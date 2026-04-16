import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Exchange } from '../models/Exchange';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { calculateFairness, FairnessResult } from '../services/fairnessCalculator';
import { updateUserRanking } from '../services/rankingService';
import {
  calculateSkillCEU,
  calculateToolCEU,
  calculateToolGiftingCEU,
  ProficiencyLevel,
} from '../services/ceuCalculator';
import { containsProfanity } from '../utils/contentFilter';
import { uploadToS3, resolveAvatarUrl } from '../services/storage';
import { getIO } from '../socket/ioInstance';
import { scanImageBuffer, scanVideoBuffer } from '../services/moderation';
import Meeting from '../models/Meeting';
import { notifyInterestedUsersForExchange } from '../services/interestEngine';
import { detectAndCreateChains } from '../services/skillChainEngine';
import { SkillChain } from '../models/SkillChain';
import { Notification } from '../models/Notification';

export const getExchanges = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20, type, status, lng, lat, radius = 10, postId, sourceId, q } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (postId) filter.postId = postId;
    if (sourceId) filter.sourceExchangeId = sourceId;

    // Full-text search across title, offering, seeking, tags + location type (online/physical)
    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim().toLowerCase();
      if (term === 'online') {
        filter.onlineLink = { $exists: true, $ne: '' };
      } else if (term === 'physical' || term === 'in-person' || term === 'in person') {
        filter.onlineLink = { $in: [null, '', undefined] };
        (filter as Record<string, unknown>)['location.coordinates'] = { $exists: true };
      } else {
        filter.$or = [
          { title:    { $regex: term, $options: 'i' } },
          { offering: { $regex: term, $options: 'i' } },
          { seeking:  { $regex: term, $options: 'i' } },
          { tags:     { $elemMatch: { $regex: term, $options: 'i' } } },
          { locationName: { $regex: term, $options: 'i' } },
        ];
      }
    }

    if (lng && lat) {
      filter.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius) * 1000,
        },
      };
    }

    const exchanges = await Exchange.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('requester provider', 'name avatar rating isVerified')
      .lean();

    const total = await Exchange.countDocuments(filter);

    const resolveUser = (u: unknown) => {
      if (!u || typeof u !== 'object') return u;
      const usr = u as Record<string, unknown>;
      return { ...usr, avatar: resolveAvatarUrl(usr.avatar as string | undefined) ?? usr.avatar };
    };

    const resolved = exchanges.map(ex => ({
      ...ex,
      images:             ((ex.images        as string[] | undefined) ?? []).map(resolveAvatarUrl).filter((u): u is string => !!u),
      seekingImages:      ((ex.seekingImages as string[] | undefined) ?? []).map(resolveAvatarUrl).filter((u): u is string => !!u),
      seekingDescription: (ex as Record<string, unknown>).seekingDescription ?? undefined,
      requester:          resolveUser((ex as Record<string, unknown>).requester),
      provider:           resolveUser((ex as Record<string, unknown>).provider),
    }));

    res.json({ exchanges: resolved, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

export const createExchange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type, title, description, offering, seeking, ceuValue,
      tags, latitude, longitude, postId, offeringPostId,
      offeringSkillName,
      // Which of the provider's wanted skills the responder is offering for (Request Skill Swap)
      offeringForSkill,
      locationName,
      onlineLink,
      // CEU formula inputs (sent by client alongside ceuValue for server validation)
      hours, sessions, proficiency,
      marketValue, days, riskFactor, isGift,
      rarityBonus, demandBonus,
      // Schedule fields
      scheduledDate, startDate, timeStart, timeEnd, recurring,
      // Tool-exchange fields (requester's offered tool)
      toolCondition, toolMarketValue, toolSpecs,
      // Seeking-tool fields (provider's tool, supplied by client for non-linked exchanges)
      seekingCondition: seekingConditionBody,
      seekingDescription: seekingDescriptionBody,
      // Standalone rich description of what the requester is offering
      offeringDescription: offeringDescriptionBody,
      // Borrow deposit (client pre-calculates; server validates independently)
      depositAmount: clientDepositAmount,
      // Wanted skills array for skill/service exchanges
      wantedSkills: wantedSkillsBody,
      // Link back to the Start Exchange this response was created from
      sourceExchangeId,
    } = req.body;

    // ── Server-side CEU calculation ───────────────────────────────────────────
    // Skill-for-Skill exchanges are free — no CEU charged.
    // Tool and Hybrid exchanges compute cost from formula inputs.
    let cost: number;

    if (type === 'skill') {
      cost = 0;
    } else {
      const numSessions = Math.max(1, Number(sessions) || 1);
      if (type === 'tool' && marketValue) {
        const mv = Math.max(0, Number(marketValue) || 0);
        if (isGift === true || isGift === 'true') {
          cost = calculateToolGiftingCEU(mv);
        } else {
          const d  = Math.max(1, Number(days) || 1);
          const rf = Math.max(0, Number(riskFactor) || 0);
          cost = calculateToolCEU(mv, d, rf);
        }
      } else if (hours && proficiency) {
        const h   = Math.max(0.5, Number(hours) || 1);
        const rb  = Math.max(0, Number(rarityBonus)  || 0);
        const db  = Math.max(0, Number(demandBonus)  || 0);
        const lvl = (String(proficiency).toLowerCase()) as ProficiencyLevel;
        const perSession = calculateSkillCEU(h, lvl, rb, db);
        cost = perSession * numSessions;
      } else if (marketValue) {
        const mv = Math.max(0, Number(marketValue) || 0);
        if (isGift === true || isGift === 'true') {
          cost = calculateToolGiftingCEU(mv);
        } else {
          const d  = Math.max(1, Number(days) || 1);
          const rf = Math.max(0, Number(riskFactor) || 0);
          cost = calculateToolCEU(mv, d, rf);
        }
      } else {
        cost = Math.max(1, Number(ceuValue) || 1);
      }
    }

    // ── Server-side deposit calculation for borrow requests ─────────────────
    const DEPOSIT_RATES: Record<string, number> = { New: 0.30, Excellent: 0.25, Good: 0.20, Fair: 0.15 };
    let deposit = 0;
    if (type === 'tool' && !(isGift === true || isGift === 'true') && toolMarketValue) {
      const mv = Math.max(0, Number(toolMarketValue) || 0);
      const rate = DEPOSIT_RATES[String(toolCondition)] ?? 0.20;
      deposit = Math.round(mv * rate);
    }
    // Use client value as a floor if server can't determine (e.g. no market value sent)
    if (deposit === 0 && clientDepositAmount) {
      deposit = Math.max(0, Math.round(Number(clientDepositAmount) || 0));
    }

    // All exchange types require video verification
    const requester = await User.findById(req.userId);
    if (!requester) return next(createError('User not found', 404));

    if (!requester.videoIntro) {
      return next(createError(
        'VIDEO_VERIFICATION_REQUIRED',
        403
      ));
    }

    const currentBalance = requester.ceuBalance ?? 0;
    // Only the borrow deposit must be available upfront (it's collateral).
    // The exchange CEU cost is not checked here — the provider decides whether
    // to accept the offer; deduction happens at acceptance, not at request time.
    if (deposit > 0 && currentBalance < deposit) {
      return next(createError(
        `Not enough CEU for the borrow deposit. You need ${deposit} CEU but only have ${currentBalance}.`,
        400
      ));
    }

    // Content moderation
    if (containsProfanity(title, description, offering, seeking)) {
      return next(createError('Your exchange contains inappropriate content. Please revise and try again.', 400));
    }

    // ── Media uploads — images and/or videos, scanned by ML model then S3 ────
    // req.files can be an array (from .array()) or a dict (from .fields())
    const filesDict = req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
    const offeringFiles: Express.Multer.File[] = Array.isArray(filesDict)
      ? filesDict                          // legacy .array('images') fallback
      : (filesDict?.images ?? []);         // .fields() → { images: [...], seekingMedia: [...] }
    const seekingFiles: Express.Multer.File[] = Array.isArray(filesDict)
      ? []
      : (filesDict?.seekingMedia ?? []);

    const uploadFiles = async (files: Express.Multer.File[], prefix: string): Promise<string[]> => {
      const keys: string[] = [];
      for (const file of files) {
        const isVideo = file.mimetype.startsWith('video/');
        if (isVideo) {
          const videoExtMap: Record<string, string> = {
            'video/mp4': 'mp4', 'video/webm': 'webm',
            'video/ogg': 'ogv', 'video/quicktime': 'mov',
          };
          const ext = videoExtMap[file.mimetype] ?? 'mp4';
          const scan = await scanVideoBuffer(file.buffer, ext);
          if (!scan.safe) {
            return next(createError(
              `Your video contains NSFW material and cannot be uploaded (${scan.reason ?? 'explicit content'}).`,
              422,
            )) as never;
          }
          const key = `exchange-videos/${req.userId}-${Date.now()}-${prefix}-${keys.length}.${ext}`;
          await uploadToS3(key, file.buffer, file.mimetype);
          keys.push(key);
        } else {
          const scan = await scanImageBuffer(file.buffer);
          if (!scan.safe) {
            return next(createError(
              `One of your images contains NSFW material and cannot be uploaded (${scan.reason ?? 'explicit content'}).`,
              422,
            )) as never;
          }
          const ext = file.mimetype.includes('png') ? 'png'
            : file.mimetype.includes('webp') ? 'webp'
            : file.mimetype.includes('gif')  ? 'gif'
            : 'jpg';
          const key = `exchange-images/${req.userId}-${Date.now()}-${prefix}-${keys.length}.${ext}`;
          await uploadToS3(key, file.buffer, file.mimetype);
          keys.push(key);
        }
      }
      return keys;
    };

    const imageKeys = await uploadFiles(offeringFiles, 'offer');
    const seekingUploadKeys = await uploadFiles(seekingFiles, 'seek');

    // If offeringPostId given, copy that post's images into exchange.images
    if (imageKeys.length === 0 && offeringPostId) {
      const offeringPost = await Post.findById(offeringPostId).select('images').lean();
      if (offeringPost?.images?.length) {
        imageKeys.push(...(offeringPost.images as string[]));
      }
    }

    // If user selected a profile skill by name (Request Skill Swap modal), auto-copy images
    // from their most recent skill post matching that title — so the Offering container shows media
    if (imageKeys.length === 0 && offeringSkillName) {
      const skillPost = await Post.findOne({
        author: req.userId,
        type: 'skill',
        title: offeringSkillName,
      }).select('images').sort({ createdAt: -1 }).lean();
      if (skillPost?.images?.length) {
        imageKeys.push(...(skillPost.images as string[]));
      }
    }

    // Primary offering-image source for Request Skill Swap:
    // Copy the provider's reference photos (source exchange seekingImages slice for the selected
    // wanted skill) into the response exchange's images — these are the "Provider's reference photos"
    // shown in the modal, and they should appear in the Offering container on ExchangeDetail.
    if (imageKeys.length === 0 && sourceExchangeId && offeringForSkill) {
      const srcEx = await Exchange.findById(sourceExchangeId)
        .select('seekingImages wantedSkills')
        .lean() as Record<string, unknown> | null;
      if (srcEx) {
        const allSeekingImgs = (srcEx.seekingImages as string[] | undefined) ?? [];
        const wantedSkills   = (srcEx.wantedSkills  as Array<{ name: string; imageCount?: number }> | undefined) ?? [];
        // Find the skill the responder selected and slice its image chunk
        let cursor = 0;
        for (const sk of wantedSkills) {
          const count = sk.imageCount ?? 0;
          if (sk.name === offeringForSkill) {
            const slice = allSeekingImgs.slice(cursor, cursor + count);
            imageKeys.push(...slice);
            break;
          }
          cursor += count;
        }
        // Fallback: if skill not found by name (single skill / old data), use all seekingImages
        if (imageKeys.length === 0 && allSeekingImgs.length) {
          imageKeys.push(...allSeekingImgs);
        }
      }
    }

    // When linked to a post, copy the post's images + description into seekingImages/seekingDescription
    // (the post represents what the requester is SEEKING).
    // Also capture the post's author so they become the designated provider.
    const seekingImageKeys: string[] = [...seekingUploadKeys];
    // Seed from client body; linked-post data overrides below if postId is present
    let seekingDescription: string | undefined = seekingDescriptionBody || undefined;
    let seekingCondition: string | undefined  = seekingConditionBody  || undefined;
    let linkedPostAuthor: unknown;
    let seekingMarketValue: number | undefined;
    let seekingSpecs: { name: string; details: string[] }[] | undefined;
    if (postId) {
      const linkedPost = await Post.findById(postId).select('images content author ceuRate condition marketValue specifications').lean();
      if (linkedPost?.images?.length) {
        seekingImageKeys.push(...(linkedPost.images as string[]));
      }
      if ((linkedPost as Record<string, unknown>)?.content) {
        seekingDescription = (linkedPost as Record<string, unknown>).content as string;
      }
      if (linkedPost?.author) {
        linkedPostAuthor = linkedPost.author;
      }
      if ((linkedPost as Record<string, unknown>)?.marketValue) {
        seekingMarketValue = (linkedPost as Record<string, unknown>).marketValue as number;
      } else if ((linkedPost as Record<string, unknown>)?.ceuRate) {
        seekingMarketValue = (linkedPost as Record<string, unknown>).ceuRate as number;
      }
      if ((linkedPost as Record<string, unknown>)?.condition) {
        seekingCondition = (linkedPost as Record<string, unknown>).condition as string;
      }
      if ((linkedPost as Record<string, unknown>)?.specifications) {
        seekingSpecs = (linkedPost as Record<string, unknown>).specifications as { name: string; details: string[] }[];
      }
    }

    // When this is a response to a Start Exchange, copy the source exchange's
    // offering description + images into this exchange's seeking fields
    // so the Seeking card in ExchangeDetail shows the full provider info.
    // Also designate the source exchange's requester as the provider of this
    // response exchange so they get Decline / Accept Request UI.
    let sourceExRequester: unknown = null;
    if (sourceExchangeId && !postId) {
      const sourceEx = await Exchange.findById(sourceExchangeId)
        .select('requester offering offeringDescription images')
        .lean() as Record<string, unknown> | null;
      if (sourceEx) {
        // Remember the original requester so we can set them as provider below
        sourceExRequester = sourceEx.requester;
        // Copy offering images as seeking images (if no seeking images already)
        if (!seekingImageKeys.length && Array.isArray(sourceEx.images) && (sourceEx.images as string[]).length) {
          seekingImageKeys.push(...(sourceEx.images as string[]));
        }
        // Copy offering description as seeking description (if not already set)
        if (!seekingDescription) {
          if (sourceEx.offeringDescription) {
            seekingDescription = sourceEx.offeringDescription as string;
          } else if (typeof sourceEx.offering === 'string') {
            // Fallback: extract description from the offering string ("Title (Prof) — desc")
            const dashIdx = (sourceEx.offering as string).indexOf(' — ');
            if (dashIdx > -1) {
              const extracted = (sourceEx.offering as string).slice(dashIdx + 3).trim();
              if (extracted) seekingDescription = extracted;
            }
          }
        }
      }
    }

    const exchangeData: Record<string, unknown> = {
      requester: req.userId,
      type,
      title,
      description,
      offering,
      ...(offeringDescriptionBody ? { offeringDescription: offeringDescriptionBody } : {}),
      seeking,
      ceuValue: cost,
      tags: tags || [],
      images: imageKeys,
      ...(locationName   ? { locationName }   : {}),
      ...(onlineLink    ? { onlineLink }    : {}),
      ...(scheduledDate ? { scheduledDate } : {}),
      ...(startDate     ? { startDate }     : {}),
      ...(timeStart     ? { timeStart }     : {}),
      ...(timeEnd       ? { timeEnd }       : {}),
      ...(recurring     ? { recurring }     : {}),
      ...(sessions      ? { sessions: Number(sessions) } : {}),
      ...(seekingImageKeys.length ? { seekingImages: seekingImageKeys } : {}),
      ...(seekingDescription    ? { seekingDescription }               : {}),
      ...(toolCondition   ? { toolCondition }   : {}),
      ...(toolMarketValue != null && toolMarketValue !== '' ? { toolMarketValue: Number(toolMarketValue) } : {}),
      ...(toolSpecs       ? { toolSpecs }       : {}),
      ...(seekingMarketValue != null ? { seekingMarketValue } : {}),
      ...(seekingSpecs       ? { seekingSpecs }    : {}),
      ...(seekingCondition   ? { seekingCondition } : {}),
      ...(postId         ? { postId }         : {}),
      ...(offeringPostId      ? { offeringPostId }      : {}),
      ...(sourceExchangeId    ? { sourceExchangeId }    : {}),
      // Designate the provider: source-exchange requester (for skill-swap responses) takes
      // priority; otherwise fall back to the linked post's author.
      ...(sourceExRequester ? { provider: sourceExRequester }
        : linkedPostAuthor  ? { provider: linkedPostAuthor }
        : {}),
      // Borrow deposit — held until tool is returned
      ...(deposit > 0 ? { depositAmount: deposit } : {}),
      // Wanted skills for skill/service exchanges
      ...(wantedSkillsBody ? { wantedSkills: typeof wantedSkillsBody === 'string' ? JSON.parse(wantedSkillsBody) : wantedSkillsBody } : {}),
    };

    if (latitude && longitude) {
      exchangeData.location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    const exchange = await Exchange.create(exchangeData);

    // Increment requestCount on the linked post so hot-sort reflects demand
    if (postId) {
      await Post.findByIdAndUpdate(postId, { $inc: { requestCount: 1 } });
    }

    // ── Link orphan Meeting record to this exchange ────────────────────────
    // When the requester created a Daily.co room during CreateExchange, the
    // Meeting doc had no exchangeId (exchange didn't exist yet).  Now that the
    // exchange exists, link the room so both parties share the same room.
    if (onlineLink) {
      // onlineLink is "https://neighbourhood-app.daily.co/nex-abc1234"
      const roomId = onlineLink.split('/').pop();
      if (roomId) {
        await Meeting.findOneAndUpdate(
          { roomId, $or: [{ exchangeId: { $exists: false } }, { exchangeId: null }] },
          { exchangeId: exchange._id },
        ).catch(() => {/* ignore — room may not exist in DB yet */});
      }
    }

    // Deduct only the borrow deposit upfront (held as collateral).
    // The exchange CEU cost is deducted when the provider accepts.
    if (deposit > 0) {
      await User.findByIdAndUpdate(req.userId, { $inc: { ceuBalance: -deposit } });
    }
    const newCeuBalance = currentBalance - deposit;

    const populated = await exchange.populate('requester', 'name avatar rating');
    const exObj = populated.toObject() as Record<string, unknown>;
    exObj.images        = ((exObj.images        as string[] | undefined) ?? []).map(resolveAvatarUrl).filter(Boolean);
    exObj.seekingImages = ((exObj.seekingImages as string[] | undefined) ?? []).map(resolveAvatarUrl).filter(Boolean);

    // Fire-and-forget: notify users whose interest vector matches this exchange.
    // Only run for new "Start Exchange" requests visible to the community (no sourceExchangeId).
    if (!sourceExchangeId) {
      const requesterName = (exObj.requester as Record<string, any>)?.name ?? 'Someone';
      const parsedWanted = (exchangeData.wantedSkills as Array<{ name: string; description?: string }> | undefined) ?? [];
      const parsedTags   = (exchangeData.tags as string[] | undefined) ?? [];
      notifyInterestedUsersForExchange(
        String(exchange._id),
        req.userId!,
        requesterName,
        String(exchangeData.title ?? ''),
        String(exchangeData.description ?? ''),
        String(exchangeData.seeking ?? ''),
        parsedWanted,
        parsedTags,
      );

      // Fire-and-forget: detect and create skill chains involving this exchange
      detectAndCreateChains(String(exchange._id), req.userId!);
    }

    res.status(201).json({ ...exObj, newCeuBalance });
  } catch (err) {
    next(err);
  }
};

