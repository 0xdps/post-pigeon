# Platform Credentials — Overview

Each platform requires different API credentials. This directory contains a step-by-step guide for every supported platform.

| Platform | Guide | Adapter | Credential type |
|----------|-------|---------|----------------|
| X / Twitter | [twitter.md](./twitter.md) | ✅ Implemented | API Key + Access Token (permanent) |
| LinkedIn | [linkedin.md](./linkedin.md) | 🚧 Stub | OAuth 2.0 (60-day token) |
| Reddit | [reddit.md](./reddit.md) | 🚧 Stub | Username + Password + Client ID/Secret |
| Dev.to | [devto.md](./devto.md) | 🚧 Stub | API Key (permanent) |
| Threads (Meta) | [threads.md](./threads.md) | 🚧 Stub | OAuth 2.0 (60-day token) |

---

## Thread support

Only **X / Twitter** supports multi-tweet threads. All other platforms will receive only the **first tweet** of a thread post.

| Platform | Threads |
|----------|---------|
| X / Twitter | ✅ Full thread |
| LinkedIn | ❌ First tweet only |
| Reddit | ❌ First tweet only |
| Dev.to | ❌ First tweet only (as article body) |
| Threads (Meta) | ❌ First tweet only |

---

## Quickest to set up (by complexity)

1. **Dev.to** — single API key, no OAuth, no expiry
2. **X / Twitter** — four keys, all permanent, no expiry
3. **Reddit** — five fields, no OAuth flow needed (script app)
4. **Threads** — OAuth flow + two-step publish
5. **LinkedIn** — OAuth flow + token refresh every 60 days
