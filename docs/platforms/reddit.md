# Reddit — API Credentials Guide

> **Adapter status:** Not yet implemented 🚧

## Required credentials

| Field | ENV var (planned) | Description |
|-------|-------------------|-------------|
| Client ID | `REDDIT_CLIENT_ID` | Your app's client ID (shown below the app name) |
| Client Secret | `REDDIT_CLIENT_SECRET` | Your app's secret |
| Username | `REDDIT_USERNAME` | Reddit username of the posting account |
| Password | `REDDIT_PASSWORD` | Reddit password of the posting account |
| User Agent | `REDDIT_USER_AGENT` | Identifies your app to Reddit's API |

> Reddit uses **password-based OAuth** (script app type) — no browser OAuth flow needed. Your username and password are exchanged for a token behind the scenes.

---

## Step-by-step setup

### 1. Create a Reddit app

> **Note on the Responsible Builder Policy:** Reddit shows a link to their policy page when you first visit the apps page. That page has no "Accept" button — it's just an informational document. You don't need to do anything there. Just close it and proceed with the steps below.

1. Log in to Reddit as the account you want to post from
2. Go to [old.reddit.com/prefs/apps](https://old.reddit.com/prefs/apps) — the old Reddit interface is more reliable for this

> If you see a message about the Responsible Builder Policy, read it and come back — there is no button to click. Just navigate back to the prefs/apps page.
3. Scroll down and click **Create another app…**
4. Fill in:
   - **Name:** PostPigeon
   - **Type:** Select **script** (this is critical — script apps use password auth)
   - **Description:** Optional
   - **About URL:** Optional (any URL)
   - **Redirect URI:** `http://localhost` (required but unused for script apps)
5. Click **Create app**

### 2. Copy your credentials

After creation, you'll see the app listed:

```
PostPigeon
personal use script
[CLIENT_ID shown here — the short string under the app name]
secret: [CLIENT_SECRET shown here]
```

- The string directly under the app name is your **Client ID** → `REDDIT_CLIENT_ID`
- The `secret` value is your **Client Secret** → `REDDIT_CLIENT_SECRET`

### 3. Set your user agent

Reddit requires a descriptive user agent string. Use this format:

```
script:PostPigeon:v1.0 (by /u/YOUR_USERNAME)
```

For example:
```
REDDIT_USER_AGENT=script:PostPigeon:v1.0 (by /u/devendra)
```

> Reddit **bans** generic user agents like `python-requests` or `axios`. Always use a descriptive, unique string.

### 4. Verify your account

Reddit may require your account to be at least a few days old and have some karma before the API allows posting. If you get `403` errors, this is likely the cause.

---

## How Reddit posting works

When PostPigeon posts to Reddit, it needs to know **which subreddit** to post to. This is configured per-post in the Compose page under the Reddit metadata section:

- **Subreddit** — e.g. `r/programming` (required)
- **Post type** — `link` or `self` (text post). PostPigeon uses `self` posts
- **NSFW / Spoiler** — optional flags

---

## Rate limits

Reddit enforces:
- **1 post per 10 minutes** per account (new accounts may have stricter limits)
- **1 comment per second**

PostPigeon's cooldown settings help avoid hitting these limits.

---

## Common errors

| Error | Likely cause |
|-------|-------------|
| `403 Forbidden` | Account too new, banned from subreddit, or subreddit requires approval |
| `RATELIMIT` | Posting too frequently — increase `COOLDOWN_MINUTES` |
| `SUBREDDIT_NOTALLOWED` | Your account doesn't meet the subreddit's posting requirements |
| `Invalid credentials` | Wrong username/password, or 2FA is enabled (disable 2FA for script apps) |

> **2FA note:** Script apps don't support two-factor authentication. If your Reddit account has 2FA enabled, you must disable it or create a separate posting account.

---

## Notes

- Reddit does **not** support threads — only the first part of a thread post will be published
- Subreddit rules vary widely — some require a minimum account age or karma
- Posts to some subreddits may be automatically filtered by AutoModerator until a mod approves them
