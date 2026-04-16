/**
 * Client-side Content Filter
 * Mirrors the server-side check so users get instant feedback before submit.
 * The server always performs the authoritative check.
 */
import leoProfanity from 'leo-profanity';

// Load the built-in English dictionary once
leoProfanity.loadDictionary('en');

// Additional custom words — keep in sync with server/src/utils/contentFilter.ts
const CUSTOM_WORDS: string[] = [
  'cameltoe', 'chink', 'coon', 'cracker', 'cum', 'cumshot', 'deepthroat',
  'dyke', 'fag', 'faggot', 'flatchested', 'gook', 'handjob', 'hardcock',
  'heeb', 'jap', 'kike', 'kunt', 'milf', 'negro', 'nigga', 'nigger', 'nig',
  'paki', 'pedo', 'pedophile', 'porn', 'porno', 'pornography', 'pussy',
  'raghead', 'rapist', 'retard', 'rimjob', 'sandnigger', 'sexting', 'slut',
  'spic', 'squirt', 'terrorist', 'tranny', 'twat', 'wetback', 'whore', 'wop',
];

leoProfanity.add(CUSTOM_WORDS);

/**
 * Returns true if any of the supplied strings contain inappropriate content.
 * Safe to call with undefined/empty values.
 */
export const containsProfanity = (...texts: (string | undefined)[]): boolean => {
  try {
    return texts.some((t) => t && leoProfanity.check(t));
  } catch {
    return false; // fail open on the client — server is authoritative
  }
};

/**
 * Like containsProfanity but also accepts string arrays (skills, interests, tags).
 * Each element of an array is checked individually.
 */
export const checkFields = (...fields: (string | string[] | undefined)[]): boolean => {
  try {
    return fields.some((f) => {
      if (!f) return false;
      if (Array.isArray(f)) return f.some((t) => t && leoProfanity.check(t));
      return leoProfanity.check(f);
    });
  } catch {
    return false;
  }
};

export const PROFANITY_ERROR =
  'Your text contains inappropriate content (profanity, slurs, or NSFW terms). Please revise and try again.';