export const getExchange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const exchange = await Exchange.findById(req.params.id)
      .populate('requester provider', 'name avatar rating bio skills isVerified')
      .populate('applications.applicant', 'name avatar rating isVerified')
      .lean();

    if (!exchange) return next(createError('Exchange not found', 404));

    const ex = exchange as Record<string, unknown>;

    // Resolve S3 keys → signed URLs (same as getExchanges list)
    let images        = ((ex.images        as string[] | undefined) ?? []).map(resolveAvatarUrl).filter((u): u is string => !!u);
    const seekingImages = ((ex.seekingImages as string[] | undefined) ?? []).map(resolveAvatarUrl).filter((u): u is string => !!u);

    // ── Offering image fallback ───────────────────────────────────────────────
    // If no offering images were uploaded when the exchange was created, auto-look
    // up the requester's most recent skill post whose title matches the offering
    // and use those images — so the Offering container always has media when available.
    if (images.length === 0 && ex.type !== 'tool') {
      const rawOffering = (ex.offering as string | undefined) ?? '';
      // Strip "(Proficiency) — Description" suffix to get the bare skill name
      const offeringTitle = rawOffering.split(' (')[0].split(' — ')[0].trim();
      const requesterId =
        ex.requester && typeof ex.requester === 'object'
          ? (ex.requester as Record<string, unknown>)._id
          : ex.requester;
      if (offeringTitle && requesterId) {
        const skillPost = await Post.findOne({
          author: requesterId,
          type: 'skill',
          title: offeringTitle,
        })
          .select('images')
          .sort({ createdAt: -1 })
          .lean();
        if (skillPost?.images?.length) {
          images = (skillPost.images as string[]).map(resolveAvatarUrl).filter((u): u is string => !!u);
        }
      }
    }

    const resolveUser = (u: unknown) => {
      if (!u || typeof u !== 'object') return u;
      const usr = u as Record<string, unknown>;
      return { ...usr, avatar: resolveAvatarUrl(usr.avatar as string | undefined) ?? usr.avatar };
    };

    // ── Backfill provider for existing skill-swap response exchanges ─────────
    // Exchanges created via "Request Skill Swap" before the server automatically
    // set provider have no provider field.  Detect by sourceExchangeId + no
    // postId + no provider, then look up the source exchange's requester and
    // persist it so the original requester sees Decline / Accept Request UI.
    if (ex.sourceExchangeId && !ex.postId && !ex.provider) {
      const srcEx = await Exchange.findById(ex.sourceExchangeId)
        .populate('requester', 'name avatar rating bio skills isVerified')
        .lean() as Record<string, unknown> | null;
      if (srcEx?.requester) {
        const srcRequesterId =
          typeof srcEx.requester === 'object'
            ? (srcEx.requester as Record<string, unknown>)._id
            : srcEx.requester;
        const thisRequesterId =
          ex.requester && typeof ex.requester === 'object'
            ? (ex.requester as Record<string, unknown>)._id
            : ex.requester;
        if (String(srcRequesterId) !== String(thisRequesterId)) {
          // Persist to DB so future reads skip this lookup
          await Exchange.updateOne({ _id: ex._id }, { provider: srcRequesterId });
          ex.provider = srcEx.requester; // already populated
        }
      }
    }

    // Strip private location data outside the 24-hour reveal window
    const isPrivateTag = ((ex.tags as string[] | undefined) ?? []).includes('private');
    let locationPayload = ex.location;
    let locationNamePayload = ex.locationName;
    if (isPrivateTag) {
      const scheduledMs = ex.scheduledDate
        ? new Date(ex.scheduledDate as string).getTime()
        : ex.startDate
          ? new Date(ex.startDate as string).getTime()
          : null;
      const WINDOW_MS = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const revealed = scheduledMs !== null
        && now >= scheduledMs - WINDOW_MS
        && now <= scheduledMs + WINDOW_MS;
      if (!revealed) {
        locationPayload = null;
        locationNamePayload = null;
      }
    }

    res.json({ ...ex, images, seekingImages, location: locationPayload, locationName: locationNamePayload, requester: resolveUser(ex.requester), provider: resolveUser(ex.provider) });
  } catch (err) {
    next(err);
  }
};

