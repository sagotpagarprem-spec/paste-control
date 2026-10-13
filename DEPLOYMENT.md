# UNIVERSAL PEST CONTROL — PRODUCTION DEPLOYMENT GUIDE
## Comprehensive Operations, Security, Database Migrations & External Integrations Manual

---

### 1. ENVIRONMENT CONFIGURATION

Copy `.env.example` to `.env` on the production server:
```bash
cp .env.example .env
```

Ensure the following variables are configured for production:

| Variable | Description | Production Guidance |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | Must be set to `production` |
| `PORT` | Node process listen port | `3000` (or target container port) |
| `APP_URL` | Canonical public URL | E.g., `https://universalpestcontrol.com` |
| `DB_HOST` | MySQL hostname / RDS endpoint | Production MySQL 8.0+ host |
| `DB_PORT` | MySQL connection port | `3306` |
| `DB_NAME` | MySQL database name | `universal_pest_control` |
| `DB_USER` | MySQL user account | Schema migration requires DDL (`CREATE, ALTER, INDEX, REFERENCES`) + DML. Runtime service requires least-privilege DML: `SELECT, INSERT, UPDATE, DELETE` |
| `DB_PASSWORD` | MySQL user password | High-entropy random password |
| `JWT_SECRET` | Session & token signing key | Must be high-entropy, >= 32 characters long. Production startup fails if missing, weak, or default |
| `JWT_EXPIRES_IN` | Session cookie validity | `24h` or `7d` |
| `CORS_ORIGIN` | Allowed cross-origin domains | Set strictly to `https://universalpestcontrol.com` (comma-separated if multiple). Wildcard `*` with credentials is rejected in production |
| `META_PIXEL_ID` | Meta (Facebook) Pixel ID | Obtained from Meta Events Manager |
| `META_APP_SECRET` | Meta App Secret for webhooks | Kept secret on server for SHA256 HMAC signature validation; required for webhook event processing |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta Webhook Verify Token | High-entropy secret token; must be configured for webhook subscription verification |
| `META_ACCESS_TOKEN` | Meta System User Graph API Token | Long-lived token with `leads_retrieval` permission |
| `META_MOCK_MODE` | Sandbox mock mode toggle | Must be set to `false` in production; server enforces real provider delivery in production |
| `WHATSAPP_API_TOKEN` | Meta WhatsApp Cloud API Token | Permanent System User Token from Meta Business Suite |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business Phone ID | ID from WhatsApp API Setup in Meta Developer Console |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | WhatsApp Webhook Verify Token | High-entropy secret token; must be configured for webhook subscription verification |
| `WHATSAPP_MOCK_MODE` | Sandbox mock mode toggle | Must be set to `false` in production; mock mode is strictly disabled in production |

---

### 2. DATABASE INITIALIZATION & MIGRATIONS

The application includes automated, idempotent schema migrations that preserve all existing records:

```bash
# Execute database migration (requires DDL privileges: CREATE, ALTER, INDEX, REFERENCES)
npm run db:migrate
```

**Migration Safety Notes:**
- Migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` semantics.
- Tables are never dropped or truncated, and existing passwords/records are never overwritten.
- Demo seed records (demo users, demo leads, sample technicians) are separated from production migrations and are only populated when `SEED_DEMO_DATA=true` in non-production environments.
- Production schema backups should always be taken prior to schema updates:
  ```bash
  mysqldump -u <user> -p universal_pest_control > backup_$(date +%F_%T).sql
  ```

---

### 3. INITIAL ADMINISTRATOR CREATION

Do not hardcode or commit administrator credentials. Generate the initial root admin using the CLI utility:

```bash
# Method A: Using supported ADMIN_SETUP_* environment variables
ADMIN_SETUP_EMAIL="admin@universalpestcontrol.com" ADMIN_SETUP_PASSWORD="<SuperSecurePassword2026!>" ADMIN_SETUP_NAME="Managing Director" npm run admin:create

