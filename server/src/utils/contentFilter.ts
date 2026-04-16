/**
 * Content Filter Utility
 * Screens user-generated text for profanity, slurs, and NSFW content
 * using leo-profanity, which ships English + French + Spanish dictionaries.
 */
import leoProfanity from 'leo-profanity';

// Load the full built-in English word list on module init (done once)
leoProfanity.loadDictionary('en');

// ── Additional custom words (slurs / NSFW terms not in the default list) ──────
// Keep this list sorted alphabetically for easy maintenance
const CUSTOM_WORDS: string[] = [
  'cameltoe',
  'chink',
  'coon',
  'cracker',
  'cum',
  'cumshot',
  'deepthroat',
  'dyke',
  'fag',
  'faggot',
  'flatchested',
  'gook',
  'handjob',
  'hardcock',
  'heeb',
  'jap',
  'kike',
  'kunt',
  'milf',
  'negro',
  'nigga',
  'nigger',
  'nig',
  'paki',
  'pedo',
  'pedophile',
  'porn',
  'porno',
  'pornography',
  'pussy',
  'raghead',
  'rapist',
  'retard',
  'rimjob',
  'sandnigger',
  'sexting',
  'slut',
  'spic',
  'squirt',
  'terrorist',
  'tranny',
  'twat',
  'wetback',
  'whore',
  'wop',
];

leoProfanity.add(CUSTOM_WORDS);

/**
 * Returns true if any of the supplied strings contain profanity or
 * inappropriate content. Undefined/null/empty values are skipped.
 */
export const containsProfanity = (...texts: (string | undefined | null)[]): boolean =>
  texts.some((t) => t && leoProfanity.check(t));

/**
 * Like containsProfanity but also accepts string arrays (skills, interests, tags).
 * Each element of an array is checked individually.
 */
export const checkFields = (...fields: (string | string[] | undefined | null)[]): boolean =>
  fields.some((f) => {
    if (!f) return false;
    if (Array.isArray(f)) return f.some((t) => t && leoProfanity.check(t));
    return leoProfanity.check(f);
  });
