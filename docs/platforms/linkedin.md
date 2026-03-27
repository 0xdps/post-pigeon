# LinkedIn — API Credentials Guide

> **Adapter status:** Not yet implemented 🚧

## Required credentials

| Field | ENV var (planned) | Description |
|-------|-------------------|-------------|
| Client ID | `LINKEDIN_CLIENT_ID` | Your LinkedIn app's client ID |
| Client Secret | `LINKEDIN_CLIENT_SECRET` | Your LinkedIn app's client secret |
| Access Token | `LINKEDIN_ACCESS_TOKEN` | OAuth 2.0 token for the posting account |
| Person URN | `LINKEDIN_PERSON_URN` | The `urn:li:person:XXXXXX` ID of your account |

> LinkedIn uses **OAuth 2.0**. The access token expires after **60 days** and must be refreshed. PostPigeon will handle token refresh automatically once the adapter is implemented.

---

## Step-by-step setup

### 1. Create a LinkedIn developer app

1. Go to [linkedin.com/developers](https://www.linkedin.com/developers/apps) and sign in
2. Click **Create app**
3. Fill in:
   - **App name:** PostPigeon (or anything you like)
   - **LinkedIn Page:** Associate it with your personal profile or a company page (required — create a dummy page if needed)
   - **App logo:** Upload any image
4. Accept the terms and click **Create app**

### 2. Request the right API products

1. Open your app → **Products** tab
2. Request access to **Share on LinkedIn** — this allows posting text and media to a member's feed
3. Optionally request **Sign In with LinkedIn using OpenID Connect** if you want to verify the user identity

> Approval for **Share on LinkedIn** is usually immediate (no manual review required).

### 3. Configure OAuth settings

1. Go to **Auth** tab
2. Note your **Client ID** and **Client Secret**
3. Under **OAuth 2.0 settings**, add a redirect URL:
   - For local development: `http://localhost:3000/auth/linkedin/callback`
   - For production: your deployed service URL + `/auth/linkedin/callback`

### 4. Get an access token

LinkedIn doesn't offer permanent tokens like Twitter — you must go through the OAuth 2.0 flow. Once the PostPigeon UI-based auth is implemented, this will happen in the browser. Until then, you can generate one manually:

**Option A — Using LinkedIn's OAuth playground:**

1. Construct this URL (replace `YOUR_CLIENT_ID` and `YOUR_REDIRECT_URI`):
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=openid%20profile%20w_member_social
   ```
2. Visit the URL in your browser, approve access
3. You'll be redirected — copy the `code` parameter from the URL
4. Exchange it for a token:
   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=CODE&redirect_uri=YOUR_REDIRECT_URI&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
   ```
5. Copy the `access_token` from the response → `LINKEDIN_ACCESS_TOKEN`

### 5. Get your Person URN

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.linkedin.com/v2/userinfo
```

The response includes `sub` — that's your Person URN. Use it as:
```
LINKEDIN_PERSON_URN=urn:li:person:XXXXXX
```

---

## Scopes required

| Scope | Purpose |
|-------|---------|
| `openid` | Identify the user |
| `profile` | Read basic profile info |
| `w_member_social` | Post on behalf of the member |

---

## Token expiry

LinkedIn access tokens expire after **60 days**. The refresh token lasts **365 days**. PostPigeon will store the refresh token and automatically renew the access token in the background.

---

## Notes

- LinkedIn does **not** support threads — only the first tweet of a thread post will be published
- Image posts use the LinkedIn Asset API (upload first, then attach)
- Company page posting requires the `rw_organization_admin` scope and additional app approval
