/**
 * Interest Engine — TF-IDF Cosine-Similarity Recommendation Model
 *
 * Builds a weighted term-frequency vector for each user from:
 *   • profile skills & interests
 *   • preferred tags (explicitly chosen)
 *   • wanted skills on their exchanges
 *   • past exchange seeking/offering text
 *   • tags & titles on their own posts
 *
 * When a new post or exchange is created, content is split into three
 * independent dimensions and each is compared against every other user's
 * interest vector via cosine similarity:
 *
 *   dim 1 — title       (tokenised title text)
 *   dim 2 — media/tags  (post tags, which describe what appears in media)
 *   dim 3 — description (content / description / seeking text)
 *
 * Rule: if ANY ONE dimension exceeds its threshold → the user is interested
 * → send an `interest_match` notification (fire-and-forget, does not block the API).
 */

import { Types } from 'mongoose';
import { User }     from '../models/User';
import { Post }     from '../models/Post';
import { Exchange } from '../models/Exchange';
import { Notification } from '../models/Notification';
import { getIO } from '../socket/ioInstance';

// ── Stop-word list (common English words that carry no interest signal) ────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','during','before','after','above',
  'below','between','out','off','over','under','again','then','once','here',
  'there','when','where','why','how','all','both','each','few','more','most',
  'other','some','such','no','nor','not','only','own','same','so','than',
  'too','very','can','will','just','should','now','i','me','my','we','our',
  'you','your','he','she','it','they','them','this','that','these','those',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','would','could','may','might','shall','must','am','get','got','make',
  'like','use','go','see','know','take','come','think','look','want','give',
  'use','find','tell','ask','seem','feel','try','leave','call','keep','let',
  'new','good','great','best','well','free','high','low','big','small','long',
  'right','old','great','little','own','right','large','next','early','young',
]);

// ── Tokeniser ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')   // keep hyphens (e.g. "3d-printing")
    .split(/[\s\-]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

/** Merge tokens into a freq map, multiplied by weight */
function addTokens(vec: Map<string, number>, tokens: string[], weight: number): void {
  for (const t of tokens) {
    vec.set(t, (vec.get(t) ?? 0) + weight);
  }
}

// ── User interest vector ──────────────────────────────────────────────────────

/**
 * Build a TF-weighted term vector for a user from all interest signals.
 * Returns a normalised Map<term, weight> (L2-normalised for cosine similarity).
 */
async function buildUserVector(userId: string): Promise<Map<string, number>> {
  const raw = new Map<string, number>();

  const [userDoc, userPosts, userExchanges] = await Promise.all([
    User.findById(userId)
      .select('skills interests preferredTags')
      .lean() as Promise<Record<string, any> | null>,
    Post.find({ author: userId, isActive: true })
      .select('title tags')
      .lean() as Promise<Record<string, any>[]>,
    Exchange.find({ $or: [{ requester: userId }, { provider: userId }] })
      .select('offering seeking wantedSkills tags')
      .lean() as Promise<Record<string, any>[]>,
  ]);

  if (!userDoc) return raw;

  // 1. Profile skills  (weight 4)
  for (const sk of (userDoc.skills ?? []) as Record<string, any>[]) {
    addTokens(raw, tokenize(sk.name ?? ''),        4);
    addTokens(raw, tokenize(sk.description ?? ''), 2);
  }

  // 2. Profile interests  (weight 5)
  for (const int of (userDoc.interests ?? []) as Record<string, any>[]) {
    addTokens(raw, tokenize(int.name ?? ''),        5);
    addTokens(raw, tokenize(int.description ?? ''), 3);
  }

  // 3. Preferred tags  (weight 5 — direct user selections)
  for (const tag of (userDoc.preferredTags ?? []) as string[]) {
    addTokens(raw, tokenize(tag), 5);
  }

  // 4. Wanted skills on exchanges  (weight 6 — strongest signal: explicit need)
  for (const ex of userExchanges) {
    for (const ws of (ex.wantedSkills ?? []) as Record<string, any>[]) {
      addTokens(raw, tokenize(ws.name        ?? ''), 6);
      addTokens(raw, tokenize(ws.description ?? ''), 4);
    }
    // 5. Exchange seeking/offering text  (weight 4)
    addTokens(raw, tokenize(ex.seeking  ?? ''), 4);
    addTokens(raw, tokenize(ex.offering ?? ''), 2);
    for (const tag of (ex.tags ?? []) as string[]) {
      addTokens(raw, tokenize(tag), 3);
    }
  }

  // 6. Own post tags  (weight 3)
  for (const post of userPosts) {
    for (const tag of (post.tags ?? []) as string[]) {
      addTokens(raw, tokenize(tag), 3);
    }
    addTokens(raw, tokenize(post.title ?? ''), 1);
  }

  return l2Normalize(raw);
}

/** L2-normalise a term vector so cosine similarity = just the dot product */
function l2Normalize(vec: Map<string, number>): Map<string, number> {
  let mag = 0;
  for (const v of vec.values()) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  const out = new Map<string, number>();
  for (const [k, v] of vec) out.set(k, v / mag);
  return out;
}

/** Cosine similarity between two normalised term vectors */
function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  // iterate over the smaller map for efficiency
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, w] of small) {
    const bw = large.get(term);
    if (bw !== undefined) dot += w * bw;
  }
  return dot; // both already L2-normalised, so dot = cosine
}

