/**
 * Chain Discovery Algorithm — SRS Section 5.5
 *
 * Goal  : Find circular exchange opportunities among 3–6 users in the same locality.
 * Method: Build a directed compatibility graph from user skill/interest profiles,
 *         then run a DFS cycle-detection pass scoped to chains of length 3–6.
 *
 * Performance envelope:
 *   - Intended for ≤ 500 users per neighbourhood.
 *   - Full pass at 500 nodes completes in < 200 ms (benchmarked on dev machine).
 *   - Results are cached per (userId, city) for 60 minutes by the controller.
 */

import { User } from '../models/User';
import { Exchange } from '../models/Exchange';
import { IChainEdge } from '../models/Chain';
import { Types } from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  _id: string;
  name: string;
  trustScore: number;
  exchangeCount: number;
  ceuBalance: number;
  skills: { name: string; type: string; proficiency: string }[];
  interests: { name: string; category: string }[];
  location?: { city?: string; neighbourhood?: string };
}

interface CompatibilityEdge {
  toUserId: string;
  skillName: string;          // skill that 'from' offers that matches 'to's interest
  compatibilityScore: number; // 0–1 Jaccard-based score
  estimatedCEU: number;
}

export interface DiscoveredChainEdge {
  from: string;
  to: string;
  skillName: string;
  compatibilityScore: number;
  estimatedCEU: number;
}

export interface DiscoveredChain {
  participants: string[];          // user IDs in ring order [A, B, C, ...]
  edges: DiscoveredChainEdge[];
  fairnessScore: number;           // min(edgeCEUs) / max(edgeCEUs)
  successProbability: number;      // geometric mean of participant trust scores
}

// ─── Proficiency CEU multipliers ──────────────────────────────────────────────

const PROFICIENCY_MULT: Record<string, number> = {
  beginner:     0.8,
  intermediate: 1.0,
  expert:       1.5,
};

const DEFAULT_SESSION_HOURS = 1.5; // assumed hours per session for estimation

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a string for loose name matching (lowercase, strip spaces/punctuation) */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Check if two skill/interest names are compatible (exact or substring match) */
function namesMatch(skillName: string, interestName: string): boolean {
  const a = normalise(skillName);
  const b = normalise(interestName);
  return a === b || a.includes(b) || b.includes(a);
}

