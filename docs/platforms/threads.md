# Threads (Meta) — API Credentials Guide

> **Adapter status:** Not yet implemented 🚧

## Required credentials

| Field | ENV var (planned) | Description |
|-------|-------------------|-------------|
| App ID | `THREADS_APP_ID` | Your Meta app's App ID |
| App Secret | `THREADS_APP_SECRET` | Your Meta app's App Secret |
| Access Token | `THREADS_ACCESS_TOKEN` | Long-lived token for the posting account |
| User ID | `THREADS_USER_ID` | Numeric Threads user ID |

> Threads uses **Meta's OAuth 2.0** via the Threads API (separate from the Instagram Graph API). Access tokens last **60 days** and can be refreshed to long-lived tokens (90 days).

---

## Step-by-step setup

### 1. Create a Meta Developer account

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with your Facebook account
2. If prompted, complete the developer registration

### 2. Create a Meta app

1. Go to **My Apps → Create App**
2. For **Use case**, select **Other** → **Next**
3. For **App type**, select **Business** → **Next**
4. Fill in the app name ("PostPigeon") and your contact email
5. Click **Create App**

### 3. Add the Threads product

1. In your app dashboard, find the **Add products to your app** section
2. Find **Threads API** and click **Set up**

> If you don't see Threads API listed, your account may not have access yet. The Threads API is available to approved developers — apply at [developers.facebook.com/products/threads](https://developers.facebook.com/products/threads).

### 4. Configure OAuth settings

1. In the left sidebar, go to **Threads API → Quick Start**
2. Under **User token generator**, add the Threads account you want to post from
3. Note your **App ID** and **App Secret** from **App Settings → Basic**

### 5. Get an access token

**Option A — Via the Quick Start token generator (easiest):**

1. Go to **Threads API → Quick Start**
2. Under **User token generator**, find your account and click **Generate Token**
3. Approve the permissions requested
4. Copy the short-lived token

**Option B — OAuth flow (for production use):**

Construct the auth URL:
```
https://threads.net/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=threads_basic,threads_content_publish&response_type=code
```

Visit it, approve, grab the `code`, then exchange it:
```bash
curl -X POST https://graph.threads.net/oauth/access_token \
  -d "client_id=YOUR_APP_ID" \
  -d "client_secret=YOUR_APP_SECRET" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "code=YOUR_CODE"
```

### 6. Exchange for a long-lived token

Short-lived tokens expire in 1 hour. Exchange for a long-lived token (60 days):

```bash
curl "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=YOUR_APP_SECRET&access_token=YOUR_SHORT_LIVED_TOKEN"
```

Copy `access_token` → `THREADS_ACCESS_TOKEN`

### 7. Get your Threads User ID

```bash
curl "https://graph.threads.net/v1.0/me?fields=id,username&access_token=YOUR_ACCESS_TOKEN"
```

Copy the `id` value → `THREADS_USER_ID`

---

## Permissions (scopes) required

| Scope | Purpose |
|-------|---------|
| `threads_basic` | Read profile and threads |
| `threads_content_publish` | Create and publish threads posts |

---

## Token expiry

| Token type | Lifetime |
|-----------|---------|
| Short-lived | 1 hour |
| Long-lived | 60 days |
| Refreshed long-lived | 60 days (reset each time refreshed) |

PostPigeon will automatically refresh the token before it expires.

---

## How Threads posting works

Threads uses a **two-step publish flow**:
1. **Create a media container** — send the text/image to the API, get back a `creation_id`
2. **Publish the container** — send the `creation_id` to publish it to the feed

PostPigeon handles both steps automatically.

---

## Common errors

| Error | Likely cause |
|-------|-------------|
| `190 Invalid OAuth token` | Token expired or revoked |
| `200 Permissions error` | Missing `threads_content_publish` scope |
| `32 Page request limit reached` | Rate limit hit |

## Notes

- Threads does **not** support multi-part thread posts via the API — only the first tweet of a thread will be posted
- Images must be publicly accessible URLs (direct file upload is not supported)
- Video support requires the `threads_content_publish` scope with video permissions (may require additional approval)
- The Threads API is relatively new — check [developers.facebook.com/docs/threads](https://developers.facebook.com/docs/threads) for the latest changes