// ── Content dimension vectors ─────────────────────────────────────────────────

function titleVec(title: string): Map<string, number> {
  return l2Normalize(new Map(tokenize(title).map(t => [t, 1])));
}

function descVec(text: string): Map<string, number> {
  const raw = new Map<string, number>();
  const tokens = tokenize(text);
  for (const t of tokens) raw.set(t, (raw.get(t) ?? 0) + 1);
  return l2Normalize(raw);
}

/** Tags represent what appears in media + the overall topic signal */
function mediaVec(tags: string[]): Map<string, number> {
  const raw = new Map<string, number>();
  for (const tag of tags) {
    for (const t of tokenize(tag)) raw.set(t, (raw.get(t) ?? 0) + 2);
  }
  return l2Normalize(raw);
}

// ── Thresholds ────────────────────────────────────────────────────────────────

// Tuned so that a single strong overlapping term triggers a match.
// Lower value = more sensitive; raise if too many false positives.
const TITLE_THRESHOLD = 0.10;
const MEDIA_THRESHOLD = 0.12;
const DESC_THRESHOLD  = 0.08;

interface MatchResult {
  titleMatch: boolean;
  mediaMatch: boolean;
  descMatch:  boolean;
  interested: boolean;  // true if ANY dimension matches
  score:      number;   // max of the three (for ranking)
}

function scoreContent(
  userVec: Map<string, number>,
  titleText:  string,
  descText:   string,
  tags:       string[],
): MatchResult {
  const tv = cosineSim(userVec, titleVec(titleText));
  const mv = cosineSim(userVec, mediaVec(tags));
  const dv = cosineSim(userVec, descVec(descText));

  const titleMatch = tv >= TITLE_THRESHOLD;
  const mediaMatch = mv >= MEDIA_THRESHOLD;
  const descMatch  = dv >= DESC_THRESHOLD;

  return {
    titleMatch,
    mediaMatch,
    descMatch,
    interested: titleMatch || mediaMatch || descMatch,
    score: Math.max(tv, mv, dv),
  };
}

// ── Post-type → client route helper ──────────────────────────────────────────

function postRoute(type: string, id: string): string {
  const map: Record<string, string> = {
    skill: 'skills', tool: 'tools', event: 'events', question: 'questions',
  };
  return `/${map[type] ?? 'posts'}/${id}`;
}

function postTypeLabel(type: string): string {
  const map: Record<string, string> = {
    skill: 'skill', tool: 'tool listing', event: 'event',
    question: 'question', general: 'post', gift: 'gift',
  };
  return map[type] ?? 'post';
}

// ── Notification helper ───────────────────────────────────────────────────────

