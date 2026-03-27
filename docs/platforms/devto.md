# Dev.to — API Credentials Guide

> **Adapter status:** Not yet implemented 🚧

## Required credentials

| Field | ENV var (planned) | Description |
|-------|-------------------|-------------|
| API Key | `DEVTO_API_KEY` | Personal API key from your Dev.to account settings |

> Dev.to uses a simple **API key** — no OAuth, no secrets, no expiry. It's the simplest platform to set up.

---

## Step-by-step setup

### 1. Log in to Dev.to

Go to [dev.to](https://dev.to) and sign in to the account you want to publish from.

### 2. Generate an API key

1. Click your profile avatar → **Settings**
2. In the left sidebar, click **Extensions**
3. Scroll down to the **DEV API Keys** section
4. Enter a description (e.g. "PostPigeon") and click **Generate API Key**
5. Copy the key immediately — it won't be shown again

That key is your `DEVTO_API_KEY`.

---

## How Dev.to posting works

Dev.to posts are **articles**, not short-form posts. When PostPigeon publishes to Dev.to, the post content becomes the article body (supports full Markdown). Additional fields available in the Compose metadata:

| Field | Description |
|-------|-------------|
| **Title** | Article headline (required) |
| **Tags** | Up to 4 tags (e.g. `javascript, webdev, tutorial`) |
| **Series** | Group articles into a named series |
| **Published** | `true` = publish immediately, `false` = save as draft |
| **Canonical URL** | If the post originated elsewhere, set the canonical URL here |

---

## Rate limits

Dev.to allows **unlimited** API calls for personal use. There are no strict rate limits documented, but avoid posting more than a few articles per minute.

---

## Common errors

| Error | Likely cause |
|-------|-------------|
| `401 Unauthorized` | API key is invalid or was revoked |
| `422 Unprocessable Entity` | Article validation failed — check title length and tag format |
| `429 Too Many Requests` | Posting too rapidly |

---

## Notes

- Dev.to does **not** support threads — only the first part of a thread post will be published as the article body
- Articles are **Markdown-rendered** — standard Markdown syntax works (headers, code blocks, lists, links, images via URL)
- Images must be hosted externally (Dev.to doesn't support image upload via API)
- A Dev.to article published via API appears the same as one written in the editor — it shows up in followers' feeds and is indexed by search
- The `canonical_url` field is useful if you're cross-posting content that originally appeared on your blog