# Method B: Using supported CLI flags
npm run admin:create -- --email="admin@universalpestcontrol.com" --password="<SuperSecurePassword2026!>" --name="Managing Director"
```

If the admin account already exists, the utility updates password credentials safely using `bcryptjs` with salt rounds = 10 without resetting other users.

---

### 4. BUILD & PROCESS SUPERVISION

The application runs directly on Node.js v18+ with zero compile-step overhead.

#### Process Supervisor: PM2
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start server in cluster mode
pm2 start server.js --name "upc-production" -i max --env production

# Enable automatic reboot persistence
pm2 save
pm2 startup
```

---

### 5. REVERSE PROXY & HTTPS (NGINX)

Place Nginx in front of Node.js to handle TLS termination, static caching, and HTTP/2.

```nginx
server {
    listen 80;
    server_name universalpestcontrol.com www.universalpestcontrol.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name universalpestcontrol.com www.universalpestcontrol.com;

    ssl_certificate /etc/letsencrypt/live/universalpestcontrol.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/universalpestcontrol.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Forward to Node.js backend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \.(css|js|png|jpg|jpeg|webp|svg|ico|woff2)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

### 6. SESSION COOKIE & SECURITY POLICIES

- In `production` (`NODE_ENV=production`), session cookies are set with `Secure: true`, `HttpOnly: true`, and `SameSite: Lax`.
- `X-Hub-Signature-256` HMAC validation protects Meta Webhook ingestion against replay attacks and spoofing.
- Public rate limiting prevents brute-force submissions (`1000` requests per 15-minute sliding window).

---

### 7. EXTERNAL INTEGRATION ACTIVATION CHECKLISTS

#### A. Meta Pixel Activation
1. Create a Pixel in **Meta Events Manager** and copy the **Pixel ID** (e.g. `123456789012345`).
2. Add `META_PIXEL_ID=123456789012345` to `.env` or save via Admin Dashboard -> Meta Ads Settings.
3. Verify with **Meta Pixel Helper** Chrome extension:
   - `PageView` fires automatically on all pages.
   - `Lead` fires exclusively after HTTP 201 lead confirmation from `/api/leads`.

#### B. WhatsApp Business Cloud API Activation
1. Create a Meta Developer App under **Business** type.
2. Add **WhatsApp** product.
3. Register and verify the business phone number.
4. Create templates matching the names:
   - `lead_welcome_inspection`
   - `booking_confirmed_v1`
   - `technician_assigned_v1`
   - `service_completed_v1`
   - `review_request_v1`
5. Configure Webhook URL in Meta Developer Portal:
   - URL: `https://universalpestcontrol.com/api/whatsapp/webhook`
   - Verify Token: Matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env`.
   - Subscribe to field: `messages`.
6. Set `WHATSAPP_MOCK_MODE=false` in `.env`.

#### C. Meta Lead Ads Webhook Activation
1. In Meta Developer App, add **Webhooks** -> Object: **Page**.
2. Configure Webhook URL:
   - Callback URL: `https://universalpestcontrol.com/api/meta/webhook`
   - Verify Token: Matches `META_WEBHOOK_VERIFY_TOKEN` in `.env`.
3. Subscribe Page to `leadgen` permissions in Meta App Settings.
4. Set `META_MOCK_MODE=false` in `.env`.
5. Test using the official **Meta Lead Ads Testing Tool**.

---

### 8. ROLLBACK & DISASTER RECOVERY GUIDANCE

- **Zero Data Loss Rule**: Never drop tables or run destructive queries during rollbacks.
- **Application Code Rollback**:
  ```bash
  git checkout <previous_commit_hash>
  npm install --production
  pm2 reload upc-production
  ```
- **Database Schema Rollback**:
  Because all migrations only add tables and columns without destructive alterations, old application versions can safely run against newer schema versions.
