// Smoke Test for Phase 2 Lead CRM and Attribution
const http = require('http');
const app = require('c:/paste control/server/app');
const { generateToken } = require('c:/paste control/server/utils/jwt');
const { pool } = require('c:/paste control/server/config/database');

async function runPhase2Tests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Phase 2 Test server running on ${baseUrl}`);

  async function req(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, baseUrl);
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const r = http.request(u, { method, headers: reqHeaders }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json || data });
        });
      });
      r.on('error', reject);
      if (body) {
        r.write(typeof body === 'object' ? JSON.stringify(body) : body);
      }
      r.end();
    });
  }

  // Token for admin user
  const adminToken = generateToken({ id: 1, email: 'admin@universalpestcontrol.com', role: 'admin', roles: ['admin'] });
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const results = [];

  // 1. Staff users list (GET /api/users)
  const usersRes = await req('GET', '/api/users', null, authHeaders);
  results.push({
    name: 'GET /api/users (Staff listing)',
    passed: usersRes.status === 200 && Array.isArray(usersRes.body?.data),
    details: `Status ${usersRes.status}, count: ${usersRes.body?.data?.length || 0}`
  });

  // 2. Lead creation with full attributes and UTM attribution
  const testPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
  const leadPayload = {
    name: 'Rajesh Sharma',
    phone: testPhone,
    email: 'rajesh.test@example.com',
    service: 'Termite Control',
    propertyType: 'Villa / Independent House',
    city: 'Mumbai',
    area: 'Andheri West',
    address: 'Flat 402, Sunshine Heights, Lokhandwala',
    urgency: 'HIGH',
    message: 'Need urgent termite inspection in master bedroom wooden cabinets',
    source: 'Website - Smart Wizard',
    campaign: 'MonsoonTermite2026',
    adName: 'TermiteDrillAd_V2',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'MonsoonTermite2026',
    utmContent: 'ad_banner_termite',
    utmTerm: 'best termite treatment mumbai',
    fbclid: null,
    gclid: 'CjwKCAjwTESTGCLID12345',
    landingPage: '/services/termite-control.html',
    referrer: 'https://www.google.com/'
  };

  const createRes = await req('POST', '/api/leads', leadPayload);
  const createdLead = createRes.body?.data;
  results.push({
    name: 'POST /api/leads (Create public lead with UTM attribution)',
    passed: createRes.status === 201 && createdLead && createdLead.id && createdLead.phone === testPhone,
    details: `Status ${createRes.status}, Lead ID: ${createdLead?.id}`
  });

  // 3. Duplicate detection test (same phone within 48h)
  const duplicatePayload = {
    name: 'Rajesh Sharma',
    phone: testPhone,
    email: 'rajesh.test@example.com',
    service: 'Cockroach Control',
    message: 'Also inquiring about kitchen cockroaches',
    source: 'Website - Callback Form'
  };
  const dupRes = await req('POST', '/api/leads', duplicatePayload);
  results.push({
    name: 'POST /api/leads (Controlled duplicate detection)',
    passed: (dupRes.status === 200 || dupRes.status === 201) && dupRes.body?.data?.isDuplicate === true,
    details: `Status ${dupRes.status}, isDuplicate: ${dupRes.body?.data?.isDuplicate}, parent: ${dupRes.body?.data?.duplicateOfId}`
  });

  // 4. GET /api/leads with filters and pagination
  const listRes = await req('GET', '/api/leads?page=1&limit=10&status=NEW', null, authHeaders);
  results.push({
    name: 'GET /api/leads (Filtered list & pagination metadata)',
    passed: listRes.status === 200 && Array.isArray(listRes.body?.data) && listRes.body?.pagination?.page === 1,
    details: `Status ${listRes.status}, total: ${listRes.body?.pagination?.total || 0}`
  });

  // 5. GET /api/leads/:id (Lead detail with notes and timeline)
  const detailRes = await req('GET', `/api/leads/${createdLead.id}`, null, authHeaders);
  results.push({
    name: `GET /api/leads/${createdLead.id} (Lead detail hydration)`,
    passed: detailRes.status === 200 && detailRes.body?.data?.id === createdLead.id && Array.isArray(detailRes.body?.data?.activities),
    details: `Status ${detailRes.status}, activities count: ${detailRes.body?.data?.activities?.length || 0}`
  });

  // 6. PUT /api/leads/:id (Status change, assignment, estimated value, follow-up)
  const updateRes = await req('PUT', `/api/leads/${createdLead.id}`, {
    status: 'SITE_VISIT',
    assignedTo: 2,
    estimatedValue: 4500,
    followUpDate: '2026-10-10'
  }, authHeaders);
  results.push({
    name: `PUT /api/leads/${createdLead.id} (Update status to SITE_VISIT & assign)`,
    passed: updateRes.status === 200 && updateRes.body?.data?.status === 'SITE_VISIT' && updateRes.body?.data?.assignedTo === 2,
    details: `Status ${updateRes.status}, updated status: ${updateRes.body?.data?.status}`
  });

  // 7. POST /api/leads/:id/notes (Add note and record activity)
  const noteRes = await req('POST', `/api/leads/${createdLead.id}/notes`, {
    note: 'Customer confirmed site inspection on Saturday morning at 11 AM.'
  }, authHeaders);
  results.push({
    name: `POST /api/leads/${createdLead.id}/notes (Create note & activity)`,
    passed: noteRes.status === 201 && noteRes.body?.data?.id,
    details: `Status ${noteRes.status}, note ID: ${noteRes.body?.data?.id}`
  });

  // 8. Re-fetch detail to verify timeline has status change, duplicate, and note activities
  const reDetailRes = await req('GET', `/api/leads/${createdLead.id}`, null, authHeaders);
  const activities = reDetailRes.body?.data?.activities || [];
  const hasStatusChange = activities.some(a => a.activityType === 'STATUS_CHANGE');
  const hasNoteActivity = activities.some(a => a.activityType === 'NOTE_ADDED');
  results.push({
    name: 'Activity Timeline persistence',
    passed: hasStatusChange && hasNoteActivity,
    details: `Total activities: ${activities.length}, types: ${activities.map(a => a.activityType).join(', ')}`
  });

  server.close();

  console.log('\n--- PHASE 2 TEST RESULTS ---');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    if (!r.passed) allPassed = false;
    console.log(`[${icon}] ${r.name} -> ${r.details}`);
  }
  console.log(`\nOverall Result: ${allPassed ? 'ALL PHASE 2 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 tests failed with error:', err);
  process.exit(1);
});
