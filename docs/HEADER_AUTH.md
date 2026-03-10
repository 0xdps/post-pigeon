# Header-Based File Authentication

## Overview

Dashboard now supports **secure header-based authentication** for accessing files from sqlite-hub instead of URL query parameters. This provides better security as tokens won't appear in logs or browser history.

## How It Works

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│  Dashboard  │ ──── POST /files/session ───► │   Service    │ ──────────────────► │ sqlite-hub  │
│             │ ◄───── {session, db, url} ──── │              │                      │             │
└─────────────┘                    └──────────────┘                    └─────────────┘
      │                                                                         ▲
      │                                                                         │
      └─── GET /db/file/:id (Authorization: Bearer token) ───────────────────┘
           (Fetches file, creates blob URL)
```

## Implementation

### 1. Backend (Already Done ✅)

The service provides a session token endpoint:

**File:** `service/http/routes/images.js`
```javascript
POST /api/posts/files/session
→ Returns: { session: "token", db: "postpigeon", base_url: "http://..." }
```

**File:** `service/posting/sqlite-hub-upload.js`
```javascript
createFileReadSessionToken(expiresInSeconds)
→ Creates read-only token with 30-day expiry
```

### 2. Frontend File Manager

**File:** `dashboard/src/fileManager.js`

- Stores session token in memory
- Fetches files with `Authorization: Bearer {token}` header
- Creates blob URLs from responses
- Caches blob URLs to avoid re-fetching
- Gracefully falls back to proxy if session unavailable

### 3. React Hooks

**File:** `dashboard/src/hooks/useFileUrl.js`

```javascript
import { useFileUrl } from './hooks/useFileUrl.js';

function MyComponent({ image }) {
  const url = useFileUrl(image.file_id, image.url);
  return <img src={url} alt={image.filename} />;
}
```

**Batch fetch multiple images:**
```javascript
import { useFileUrls } from './hooks/useFileUrl.js';

function Gallery({ images }) {
  const files = images.map(img => ({ id: img.file_id, fallback: img.url }));
  const urlMap = useFileUrls(files);
  
  return images.map(img => (
    <img key={img.id} src={urlMap.get(img.file_id)} alt={img.filename} />
  ));
}
```

### 4. Auto-Initialization

**File:** `dashboard/src/components/Layout.jsx`

The file manager initializes automatically when the app loads:

```javascript
useEffect(() => {
  initializeFileAccess().then((success) => {
    if (success) {
      console.log('Direct file access enabled');
    } else {
      console.log('Using proxy fallback');
    }
  });
}, []);
```

## Security Benefits

✅ **No tokens in URLs** - Headers aren't logged in browser history  
✅ **Read-only access** - Token scope limited to `files:read`  
✅ **Expiring tokens** - 30-day expiry (configurable)  
✅ **No CORS issues** - Same-origin or proper CORS headers required  

## Proxy Fallback

If direct access fails (network issue, CORS, etc.), the system automatically falls back to:

```
GET /api/posts/files/:fileId → Service proxies to sqlite-hub
```

This ensures images **always display**, even if direct access is unavailable.

## Memory Management

Blob URLs are cached but can be cleaned up:

```javascript
import { fileManager } from './fileManager.js';

// Clean all cached blobs (on logout, route change, etc.)
fileManager.cleanup();

// Revoke specific blob
fileManager.revokeBlobUrl(fileId);
```

## Migration Guide

**Before:**
```jsx
<img src={image.url} alt={image.filename} />
```

**After:**
```jsx
const imageUrl = useFileUrl(image.file_id, image.url);
<img src={imageUrl} alt={image.filename} />
```

That's it! The hook handles:
- Fetching with auth headers
- Creating blob URLs
- Caching
- Fallback to proxy

## Testing

1. Start dev server: `just dev`
2. Open browser console
3. Look for: `[FileManager] Initialized with direct file access`
4. Network tab should show requests to sqlite-hub with `Authorization: Bearer ...` header
5. Images should load from blob URLs: `blob:http://localhost:5173/...`

## Configuration

No additional env vars needed! Uses existing:
- `SQLITE_HUB_URL`
- `SQLITE_HUB_SERVICE_SECRET`
- `SQLITE_HUB_DB`

Session tokens are created on-demand via the backend.
