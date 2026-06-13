/**
 * Cheap, deterministic pre-filter that runs BEFORE the LLM intent parser, so we
 * don't spend a model call on obvious noise (greetings, emoji, one-word chatter).
 *
 * The interface is intentionally narrow — `shouldProcess(text) → { process, reason }` —
 * so the internals can later be swapped for a trained classifier or an
 * embedding-similarity gate without touching any caller.
 */

export type PrefilterResult = { process: boolean; reason: string };

// Greeting / acknowledgement / filler tokens. A message made up entirely of
// these (in any combination) is chatter, not work.
const GREETING_WORDS = new Set([
  "hi", "hii", "hiii", "hello", "helloo", "hey", "heya", "heyy", "yo", "sup", "gm", "gn",
  "good", "morning", "afternoon", "evening", "night", "day",
  "thanks", "thank", "thx", "ty", "cheers", "appreciated",
  "lol", "lmao", "haha", "nice", "great", "awesome", "cool", "sweet", "perfect",
  "ok", "okay", "okie", "np", "welcome", "yw", "yes", "no", "yep", "nope",
  "everyone", "all", "team", "folks", "guys", "yall", "yeah", "please", "just", "hello!",
  "you", "u", "the", "a", "to", "and",
  // common ack/greeting fillers (generic words only — never domain nouns)
  "so", "much", "very", "really", "for", "it", "that", "this", "is", "are", "im", "today",
  "here", "again", "doing", "how", "whats", "everybody", "morning!", "thanks!",
]);

// Strong signals that this is real engineering work.
const BUG_SIGNAL =
  /\b(bug|error|errors|broken|break(s|ing)?|crash(es|ed|ing)?|fail(s|ed|ing|ure)?|not working|does(n'?t| not)|can'?t|won'?t|isn'?t|500|404|503|exception|stack ?trace|null|undefined|timeout|regression|leak|stuck|hang(s|ing)?|freeze|wrong|missing|unable|throws?|reproduce|repro)\b/i;

/** Whether the pre-filter is active. Set ERVIN_PREFILTER_BYPASS=1 to bypass (tests). */
export function prefilterEnabled(): boolean {
  return process.env.ERVIN_PREFILTER_BYPASS !== "1";
}

export function shouldProcess(text: string): PrefilterResult {
  const trimmed = text.trim();
  if (!trimmed) return { process: false, reason: "empty" };

  // Emoji / punctuation only (no letters or digits at all).
  const lettersDigits = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (lettersDigits.length === 0) return { process: false, reason: "emoji_or_punctuation_only" };

  // A real bug signal beats every chatter heuristic.
  const hasBugSignal = BUG_SIGNAL.test(trimmed);
  if (hasBugSignal) return { process: true, reason: "bug_signal" };

  // Greeting/filler only: strip punctuation per token; if nothing but greeting
  // words remains, it's chatter (handles "hey team good morning!").
  const words = trimmed.split(/\s+/).filter(Boolean);
  const meaningful = words
    .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""))
    .filter((w) => w.length > 0 && !GREETING_WORDS.has(w));
  if (meaningful.length === 0) return { process: false, reason: "greeting" };

  if (trimmed.length < 12 || words.length < 3) {
    return { process: false, reason: "too_short_or_low_signal" };
  }

  return { process: true, reason: "sufficient_detail" };
}
