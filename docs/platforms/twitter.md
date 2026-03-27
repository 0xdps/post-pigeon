# X / Twitter — API Credentials Guide

> **Adapter status:** Fully implemented ✅

## Required credentials

| Field | ENV var | Description |
|-------|---------|-------------|
| API Key | `TWITTER_API_KEY` | Consumer Key for your app |
| API Key Secret | `TWITTER_API_KEY_SECRET` | Consumer Secret for your app |
| Access Token | `TWITTER_ACCESS_TOKEN` | Token for the account that will post |
| Access Token Secret | `TWITTER_ACCESS_TOKEN_SECRET` | Secret for the access token |

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

### 4. Get your API Key and Secret

1. Go to **Keys and tokens** tab inside your app
2. Under **Consumer Keys**, copy:
   - **API Key** → `TWITTER_API_KEY`
   - **API Key Secret** → `TWITTER_API_KEY_SECRET`

### 5. Generate Access Tokens

1. Still on the **Keys and tokens** tab
2. Under **Authentication Tokens**, click **Generate** next to Access Token and Secret
3. Copy:
   - **Access Token** → `TWITTER_ACCESS_TOKEN`
   - **Access Token Secret** → `TWITTER_ACCESS_TOKEN_SECRET`
4. The access token is tied to the account you're logged in as — this is the account PostPigeon will post from

> **Important:** Access tokens generated this way are permanent (they don't expire). Keep them secret.

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
