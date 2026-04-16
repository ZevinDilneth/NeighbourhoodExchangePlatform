import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Chain } from '../models/Chain';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { createError } from '../middleware/errorHandler';
import { getIO } from '../socket/ioInstance';
import {
  discoverChains,
  discoverAllChains,
  getUserNames,
} from '../services/chainDiscovery';

// ─── In-memory discovery cache (per user, 60-min TTL) ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CachedChains = any[];

interface CacheEntry {
  chains: CachedChains;
  expiresAt: number;
}
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS   = 60 * 60 * 1000; // 60 minutes

function getCached(userId: string): CachedChains | null {
  const entry = discoveryCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { discoveryCache.delete(userId); return null; }
  return entry.chains;
}
function setCache(userId: string, chains: CachedChains): void {
  discoveryCache.set(userId, { chains, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Populate a chain's participant IDs with name/avatar/trustScore */
async function populateParticipants(
  participants: string[],
): Promise<{ _id: string; name: string; avatar?: string; trustScore: number }[]> {
  const nameMap = await getUserNames(participants);
  return participants.map(id => ({
    _id:        id,
    name:       nameMap.get(id)?.name       ?? 'Unknown',
    avatar:     nameMap.get(id)?.avatar,
    trustScore: nameMap.get(id)?.trustScore ?? 0,
  }));
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/chains/discover
 *
 * Runs (or returns cached) chain discovery for the requesting user.
 * Results are scoped to the user's city / neighbourhood.
 * Any newly discovered chains are persisted as 'proposed' Chain documents.
 */
export const discoverChainsForUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.userId!;

    // Check cache
    const cached = getCached(userId);
    if (cached) {
      res.json({ chains: cached, fromCache: true });
      return;
    }

    // Load user's location
    const user = await User.findById(userId).select('location').lean();
    if (!user) return next(createError('User not found', 404));

    const city          = user.location?.city;
    const neighbourhood = user.location?.neighbourhood;

    // Run graph algorithm
    const discovered = await discoverChains(userId, city, neighbourhood, 10);

    // Persist new chains (skip if an identical participant set already exists and is still proposed)
    const persisted = await Promise.all(
      discovered.map(async (dc) => {
        // Check for existing proposed chain with the same participants (order-independent)
        const sortedParticipants = [...dc.participants].sort();
        const existing = await Chain.findOne({
          status:       'proposed',
          participants: { $all: sortedParticipants, $size: sortedParticipants.length },
        });

        if (existing) return existing.toObject();

        const chain = await Chain.create({
          participants:       dc.participants,
          edges:              dc.edges,
          fairnessScore:      dc.fairnessScore,
          successProbability: dc.successProbability,
          city,
          neighbourhood,
          acceptances: dc.participants.map(uid => ({ user: uid, accepted: null })),
        });

        // Notify each participant via socket + persist notification
        const chainId = chain._id.toString();
        const chainLink = `/chains/${chainId}`;
        const participantCount = dc.participants.length;

        await Promise.all(
          dc.participants.map(async (uid) => {
            const notif = await Notification.create({
              recipient: uid,
              type:      'chain_proposed',
              title:     'We found a potential Skill Chain!',
              body:      `A ${participantCount}-person skill exchange circle was discovered for you. Check it out and opt in!`,
              link:      chainLink,
              data:      { chainId },
            });

            try {
              getIO().to(`user:${uid}`).emit('notification', {
                _id:       notif._id,
                type:      notif.type,
                title:     notif.title,
                body:      notif.body,
                link:      notif.link,
                read:      false,
                createdAt: notif.createdAt,
              });
            } catch {
              // Socket may not be initialised during tests — swallow gracefully
            }
          }),
        );

        return chain.toObject();
      }),
    );

    // Enrich with user name info before returning
    const enriched = await Promise.all(
      persisted.map(async (chain) => {
        const participantIds = chain.participants.map((p: unknown) => p!.toString());
        const populated = await populateParticipants(participantIds);
        return { ...chain, participantDetails: populated };
      }),
    );

    setCache(userId, enriched as CacheEntry['chains']);
    res.json({ chains: enriched, fromCache: false });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chains/me
 *
 * Returns all chains the requesting user is a participant of.
 * Supports ?status= filter.
 */
export const getMyChains = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status } = req.query;

    const filter: Record<string, unknown> = { participants: req.userId };
    if (status) filter.status = status;

    const chains = await Chain.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each chain with participant names
    const enriched = await Promise.all(
      chains.map(async (chain) => {
        const participantIds = chain.participants.map((p) => p.toString());
        const populated = await populateParticipants(participantIds);
        return { ...chain, participantDetails: populated };
      }),
    );

    res.json({ chains: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chains/:id
 *
 * Returns full chain detail (participants populated).
 * Only accessible to chain participants or admins.
 */
export const getChain = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chain = await Chain.findById(req.params.id).lean();
    if (!chain) return next(createError('Chain not found', 404));

    const isParticipant = chain.participants.some(p => p.toString() === req.userId);
    const isAdmin       = req.userRole === 'admin';
    if (!isParticipant && !isAdmin) return next(createError('Not authorized', 403));

    const participantIds = chain.participants.map(p => p.toString());
    const populated      = await populateParticipants(participantIds);

    res.json({ ...chain, participantDetails: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chains/:id/respond
 *
 * Body: { accepted: boolean }
 *
 * Records the user's accept/decline for a proposed chain.
 *
 * - If ALL participants accept → status becomes 'active'.
 * - If ANY participant declines → status becomes 'declined'.
 * - Invalidates the discovery cache for the declining user.
 */
export const respondToChain = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accepted } = req.body as { accepted: boolean };
    if (typeof accepted !== 'boolean') {
      return next(createError('accepted must be a boolean', 400));
    }

    const chain = await Chain.findById(req.params.id);
    if (!chain) return next(createError('Chain not found', 404));
    if (chain.status !== 'proposed') {
      return next(createError(`Chain is already ${chain.status}`, 400));
    }

    const acceptance = chain.acceptances.find(a => a.user.toString() === req.userId);
    if (!acceptance) return next(createError('You are not part of this chain', 403));

    acceptance.accepted    = accepted;
    acceptance.respondedAt = new Date();

    // Determine new status
    if (!accepted) {
      chain.status = 'declined';
      // Bust cache for all participants so they can rediscover
      chain.participants.forEach(p => discoveryCache.delete(p.toString()));
    } else {
      const allAccepted = chain.acceptances.every(a => a.accepted === true);
      if (allAccepted) {
        chain.status = 'active';

        // Notify all participants that the chain is now active
        const chainId   = chain._id.toString();
        const chainLink = `/chains/${chainId}`;
        await Promise.all(
          chain.participants.map(async (pId) => {
            const notif = await Notification.create({
              recipient: pId,
              type:      'chain_active',
              title:     'Skill Chain is Active!',
              body:      'All members have agreed — your skill exchange circle is now active. Coordinate in the chain thread.',
              link:      chainLink,
              data:      { chainId },
            });
            try {
              getIO().to(`user:${pId.toString()}`).emit('notification', {
                _id: notif._id, type: notif.type, title: notif.title,
                body: notif.body, link: notif.link, read: false, createdAt: notif.createdAt,
              });
            } catch { /* swallow */ }
          }),
        );
      }
    }

    await chain.save();

    const participantIds = chain.participants.map(p => p.toString());
    const populated      = await populateParticipants(participantIds);

    res.json({ ...chain.toObject(), participantDetails: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chains/:id/undo-accept
 *
 * Reverts the requesting user's acceptance back to null (pending).
 * - Works when chain is 'proposed' (still waiting for others) or 'active'.
 * - If the chain was 'active', it reverts back to 'proposed' so all
 *   participants know the chain needs re-confirmation.
 */
export const undoChainAcceptance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chain = await Chain.findById(req.params.id);
    if (!chain) return next(createError('Chain not found', 404));

    if (chain.status !== 'proposed' && chain.status !== 'active') {
      return next(createError(`Cannot undo — chain is already ${chain.status}`, 400));
    }

    const acceptance = chain.acceptances.find(a => a.user.toString() === req.userId);
    if (!acceptance) return next(createError('You are not part of this chain', 403));
    if (acceptance.accepted !== true) return next(createError('You have not accepted this chain', 400));

    // Revert acceptance
    acceptance.accepted    = null;
    acceptance.respondedAt = undefined;

    // If chain was already active, revert to proposed so others are informed
    if (chain.status === 'active') {
      chain.status = 'proposed';

      // Notify all other participants that the chain is back to proposed
      const chainId   = chain._id.toString();
      const chainLink = `/chains/${chainId}`;
      const undoUser  = await User.findById(req.userId).select('name').lean();
      const undoName  = undoUser?.name ?? 'A participant';

      await Promise.all(
        chain.participants
          .filter(p => p.toString() !== req.userId)
          .map(async (pId) => {
            const notif = await Notification.create({
              recipient: pId,
              type:      'chain_proposed',
              title:     'Skill Chain needs re-confirmation',
              body:      `${undoName} withdrew their acceptance. The chain is back to proposed — waiting for everyone to opt in again.`,
              link:      chainLink,
              data:      { chainId },
            });
            try {
              getIO().to(`user:${pId.toString()}`).emit('notification', {
                _id: notif._id, type: notif.type, title: notif.title,
                body: notif.body, link: notif.link, read: false, createdAt: notif.createdAt,
              });
            } catch { /* swallow */ }
          }),
      );
    }

    await chain.save();

    const participantIds = chain.participants.map(p => p.toString());
    const populated      = await populateParticipants(participantIds);
    res.json({ ...chain.toObject(), participantDetails: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/chains/:id/complete-edge
 *
 * Body: { fromUserId: string, toUserId: string }
 *
 * Marks one edge of an active chain as fulfilled.
 * When completedEdgesCount === edges.length → status becomes 'completed'.
 */
export const completeChainEdge = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chain = await Chain.findById(req.params.id);
    if (!chain) return next(createError('Chain not found', 404));
    if (chain.status !== 'active') {
      return next(createError('Chain is not active', 400));
    }

    const isParticipant = chain.participants.some(p => p.toString() === req.userId);
    if (!isParticipant) return next(createError('Not authorized', 403));

    chain.completedEdgesCount = Math.min(
      chain.edges.length,
      chain.completedEdgesCount + 1,
    );

    if (chain.completedEdgesCount >= chain.edges.length) {
      chain.status = 'completed';
    }

    await chain.save();
    res.json(chain.toObject());
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chains/stats  (admin only)
 *
 * Returns aggregate completion rates for algorithm improvement tracking.
 */
export const getChainStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.userRole !== 'admin') return next(createError('Admin only', 403));

    const [total, active, completed, declined, expired] = await Promise.all([
      Chain.countDocuments(),
      Chain.countDocuments({ status: 'active' }),
      Chain.countDocuments({ status: 'completed' }),
      Chain.countDocuments({ status: 'declined' }),
      Chain.countDocuments({ status: 'expired' }),
    ]);

    const proposed = total - active - completed - declined - expired;

    // Average chain length and fairness score across completed chains
    const completedChains = await Chain.find({ status: 'completed' })
      .select('participants fairnessScore successProbability')
      .lean();

    const avgLength = completedChains.length
      ? completedChains.reduce((s, c) => s + c.participants.length, 0) / completedChains.length
      : 0;
    const avgFairness = completedChains.length
      ? completedChains.reduce((s, c) => s + c.fairnessScore, 0) / completedChains.length
      : 0;
    const avgProbability = completedChains.length
      ? completedChains.reduce((s, c) => s + c.successProbability, 0) / completedChains.length
      : 0;

    const completionRate = total ? parseFloat(((completed / total) * 100).toFixed(1)) : 0;
    const declineRate    = total ? parseFloat(((declined  / total) * 100).toFixed(1)) : 0;

    res.json({
      totals: { total, proposed, active, completed, declined, expired },
      rates:  { completionRate, declineRate },
      averages: {
        chainLength:         parseFloat(avgLength.toFixed(1)),
        fairnessScore:       parseFloat(avgFairness.toFixed(3)),
        successProbability:  parseFloat(avgProbability.toFixed(3)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chains/admin/run-discovery  (admin only)
 *
 * Triggers a full city-wide chain discovery and persists new proposals.
 * Useful for a scheduled job or manual admin trigger.
 */
export const adminRunDiscovery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.userRole !== 'admin') return next(createError('Admin only', 403));

    const { city, neighbourhood } = req.query as { city?: string; neighbourhood?: string };

    const discovered = await discoverAllChains(city, neighbourhood, 100);
    let created = 0;
    let skipped = 0;

    for (const dc of discovered) {
      const sorted = [...dc.participants].sort();
      const exists = await Chain.findOne({
        status: 'proposed',
        participants: { $all: sorted, $size: sorted.length },
      });

      if (exists) { skipped++; continue; }

      await Chain.create({
        participants:       dc.participants,
        edges:              dc.edges,
        fairnessScore:      dc.fairnessScore,
        successProbability: dc.successProbability,
        city,
        neighbourhood,
        acceptances: dc.participants.map(uid => ({ user: uid, accepted: null })),
      });
      created++;
    }

    // Clear all discovery caches after bulk run
    discoveryCache.clear();

    res.json({ discovered: discovered.length, created, skipped });
  } catch (err) {
    next(err);
  }
};
