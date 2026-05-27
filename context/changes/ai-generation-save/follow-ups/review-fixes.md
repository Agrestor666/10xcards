# Review follow-ups (ai-generation-save)

## Deferred from impl review (2026-05-27)

- **Rate limit `/api/ai/generate`**: Per-user throttle (Cloudflare Rate Limiting or KV token bucket on `user.id`) before production exposure. Return `429` with generic message.