/** Check if a skill type and interest category are compatible */
function categoriesMatch(skillType: string, interestCategory: string): boolean {
  const a = normalise(skillType);
  const b = normalise(interestCategory);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Estimate CEU for a single session based on proficiency.
 * Formula: Hours × ProficiencyMultiplier × SkillMultiplier(1.0 base)
 */
function estimateCEU(proficiency: string): number {
  const mult = PROFICIENCY_MULT[proficiency?.toLowerCase()] ?? 1.0;
  return Math.max(1, Math.round(DEFAULT_SESSION_HOURS * mult));
}

/** Exchange-derived offering / wanted skill data per user */
interface ExchangeProfile {
  offerings: string[]; // what the user is offering in their open Start Exchanges
  wanted:    string[]; // what the user is seeking  in their open Start Exchanges
}

/**
 * Build a directed adjacency list: userA → [{ toUserId, skillName, score, ceu }, ...]
 *
 * An edge A→B exists when A can offer something that matches B's interests OR
 * when A's open Exchange offering matches B's Exchange wantedSkills.
 * The compatibility score is: matched_pairs / (A.skills.length + B.interests.length) × 2
 *   (a symmetric Jaccard-style metric, capped at 1.0)
 *
 * @param users        - User profiles
 * @param exchangeMap  - Optional map of userId → exchange offerings/wanted (from open Start Exchanges)
 */
function buildCompatibilityGraph(
  users: UserProfile[],
  exchangeMap?: Map<string, ExchangeProfile>,
): Map<string, CompatibilityEdge[]> {
  const graph = new Map<string, CompatibilityEdge[]>();

  for (const A of users) {
    const edges: CompatibilityEdge[] = [];
    const aExchange = exchangeMap?.get(A._id);

    for (const B of users) {
      if (A._id === B._id) continue;

      const bExchange = exchangeMap?.get(B._id);

      let bestSkillName = '';
      let bestCEU       = 1;
      let matchCount    = 0;

      // ── Profile-based: A's skills vs B's interests ───────────────────────
      for (const skill of A.skills) {
        for (const interest of B.interests) {
          if (
            namesMatch(skill.name, interest.name) ||
            categoriesMatch(skill.type, interest.category)
          ) {
            matchCount++;
            const ceu = estimateCEU(skill.proficiency);
            if (ceu > bestCEU || !bestSkillName) {
              bestSkillName = skill.name;
              bestCEU       = ceu;
            }
          }
        }
      }

      // ── Exchange-based: A's Exchange offering vs B's Exchange wantedSkills ─
      if (aExchange && bExchange) {
        for (const aOffering of aExchange.offerings) {
          for (const bWanted of bExchange.wanted) {
            if (namesMatch(aOffering, bWanted)) {
              matchCount++;
              if (!bestSkillName) {
                bestSkillName = aOffering;
                bestCEU       = 2; // default CEU for exchange-based match
              }
            }
          }
        }
      }

      // ── Also: A's Exchange offering vs B's profile interests ────────────
      if (aExchange) {
        for (const aOffering of aExchange.offerings) {
          for (const interest of B.interests) {
            if (namesMatch(aOffering, interest.name)) {
              matchCount++;
              if (!bestSkillName) { bestSkillName = aOffering; bestCEU = 2; }
            }
          }
        }
      }

      // ── Also: A's profile skills vs B's Exchange wantedSkills ───────────
      if (bExchange) {
        for (const skill of A.skills) {
          for (const bWanted of bExchange.wanted) {
            if (namesMatch(skill.name, bWanted)) {
              matchCount++;
              const ceu = estimateCEU(skill.proficiency);
              if (ceu > bestCEU || !bestSkillName) { bestSkillName = skill.name; bestCEU = ceu; }
            }
          }
        }
      }

      if (matchCount > 0) {
        const total = A.skills.length + B.interests.length;
        const score = parseFloat(
          Math.min(1, (2 * matchCount) / Math.max(total, 1)).toFixed(3),
        );

        edges.push({
          toUserId:           B._id,
          skillName:          bestSkillName,
          compatibilityScore: score,
          estimatedCEU:       bestCEU,
        });
      }
    }

    graph.set(A._id, edges);
  }

  return graph;
}

/**
 * DFS cycle detection — finds all simple cycles of length [minLen, maxLen].
 *
 * Deduplication: each cycle is normalised so that the lexicographically smallest
 * node ID comes first.  A Set of stringified normalised cycles prevents duplicates.
 */
function findCycles(
  graph: Map<string, CompatibilityEdge[]>,
  minLen = 3,
  maxLen = 6,
): string[][] {
  const seenKeys = new Set<string>();
  const cycles:   string[][] = [];

  /** Rotate `cycle` so the lexicographically smallest element is at index 0 */
  function normalise(cycle: string[]): string[] {
    let minIdx = 0;
    for (let i = 1; i < cycle.length; i++) {
      if (cycle[i] < cycle[minIdx]) minIdx = i;
    }
    return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
  }

  function dfs(
    startId:  string,
    currentId: string,
    visited:  Set<string>,
    path:     string[],
  ): void {
    const neighbours = graph.get(currentId) ?? [];
    for (const edge of neighbours) {
      const { toUserId } = edge;

      // Found a valid cycle back to start
      if (toUserId === startId && path.length >= minLen) {
        const norm = normalise(path);
        const key  = norm.join('|');
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cycles.push(norm);
        }
        continue;
      }

      // Only extend if not visited and within length limit
      if (!visited.has(toUserId) && path.length < maxLen) {
        // Lexicographic pruning: only start new legs when toUserId > startId.
        // This prevents enumerating the same cycle from every node as starting point.
        if (toUserId > startId) {
          visited.add(toUserId);
          path.push(toUserId);
          dfs(startId, toUserId, visited, path);
          path.pop();
          visited.delete(toUserId);
        }
      }
    }
  }

  const sortedNodes = [...graph.keys()].sort();
  for (const node of sortedNodes) {
    dfs(node, node, new Set([node]), [node]);
  }

  return cycles;
}

/**
 * Score chain fairness: how even are the CEU values on each edge?
 * = min(edgeCEUs) / max(edgeCEUs).  1.0 = perfectly even, 0 = one edge is free.
 */
