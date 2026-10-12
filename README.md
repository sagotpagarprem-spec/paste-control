# Universal Pest Control — Enterprise Platform & Production Backend

Production Node.js / Express backend with MySQL persistence, session authentication, and RBAC security for Universal Pest Control.

---

## 1. Environment Configuration

Copy the template configuration file:
```bash
cp .env.example .env
```

Ensure your `.env` contains valid database credentials and secrets:
```ini
# Server Settings
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000

# Database Configuration (MySQL 8.0+)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=universal_pest_control
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_CONNECTION_LIMIT=10

# Security & Sessions
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=24h

# Admin Setup Configuration
ADMIN_SETUP_EMAIL=admin@universalpestcontrol.com
ADMIN_SETUP_PASSWORD=your_secure_admin_password
ADMIN_SETUP_NAME="System Administrator"
ADMIN_SETUP_PHONE=9823044129

# Rate Limiting & CORS
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
CORS_ORIGIN=*
```

---

## 2. MySQL Setup & Schema Migrations

### Prerequisites
- MySQL 8.0 or higher running on `DB_HOST:DB_PORT`.
- A database user with `CREATE`, `ALTER`, `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges.

### Run Schema Migrations
The migration script is completely safe and non-destructive. It initializes tables, schema indexes, foreign keys, RBAC roles, and permissions without dropping or overwriting existing user data:

```bash
npm run db:migrate
```

### Initialized Tables:
- `roles` — System roles (`admin`, `manager`, `technician`, `sales_agent`).
- `permissions` — Granular capability keys (`leads:create`, `bookings:manage`, etc.).
- `role_permissions` — Role-to-permission RBAC mapping.
- `users` — Administrator, technician, and staff user accounts.
- `user_roles` — Many-to-many user assignment to roles.
- `user_sessions` — Server-side persistent session store backed by MySQL.
- `audit_logs` — Security audit trail tracking logins, logouts, and operational actions.
- `leads`, `lead_activities`, `lead_notes` — CRM pipeline with UTM and Meta attribution.
- `bookings`, `technicians`, `customer_reviews`, `service_areas`, `offers`, `blogs`.

---

## 3. First Admin Account Setup

Create or update the primary administrator account using the controlled CLI script without hardcoded default credentials:

### Method A: Using Environment Variables
Set `ADMIN_SETUP_EMAIL` and `ADMIN_SETUP_PASSWORD` in `.env`, then execute:
```bash
npm run admin:create
```

### Method B: Using CLI Flags
Pass explicit credentials directly via command-line arguments:
```bash
node server/scripts/create-admin.js --email=admin@universalpestcontrol.com --password=YourSecurePassword123! --name="Platform Administrator"
```

### Method C: Interactive Terminal Prompt
If executed without arguments or environment variables in a TTY terminal, the command will prompt for email and password securely:
```bash
npm run admin:create
```

*Note: Passwords are automatically hashed using `bcryptjs` with 10 salt rounds. If the account already exists, the password and role are safely updated without touching existing records or relations.*

---

## 4. Starting the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```
The server starts by default on `http://localhost:3000`.

---

## 5. Running Verification Tests

Run the comprehensive Phase 1 backend, MySQL session, and RBAC test suite:
```bash
npm run test:phase1
```

Run all test suites (Phase 1 Auth & Database + Phase 2 Lead CRM):
```bash
npm run test:all
```

---

## 6. Authentication Architecture & Security

- **Server-Side MySQL Session Store**: Each login generates a cryptographically secure random session ID persisted in `user_sessions` with 24-hour expiration.
- **HttpOnly Session Cookies**: Session tokens are transmitted exclusively via `HttpOnly`, `SameSite=lax` (or `strict` in production), `Secure` cookies (`upc_token`). Session tokens are never stored in browser `localStorage`.
- **User Enumeration Protection**: Authentication failures for wrong passwords, inactive accounts, or unknown emails return an identical, generic error: `"Invalid email or password."`.
- **Role-Based Access Control (RBAC)**: Protected endpoints enforce `authenticateToken` and `requireRole('admin')` middleware. Unauthorized requests receive `401 Unauthorized` or `403 Forbidden`.
- **Session Revocation**: Logout (`POST /api/auth/logout`) immediately destroys the session record in MySQL and clears the cookie. Revoked sessions are blocked on subsequent requests.

---

## 7. API Endpoints Reference

### System & Health
- `GET /health` — Load balancer health status (online status, uptime, MySQL connection state).
- `GET /api/health` — API health check returning JSON metadata and database connectivity status.

### Authentication
- `POST /api/auth/login` — Authenticate user.
  - Body: `{ "email": "admin@universalpestcontrol.com", "password": "..." }`
  - Sets HttpOnly `upc_token` session cookie.
- `POST /api/auth/logout` — Invalidate MySQL session and clear session cookie.
- `GET /api/auth/me` — Retrieve currently authenticated user profile and roles (`requires active session`).

### CRM & Admin (Protected)
- `GET /api/leads` — List CRM leads (`authenticateToken`).
- `POST /api/leads` — Ingest inbound lead (public or authenticated).
- `GET /api/cms/admin/overview` — Admin dashboard CMS metrics (`requireRole('admin')`).
- `GET /api/users` — Staff directory (`requireRole('admin')`).

---

## 8. Production Deployment Notes

1. **Reverse Proxy (Nginx / Cloudflare)**:
   - Configure Nginx or Caddy to proxy traffic to `http://127.0.0.1:3000`.
   - Ensure `proxy_set_header X-Forwarded-For $remote_addr;` and `proxy_set_header X-Forwarded-Proto https;` are set so `req.ip` and `req.secure` function accurately.
2. **HTTPS Enforcement**:
   - In production (`NODE_ENV=production`), session cookies automatically require `secure: true`. Ensure SSL/TLS certificates (e.g. Let's Encrypt) are active.
3. **Database Security**:
   - Restrict MySQL user permissions to only required tables.
   - Use strong, randomly generated database passwords.
   - Never commit `.env` or sensitive credentials to version control.