export const respondToExchange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      status: 'open',
    });

    if (!exchange) return next(createError('Exchange not found or not open', 404));

    if (exchange.requester.toString() === req.userId) {
      return next(createError('Cannot respond to your own exchange', 400));
    }

    // Only the designated provider can accept directly.
    // For skill-swap response exchanges (sourceExchangeId set, no postId) that
    // were created before the server auto-set the provider, backfill it now.
    if (!exchange.provider && exchange.sourceExchangeId && !exchange.postId) {
      const srcEx = await Exchange.findById(exchange.sourceExchangeId).select('requester').lean() as Record<string, unknown> | null;
      if (srcEx?.requester && String(srcEx.requester) !== String(exchange.requester)) {
        exchange.provider = srcEx.requester as typeof exchange.provider;
        await Exchange.updateOne({ _id: exchange._id }, { provider: srcEx.requester });
      }
    }
    if (!exchange.provider) {
      return next(createError('This exchange has no designated provider. Use the application flow instead.', 400));
    }
    if (exchange.provider.toString() !== req.userId) {
      return next(createError('Only the designated provider can accept this exchange', 403));
    }

    // Video verification required for all exchange types
    const responder = await User.findById(req.userId).select('videoIntro').lean();
    if (!responder?.videoIntro) {
      return next(createError('VIDEO_VERIFICATION_REQUIRED', 403));
    }
    exchange.status = 'pending';

    // SRS 5.2 — provider may offer a different CEU value when they respond.
    // If omitted, default to the requester's posted ceuValue (symmetric exchange).
    const providerCeu = req.body.providerCeuValue
      ? Math.max(0, Number(req.body.providerCeuValue))
      : exchange.ceuValue;

    exchange.providerCeuValue = providerCeu;

    // Run full fairness algorithm: requester (A) vs provider (B)
    // For tool exchanges, blend market values into the score
    const fairness: FairnessResult = calculateFairness(
      exchange.ceuValue,
      providerCeu,
      exchange.type === 'tool' ? (exchange.toolMarketValue ?? undefined)    : undefined,
      exchange.type === 'tool' ? (exchange.seekingMarketValue ?? undefined) : undefined,
    );
    exchange.fairnessScore       = fairness.score;
    exchange.fairnessLabel       = fairness.label;
    exchange.fairnessSuggestions = fairness.suggestions;

    await exchange.save();

    // Settle CEU now that the provider has accepted:
    //   • Deduct the exchange cost from the requester
    //   • Credit the same amount to the provider
    if (exchange.ceuValue > 0) {
      await User.findByIdAndUpdate(exchange.requester, { $inc: { ceuBalance: -exchange.ceuValue } });
      await User.findByIdAndUpdate(req.userId,         { $inc: { ceuBalance:  exchange.ceuValue } });
    }

    const populated = await exchange.populate('requester provider', 'name avatar rating isVerified');
    const popObj = populated.toObject() as Record<string, any>;
    if (popObj.requester?.avatar) popObj.requester.avatar = resolveAvatarUrl(popObj.requester.avatar);
    if (popObj.provider?.avatar) popObj.provider.avatar = resolveAvatarUrl(popObj.provider.avatar);

    // Return exchange + full fairness result (including suggestions) so the client
    // can display the panel immediately without a second request.
    res.json({ ...popObj, fairness });
  } catch (err) {
    next(err);
  }
};

