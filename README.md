# postpigeon

postpigeon posts content to social platforms with scheduling, queue controls, and a React dashboard.

This repository uses a V1 runtime model:
- single compose file: docker-compose.yml
- profile switch only: dev or prod
- dev uses Docker random host port plus optional Portless alias
- prod uses platform provided PORT

## Quick Start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- just
- Portless (optional)

### Install

```bash
npm ci
npm --prefix dashboard ci
```

### Configure Environment

```bash
cp .env.example .env
```

Set required values in .env:
- API_KEY
- API_KEY_SECRET
- ACCESS_TOKEN
- ACCESS_TOKEN_SECRET
- SQLITE_HUB_URL
- SQLITE_HUB_SERVICE_SECRET
- ADMIN_TOKEN
- SESSION_SECRET

### File Storage & Access

PostPigeon uses **sqlite-hub** for file storage with secure header-based authentication:

### Architecture

- **Backend**: Stores only metadata (file_path, size, mime_type) in SQLite
- **Storage**: Actual files stored in sqlite-hub via `db.files` API
- **Content**: Post text stored as `@hub:<file_id>` references, resolved transparently
- **Images**: Stored in per-post folders: `bank/posts/<postId>/`

### Dashboard Access

Files are accessed securely with **long-lived session tokens**:

```javascript
// Automatic initialization on app load
import { initializeFileAccess } from './api.js';
await initializeFileAccess(); // Gets 30-day read-only token

// Use SecureImage component (easiest)
import { SecureImage } from './components/SecureImage.jsx';
<SecureImage fileId={image.file_id} fallbackUrl={image.url} alt="..." />

// Or use the hook directly
import { useFileUrl } from './hooks/useFileUrl.js';
const url = useFileUrl(image.file_id, image.url);
<img src={url} alt="..." />
```

**How it works:**
1. Dashboard requests token from `/api/posts/files/session`
2. Token stored in memory (not localStorage for security)
3. Files fetched with `Authorization: Bearer {token}` header
4. Blob URLs created and cached
5. Automatic fallback to proxy if direct access fails

See [docs/HEADER_AUTH.md](docs/HEADER_AUTH.md) for full details.

---

## Development

```bash
just doctor
just dev
```

Behavior:
- starts dev profile containers
- lets Docker choose a random host port
- detects mapped port
- configures Portless alias automatically
- waits for health endpoint readiness
- streams logs in foreground

Notes:
- Ctrl+C stops dev containers and removes alias

### Production Profile (Local)

```bash
just prod
```

Stop production profile:

```bash
just prod-down
```

## Runtime Topology

### Dev Profile Services
- backend
- frontend
- caddy

### Prod Profile Services
- app

Verify:

```bash
docker-compose --profile dev config --services
docker-compose --profile prod config --services
```

Expected:
- dev: backend, frontend, caddy
- prod: app

## Useful Commands

```bash
just --list
just doctor
just contract
just status
just show-ports
just logs
just smoke
just prod-logs
just lint
just test
```

## Documentation

- Development and production runtime: docs/DEVELOPMENT_PRODUCTION.md
- Developer reference: DEVELOPER.md
