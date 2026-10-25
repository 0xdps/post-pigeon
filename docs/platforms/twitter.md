# X / Twitter — API Credentials Guide

> **Adapter status:** Fully implemented ✅

## Required credentials

| Field | ENV var | Description |
|-------|---------|-------------|
| Client ID | `TWITTER_CLIENT_ID` | OAuth 2.0 Client ID |
| Client Secret | `TWITTER_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| Access Token | `TWITTER_ACCESS_TOKEN` | User access token. Expires in 2 hours; refreshed automatically |
| Refresh Token | `TWITTER_ACCESS_REFRESH_TOKEN` | User refresh token. Expires in about 6 months |

---

## Step-by-step setup

### 1. Create a developer account

Go to [developer.twitter.com](https://developer.twitter.com) and sign in with the Twitter account you want to post from. If you don't have a developer account yet, apply for one — approval is usually instant for basic access.

### 2. Create a project and app

1. In the Developer Portal, click **Projects & Apps → Overview → New Project**
2. Give it a name (e.g. "PostPigeon"), select a use case (Hobbyist / Making a bot)
3. Inside the project, create an **App**

### 3. Set app permissions

1. Open your app → **Settings** tab
2. Scroll to **User authentication settings** → click **Set up**
3. Set **App permissions** to **Read and Write** (required to post)
4. For **Type of App** choose **Native App** or **Web App** — either works
5. Set any placeholder URL for the callback (e.g. `http://localhost`) — PostPigeon doesn't need OAuth callbacks
6. Save

### 4. Copy the OAuth 2.0 client credentials

1. Go to **Keys and tokens** inside your app
2. Under **OAuth 2.0 Keys**, copy:
   - **Client ID** → `TWITTER_CLIENT_ID`
   - **Client Secret** → `TWITTER_CLIENT_SECRET`

### 5. Generate user tokens

1. Still on **Keys and tokens**, under **OAuth 2.0**, generate an access token and refresh token for the account that will post
2. Copy both immediately — X shows them only once:
   - **Access Token** → `TWITTER_ACCESS_TOKEN`
   - **Refresh Token** → `TWITTER_ACCESS_REFRESH_TOKEN`
3. The access token expires in 2 hours. PostPigeon refreshes it automatically and writes the new pair back to the env file
4. The refresh token expires in about 6 months. Regenerate it in the portal when it does

> OAuth 1.0 consumer keys and the app-only Bearer Token are not used.

### 6. Verify access level

PostPigeon uses the **Twitter API v2** endpoints. The **Free** tier allows posting but has strict rate limits (17 posts/24h). **Basic** tier ($100/month) increases this significantly. Check your current tier under **Products → Twitter API** in the portal.

---

## Common errors

| Error | Likely cause |
|-------|-------------|
| `401 Unauthorized` | Wrong API key/secret, or app permissions not set to Read+Write |
| `403 Forbidden` | Free tier rate limit hit, or app not approved for write access |
| `187 Status is a duplicate` | You're trying to post the same text twice |

---

## Notes

- The `MAX_TWEET_LENGTH` env var (default 1000) is applied before sending — useful if you're on Free tier and want to stay within the character limit
- Threads are posted as reply chains: tweet 1 → reply to tweet 1 → reply to tweet 2, etc.