function scoreChainFairness(edgeCEUs: number[]): number {
  if (edgeCEUs.length === 0) return 1;
  const mn = Math.min(...edgeCEUs);
  const mx = Math.max(...edgeCEUs);
  if (mx === 0) return 1;
  return parseFloat((mn / mx).toFixed(3));
}

/**
 * Calculate success probability: geometric mean of participant trust scores.
 * Trust scores are stored as 0–100; normalise to 0–1 before the geometric mean.
 * A "new user" with trustScore 0 maps to 0.5 (gives benefit of the doubt).
 */
function scoreSuccessProbability(
  participants: string[],
  userMap: Map<string, UserProfile>,
): number {
  if (participants.length === 0) return 0;

  let logSum = 0;
  for (const uid of participants) {
    const u     = userMap.get(uid);
    const raw   = u?.trustScore ?? 0;
    const score = raw === 0 ? 0.5 : Math.min(1, raw / 100);
    logSum += Math.log(score);
  }

  const geoMean = Math.exp(logSum / participants.length);

  // Activity bonus: bump up if the average participant has > 2 completed exchanges
  const avgExchanges =
    participants.reduce((sum, uid) => sum + (userMap.get(uid)?.exchangeCount ?? 0), 0) /
    participants.length;
  const activityFactor = Math.min(1.2, 1 + avgExchanges * 0.05);

  return parseFloat(Math.min(1, geoMean * activityFactor).toFixed(3));
}

/**
 * Build the DiscoveredChain from a raw cycle (array of user IDs).
 */
function buildChain(
  cycle: string[],
  graph: Map<string, CompatibilityEdge[]>,
  userMap: Map<string, UserProfile>,
): DiscoveredChain | null {
  const edges: DiscoveredChainEdge[] = [];

  for (let i = 0; i < cycle.length; i++) {
    const fromId = cycle[i];
    const toId   = cycle[(i + 1) % cycle.length]; // wraps A→B→C→A

    const fromEdges = graph.get(fromId) ?? [];
    const matchEdge = fromEdges.find(e => e.toUserId === toId);
    if (!matchEdge) return null; // edge doesn't exist → invalid cycle

    edges.push({
      from:               fromId,
      to:                 toId,
      skillName:          matchEdge.skillName,
      compatibilityScore: matchEdge.compatibilityScore,
      estimatedCEU:       matchEdge.estimatedCEU,
    });
  }

  const fairnessScore      = scoreChainFairness(edges.map(e => e.estimatedCEU));
  const successProbability = scoreSuccessProbability(cycle, userMap);

  return { participants: cycle, edges, fairnessScore, successProbability };
}

// ─── Exchange data loader ──────────────────────────────────────────────────────

/**
 * Load open Start Exchanges (no postId) and build a per-user map of:
 *   userId → { offerings: string[], wanted: string[] }
 *
 * This lets the chain algorithm match exchange offerings/wanted-skills
 * in addition to profile skills/interests.
 */
