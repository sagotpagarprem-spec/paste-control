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

  // 9. PATCH /api/leads/:id/status (Specific status route)
  const patchStatusRes = await req('PATCH', `/api/leads/${createdLead.id}/status`, { status: 'QUALIFIED' }, authHeaders);
  results.push({
    name: `PATCH /api/leads/${createdLead.id}/status (Status route)`,
    passed: patchStatusRes.status === 200 && patchStatusRes.body?.data?.status === 'QUALIFIED',
    details: `Status ${patchStatusRes.status}, lead status: ${patchStatusRes.body?.data?.status}`
  });

  // 10. PATCH /api/leads/:id/assign (Assign technician)
  const patchAssignRes = await req('PATCH', `/api/leads/${createdLead.id}/assign`, { technicianId: 1 }, authHeaders);
  results.push({
    name: `PATCH /api/leads/${createdLead.id}/assign (Technician assignment)`,
    passed: patchAssignRes.status === 200 && patchAssignRes.body?.data?.assigned_technician_id === 1,
    details: `Status ${patchAssignRes.status}, assigned_technician_id: ${patchAssignRes.body?.data?.assigned_technician_id}, tech_name: ${patchAssignRes.body?.data?.technician_name}`
  });

  // 11. PATCH /api/leads/:id (Update preferred_date, preferred_time, admin_notes)
  const patchFieldsRes = await req('PATCH', `/api/leads/${createdLead.id}`, {
    preferred_date: '2026-10-15',
    preferred_time: '14:00',
    admin_notes: 'Urgent termite treatment required for bungalow.'
  }, authHeaders);
  results.push({
    name: `PATCH /api/leads/${createdLead.id} (Preferred date, time, and admin notes)`,
    passed: patchFieldsRes.status === 200 &&
            patchFieldsRes.body?.data?.preferred_date === '2026-10-15' &&
            patchFieldsRes.body?.data?.preferred_time === '14:00',
    details: `Status ${patchFieldsRes.status}, date: ${patchFieldsRes.body?.data?.preferred_date}, time: ${patchFieldsRes.body?.data?.preferred_time}`
  });

  // 12. Public user denial for administrative operations (Unauthenticated requests must get 401)
  const unauthListRes = await req('GET', '/api/leads');
  const unauthDetailRes = await req('GET', `/api/leads/${createdLead.id}`);
  const unauthStatusRes = await req('PATCH', `/api/leads/${createdLead.id}/status`, { status: 'BOOKED' });
  const unauthAssignRes = await req('PATCH', `/api/leads/${createdLead.id}/assign`, { technicianId: 1 });
  const allDenied = unauthListRes.status === 401 && unauthDetailRes.status === 401 && unauthStatusRes.status === 401 && unauthAssignRes.status === 401;
  results.push({
    name: 'Public user denial for administrative endpoints (401 Unauthorized)',
    passed: allDenied,
    details: `List: ${unauthListRes.status}, Detail: ${unauthDetailRes.status}, Status: ${unauthStatusRes.status}, Assign: ${unauthAssignRes.status}`
  });

  // 13. Input validation errors on POST /api/leads (Missing phone / invalid format -> 422)
  const invalidLeadRes = await req('POST', '/api/leads', { name: 'Incomplete User' });
  results.push({
    name: 'POST /api/leads validation rejection (Missing phone returns 422)',
    passed: invalidLeadRes.status === 422,
    details: `Status ${invalidLeadRes.status}, message: ${invalidLeadRes.body?.message}`
  });

  // 14. DELETE /api/leads/:id (Soft-delete / Archive lead)
  const deleteRes = await req('DELETE', `/api/leads/${createdLead.id}`, null, authHeaders);
  results.push({
    name: `DELETE /api/leads/${createdLead.id} (Archive / Soft-delete lead)`,
    passed: deleteRes.status === 200 && Boolean(deleteRes.body?.data?.is_archived) === true,
    details: `Status ${deleteRes.status}, is_archived: ${deleteRes.body?.data?.is_archived}`
  });

  // 15. Verify archived lead exclusion from default listing
  const activeListRes = await req('GET', `/api/leads?search=${testPhone}`, null, authHeaders);
  const archivedListRes = await req('GET', `/api/leads?search=${testPhone}&includeArchived=true`, null, authHeaders);
  const isLead45Excluded = !activeListRes.body?.data?.some(l => l.id === createdLead.id);
  const isLead45InArchived = Boolean(archivedListRes.body?.data?.some(l => l.id === createdLead.id));
  results.push({
    name: 'Archived lead exclusion & includeArchived filter',
    passed: isLead45Excluded && isLead45InArchived,
    details: `Excluded by default: ${isLead45Excluded}, Found when includeArchived=true: ${isLead45InArchived}`
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
