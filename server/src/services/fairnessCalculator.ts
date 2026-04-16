/**
 * Fairness Matching Algorithm — SRS Section 5.2
 *
 * Input : ceuA (Party A's total offer), ceuB (Party B's total offer)
 * Output: score (0–1) + label + specific adjustment suggestions
 *
 * ratio = 1 − (|CEU_A − CEU_B| / max(CEU_A, CEU_B))
 *
 * ≥ 0.8  → Fair           — exchange is well balanced
 * 0.7–0.8 → Needs minor adjustment — small tweak advised
 * < 0.7  → Unfair         — significant imbalance, specific actions required
 */

export type FairnessLabel = 'fair' | 'needs_adjustment' | 'unfair';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/** A single actionable recommendation shown to one or both parties */
export interface FairnessSuggestion {
  /** Which side should act on this suggestion */
  party: 'A' | 'B' | 'both';
  /** Short action label (used as a heading in the UI) */
  action: string;
  /** Full explanation of what to do and why */
  detail: string;
  /**
   * Net CEU impact for the acting party.
   * Positive = they need to add this many CEU.
   * Negative = they could reduce by this many CEU.
   * 0 = both parties move equally.
   */
  ceuImpact: number;
}

export interface FairnessResult {
  /** Fairness ratio 0.0 (completely unfair) → 1.0 (perfectly balanced) */
  score: number;
  /** Human-readable classification */
  label: FairnessLabel;
  /** One-line summary for banners / toasts */
  description: string;
  /** Emoji shorthand for inline display */
  emoji: string;
  /**
   * How many CEU the lower-value party must add to cross the 0.8 "fair" threshold.
   * 0 when already fair.
   */
  adjustmentNeeded: number;
  /**
   * The minimum CEU each party should offer for this exchange to be fair (score ≥ 0.8).
   * Reflects the smallest symmetric adjustment.
   */
  targetCEU: { A: number; B: number };
  /**
   * Ordered list of specific, actionable suggestions.
   * Empty when label === 'fair'.
   */
  suggestions: FairnessSuggestion[];
  /** Present only when market values were supplied (tool exchanges) */
  marketValue?: {
    /** Raw fairness score computed from market prices alone (0–1) */
    score: number;
    /** Dollar value of Party A's tool */
    valueA: number;
    /** Dollar value of Party B's tool */
    valueB: number;
    /** Dollar gap between the two tools */
    gap: number;
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Compute how many CEU the lower party must add to reach an 0.8 ratio.
 *
 * ratio = 1 − (max − min) / max ≥ 0.8
 *   → (max − min) / max ≤ 0.2
 *   → min ≥ max × 0.8
 *   → needed = ceil(max × 0.8 − min)
 */
function ceuToReachFair(lower: number, higher: number): number {
  const target = Math.ceil(higher * 0.8);
  return Math.max(0, target - lower);
}

/**
 * Compute how many CEU the higher party must shed so that:
 *   newHigh × 0.8 ≤ lower → newHigh ≤ lower / 0.8
 *   reduction = ceil(higher − lower / 0.8)
 */
function ceuToReduceToFair(lower: number, higher: number): number {
  const targetHigh = Math.floor(lower / 0.8);
  return Math.max(0, higher - targetHigh);
}

/**
 * Generate all adjustment suggestions for a given fairness label and CEU values.
 * Optionally enriched with market-value data for tool exchanges.
 */
function generateSuggestions(
  ceuA: number,
  ceuB: number,
  label: FairnessLabel,
  mvA?: number,
  mvB?: number,
): FairnessSuggestion[] {
  if (label === 'fair') return [];

  const lowerIsA  = ceuA <= ceuB;
  const lowerParty: 'A' | 'B'  = lowerIsA ? 'A' : 'B';
  const higherParty: 'A' | 'B' = lowerIsA ? 'B' : 'A';
  const minCEU  = Math.min(ceuA, ceuB);
  const maxCEU  = Math.max(ceuA, ceuB);
  const gap     = maxCEU - minCEU;
  const needed  = ceuToReachFair(minCEU, maxCEU);
  const reduce  = ceuToReduceToFair(minCEU, maxCEU);
  const midAdd  = Math.ceil(needed / 2);
  const midCut  = Math.ceil(reduce / 2);

  // Estimate skill hours at Intermediate level (1.0 multiplier, default to 1 CEU ≈ 1h)
  const hoursEquivalent = needed;
  const sessionsNeeded  = Math.max(1, Math.ceil(needed / Math.max(1, minCEU)));

  const suggestions: FairnessSuggestion[] = [];

  if (label === 'needs_adjustment') {
    // ── Minor tweak — two focused suggestions ────────────────────────────────

    suggestions.push({
      party: lowerParty,
      action: `Add ${needed} CEU to your offer`,
      detail:
        `Party ${lowerParty} is offering ${minCEU} CEU vs Party ${higherParty}'s ${maxCEU} CEU. ` +
        `Adding ${needed} more CEU — for example by extending the session by ~${hoursEquivalent}h ` +
        `or including a small additional service — closes the gap and achieves a fair score (≥ 0.8).`,
      ceuImpact: needed,
    });

    suggestions.push({
      party: higherParty,
      action: `Trim your offer by ${reduce} CEU`,
      detail:
        `Alternatively, Party ${higherParty} could reduce their offer by ${reduce} CEU ` +
        `(e.g. shorten session duration or remove one session) to balance the exchange.`,
      ceuImpact: -reduce,
    });
  } else {
    // label === 'unfair' — three concrete suggestions + the "meet in the middle" option

    // 1. Lower party increases
    suggestions.push({
      party: lowerParty,
      action: `Add ${needed} CEU — increase your offering`,
      detail:
        `Party ${lowerParty} offers ${minCEU} CEU; Party ${higherParty} offers ${maxCEU} CEU — a gap of ${gap} CEU. ` +
        `To reach a fair exchange Party ${lowerParty} must add at least ${needed} CEU. ` +
        `Practical options: add ~${hoursEquivalent}h of extra service time, ` +
        `include ${sessionsNeeded} additional session${sessionsNeeded > 1 ? 's' : ''}, ` +
        `or upgrade the skill proficiency level from Intermediate to Expert (1.5× multiplier).`,
      ceuImpact: needed,
    });

    // 2. Lower party adds a session specifically
    suggestions.push({
      party: lowerParty,
      action: 'Upgrade proficiency or add a session',
      detail:
        `Upgrading from Intermediate (×1.0) to Expert (×1.5) multiplies CEU per hour by 1.5. ` +
        `If that is not enough, adding ${sessionsNeeded} extra session${sessionsNeeded > 1 ? 's' : ''} ` +
        `at the current rate covers the ${needed} CEU shortfall.`,
      ceuImpact: needed,
    });

    // 3. Higher party reduces
    suggestions.push({
      party: higherParty,
      action: `Reduce your offer by ${reduce} CEU`,
      detail:
        `Party ${higherParty} could reduce their offer by ${reduce} CEU ` +
        `(e.g. cut a session, shorten session length, or lower to a fewer-day borrow period). ` +
        `This brings the ratio to the 0.8 fair threshold without requiring Party ${lowerParty} to change.`,
      ceuImpact: -reduce,
    });

    // 4. Both compromise — meet in the middle
    suggestions.push({
      party: 'both',
      action: 'Meet in the middle — both adjust equally',
      detail:
        `A fair compromise: Party ${lowerParty} adds ~${midAdd} CEU and ` +
        `Party ${higherParty} reduces by ~${midCut} CEU. ` +
        `This shared adjustment reaches the 0.8 fairness threshold with minimal effort from either side.`,
      ceuImpact: 0,
    });
  }

  // ── Market-value-specific suggestions (tool exchanges only) ────────────────
  if (mvA != null && mvA > 0 && mvB != null && mvB > 0) {
    const mvGap     = Math.abs(mvA - mvB);
    const mvMax     = Math.max(mvA, mvB);
    const mvRatio   = 1 - mvGap / mvMax;
    const higherMvParty: 'A' | 'B' = mvA >= mvB ? 'A' : 'B';
    const lowerMvParty:  'A' | 'B' = mvA <  mvB ? 'A' : 'B';

    if (mvRatio < 0.8) {
      // The tool with lower market value should compensate via CEU
      const ceuPerDollar = Math.max(ceuA, ceuB) / mvMax; // rough conversion rate
      const compensationCEU = Math.ceil(mvGap * ceuPerDollar);

      suggestions.push({
        party: lowerMvParty,
        action: `Compensate for $${mvGap.toFixed(0)} market value gap with ${compensationCEU} CEU`,
        detail:
          `Party ${higherMvParty}'s tool has a market value of $${(higherMvParty === 'A' ? mvA : mvB).toFixed(0)} ` +
          `vs Party ${lowerMvParty}'s $${(lowerMvParty === 'A' ? mvA : mvB).toFixed(0)} — a $${mvGap.toFixed(0)} gap. ` +
          `Adding ~${compensationCEU} CEU to the offer brings the overall exchange value in line with the market price difference.`,
        ceuImpact: compensationCEU,
      });

      suggestions.push({
        party: 'both',
        action: 'Agree on a cash top-up or CEU supplement to bridge the market value difference',
        detail:
          `The tools differ in market value by $${mvGap.toFixed(0)} (${Math.round((1 - mvRatio) * 100)}% gap). ` +
          `Both parties can agree to bridge this outside the platform (e.g. a cash payment) ` +
          `or Party ${lowerMvParty} can increase their CEU offer to reflect the difference in real-world value.`,
        ceuImpact: 0,
      });
    }
  }

  return suggestions;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Calculate the full fairness result for a two-sided exchange.
 *
 * @param ceuA          - CEU offered by Party A (typically the requester)
 * @param ceuB          - CEU offered by Party B (typically the provider)
 * @param marketValueA  - Market value ($) of Party A's tool (tool exchanges only)
 * @param marketValueB  - Market value ($) of Party B's tool (tool exchanges only)
 */
export function calculateFairness(
  ceuA: number,
  ceuB: number,
  marketValueA?: number,
  marketValueB?: number,
): FairnessResult {
  // Both zero → gift exchange, always fair
  if (ceuA === 0 && ceuB === 0) {
    return {
      score: 1,
      label: 'fair',
      description: 'This is a gift exchange — no CEU balance required.',
      emoji: '🎁',
      adjustmentNeeded: 0,
      targetCEU: { A: 0, B: 0 },
      suggestions: [],
    };
  }

  // ── CEU fairness score (core algorithm) ──────────────────────────────────
  const maxCEU    = Math.max(ceuA, ceuB);
  const ceuScore  = 1 - Math.abs(ceuA - ceuB) / maxCEU;

  // ── Market-value fairness score (tool exchanges only) ────────────────────
  const hasMV   = (marketValueA ?? 0) > 0 && (marketValueB ?? 0) > 0;
  const mvA     = hasMV ? (marketValueA as number) : 0;
  const mvB     = hasMV ? (marketValueB as number) : 0;
  const mvScore = hasMV
    ? 1 - Math.abs(mvA - mvB) / Math.max(mvA, mvB)
    : null;

  // ── Blended score: equal weight of CEU + market value when MV available ──
  const rawScore = hasMV
    ? (ceuScore + (mvScore as number)) / 2
    : ceuScore;
  const score = parseFloat(rawScore.toFixed(4));

  let label: FairnessLabel;
  let description: string;
  let emoji: string;

  if (score >= 0.8) {
    label       = 'fair';
    description = hasMV
      ? 'Both CEU values and tool market prices are well balanced.'
      : 'This exchange is well balanced. Both parties offer comparable value.';
    emoji       = '✅';
  } else if (score >= 0.7) {
    label       = 'needs_adjustment';
    description = hasMV
      ? 'Minor imbalance in CEU values or tool market prices. A small adjustment will balance this exchange.'
      : 'Minor imbalance detected. A small adjustment from one party will balance this exchange.';
    emoji       = '⚠️';
  } else {
    label       = 'unfair';
    description = hasMV
      ? 'Significant imbalance in CEU values and/or tool market prices. Review the suggestions below.'
      : 'Significant CEU imbalance. Both parties should review the specific suggestions below.';
    emoji       = '❌';
  }

  const lowerIsA = ceuA <= ceuB;
  const minCEU   = Math.min(ceuA, ceuB);
  const needed   = ceuToReachFair(minCEU, maxCEU);

  // targetCEU: what each party should offer for CEU score ≥ 0.8
  const targetCEU = {
    A: lowerIsA ? Math.ceil(maxCEU * 0.8) : ceuA,
    B: lowerIsA ? ceuB                    : Math.ceil(maxCEU * 0.8),
  };

  const suggestions = generateSuggestions(ceuA, ceuB, label, hasMV ? mvA : undefined, hasMV ? mvB : undefined);

  const result: FairnessResult = {
    score,
    label,
    description,
    emoji,
    adjustmentNeeded: needed,
    targetCEU,
    suggestions,
  };

  // Attach market-value breakdown so the UI can render it
  if (hasMV) {
    result.marketValue = {
      score: parseFloat((mvScore as number).toFixed(4)),
      valueA: mvA,
      valueB: mvB,
      gap: parseFloat(Math.abs(mvA - mvB).toFixed(2)),
    };
  }

  return result;
}

/**
 * Check if an exchange is critically unfair (score < 0.5).
 * These exchanges should be flagged in the platform UI.
 */
export function isCriticallyUnfair(ceuA: number, ceuB: number): boolean {
  return calculateFairness(ceuA, ceuB).score < 0.5;
}
