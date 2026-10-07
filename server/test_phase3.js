// Phase 3 Smoke Test Suite — Universal Pest Control
const http = require('http');
const app = require('./app');
const { generateToken } = require('./utils/jwt');

async function runPhase3Tests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Phase 3 Test server running on ${baseUrl}`);

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
  const testPhone = '99887' + Math.floor(10000 + Math.random() * 90000);

  // 1. POST /api/bookings (Create booking & auto-create customer)
  const bookingPayload = {
    customerName: 'Aakash Verma',
    name: 'Aakash Verma',
    phone: testPhone,
    service: 'Termite Radar Inspection & Barrier',
    propertyType: '3 BHK Apartment',
    address: 'Flat 502, Orchid Towers, Kothrud',
    city: 'Pune',
    date: '2026-10-15',
    timeSlot: '11:00 AM – 01:00 PM',
    instructions: 'Ring bell twice, pet cat on premises',
    amount: 4500,
    status: 'CONFIRMED'
  };

  const createBRes = await req('POST', '/api/bookings', bookingPayload);
  const createdBooking = createBRes.body?.data;
  results.push({
    name: 'POST /api/bookings (Create booking & auto customer sync)',
    passed: createBRes.status === 201 && createdBooking && createdBooking.id && (createdBooking.bookingCode || createdBooking.booking_code),
    details: `Status ${createBRes.status}, BookingCode: ${createdBooking?.bookingCode || createdBooking?.booking_code}`
  });

  // 2. GET /api/bookings (List bookings with filters & pagination)
  const listBRes = await req('GET', '/api/bookings?status=CONFIRMED', null, authHeaders);
  results.push({
    name: 'GET /api/bookings (Filtered list & pagination)',
    passed: listBRes.status === 200 && Array.isArray(listBRes.body?.data) && listBRes.body?.data.length > 0,
    details: `Status ${listBRes.status}, Count: ${listBRes.body?.data?.length || 0}`
  });

  // 3. GET /api/bookings/:id
  const getBRes = await req('GET', `/api/bookings/${createdBooking.id}`, null, authHeaders);
  results.push({
    name: `GET /api/bookings/${createdBooking.id} (Booking detail retrieval)`,
    passed: getBRes.status === 200 && getBRes.body?.data?.id === createdBooking.id,
    details: `Status ${getBRes.status}, Address: ${getBRes.body?.data?.address}`
  });

  // 4. PUT /api/bookings/:id (Update status & assign technician)
  const updateBRes = await req('PUT', `/api/bookings/${createdBooking.id}`, {
    status: 'ASSIGNED',
    technicianId: 1
  }, authHeaders);
  results.push({
    name: `PUT /api/bookings/${createdBooking.id} (Status to ASSIGNED & assign tech)`,
    passed: updateBRes.status === 200 && updateBRes.body?.data?.status === 'ASSIGNED' && updateBRes.body?.data?.technicianId === 1,
    details: `Status ${updateBRes.status}, Status: ${updateBRes.body?.data?.status}, TechId: ${updateBRes.body?.data?.technicianId}`
  });

  // 5. DELETE /api/bookings/:id (Archive booking)
  const delBRes = await req('DELETE', `/api/bookings/${createdBooking.id}`, null, authHeaders);
  results.push({
    name: `DELETE /api/bookings/${createdBooking.id} (Archive / cancel booking)`,
    passed: delBRes.status === 200 && (delBRes.body?.data?.isArchived === true || delBRes.body?.data?.status === 'CANCELLED'),
    details: `Status ${delBRes.status}, Archived: ${delBRes.body?.data?.isArchived}`
  });

  // 6. GET /api/customers (List customers with lifetime stats)
  const listCRes = await req('GET', `/api/customers?search=${testPhone}`, null, authHeaders);
  const foundCustomer = listCRes.body?.data?.[0];
  results.push({
    name: 'GET /api/customers (Auto-created customer list & stats)',
    passed: listCRes.status === 200 && foundCustomer && foundCustomer.phone.includes(testPhone.slice(-8)),
    details: `Status ${listCRes.status}, Customer: ${foundCustomer?.name}, Spent: ₹${foundCustomer?.totalSpent}`
  });

  // 7. GET /api/customers/:id (Full customer profile with services, bookings, notes)
  const custId = foundCustomer?.id || 1;
  const getCRes = await req('GET', `/api/customers/${custId}`, null, authHeaders);
  const custProfile = getCRes.body?.data;
  results.push({
    name: `GET /api/customers/${custId} (Full customer profile with history)`,
    passed: getCRes.status === 200 && custProfile && Array.isArray(custProfile.bookings) && Array.isArray(custProfile.services),
    details: `Status ${getCRes.status}, Bookings: ${custProfile?.bookings?.length}, Services: ${custProfile?.services?.join(', ')}`
  });

  // 8. POST /api/customers/:id/notes (Add customer account note)
  const addNoteRes = await req('POST', `/api/customers/${custId}/notes`, {
    note: 'Customer is interested in 3-year Termite AMC contract renewal.'
  }, authHeaders);
  results.push({
    name: `POST /api/customers/${custId}/notes (Save customer account note)`,
    passed: addNoteRes.status === 201 && addNoteRes.body?.data?.notes?.length > 0,
    details: `Status ${addNoteRes.status}, Notes count: ${addNoteRes.body?.data?.notes?.length}`
  });

  // 9. POST /api/customers/:id/reviews (Record customer review)
  const addRevRes = await req('POST', `/api/customers/${custId}/reviews`, {
    rating: 5.0,
    reviewText: 'Flawless execution by senior technician Vikram!',
    source: 'Website Review'
  }, authHeaders);
  results.push({
    name: `POST /api/customers/${custId}/reviews (Save customer review)`,
    passed: addRevRes.status === 201 && addRevRes.body?.data?.reviews?.length > 0,
    details: `Status ${addRevRes.status}, Reviews count: ${addRevRes.body?.data?.reviews?.length}`
  });

  // 10. GET /api/followups (Dashboard Overdue, Today, Upcoming counts)
  const listFuRes = await req('GET', '/api/followups', null, authHeaders);
  const fuSummary = listFuRes.body?.meta?.summary || listFuRes.body?.pagination?.summary;
  results.push({
    name: 'GET /api/followups (Today, Upcoming, Overdue categorization)',
    passed: listFuRes.status === 200 && Array.isArray(listFuRes.body?.data) && fuSummary !== undefined,
    details: `Status ${listFuRes.status}, Overdue: ${fuSummary?.overdue}, Today: ${fuSummary?.today}, Upcoming: ${fuSummary?.upcoming}`
  });

  // 11. POST /api/followups (Create follow-up for lead)
  const createFuRes = await req('POST', '/api/followups', {
    leadId: 1,
    date: '2026-10-14',
    time: '03:30 PM',
    notes: 'Quotation clearance call with Dr. Rajiv.',
    assignedTo: 1
  }, authHeaders);
  const createdFu = createFuRes.body?.data;
  results.push({
    name: 'POST /api/followups (Schedule follow-up & queue reminder)',
    passed: createFuRes.status === 201 && createdFu && createdFu.id && createdFu.leadId === 1,
    details: `Status ${createFuRes.status}, Followup ID: ${createdFu?.id}`
  });

  // 12. PUT /api/followups/:id (Update status to COMPLETED)
  const updateFuRes = await req('PUT', `/api/followups/${createdFu.id}`, {
    status: 'COMPLETED',
    notes: 'Call completed. Client approved site inspection.'
  }, authHeaders);
  results.push({
    name: `PUT /api/followups/${createdFu.id} (Mark follow-up COMPLETED with timestamp)`,
    passed: updateFuRes.status === 200 && updateFuRes.body?.data?.status === 'COMPLETED' && updateFuRes.body?.data?.completedAt !== null,
    details: `Status ${updateFuRes.status}, Status: ${updateFuRes.body?.data?.status}, CompletedAt: ${updateFuRes.body?.data?.completedAt}`
  });

  // 13. Notifications Foundation (GET /api/notifications with unread count)
  const notifRes = await req('GET', '/api/notifications', null, authHeaders);
  results.push({
    name: 'GET /api/notifications (Retrieve system notifications & unread count)',
    passed: notifRes.status === 200 && Array.isArray(notifRes.body?.data),
    details: `Status ${notifRes.status}, Unread: ${notifRes.body?.meta?.unreadCount || 0}, Total: ${notifRes.body?.data?.length}`
  });

  // 14. PUT /api/notifications/read-all
  const readAllRes = await req('PUT', '/api/notifications/read-all', null, authHeaders);
  const postReadRes = await req('GET', '/api/notifications', null, authHeaders);
  results.push({
    name: 'PUT /api/notifications/read-all (Mark all notifications read)',
    passed: readAllRes.status === 200 && (postReadRes.body?.meta?.unreadCount === 0 || postReadRes.body?.data?.every(n => n.isRead)),
    details: `Status ${readAllRes.status}, Remaining Unread: ${postReadRes.body?.meta?.unreadCount || 0}`
  });

  server.close();

  console.log('\n--- PHASE 3 TEST RESULTS ---');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    if (!r.passed) allPassed = false;
    console.log(`[${icon}] ${r.name} -> ${r.details}`);
  }
  console.log(`\nOverall Result: ${allPassed ? 'ALL PHASE 3 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 tests failed with error:', err);
  process.exit(1);
});