async function sendInterestNotification(
  recipientId: string,
  authorName:  string,
  contentTitle: string,
  link:         string,
  match:        MatchResult,
): Promise<void> {
  const matchDims = [
    match.titleMatch ? 'title' : '',
    match.mediaMatch ? 'media' : '',
    match.descMatch  ? 'description' : '',
  ].filter(Boolean).join(', ');

  await Notification.create({
    recipient: new Types.ObjectId(recipientId),
    type:  'interest_match',
    title: `New content that matches your interests`,
    body:  `${authorName} posted "${contentTitle}" — matched on ${matchDims}`,
    link,
    read:  false,
    data:  { score: match.score, matchDims },
  });

  // Push live via Socket.IO if the user is connected
  try {
    const io = getIO();
    io.to(`user_${recipientId}`).emit('notification', {
      type:  'interest_match',
      title: `New content that matches your interests`,
      body:  `${authorName} posted "${contentTitle}"`,
      link,
    });
  } catch { /* socket not always available */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: score a newly created post against all other active users
 * and send interest_match notifications to those whose vector matches.
 */
export function notifyInterestedUsersForPost(
  postId:     string,
  authorId:   string,
  authorName: string,
  postType:   string,
  title:      string,
  content:    string,
  tags:       string[],
): void {
  // Run asynchronously — never awaited by the caller
  void (async () => {
    try {
      const link = postRoute(postType, postId);

      // Fetch all active users except the author (batch, no pagination needed for ≤10k users)
      const users = await User.find({ _id: { $ne: authorId }, isActive: true })
        .select('_id')
        .lean() as { _id: Types.ObjectId }[];

      // Avoid duplicate notifications (in case of retries)
      const existing = await Notification.distinct('recipient', {
        type: 'interest_match',
        link,
      }) as Types.ObjectId[];
      const alreadyNotified = new Set(existing.map(String));

      // Score + notify in parallel batches of 20 to avoid overwhelming the DB
      const BATCH = 20;
      const MAX_NOTIFICATIONS = 100; // cap per post
      let sent = 0;

      for (let i = 0; i < users.length && sent < MAX_NOTIFICATIONS; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        await Promise.all(batch.map(async (u) => {
          if (sent >= MAX_NOTIFICATIONS) return;
          const uid = String(u._id);
          if (alreadyNotified.has(uid)) return;

          const userVec = await buildUserVector(uid);
          if (userVec.size === 0) return; // user has no interest data yet

          const match = scoreContent(userVec, title, content, tags);
          if (!match.interested) return;

          await sendInterestNotification(uid, authorName, title, link, match);
          sent++;
        }));
      }
    } catch (err) {
      console.error('[InterestEngine] post scoring error:', err);
    }
  })();
}

/**
 * Fire-and-forget: score a newly created exchange (Start Exchange / skill-swap)
 * against all other active users.
 */
export function notifyInterestedUsersForExchange(
  exchangeId:   string,
  authorId:     string,
  authorName:   string,
  title:        string,
  description:  string,
  seeking:      string,
  wantedSkills: Array<{ name: string; description?: string }>,
  tags:         string[],
): void {
  void (async () => {
    try {
      const link = `/exchanges/${exchangeId}`;

      // Combine description + seeking + wanted skill names as the "description" dimension
      const fullDesc = [
        description,
        seeking,
        ...wantedSkills.map(ws => `${ws.name} ${ws.description ?? ''}`),
      ].join(' ');

      const users = await User.find({ _id: { $ne: authorId }, isActive: true })
        .select('_id')
        .lean() as { _id: Types.ObjectId }[];

      const existing = await Notification.distinct('recipient', {
        type: 'interest_match',
        link,
      }) as Types.ObjectId[];
      const alreadyNotified = new Set(existing.map(String));

      const BATCH = 20;
      const MAX_NOTIFICATIONS = 100;
      let sent = 0;

      for (let i = 0; i < users.length && sent < MAX_NOTIFICATIONS; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        await Promise.all(batch.map(async (u) => {
          if (sent >= MAX_NOTIFICATIONS) return;
          const uid = String(u._id);
          if (alreadyNotified.has(uid)) return;

          const userVec = await buildUserVector(uid);
          if (userVec.size === 0) return;

          const match = scoreContent(userVec, title, fullDesc, tags);
          if (!match.interested) return;

          await sendInterestNotification(uid, authorName, title, link, match);
          sent++;
        }));
      }
    } catch (err) {
      console.error('[InterestEngine] exchange scoring error:', err);
    }
  })();
}