export const updateExchangeStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;
    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) return next(createError('Exchange not found', 404));

    const isParty =
      exchange.requester.toString() === req.userId ||
      exchange.provider?.toString() === req.userId;

    if (!isParty) return next(createError('Not authorized', 403));

    exchange.status = status;

    if (status === 'completed') {
      exchange.completedDate = new Date();
      await User.findByIdAndUpdate(exchange.requester, { $inc: { exchangeCount: 1 } });
      if (exchange.provider) {
        await User.findByIdAndUpdate(exchange.provider, { $inc: { exchangeCount: 1 } });
      }
      // SRS 5.4 — update trust scores for both parties after completion
      const rankingJobs = [updateUserRanking(exchange.requester.toString())];
      if (exchange.provider) {
        rankingJobs.push(updateUserRanking(exchange.provider.toString()));
      }
      await Promise.all(rankingJobs);
    }

    if (status === 'cancelled') {
      const prevStatus    = exchange.status; // status before this update
      const providerPaid  = ['pending', 'active'].includes(prevStatus) && exchange.provider;
      const ceuCost       = exchange.ceuValue ?? 0;
      const depositHeld   = exchange.depositAmount ?? 0;

      // Always refund the deposit (was deducted upfront as collateral)
      let requesterRefund = depositHeld;

      // Only refund/clawback the exchange cost if it was already settled (provider had accepted)
      if (providerPaid && ceuCost > 0) {
        requesterRefund += ceuCost;
        // Clawback from provider
        await User.findByIdAndUpdate(exchange.provider, { $inc: { ceuBalance: -ceuCost } });
      }

      if (requesterRefund > 0) {
        await User.findByIdAndUpdate(exchange.requester, { $inc: { ceuBalance: requesterRefund } });
      }
    }

    if (status === 'completed' && (exchange.depositAmount ?? 0) > 0) {
      // Return the borrow deposit to the requester — tool was returned in good condition
      await User.findByIdAndUpdate(exchange.requester, { $inc: { ceuBalance: exchange.depositAmount! } });
    }

    await exchange.save();
    res.json(exchange);
  } catch (err) {
    next(err);
  }
};