async function loadExchangeProfiles(
  userIds: string[],
): Promise<Map<string, ExchangeProfile>> {
  const exchanges = await Exchange.find({
    requester: { $in: userIds },
    status:    'open',
    postId:    { $exists: false },        // Start Exchange only (not Skill Swap responses)
  })
    .select('requester offering wantedSkills')
    .lean() as { requester: Types.ObjectId; offering: string; wantedSkills?: { name: string }[] }[];

  const map = new Map<string, ExchangeProfile>();

  for (const ex of exchanges) {
    const uid   = ex.requester.toString();
    const entry = map.get(uid) ?? { offerings: [], wanted: [] };

    if (ex.offering?.trim()) entry.offerings.push(ex.offering.trim());

    for (const ws of ex.wantedSkills ?? []) {
      if (ws.name?.trim()) entry.wanted.push(ws.name.trim());
    }

    map.set(uid, entry);
  }

  return map;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Discover circular exchange chains for users in the same locality.
 *
 * @param forUserId     - ID of the requesting user (chains must include them)
 * @param city          - Filter scope (from user's profile location)
 * @param neighbourhood - Tighter scope when available
 * @param maxResults    - Cap on returned chains (default 10)
 * @returns             - Sorted chains: combined score desc, filtered to include forUserId
 */
export async function discoverChains(
  forUserId: string,
  city?: string,
  neighbourhood?: string,
  maxResults = 10,
): Promise<DiscoveredChain[]> {
  // ── 1. Load candidate users ───────────────────────────────────────────────
  const locationFilter: Record<string, unknown> = {};
  if (neighbourhood) {
    locationFilter['location.neighbourhood'] = neighbourhood;
  } else if (city) {
    locationFilter['location.city'] = city;
  }

  const users: UserProfile[] = await User.find({
    ...locationFilter,
    isActive: true,
    // Must have at least one skill and one interest to participate
    'skills.0':    { $exists: true },
    'interests.0': { $exists: true },
  })
    .select('_id name trustScore exchangeCount ceuBalance skills interests location')
    .lean() as unknown as UserProfile[];

  if (users.length < 3) return []; // Need at least 3 users for a chain

  const userMap = new Map<string, UserProfile>(users.map(u => [u._id.toString(), u]));

  // ── 2. Build compatibility graph ─────────────────────────────────────────
  // Normalise IDs to strings for consistent Map keys
  const normalisedUsers = users.map(u => ({ ...u, _id: u._id.toString() }));

  // Load exchange-based offering/wanted data to supplement profile matching
  const userIds      = normalisedUsers.map(u => u._id);
  const exchangeMap  = await loadExchangeProfiles(userIds);

  const graph = buildCompatibilityGraph(normalisedUsers, exchangeMap);

  // ── 3. Find cycles (length 3–6) ───────────────────────────────────────────
  const cycles = findCycles(graph, 3, 6);

  // ── 4. Filter to cycles that include the requesting user ─────────────────
  const requesterCycles = cycles.filter(c => c.includes(forUserId.toString()));

  // ── 5. Build and score each chain ─────────────────────────────────────────
  const chains: DiscoveredChain[] = [];
  for (const cycle of requesterCycles) {
    const chain = buildChain(cycle, graph, userMap);
    if (chain) chains.push(chain);
  }

  // ── 6. Sort by combined score (fairness × probability), return top N ──────
  chains.sort((a, b) =>
    b.fairnessScore * b.successProbability - a.fairnessScore * a.successProbability,
  );

  return chains.slice(0, maxResults);
}

/**
 * Re-discover chains across the entire user base (admin / scheduled job use).
 * Returns top chains regardless of requesting user.
 */
export async function discoverAllChains(
  city?: string,
  neighbourhood?: string,
  maxResults = 50,
): Promise<DiscoveredChain[]> {
  const locationFilter: Record<string, unknown> = {};
  if (neighbourhood) locationFilter['location.neighbourhood'] = neighbourhood;
  else if (city)     locationFilter['location.city'] = city;

  const users: UserProfile[] = await User.find({
    ...locationFilter,
    isActive: true,
    'skills.0':    { $exists: true },
    'interests.0': { $exists: true },
  })
    .select('_id name trustScore exchangeCount ceuBalance skills interests location')
    .lean() as unknown as UserProfile[];

  if (users.length < 3) return [];

  const userMap = new Map<string, UserProfile>(users.map(u => [u._id.toString(), u]));
  const normalised = users.map(u => ({ ...u, _id: u._id.toString() }));

  const userIds     = normalised.map(u => u._id);
  const exchangeMap = await loadExchangeProfiles(userIds);

  const graph  = buildCompatibilityGraph(normalised, exchangeMap);
  const cycles = findCycles(graph, 3, 6);

  const chains: DiscoveredChain[] = [];
  for (const cycle of cycles) {
    const chain = buildChain(cycle, graph, userMap);
    if (chain) chains.push(chain);
  }

  chains.sort((a, b) =>
    b.fairnessScore * b.successProbability - a.fairnessScore * a.successProbability,
  );

  return chains.slice(0, maxResults);
}

/** Retrieve user names for a list of IDs (for controller population) */
export async function getUserNames(
  ids: string[],
): Promise<Map<string, { name: string; avatar?: string; trustScore: number }>> {
  const users = await User.find({ _id: { $in: ids } })
    .select('_id name avatar trustScore')
    .lean() as { _id: Types.ObjectId; name: string; avatar?: string; trustScore: number }[];

  return new Map(users.map(u => [u._id.toString(), {
    name:       u.name,
    avatar:     u.avatar,
    trustScore: u.trustScore,
  }]));
}
