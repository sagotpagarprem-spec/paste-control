// Phase 5 Test Suite — Universal Pest Control Technician & Dispatch System
const http = require('http');
const app = require('./app');
const { generateToken } = require('./utils/jwt');

async function runPhase5Tests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`\n======================================================`);
  console.log(`🚀 Running Phase 5 Technician & Dispatch Test Suite on ${baseUrl}`);
  console.log(`======================================================\n`);

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

  const adminToken = generateToken({ id: 1, email: 'admin@universalpestcontrol.com', role: 'admin', roles: ['admin'] });
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const results = [];
  const testSuffix = Math.floor(1000 + Math.random() * 9000);
  const testPhone = `+91 97600 ${testSuffix}`;

  // ---------------------------------------------------------
  // 1. TECHNICIAN MANAGEMENT CRUD
  // ---------------------------------------------------------
  // 1a. List technicians
  const listTechRes = await req('GET', '/api/technicians', null, authHeaders);
  results.push({
    name: 'GET /api/technicians (List all technicians with skills & areas)',
    passed: listTechRes.status === 200 && Array.isArray(listTechRes.body?.data) && listTechRes.body.data.length > 0,
    details: `Status: ${listTechRes.status}, count: ${listTechRes.body?.data?.length || 0}`
  });

  // 1b. Unauthenticated create rejected (Security check)
  const unauthCreate = await req('POST', '/api/technicians', { name: 'Unauthorized Tech' });
  results.push({
    name: 'POST /api/technicians without token (Security Check: 401)',
    passed: unauthCreate.status === 401,
    details: `Status: ${unauthCreate.status}`
  });

  // 1c. Create new technician
  const createTechRes = await req('POST', '/api/technicians', {
    name: `Prashant More ${testSuffix}`,
    phone: testPhone,
    email: `prashant.more.${testSuffix}@universalpest.in`,
    specialization: 'Fumigation & Cockroach Gel',
    skills: ['Fumigation Safety', 'Bayer Cockroach Gel', 'Commercial Food IPM'],
    serviceAreas: ['Kothrud', 'Karve Nagar', 'Deccan'],
    availability: 'AVAILABLE',
    status: 'ACTIVE',
    profileImage: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80'
  }, authHeaders);

  const createdTech = createTechRes.body?.data;
  results.push({
    name: 'POST /api/technicians (Create technician with skills, areas, availability)',
    passed: createTechRes.status === 201 && createdTech && Array.isArray(createdTech.skills) && createdTech.status === 'ACTIVE',
    details: `Status: ${createTechRes.status}, id: ${createdTech?.id}, skills: ${createdTech?.skills?.length || 0}`
  });

  const techId = createdTech?.id;

  // 1d. Get technician by ID
  const getTechRes = await req('GET', `/api/technicians/${techId}`, null, authHeaders);
  results.push({
    name: 'GET /api/technicians/:id (Retrieve technician details with stats)',
    passed: getTechRes.status === 200 && getTechRes.body?.data?.name?.includes(testSuffix.toString()),
    details: `Status: ${getTechRes.status}, name: ${getTechRes.body?.data?.name}`
  });

  // 1e. Update technician
  const updateTechRes = await req('PUT', `/api/technicians/${techId}`, {
    specialization: 'Senior Fumigation & Termite Specialist',
    skills: ['Fumigation Safety', 'Bayer Cockroach Gel', 'Commercial Food IPM', 'Radar Drill-Fill']
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id (Update technician profile)',
    passed: updateTechRes.status === 200 && updateTechRes.body?.data?.skills?.length === 4,
    details: `Status: ${updateTechRes.status}, skills count: ${updateTechRes.body?.data?.skills?.length}`
  });

  // 1f. Update status (ON_LEAVE)
  const statusRes = await req('PUT', `/api/technicians/${techId}/status`, { status: 'ON_LEAVE' }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/status (Set status to ON_LEAVE)',
    passed: statusRes.status === 200 && statusRes.body?.data?.status === 'ON_LEAVE',
    details: `Status: ${statusRes.status}, newStatus: ${statusRes.body?.data?.status}`
  });

  // 1g. Re-activate status (ACTIVE)
  const reactivateRes = await req('PUT', `/api/technicians/${techId}/status`, { status: 'ACTIVE' }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/status (Reactivate status to ACTIVE)',
    passed: reactivateRes.status === 200 && reactivateRes.body?.data?.status === 'ACTIVE',
    details: `Status: ${reactivateRes.status}, newStatus: ${reactivateRes.body?.data?.status}`
  });

  // 1h. Update availability (AVAILABLE)
  const availRes = await req('PUT', `/api/technicians/${techId}/availability`, { availability: 'AVAILABLE' }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/availability (Update availability)',
    passed: availRes.status === 200 && availRes.body?.data?.availability === 'AVAILABLE',
    details: `Status: ${availRes.status}, availability: ${availRes.body?.data?.availability}`
  });

  // ---------------------------------------------------------
  // 2. BOOKING CREATION & TECHNICIAN ASSIGNMENT
  // ---------------------------------------------------------
  // 2a. Create a booking
  const createBookingRes = await req('POST', '/api/bookings', {
    name: `Siddharth Joshi ${testSuffix}`,
    phone: `+91 98220 ${testSuffix}`,
    service: 'Termite Radar Inspection & Barrier',
    propertyType: '2 BHK Apartment',
    date: new Date().toISOString().split('T')[0], // Today
    timeSlot: '11:00 AM – 01:00 PM',
    address: 'Flat 304, Green Palms, Kothrud',
    city: 'Pune',
    instructions: 'Ring bell twice, pets on balcony',
    amount: 3200,
    status: 'CONFIRMED'
  });

  const createdBooking = createBookingRes.body?.data;
  const bookingId = createdBooking?.id;
  const bookingCode = createdBooking?.bookingCode;
  results.push({
    name: 'POST /api/bookings (Create booking for dispatch flow)',
    passed: createBookingRes.status === 201 && Boolean(bookingId),
    details: `Status: ${createBookingRes.status}, id: ${bookingId}, code: ${bookingCode}`
  });

  // 2b. Assign booking to technician
  const assignRes = await req('POST', `/api/bookings/${bookingId}/assign`, {
    technicianId: techId
  }, authHeaders);

  const assignedBooking = assignRes.body?.data;
  results.push({
    name: 'POST /api/bookings/:id/assign (Admin assigns booking to technician)',
    passed: assignRes.status === 200 && (assignedBooking?.status === 'ASSIGNED') && (assignedBooking?.technicianId === techId),
    details: `Status: ${assignRes.status}, bookingStatus: ${assignedBooking?.status}, assignedTechId: ${assignedBooking?.technicianId}`
  });

  // ---------------------------------------------------------
  // 3. TECHNICIAN SCHEDULE & JOB WORKFLOW
  // ---------------------------------------------------------
  // 3a. Technician fetches jobs schedule
  const techJobsRes = await req('GET', `/api/technicians/${techId}/jobs`, null, authHeaders);
  const jobsData = techJobsRes.body?.data;
  const hasJobInToday = (jobsData?.today || []).some(j => j.id === bookingId || j.bookingCode === bookingCode);
  results.push({
    name: 'GET /api/technicians/:id/jobs (Technician views today, upcoming, completed)',
    passed: techJobsRes.status === 200 && Array.isArray(jobsData?.today) && hasJobInToday,
    details: `Status: ${techJobsRes.status}, todayJobs: ${jobsData?.today?.length}, foundAssigned: ${hasJobInToday}`
  });

  // 3b. Step 1: Technician accepts job (ASSIGNED -> ACCEPTED)
  const acceptRes = await req('PUT', `/api/technicians/${techId}/jobs/${bookingId}/status`, {
    status: 'ACCEPTED',
    notes: 'Job accepted. Equipment loaded in service van.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/jobs/:bookingId/status -> ACCEPTED',
    passed: acceptRes.status === 200 && acceptRes.body?.data?.status === 'ACCEPTED',
    details: `Status: ${acceptRes.status}, newJobStatus: ${acceptRes.body?.data?.status}`
  });

  // 3c. Step 2: Technician starts journey (ACCEPTED -> ON_THE_WAY)
  const onTheWayRes = await req('PUT', `/api/technicians/${techId}/jobs/${bookingId}/status`, {
    status: 'ON_THE_WAY',
    notes: 'Departed base camp towards Kothrud.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/jobs/:bookingId/status -> ON_THE_WAY',
    passed: onTheWayRes.status === 200 && onTheWayRes.body?.data?.status === 'ON_THE_WAY',
    details: `Status: ${onTheWayRes.status}, newJobStatus: ${onTheWayRes.body?.data?.status}`
  });

  // 3d. Step 3: Technician arrives at customer location (ON_THE_WAY -> ARRIVED)
  const arrivedRes = await req('PUT', `/api/technicians/${techId}/jobs/${bookingId}/status`, {
    status: 'ARRIVED',
    notes: 'Arrived at Green Palms flat 304.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/jobs/:bookingId/status -> ARRIVED',
    passed: arrivedRes.status === 200 && arrivedRes.body?.data?.status === 'ARRIVED',
    details: `Status: ${arrivedRes.status}, newJobStatus: ${arrivedRes.body?.data?.status}`
  });

  // 3e. Step 4: Technician starts service (ARRIVED -> IN_PROGRESS)
  const inProgressRes = await req('PUT', `/api/technicians/${techId}/jobs/${bookingId}/status`, {
    status: 'IN_PROGRESS',
    notes: 'Commenced ultrasonic radar scan and injection.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/jobs/:bookingId/status -> IN_PROGRESS',
    passed: inProgressRes.status === 200 && inProgressRes.body?.data?.status === 'IN_PROGRESS',
    details: `Status: ${inProgressRes.status}, newJobStatus: ${inProgressRes.body?.data?.status}`
  });

  // 3f. Step 5: Technician completes service (IN_PROGRESS -> COMPLETED)
  const completeRes = await req('PUT', `/api/technicians/${techId}/jobs/${bookingId}/status`, {
    status: 'COMPLETED',
    notes: 'Treatment finished. Digital warranty certificate issued.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/technicians/:id/jobs/:bookingId/status -> COMPLETED',
    passed: completeRes.status === 200 && completeRes.body?.data?.status === 'COMPLETED',
    details: `Status: ${completeRes.status}, newJobStatus: ${completeRes.body?.data?.status}`
  });

  // ---------------------------------------------------------
  // 4. CUSTOMER LIVE TRACKING TELEMETRY (PUBLIC)
  // ---------------------------------------------------------
  // 4a. Customer tracks booking using bookingCode without authentication
  const trackingRes = await req('GET', `/api/bookings/${bookingCode}/tracking`);
  const trackingData = trackingRes.body?.data;
  const hasAssignedStage = trackingData?.stages?.some(s => s.key === 'ASSIGNED' && s.completed);
  const hasCompletedStage = trackingData?.stages?.some(s => s.key === 'COMPLETED' && s.completed);
  const hasTechInfo = Boolean(trackingData?.technician && trackingData.technician.name);

  results.push({
    name: 'GET /api/bookings/:bookingCode/tracking (Public live tracking milestones)',
    passed: trackingRes.status === 200 && trackingData?.currentStatus === 'COMPLETED' && hasAssignedStage && hasCompletedStage && hasTechInfo,
    details: `Status: ${trackingRes.status}, stagesCount: ${trackingData?.stages?.length}, techName: ${trackingData?.technician?.name}`
  });

  // ---------------------------------------------------------
  // 5. CLEANUP DEACTIVATION
  // ---------------------------------------------------------
  const deleteTechRes = await req('DELETE', `/api/technicians/${techId}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/technicians/:id (Deactivate technician profile)',
    passed: deleteTechRes.status === 200 && deleteTechRes.body?.success === true,
    details: `Status: ${deleteTechRes.status}`
  });

  // Close server
  await new Promise((resolve) => server.close(resolve));

  // Print results
  console.log(`\n======================================================`);
  console.log(`📋 PHASE 5 TEST RESULTS`);
  console.log(`======================================================`);
  let passedCount = 0;
  results.forEach((r, idx) => {
    const icon = r.passed ? '✅' : '❌';
    if (r.passed) passedCount++;
    console.log(`${icon} [${idx + 1}/${results.length}] ${r.name}`);
    console.log(`   Details: ${r.details}`);
  });

  console.log(`\n======================================================`);
  console.log(`Summary: ${passedCount}/${results.length} tests passed.`);
  console.log(`======================================================\n`);

  if (passedCount === results.length) {
    console.log('🎉 ALL PHASE 5 TECHNICIAN & DISPATCH TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