export const reviewExchange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rating } = req.body;
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return next(createError('Rating must be between 1 and 5', 400));
    }

    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) return next(createError('Exchange not found', 404));
    if (exchange.status !== 'completed') {
      return next(createError('Can only review completed exchanges', 400));
    }

    const isRequester = exchange.requester.toString() === req.userId;
    const isProvider  = exchange.provider?.toString() === req.userId;
    if (!isRequester && !isProvider) return next(createError('Not authorized', 403));

    if (isRequester) {
      if (exchange.requesterRating) return next(createError('You have already submitted a review', 400));
      exchange.requesterRating = numRating;
      // Update provider's aggregate rating
      if (exchange.provider) {
        const providerUser = await User.findById(exchange.provider);
        if (providerUser) {
          const newCount  = (providerUser.reviewCount ?? 0) + 1;
          const newRating = ((providerUser.rating ?? 0) * (providerUser.reviewCount ?? 0) + numRating) / newCount;
          providerUser.rating      = Math.round(newRating * 10) / 10;
          providerUser.reviewCount = newCount;
          await providerUser.save();
        }
      }
    } else {
      if (exchange.providerRating) return next(createError('You have already submitted a review', 400));
      exchange.providerRating = numRating;
      // Update requester's aggregate rating
      const requesterUser = await User.findById(exchange.requester);
      if (requesterUser) {
        const newCount  = (requesterUser.reviewCount ?? 0) + 1;
        const newRating = ((requesterUser.rating ?? 0) * (requesterUser.reviewCount ?? 0) + numRating) / newCount;
        requesterUser.rating      = Math.round(newRating * 10) / 10;
        requesterUser.reviewCount = newCount;
        await requesterUser.save();
      }
    }

    await exchange.save();
    res.json(exchange);
  } catch (err) {
    next(err);
  }
};

