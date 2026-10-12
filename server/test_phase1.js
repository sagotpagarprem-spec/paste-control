// Universal Pest Control — Phase 1 Production Backend & Auth Verification Suite
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { query, checkConnection } = require('./config/database');
const sessionModel = require('./models/sessionModel');
const logger = require('./utils/logger');

async function runPhase1Tests() {
  console.log('=====================================================================');
  console.log('UNIVERSAL PEST CONTROL — PHASE 1 VERIFICATION SUITE');
  console.log('Backend, MySQL Persistence, Session Cookies & RBAC Protection');
  console.log('=====================================================================\n');

  // Start ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Test HTTP server running at: ${baseUrl}\n`);

  // Helper HTTP request wrapper
  async function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, baseUrl);
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const r = http.request(u, { method, headers: reqHeaders }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookies: res.headers['set-cookie'] || [],
            body: json || data
          });
        });
      });
      r.on('error', reject);
      if (body) {
        r.write(typeof body === 'object' ? JSON.stringify(body) : body);
      }
      r.end();
    });
  }

  const results = [];

  // Helper to record test results
  function assert(name, condition, details = '') {
    results.push({ name, passed: Boolean(condition), details });
    const status = condition ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // 1. Database Connectivity Check
    const dbConnected = await checkConnection();
    assert(
      'MySQL Database Connection',
      dbConnected,
      dbConnected ? 'Successfully connected to MySQL database pool' : 'Database connection unavailable'
    );

    // 2. Health Check Endpoints
    const healthApiRes = await makeRequest('GET', '/api/health');
    assert(
      'GET /api/health Endpoint',
      healthApiRes.status === 200 && healthApiRes.body?.success === true,
      `Status ${healthApiRes.status}, status=${healthApiRes.body?.data?.status}, database connected=${healthApiRes.body?.data?.database?.connected}`
    );

    const rootHealthRes = await makeRequest('GET', '/health');
    assert(
      'GET /health Root Endpoint',
      rootHealthRes.status === 200 && rootHealthRes.body?.status === 'ONLINE',
      `Status ${rootHealthRes.status}, uptime=${Math.round(rootHealthRes.body?.uptime || 0)}s`
    );

    // 3. MySQL user_sessions Table Verification
    const sessionTableRows = await query(`SHOW TABLES LIKE 'user_sessions'`);
    assert(
      'MySQL user_sessions Table Exists',
      sessionTableRows.length > 0,
      'user_sessions table found in database schema'
    );

    // 4. Admin Login with Invalid Password (Generic Error Guard)
    const badLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@universalpestcontrol.com',
      password: 'WrongPassword123!'
    });
    assert(
      'POST /api/auth/login with Wrong Password',
      badLoginRes.status === 401 && badLoginRes.body?.message === 'Invalid email or password.',
      `Status: ${badLoginRes.status}, message: "${badLoginRes.body?.message}"`
    );

    // 5. Admin Login with Non-Existent Email (User Enumeration Defense)
    const unknownUserRes = await makeRequest('POST', '/api/auth/login', {
      email: 'nonexistent_attacker_target@example.com',
      password: 'SomeRandomPassword999!'
    });
    assert(
      'POST /api/auth/login Non-Existent User Enumeration Defense',
      unknownUserRes.status === 401 && unknownUserRes.body?.message === 'Invalid email or password.',
      `Generic message returned: "${unknownUserRes.body?.message}"`
    );

    // 6. Admin Login with Valid Credentials
    const validLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@universalpestcontrol.com',
      password: 'Admin@1234'
    });

    const setCookieHeader = validLoginRes.cookies;
    const cookieString = setCookieHeader.join('; ');
    const hasHttpOnly = cookieString.toLowerCase().includes('httponly');
    const hasUpcTokenCookie = cookieString.includes('upc_token=');
    const sessionId = validLoginRes.body?.data?.sessionId;

    assert(
      'POST /api/auth/login Valid Admin Authentication',
      validLoginRes.status === 200 && validLoginRes.body?.success === true,
      `Status ${validLoginRes.status}, user: ${validLoginRes.body?.data?.user?.email}, roles: [${validLoginRes.body?.data?.user?.roles?.join(', ')}]`
    );

    assert(
      'HttpOnly Session Cookie Transmitted',
      hasHttpOnly && hasUpcTokenCookie,
      `Cookie contains HttpOnly flag and upc_token: ${hasHttpOnly ? 'YES' : 'NO'}`
    );

    // 7. Verify Session is Persisted in MySQL user_sessions Table
    let dbSessionRecord = null;
    if (sessionId) {
      const rows = await query(`SELECT * FROM user_sessions WHERE id = ? LIMIT 1`, [sessionId]);
      dbSessionRecord = rows[0] || null;
    }
    assert(
      'Session Persisted in MySQL user_sessions Table',
      dbSessionRecord !== null,
      dbSessionRecord ? `Session ID '${sessionId.substring(0, 16)}...' found in MySQL, expires_at: ${dbSessionRecord.expires_at}` : 'Session not found in DB'
    );

    // 8. Extract cookie for subsequent authenticated requests
    const cookieHeader = setCookieHeader.map(c => c.split(';')[0]).join('; ');

    // 9. Current User Profile via Session Cookie (GET /api/auth/me)
    const meRes = await makeRequest('GET', '/api/auth/me', null, {
      Cookie: cookieHeader
    });
    assert(
      'GET /api/auth/me via Session Cookie',
      meRes.status === 200 && meRes.body?.data?.email === 'admin@universalpestcontrol.com',
      `Status ${meRes.status}, user id=${meRes.body?.data?.id}, name="${meRes.body?.data?.name}"`
    );

    // 10. GET /api/auth/me without Cookie/Token (Security Guard: 401)
    const unauthMeRes = await makeRequest('GET', '/api/auth/me');
    assert(
      'GET /api/auth/me Unauthenticated Protection',
      unauthMeRes.status === 401,
      `Status ${unauthMeRes.status} (Properly blocked unauthorized access)`
    );

    // 11. Role-Based Access Control on Admin Routes
    const adminOverviewRes = await makeRequest('GET', '/api/cms/admin/overview', null, {
      Cookie: cookieHeader
    });
    assert(
      'Admin-Only Endpoint RBAC (Authorized)',
      adminOverviewRes.status === 200,
      `Status ${adminOverviewRes.status} on /api/cms/admin/overview`
    );

    const unauthOverviewRes = await makeRequest('GET', '/api/cms/admin/overview');
    assert(
      'Admin-Only Endpoint RBAC (Unauthenticated Block)',
      unauthOverviewRes.status === 401,
      `Status ${unauthOverviewRes.status} without authentication`
    );

    // 12. Admin Logout and Session Invalidation in MySQL (POST /api/auth/logout)
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, {
      Cookie: cookieHeader
    });
    assert(
      'POST /api/auth/logout Endpoint',
      logoutRes.status === 200 && logoutRes.body?.success === true,
      `Status ${logoutRes.status}, message="${logoutRes.body?.message}"`
    );

    // 13. Verify Session was Deleted from MySQL user_sessions Table
    let sessionAfterLogout = null;
    if (sessionId) {
      const rowsAfter = await query(`SELECT * FROM user_sessions WHERE id = ? LIMIT 1`, [sessionId]);
      sessionAfterLogout = rowsAfter[0] || null;
    }
    assert(
      'Session Deleted from MySQL on Logout',
      sessionAfterLogout === null,
      sessionAfterLogout === null ? 'Session successfully removed from MySQL database' : 'Session still exists in DB'
    );

    // 14. Access with Expired/Revoked Session Cookie Fails (Security Guard)
    const meAfterLogoutRes = await makeRequest('GET', '/api/auth/me', null, {
      Cookie: cookieHeader
    });
    assert(
      'Revoked Session Rejected on Subsequent Request',
      meAfterLogoutRes.status === 401,
      `Status ${meAfterLogoutRes.status} (Session token successfully rejected after logout)`
    );

  } catch (err) {
    console.error('Unexpected error during Phase 1 testing:', err);
    assert('Test Suite Execution', false, err.message);
  } finally {
    server.close();
  }

  // Summary
  console.log('\n=====================================================================');
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  if (allPassed) {
    console.log('OVERALL RESULT: ALL PHASE 1 REQUIREMENTS VERIFIED SUCCESSFULLY!');
  } else {
    console.log('OVERALL RESULT: SOME CHECKS FAILED');
  }
  console.log('=====================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runPhase1Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
