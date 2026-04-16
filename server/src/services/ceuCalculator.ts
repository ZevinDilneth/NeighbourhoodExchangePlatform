/**
 * CEU Calculation Algorithms — SRS Section 5.1
 *
 * Skill Value CEU      = Hours × SkillMultiplier × ProficiencyLevel
 *   SkillMultiplier    = Base(1.0) + RarityBonus + DemandBonus
 *   ProficiencyLevel   : Beginner(0.8), Intermediate(1.0), Expert(1.5)
 *
 * Tool Borrowing CEU   = (MarketValue × 0.001 × Days) + RiskFactor
 * Tool Gifting CEU     = MarketValue × 1.2  (generosity bonus)
 *
 * Q&A Bounty CEU       = Asker-defined, capped at BOUNTY_MAX_CAP
 * Answer CEU           = Base(5) + Upvotes(1 each) + Accepted(20) + BountyShare
 */

/** Maximum CEU a question asker can offer as a bounty */
export const BOUNTY_MAX_CAP = 500;

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'expert';

const PROFICIENCY_MULTIPLIERS: Record<ProficiencyLevel, number> = {
  beginner: 0.8,
  intermediate: 1.0,
  expert: 1.5,
};

/**
 * Calculate CEU value for a skill exchange.
 *
 * @param hours       - Number of hours of service offered
 * @param proficiency - Skill proficiency level of the provider
 * @param rarityBonus - Additional multiplier for rare skills (default 0)
 * @param demandBonus - Additional multiplier for high-demand skills (default 0)
 * @returns CEU value (rounded to nearest integer, minimum 1)
 */
export function calculateSkillCEU(
  hours: number,
  proficiency: ProficiencyLevel,
  rarityBonus = 0,
  demandBonus = 0,
): number {
  const skillMultiplier = 1.0 + rarityBonus + demandBonus;
  const proficiencyLevel = PROFICIENCY_MULTIPLIERS[proficiency] ?? 1.0;
  return Math.max(1, Math.round(hours * skillMultiplier * proficiencyLevel));
}

/**
 * Calculate CEU value for tool borrowing.
 *
 * @param marketValue - Estimated market value of the tool in £
 * @param days        - Number of days borrowed
 * @param riskFactor  - Additional CEU for high-risk/fragile items (default 0)
 * @returns CEU value (rounded to nearest integer, minimum 1)
 */
export function calculateToolCEU(
  marketValue: number,
  days: number,
  riskFactor = 0,
): number {
  return Math.max(1, Math.round(marketValue * 0.001 * days + riskFactor));
}

/**
 * Calculate CEU value for gifting a tool (generosity bonus).
 *
 * @param marketValue - Estimated market value of the tool in £
 * @returns CEU value (rounded to nearest integer, minimum 1)
 */
export function calculateToolGiftingCEU(marketValue: number): number {
  return Math.max(1, Math.round(marketValue * 1.2));
}

/**
 * Calculate CEU awarded to an answer/post author.
 *
 * @param upvotes    - Number of upvotes received
 * @param accepted   - Whether the answer was marked as accepted (default false)
 * @param bountyShare - Share of any bounty CEU (default 0)
 * @returns Total CEU to award (Base 5 + per-upvote + accepted bonus)
 */
export function calculateAnswerCEU(
  upvotes: number,
  accepted = false,
  bountyShare = 0,
): number {
  return 5 + Math.max(0, upvotes) + (accepted ? 20 : 0) + Math.max(0, bountyShare);
}

/**
 * Validate a user-submitted CEU value against the SRS formula.
 * Returns the corrected value, clamped to a reasonable range.
 *
 * @param submitted   - CEU value provided by the client
 * @param hours       - Hours of service
 * @param proficiency - Proficiency level
 * @param tolerance   - Fraction by which submitted value may differ from formula (default 50%)
 */
export function validateSkillCEU(
  submitted: number,
  hours: number,
  proficiency: ProficiencyLevel,
  tolerance = 0.5,
): { valid: boolean; expected: number; submitted: number } {
  const expected = calculateSkillCEU(hours, proficiency);
  const lowerBound = expected * (1 - tolerance);
  const upperBound = expected * (1 + tolerance);
  return {
    valid: submitted >= lowerBound && submitted <= upperBound,
    expected,
    submitted,
  };
}