export const sendExchangeMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { content, parentId } = req.body;
    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) return next(createError('Exchange not found', 404));

    const isParty =
      exchange.requester.toString() === req.userId ||
      exchange.provider?.toString() === req.userId;

    if (!isParty) return next(createError('Not authorized', 403));

    // Phone verification required to message
    const sender = await User.findById(req.userId).select('videoIntro isPhoneVerified').lean();
    if (!(sender as Record<string, unknown>)?.isPhoneVerified) {
      return next(createError('PHONE_VERIFICATION_REQUIRED', 403));
    }
    // Video verification also required for exchange messages
    if (!sender?.videoIntro) {
      return next(createError('VIDEO_VERIFICATION_REQUIRED', 403));
    }

    // Content moderation — skip check for system location messages
    if (!content.startsWith('__LOCATION__:') && containsProfanity(content)) {
      return next(createError('Your message contains inappropriate content. Please revise and try again.', 400));
    }

    exchange.messages.push({
      sender: req.userId as unknown as typeof exchange.messages[0]['sender'],
      content,
      timestamp: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(parentId ? { parentId: parentId as any } : {}),
    } as typeof exchange.messages[0]);

    await exchange.save();

    // Broadcast new message to both parties viewing the exchange in real-time
    const newMsg = exchange.messages[exchange.messages.length - 1];
    try {
      getIO().to(`exchange:${exchange._id}`).emit('exchange-message', newMsg);
    } catch {}

    res.json({ message: 'Message sent' });
  } catch (err) {
    next(err);
  }
};

