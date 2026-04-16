/**
 * Skill Chain Engine
 *
 * When a new "Start Exchange" is created (no postId, status open), the engine:
 *   1. Loads all other open exchanges that have no postId (pure skill-swap offers)
 *   2. Builds a directed graph:  exchangeId → [exchangeIds whose offering matches this exchange's seeking]
 *   3. Searches for simple cycles of length 2–5 containing the new exchange
 *   4. For each novel cycle (not already stored), creates a SkillChain doc
 *      and fires `chain_proposed` notifications to every member
 *
 * Matching:  token overlap between
 *   • "offering" field + tags  of exchange A
 *   • "seeking"  field + wantedSkills[].name + tags  of exchange B
 * A match fires when ≥ MIN_OVERLAP tokens are shared (case-insensitive).
 */

import { Types } from 'mongoose';
import { Exchange } from '../models/Exchange';
import { SkillChain } from '../models/SkillChain';
import { Notification } from '../models/Notification';
import { getIO } from '../socket/ioInstance';

// ── tokeniser ─────────────────────────────────────────────────────────────────
// Broad stop-word list: removes every word that carries no skill signal so that
// only true skill/domain nouns survive (guitar, cooking, gardening, coding…).
const STOP = new Set([
  // articles / pronouns / prepositions
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','during','before','after','i','my',
  'your','our','we','they','this','that','these','those','it','its',
  // generic verbs / adjectives that appear in ALL exchange posts
  'want','looking','offer','offering','provide','need','help','learn','teach',
  'share','swap','give','get','like','love','enjoy','use','make','do','can',
  'will','would','could','should','have','has','had','am','are','is','was',
  'were','be','been','being','know','show','take','come','see','let','put',
  'try','ask','feel','look','turn','call','keep','run','move','play','work',
  // generic filler words
  'skill','skills','service','services','exchange','exchanges','community',
  'anyone','someone','people','person','local','neighbourhood','neighborhood',
  'free','paid','new','good','great','well','please','happy','available',
  'interested','interest','time','experience','level','beginner','advanced',
  'intermediate','expert','basic','professional','any','all','also','just',
  'more','very','really','quite','little','lot','much','many','few','other',
  'something','anything','everything','nothing','able','willing','open','live',
]);

function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, ' ')
      .split(/[\s\-]+/)
      .map(t => t.trim())
      // min length 4 so short generic words ('get','use','run') are excluded
      .filter(t => t.length >= 4 && !STOP.has(t)),
  );
}

function offerTokens(ex: ExchangeSnap): Set<string> {
  // Include title so "Gardening Skill" in the title also matches
  const combined = [ex.title, ex.offering, ...ex.tags].join(' ');
  return tokenize(combined);
}

function seekTokens(ex: ExchangeSnap): Set<string> {
  const combined = [ex.seeking, ...ex.wantedSkillNames, ...ex.tags].join(' ');
  return tokenize(combined);
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const t of a) { if (b.has(t)) count++; }
  return count;
}

// 1 shared skill-domain token is enough because the expanded stop-word list
// and min-length-4 filter already strip all generic words, so only real skill
// nouns (guitar, gardening, coding…) survive and drive the match.
const MIN_OVERLAP = 1;

// Hard cap: at most 20 new chains created per detection run
const MAX_NEW_CHAINS = 20;

// ── lightweight snapshot loaded from DB ──────────────────────────────────────
interface ExchangeSnap {
  _id:              string;
  userId:           string;
  title:            string;
  offering:         string;
  seeking:          string;
  tags:             string[];
  wantedSkillNames: string[];
}

function snapLabel(text: string, tags: string[]): string {
  // Prefer first tag (user-chosen, already clean) then tokenized text
  if (tags.length > 0) return tags[0];
  const tokens = [...tokenize(text)];
  if (tokens.length > 0) return tokens.slice(0, 2).map(t => t[0].toUpperCase() + t.slice(1)).join(' ');
  return text.slice(0, 30);
}

// ── Cycle finder (DFS) ────────────────────────────────────────────────────────

interface Edge { from: string; to: string }

function findCycles(
  start:    string,
  graph:    Map<string, string[]>,
  maxLen:   number,
): string[][] {
  const results: string[][] = [];

  const dfs = (path: string[]) => {
    const last = path[path.length - 1];
    const neighbours = graph.get(last) ?? [];

    for (const next of neighbours) {
      if (next === start && path.length >= 2) {
        // complete cycle
        results.push([...path]);
        continue;
      }
      if (path.includes(next)) continue;  // already visited — no revisit
      if (path.length >= maxLen) continue; // too long
      path.push(next);
      dfs(path);
      path.pop();
    }
  };

  dfs([start]);
  return results;
}

