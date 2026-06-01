/** Max pasted source text length (client + server). */
export const MAX_SOURCE_TEXT_CHARS = 8_000;

/** Max length per flashcard field after trim. */
export const MAX_CARD_FIELD_CHARS = 2_000;

/** Max cards accepted in one generate or bulk-save request. */
export const MAX_CARDS_PER_REQUEST = 50;

/** Upstream OpenRouter request timeout (ms). Slightly above PRD <10s perceived target for network + model latency. */
export const OPENROUTER_REQUEST_TIMEOUT_MS = 15_000;

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Small/fast default; override via OPENROUTER_MODEL when wired. */
export const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