export const deleteExchangeMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) return next(createError('Exchange not found', 404));

    const isParty =
      exchange.requester.toString() === req.userId ||
      exchange.provider?.toString() === req.userId;
    if (!isParty) return next(createError('Not authorized', 403));

    const msgIndex = exchange.messages.findIndex(
      (m) => (m as unknown as { _id: { toString(): string } })._id.toString() === req.params.messageId
    );
    if (msgIndex === -1) return next(createError('Message not found', 404));

    const msg = exchange.messages[msgIndex];
    if (msg.sender.toString() !== req.userId) {
      return next(createError('You can only delete your own messages', 403));
    }

    exchange.messages.splice(msgIndex, 1);
    await exchange.save();

    try {
      getIO().to(`exchange:${exchange._id}`).emit('delete-exchange-message', { messageId: req.params.messageId });
    } catch {}

    res.json({ message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
};

export const getMyExchanges = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = {
      $or: [
        { requester: req.userId },
        { provider: req.userId },
        { 'applications.applicant': req.userId },
      ],
    };
    if (status) filter.status = status;

    const exchanges = await Exchange.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('requester provider', 'name avatar rating isVerified')
      .lean();

    const total = await Exchange.countDocuments(filter);

    res.json({ exchanges, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/exchanges/:id/apply
 * Any authenticated user (not the requester or existing provider) can submit
 * an application to participate in an open exchange.
 */
export const applyToExchange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, ceuOffer, skillOffer } = req.body;

    if (!['ceu', 'skill'].includes(type)) {
      return next(createError('type must be "ceu" or "skill"', 400));
    }
    if (type === 'ceu' && (ceuOffer == null || Number(ceuOffer) <= 0)) {
      return next(createError('ceuOffer must be a positive number', 400));
    }
    if (type === 'skill' && !skillOffer?.trim()) {
      return next(createError('skillOffer description is required', 400));
    }

    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) return next(createError('Exchange not found', 404));

    if (exchange.status !== 'open') {
      return next(createError('Exchange is no longer open for applications', 400));
    }
    if (exchange.requester.toString() === req.userId) {
      return next(createError('You cannot apply to your own exchange', 400));
    }
    if (exchange.provider?.toString() === req.userId) {
      return next(createError('You are already the provider for this exchange', 400));
    }

    // Prevent duplicate pending applications
    const hasPending = exchange.applications?.some(
      (a) => a.applicant.toString() === req.userId && a.status === 'pending'
    );
    if (hasPending) {
      return next(createError('You already have a pending application for this exchange', 400));
    }

    exchange.applications = exchange.applications ?? [];
    exchange.applications.push({
      applicant:  req.userId as unknown as typeof exchange.applications[0]['applicant'],
      type,
      ...(type === 'ceu'   ? { ceuOffer:   Number(ceuOffer) }    : {}),
      ...(type === 'skill' ? { skillOffer: skillOffer.trim() }   : {}),
      status:    'pending',
      createdAt: new Date(),
    } as typeof exchange.applications[0]);

    await exchange.save();

    const populated = await Exchange.findById(exchange._id)
      .populate('requester provider', 'name avatar rating isVerified')
      .populate('applications.applicant', 'name avatar rating isVerified')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/exchanges/:id/applications/:appId
 * Requester only: accept or reject an application.
 * Accepting sets the applicant as provider, moves exchange to 'pending',
 * and rejects all other pending applications.
 */
export const reviewApplication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { action } = req.body; // 'accept' | 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return next(createError('action must be "accept" or "reject"', 400));
    }

    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) return next(createError('Exchange not found', 404));

    if (exchange.requester.toString() !== req.userId) {
      return next(createError('Only the requester can review applications', 403));
    }

    const app = exchange.applications?.find(
      (a) => (a as unknown as { _id: { toString(): string } })._id.toString() === req.params.appId
    );
    if (!app) return next(createError('Application not found', 404));
    if (app.status !== 'pending') return next(createError('Application is no longer pending', 400));

    if (action === 'accept') {
      app.status = 'accepted';
      exchange.provider = app.applicant;
      exchange.status   = 'pending';

      // Reject all other pending applications
      exchange.applications.forEach((a) => {
        if (
          (a as unknown as { _id: { toString(): string } })._id.toString() !== req.params.appId &&
          a.status === 'pending'
        ) {
          a.status = 'rejected';
        }
      });

      // Run fairness check between requester's ceuValue and applicant's ceuOffer
      const providerCeu = app.ceuOffer ?? exchange.ceuValue;
      exchange.providerCeuValue = providerCeu;
      const fairness: FairnessResult = calculateFairness(
        exchange.ceuValue,
        providerCeu,
        exchange.type === 'tool' ? (exchange.toolMarketValue ?? undefined)    : undefined,
        exchange.type === 'tool' ? (exchange.seekingMarketValue ?? undefined) : undefined,
      );
      exchange.fairnessScore       = fairness.score;
      exchange.fairnessLabel       = fairness.label;
      exchange.fairnessSuggestions = fairness.suggestions;
    } else {
      app.status = 'rejected';
    }

    await exchange.save();

    // Settle CEU now that an applicant has been accepted:
    //   • Deduct the exchange cost from the requester
    //   • Credit it to the accepted provider (applicant)
    if (action === 'accept' && exchange.ceuValue > 0 && exchange.provider) {
      await User.findByIdAndUpdate(exchange.requester, { $inc: { ceuBalance: -exchange.ceuValue } });
      await User.findByIdAndUpdate(exchange.provider,  { $inc: { ceuBalance:  exchange.ceuValue } });
    }

    const populated = await Exchange.findById(exchange._id)
      .populate('requester provider', 'name avatar rating isVerified')
      .populate('applications.applicant', 'name avatar rating isVerified')
      .lean();

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/exchanges/fairness-check?ceuA=X&ceuB=Y[&mvA=Z&mvB=W]
 *
 * Stateless endpoint — converts CEU values (and optional tool market prices)
 * to a full FairnessResult. Used by the client for live fairness previews.
 */