/** Canonical key for a cycle (rotate + sort so ABC == BCA == CAB) */
function cycleKey(ids: string[]): string {
  const rotations = ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)]);
  return rotations.map(r => r.join(',')).sort()[0];
}

// ── Notification helper ───────────────────────────────────────────────────────

async function notifyChainMember(
  recipientId: string,
  exchangeId:  string,
): Promise<void> {
  const link = `/exchanges/${exchangeId}`;

  await Notification.create({
    recipient: new Types.ObjectId(recipientId),
    type:  'chain_proposed',
    title: 'Potential Skill Chain found!',
    body:  'We found a potential skill chain! Check it out.',
    link,
    read:  false,
    data:  { exchangeId },
  });

  try {
    const io = getIO();
    io.to(`user_${recipientId}`).emit('notification', {
      type:  'chain_proposed',
      title: 'Potential Skill Chain found!',
      body:  'We found a potential skill chain! Check it out.',
      link,
    });
  } catch { /* socket optional */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run fire-and-forget after a new open exchange (no postId) is created.
 */
export function detectAndCreateChains(
  newExchangeId: string,
  authorId:      string,
): void {
  void (async () => {
    try {
      // 1. Load all open exchanges without a postId (pure Start Exchange offers)
      const rawExchanges = await Exchange.find({
        status:  'open',
        postId:  { $exists: false },
      })
        .select('_id requester title offering seeking tags wantedSkills')
        .lean() as Array<{
          _id: Types.ObjectId;
          requester: Types.ObjectId;
          title: string;
          offering: string;
          seeking: string;
          tags?: string[];
          wantedSkills?: Array<{ name?: string }>;
        }>;

      if (rawExchanges.length < 2) return;

      // 2. Build snapshots
      const snaps: ExchangeSnap[] = rawExchanges.map(ex => ({
        _id:              String(ex._id),
        userId:           String(ex.requester),
        title:            ex.title    ?? '',
        offering:         ex.offering ?? '',
        seeking:          ex.seeking  ?? '',
        tags:             (ex.tags ?? []).map(t => t.toLowerCase()),
        wantedSkillNames: (ex.wantedSkills ?? []).map(ws => ws.name ?? '').filter(Boolean),
      }));

      const snapById = new Map(snaps.map(s => [s._id, s]));

      // 3. Build adjacency: A → B if A's offering matches B's seeking
      //    AND they belong to different users (no self-chains)
      const graph = new Map<string, string[]>();
      for (const a of snaps) {
        const aOffer = offerTokens(a);
        const linked: string[] = [];
        for (const b of snaps) {
          if (b._id === a._id) continue;
          if (b.userId === a.userId) continue;     // same user — skip
          const bSeek = seekTokens(b);
          if (overlap(aOffer, bSeek) >= MIN_OVERLAP) {
            linked.push(b._id);
          }
        }
        if (linked.length > 0) graph.set(a._id, linked);
      }

      // 4. Find cycles containing the new exchange (len 3 only — classic A→B→C→A)
      //    maxLen=3 keeps the graph tractable; raise to 4 if you want quad-chains.
      const cycles = findCycles(newExchangeId, graph, 3);
      if (cycles.length === 0) return;

      // 5. Deduplicate against existing chains
      const existingChains = await SkillChain.find({
        'members.exchange': new Types.ObjectId(newExchangeId),
        status: { $in: ['proposed', 'active'] },
      }).lean();
      const existingKeys = new Set(
        existingChains.map(ch => cycleKey(ch.members.map(m => String(m.exchange)))),
      );

      // 6. Persist novel chains and notify (hard cap: MAX_NEW_CHAINS per run)
      let created = 0;
      for (const cycle of cycles) {
        if (created >= MAX_NEW_CHAINS) break;

        const key = cycleKey(cycle);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        // All users in the cycle must be distinct
        const userIds = cycle.map(eid => snapById.get(eid)?.userId ?? '');
        if (new Set(userIds).size !== cycle.length) continue;

        const members = cycle.map(eid => {
          const snap = snapById.get(eid)!;
          return {
            exchange:   new Types.ObjectId(eid),
            user:       new Types.ObjectId(snap.userId),
            offering:   snapLabel(snap.offering, snap.tags),
            seeking:    snapLabel(snap.seeking,   snap.tags),
            status:     'pending' as const,
          };
        });

        const chain = await SkillChain.create({ members, status: 'proposed' });
        created++;

        for (const m of chain.members) {
          await notifyChainMember(String(m.user), String(m.exchange));
        }
      }
    } catch (err) {
      console.error('[SkillChainEngine] error:', err);
    }
  })();
}
