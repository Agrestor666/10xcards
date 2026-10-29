/** Max pasted source text length (client + server). */
export const MAX_SOURCE_TEXT_CHARS = 20_000;

/** Max topic prompt length for topic-based generation (client + server). */
export const MAX_TOPIC_CHARS = 200;

/** Max photos accepted in one transcribe request (client + server). */
export const MAX_PHOTO_COUNT = 3;

/** Max decoded image size per photo in bytes (client + server). */
export const MAX_PHOTO_BYTES = 1_500_000;

/** Max longest-edge dimension (px) when resizing a photo on the client. */
export const MAX_PHOTO_EDGE_PX = 1600;

/** OpenRouter web-search plugin result cap for topic generation. */
export const OPENROUTER_WEB_SEARCH_MAX_RESULTS = 5;

/** Max length per flashcard field after trim. */
export const MAX_CARD_FIELD_CHARS = 2_000;

/** Max cards accepted in one generate or bulk-save request. */
export const MAX_CARDS_PER_REQUEST = 50;

/** Upstream OpenRouter request timeout (ms). Covers generation from source text up to MAX_SOURCE_TEXT_CHARS. */
export const OPENROUTER_REQUEST_TIMEOUT_MS = 30_000;

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Small/fast default; override via OPENROUTER_MODEL when wired. */
export const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