export const checkFairness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ceuA = Math.max(0, Number(req.query.ceuA) || 0);
    const ceuB = Math.max(0, Number(req.query.ceuB) || 0);
    const mvA  = req.query.mvA  ? Math.max(0, Number(req.query.mvA))  : undefined;
    const mvB  = req.query.mvB  ? Math.max(0, Number(req.query.mvB))  : undefined;

    if (ceuA === 0 && ceuB === 0) {
      return next(createError('Provide at least one non-zero CEU value (ceuA or ceuB).', 400));
    }

    const result = calculateFairness(ceuA, ceuB, mvA, mvB);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── Skill Chain endpoints ─────────────────────────────────────────────────────

export const getExchangeChains = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const chains = await SkillChain.find({
      'members.exchange': id,
      status: { $in: ['proposed', 'active'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('members.user', 'name avatar rating isVerified')
      .populate('members.exchange', 'title offering seeking tags locationName onlineLink')
      .lean();
    res.json({ chains });
  } catch (err) {
    next(err);
  }
};

export const respondToChain = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id, chainId } = req.params;
    const { action } = req.body as { action: 'accept' | 'decline' };

    if (action !== 'accept' && action !== 'decline') {
      return next(createError('action must be accept or decline', 400));
    }

    const chain = await SkillChain.findOne({
      _id: chainId,
      'members.exchange': id,
      status: { $in: ['proposed', 'active'] },
    });

    if (!chain) return next(createError('Chain not found', 404));

    const member = chain.members.find(m => String(m.user) === req.userId);
    if (!member) return next(createError('You are not part of this chain', 403));
    if (member.status !== 'pending') return next(createError('You already responded', 400));

    member.status = action === 'accept' ? 'accepted' : 'declined';
    member.respondedAt = new Date();

    if (action === 'decline') {
      chain.status = 'declined';
      for (const m of chain.members) {
        if (String(m.user) === req.userId) continue;
        await Notification.create({
          recipient: m.user, type: 'chain_declined',
          title: 'Skill Chain Declined',
          body: 'A member declined the skill chain.',
          link: `/exchanges/${String(m.exchange)}`, read: false,
        });
        try { getIO().to(`user_${String(m.user)}`).emit('notification', { type: 'chain_declined', body: 'A member declined the skill chain.', link: `/exchanges/${String(m.exchange)}` }); } catch { /* ok */ }
      }
    } else {
      const allAccepted = chain.members.every(m => m.status === 'accepted');
      if (allAccepted) {
        chain.status = 'active';
        for (const m of chain.members) {
          await Notification.create({
            recipient: m.user, type: 'chain_active',
            title: 'Skill Chain Initiated! 🎉',
            body: 'All members accepted — your skill chain is now active!',
            link: `/exchanges/${String(m.exchange)}`, read: false,
          });
          try { getIO().to(`user_${String(m.user)}`).emit('notification', { type: 'chain_active', body: 'All members accepted — your skill chain is now active!', link: `/exchanges/${String(m.exchange)}` }); } catch { /* ok */ }
        }
      } else {
        for (const m of chain.members) {
          if (String(m.user) === req.userId) continue;
          await Notification.create({
            recipient: m.user, type: 'chain_accepted',
            title: 'Skill Chain Update',
            body: 'A member accepted the skill chain. Waiting for others…',
            link: `/exchanges/${String(m.exchange)}`, read: false,
          });
          try { getIO().to(`user_${String(m.user)}`).emit('notification', { type: 'chain_accepted', body: 'A member accepted.', link: `/exchanges/${String(m.exchange)}` }); } catch { /* ok */ }
        }
      }
    }

    await chain.save();
    const updated = await SkillChain.findById(chainId)
      .populate('members.user', 'name avatar rating isVerified')
      .populate('members.exchange', 'title offering seeking tags locationName onlineLink')
      .lean();
    res.json({ chain: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/exchanges/:id/chains/:chainId/undo-accept
 *
 * Reverts the requesting user's acceptance back to 'pending'.
 * If the chain was 'active', it reverts back to 'proposed'.
 */
export const undoChainAccept = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id, chainId } = req.params;

    const chain = await SkillChain.findOne({
      _id: chainId,
      'members.exchange': id,
      status: { $in: ['proposed', 'active'] },
    });

    if (!chain) return next(createError('Chain not found', 404));

    const member = chain.members.find(m => String(m.user) === req.userId);
    if (!member) return next(createError('You are not part of this chain', 403));
    if (member.status !== 'accepted') return next(createError('You have not accepted this chain', 400));

    member.status = 'pending';
    member.respondedAt = undefined;

    // If chain was active, revert to proposed
    if (chain.status === 'active') {
      chain.status = 'proposed';
    }

    await chain.save();

    const updated = await SkillChain.findById(chainId)
      .populate('members.user', 'name avatar rating isVerified')
      .populate('members.exchange', 'title offering seeking tags locationName onlineLink')
      .lean();
    res.json({ chain: updated });
  } catch (err) {
    next(err);
  }
};
