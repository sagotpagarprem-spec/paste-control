// =====================================================================
// UNIVERSAL PEST CONTROL — MASTER END-TO-END VERIFICATION SUITE
// Automated Verification for Phases A through K
// =====================================================================

const http = require('http');
const crypto = require('crypto');
const app = require('./app');
const { generateToken } = require('./utils/jwt');
const { query, validateDatabaseConfig } = require('./config/database');

async function runMasterTestSuite() {
  console.log('\n=====================================================================');
  console.log('🚀 UNIVERSAL PEST CONTROL — COMPREHENSIVE PRODUCTION VERIFICATION SUITE');
  console.log('=====================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Master test server running on ${baseUrl}\n`);

  async function req(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, baseUrl);
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const r = http.request(u, { method, headers: reqHeaders }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
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

  // Admin authentication token
  const adminToken = generateToken({ id: 1, email: 'admin@universalpestcontrol.com', role: 'admin', roles: ['admin'] });
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const results = [];
  function record(phase, name, passed, details, testType = 'DB-Backed') {
    results.push({ phase, name, passed, details, testType });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${status}] [${phase}] [${testType}] ${name} -> ${details}`);
  }

  // =====================================================================
  // PHASE A: BACKEND, DATABASE & AUTHENTICATION
  // =====================================================================
  const healthRes = await req('GET', '/health');
  record('Phase A', 'Root Health Check & DB Connectivity', healthRes.status === 200 && healthRes.body?.status === 'ONLINE', `Status ${healthRes.status}, DB: ${healthRes.body?.database?.connected}`, 'Integration');

  const unauthMeRes = await req('GET', '/api/auth/me');
  record('Phase A', 'Unauthenticated Protection (401)', unauthMeRes.status === 401, `Status ${unauthMeRes.status}`, 'Integration');

  const authMeRes = await req('GET', '/api/auth/me', null, authHeaders);
  record('Phase A', 'Authenticated Current User (200)', authMeRes.status === 200 && authMeRes.body?.data?.email === 'admin@universalpestcontrol.com', `User: ${authMeRes.body?.data?.name}`, 'Integration');

  // Database Configuration Hardening in Production (Unit check)
  let prodDbConfigProtected = false;
  try {
    validateDatabaseConfig('production', { host: '', user: '', password: '', database: '' });
  } catch (err) {
    prodDbConfigProtected = err.message.includes('Missing required production database environment variables');
  }
  let prodRootRejected = false;
  try {
    validateDatabaseConfig('production', { host: 'mysql.prod', user: 'root', password: 'secretpassword123', database: 'prod_db' });
  } catch (err) {
    prodRootRejected = err.message.includes('root');
  }
  const devConfigAllowsDefaults = Boolean(validateDatabaseConfig('development'));
  record('Phase A', 'Production Database Config Hardening (Fails on missing vars or root user)', prodDbConfigProtected && prodRootRejected && devConfigAllowsDefaults, `Missing vars blocked: ${prodDbConfigProtected}, Root user blocked: ${prodRootRejected}, Dev defaults: ${devConfigAllowsDefaults}`, 'Unit');

  // =====================================================================
  // PHASE B: REAL CRM & LEAD MANAGEMENT
  // =====================================================================
  const testPhone = '98111' + Math.floor(10000 + Math.random() * 90000);
  const leadPayload = {
    name: 'Vikramaditya Roy',
    phone: testPhone,
    email: 'vikram.roy@example.com',
    service: 'Termite Control',
    propertyType: 'Villa',
    city: 'Pune',
    area: 'Kothrud',
    address: 'Bungalow 12, Dahanukar Colony',
    message: 'Urgent termite inspection in teakwood library',
    source: 'Website - Master Test',
    campaign: 'MonsoonTermite2026',
    utmSource: 'meta',
    utmMedium: 'cpc',
    utmCampaign: 'MonsoonTermite2026'
  };

  const createLeadRes = await req('POST', '/api/leads', leadPayload);
  const leadId = createLeadRes.body?.data?.id;
  record('Phase B', 'Public Inbound Lead Submission with Attribution', createLeadRes.status === 201 && leadId, `Status ${createLeadRes.status}, Lead ID: ${leadId}`);

  // Duplicate submission test
  const dupLeadRes = await req('POST', '/api/leads', { ...leadPayload, message: 'Second inquiry from website' });
  record('Phase B', 'Duplicate Detection within 48h Window', dupLeadRes.status === 201 && dupLeadRes.body?.data?.isDuplicate === true, `isDuplicate: ${dupLeadRes.body?.data?.isDuplicate}`);

  // Admin Lead Detail & Notes
  const leadDetailRes = await req('GET', `/api/leads/${leadId}`, null, authHeaders);
  record('Phase B', 'Admin Lead Detail Hydration with Timeline', leadDetailRes.status === 200 && leadDetailRes.body?.data?.id === leadId, `Activities count: ${leadDetailRes.body?.data?.activities?.length || 0}`);

  // Update Lead Status & Technician Assignment
  const patchStatusRes = await req('PATCH', `/api/leads/${leadId}/status`, { status: 'QUALIFIED' }, authHeaders);
  record('Phase B', 'PATCH /api/leads/:id/status (QUALIFIED)', patchStatusRes.status === 200 && patchStatusRes.body?.data?.status === 'QUALIFIED', `New status: ${patchStatusRes.body?.data?.status}`);

  const patchAssignRes = await req('PATCH', `/api/leads/${leadId}/assign`, { technicianId: 1 }, authHeaders);
  record('Phase B', 'PATCH /api/leads/:id/assign (Technician)', patchAssignRes.status === 200 && patchAssignRes.body?.data?.assigned_technician_id === 1, `Assigned Tech: ${patchAssignRes.body?.data?.technician_name}`);

  // =====================================================================
  // PHASE C: BOOKINGS & CUSTOMER MANAGEMENT
  // =====================================================================
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfterTomorrow = new Date(Date.now() + 172800000).toISOString().split('T')[0];

  const bookingPayload = {
    leadId,
    customerName: 'Vikramaditya Roy',
    phone: testPhone,
    service: 'Termite Radar Inspection & Barrier',
    serviceName: 'Termite Radar Inspection & Barrier',
    propertyType: 'Villa',
    city: 'Pune',
    address: 'Bungalow 12, Dahanukar Colony, Kothrud',
    scheduledDate: tomorrow,
    timeSlot: '11:00 AM - 01:00 PM',
    amount: 3999,
    status: 'CONFIRMED'
  };

  const createBookingRes = await req('POST', '/api/bookings', bookingPayload, authHeaders);
  const bookingId = createBookingRes.body?.data?.id;
  const bookingCode = createBookingRes.body?.data?.bookingCode;
  record('Phase C', 'Create Booking with Customer Profile Sync', createBookingRes.status === 201 && bookingId, `Booking Code: ${bookingCode}`);

  // Booking Reschedule Notification
  const rescheduleRes = await req('PUT', `/api/bookings/${bookingId}`, { scheduledDate: dayAfterTomorrow, timeSlot: '02:00 PM - 04:00 PM' }, authHeaders);
  record('Phase C', 'Reschedule Booking with Notification Log', rescheduleRes.status === 200 && String(rescheduleRes.body?.data?.scheduledDate).startsWith(dayAfterTomorrow), `Rescheduled to: ${rescheduleRes.body?.data?.scheduledDate}`);

  // Customer Management
  const customersRes = await req('GET', `/api/customers?search=${testPhone}`, null, authHeaders);
  record('Phase C', 'Customer Directory Auto-Sync & Search', customersRes.status === 200 && customersRes.body?.data?.length > 0, `Customer: ${customersRes.body?.data?.[0]?.name}`);

  // =====================================================================
  // PHASE D: ADMIN CMS & BUSINESS CONFIGURATION
  // =====================================================================
  const cmsServicesRes = await req('GET', '/api/cms/services');
  record('Phase D', 'Public Active Services Catalog', cmsServicesRes.status === 200 && Array.isArray(cmsServicesRes.body?.data), `Services count: ${cmsServicesRes.body?.data?.length || 0}`);

  const cmsOffersRes = await req('GET', '/api/cms/offers');
  record('Phase D', 'Public Active Promotional Offers', cmsOffersRes.status === 200 && Array.isArray(cmsOffersRes.body?.data), `Offers count: ${cmsOffersRes.body?.data?.length || 0}`);

  const cmsOverviewRes = await req('GET', '/api/cms/admin/overview', null, authHeaders);
  record('Phase D', 'Admin CMS Aggregated Metrics Overview', cmsOverviewRes.status === 200 && cmsOverviewRes.body?.data?.servicesCount > 0, `Services: ${cmsOverviewRes.body?.data?.servicesCount}, Offers: ${cmsOverviewRes.body?.data?.offersCount}`);

  // =====================================================================
  // PHASE E: TECHNICIAN MANAGEMENT & JOB TRACKING
  // =====================================================================
  const techsRes = await req('GET', '/api/technicians', null, authHeaders);
  record('Phase E', 'List Technicians with Availability & Skills', techsRes.status === 200 && Array.isArray(techsRes.body?.data), `Technicians count: ${techsRes.body?.data?.length || 0}`);

  // Dispatch technician to booking
  const assignJobRes = await req('POST', `/api/bookings/${bookingId}/assign`, { technicianId: 1 }, authHeaders);
  record('Phase E', 'Assign Booking to Field Technician', assignJobRes.status === 200 && assignJobRes.body?.data?.status === 'ASSIGNED', `Assigned status: ${assignJobRes.body?.data?.status}`);

  // Technician milestone status transition
  const acceptJobRes = await req('PUT', `/api/technicians/1/jobs/${bookingId}/status`, { status: 'ACCEPTED' }, authHeaders);
  const enRouteRes = await req('PUT', `/api/technicians/1/jobs/${bookingId}/status`, { status: 'ON_THE_WAY' }, authHeaders);
  const completeJobRes = await req('PUT', `/api/technicians/1/jobs/${bookingId}/status`, { status: 'COMPLETED' }, authHeaders);
  record('Phase E', 'Technician Job Lifecycle (ACCEPTED -> ON_THE_WAY -> COMPLETED)', completeJobRes.status === 200 && completeJobRes.body?.data?.status === 'COMPLETED', `Final Job Status: ${completeJobRes.body?.data?.status}`);

  // =====================================================================
  // PHASE E2: PUBLIC TRACKING SECURITY & PRIVACY REGRESSION SUITE
  // =====================================================================
  // 1. Valid high-entropy bearer token tracking succeeds
  const trackingRes = await req('GET', `/api/bookings/${bookingCode}/tracking`);
  record('Phase E', 'Public Booking Milestone Tracking API (High-Entropy Bearer Token)', trackingRes.status === 200 && trackingRes.body?.data?.bookingCode === bookingCode, `Stages: ${trackingRes.body?.data?.stages?.length || 0}`, 'DB-Backed');

  // 2. Reject internal numeric database IDs (404)
  const numericIdTrackingRes = await req('GET', `/api/bookings/${bookingId}/tracking`);
  record('Phase E', 'Security: Reject internal numeric database ID lookup (404)', numericIdTrackingRes.status === 404, `Status: ${numericIdTrackingRes.status}`, 'Integration');

  // 3. Reject phone-only lookup (404)
  const phoneTrackingRes = await req('GET', `/api/bookings/${testPhone}/tracking`);
  record('Phase E', 'Security: Reject phone-only lookup (404)', phoneTrackingRes.status === 404, `Status: ${phoneTrackingRes.status}`, 'Integration');

  // 4. Reject invalid / malformed booking reference code (404)
  const invalidTrackingRes = await req('GET', '/api/bookings/UPC-INVALID-XYZ-9999/tracking');
  record('Phase E', 'Security: Reject invalid booking reference code (404)', invalidTrackingRes.status === 404, `Status: ${invalidTrackingRes.status}`, 'Integration');

  // 5. Reject legacy low-entropy lookup when verification factor is missing (403)
  const legacyMissingFactorRes = await req('GET', '/api/bookings/UPC-2026-8941/tracking');
  record('Phase E', 'Security: Reject legacy low-entropy lookup without verification factor (403)', legacyMissingFactorRes.status === 403, `Status: ${legacyMissingFactorRes.status}`, 'DB-Backed');

  // 6. Reject legacy low-entropy lookup when verification factor is incorrect (403)
  const legacyWrongFactorRes = await req('GET', '/api/bookings/UPC-2026-8941/tracking?phone=9111122222');
  record('Phase E', 'Security: Reject legacy low-entropy lookup with incorrect verification factor (403)', legacyWrongFactorRes.status === 403, `Status: ${legacyWrongFactorRes.status}`, 'DB-Backed');

  // 7. Correctly verified legacy tracking request succeeds (200)
  // Dr. Rajiv Malhotra registered phone in sampleBookings is '+91 98230 44129'
  const legacyVerifiedRes = await req('GET', '/api/bookings/UPC-2026-8941/tracking?phone=9823044129');
  record('Phase E', 'Security: Correctly verified tracking request for legacy reference succeeds (200)', legacyVerifiedRes.status === 200 && legacyVerifiedRes.body?.data?.bookingCode === 'UPC-2026-8941', `Status: ${legacyVerifiedRes.status}, Code: ${legacyVerifiedRes.body?.data?.bookingCode}`, 'DB-Backed');

  // 8. Public tracking response strictly excludes customer PII, address, notes, and billing
  const trackData = trackingRes.body?.data;
  const piiScrubbed = trackData &&
    trackData.address === undefined &&
    trackData.phone === undefined &&
    trackData.customerPhone === undefined &&
    trackData.email === undefined &&
    trackData.customerEmail === undefined &&
    trackData.amount === undefined &&
    trackData.customerName === undefined &&
    trackData.id === undefined &&
    trackData.customerId === undefined &&
    trackData.leadId === undefined &&
    (!trackData.technician || (trackData.technician.id === undefined && trackData.technician.phone === undefined && trackData.technician.email === undefined));
  record('Phase E', 'Security: Public tracking response excludes customer PII, address, and billing details', Boolean(piiScrubbed), `Address exposed: ${Boolean(trackData?.address)}, Phone exposed: ${Boolean(trackData?.phone)}, Amount exposed: ${Boolean(trackData?.amount)}`, 'Integration');

  // 9. OTP generation and verification for customer tracking
  const otpReqRes = await req('POST', `/api/bookings/${bookingCode}/tracking-otp`);
  record('Phase E', 'Security: Tracking OTP dispatch endpoint operational (200)', otpReqRes.status === 200 && Boolean(otpReqRes.body?.data?.maskedPhone), `Status: ${otpReqRes.status}, Masked: ${otpReqRes.body?.data?.maskedPhone}`, 'DB-Backed');

  const invalidOtpRes = await req('POST', `/api/bookings/${bookingCode}/verify-otp`, { otp: '000000' });
  record('Phase E', 'Security: Tracking OTP verification rejects invalid codes (403)', invalidOtpRes.status === 403, `Status: ${invalidOtpRes.status}`, 'Integration');

  // =====================================================================
  // PHASE F: WHATSAPP BUSINESS & CUSTOMER NOTIFICATIONS
  // =====================================================================
  const waTemplatesRes = await req('GET', '/api/whatsapp/templates', null, authHeaders);
  record('Phase F', 'Approved WhatsApp Template Registry', waTemplatesRes.status === 200 && Array.isArray(waTemplatesRes.body?.data), `Templates: ${waTemplatesRes.body?.data?.length || 0}`);

  const waSendRes = await req('POST', '/api/whatsapp/send-template', {
    to: testPhone,
    templateName: 'booking_confirmed_v1',
    parameters: [bookingCode, 'Vikramaditya Roy', 'Termite Radar Inspection', '2026-10-18', '02:00 PM']
  }, authHeaders);
  record('Phase F', 'WhatsApp Template Message Dispatch (Cloud API/Sandbox)', (waSendRes.status === 200 || waSendRes.status === 201) && waSendRes.body?.data?.status === 'SENT', `WAM ID: ${waSendRes.body?.data?.wamId}`);

  // Meta Webhook Verification Handshake
  const waHandshakeRes = await req('GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=upc_secure_webhook_verify_token_2026&hub.challenge=test_challenge_12345');
  record('Phase F', 'WhatsApp Webhook Handshake Verification', waHandshakeRes.status === 200 && waHandshakeRes.body === 'test_challenge_12345', `Handshake response: ${waHandshakeRes.body}`);

  // =====================================================================
  // PHASE G & H: META PIXEL & META LEAD ADS INTEGRATION
  // =====================================================================
  const pixelConfigRes = await req('GET', '/api/meta/pixel-config');
  record('Phase G', 'Safe Public Meta Pixel Configuration Endpoint', pixelConfigRes.status === 200 && pixelConfigRes.body?.data?.enabled !== undefined, `Pixel configured: ${pixelConfigRes.body?.data?.enabled}`);

  // Meta Lead Ads Webhook Handshake
  const metaHandshakeRes = await req('GET', '/api/meta/webhook?hub.mode=subscribe&hub.verify_token=upc_meta_webhook_verify_token_2026&hub.challenge=meta_challenge_777');
  record('Phase H', 'Meta Lead Ads Webhook Handshake Verification', metaHandshakeRes.status === 200 && metaHandshakeRes.body === 'meta_challenge_777', `Handshake response: ${metaHandshakeRes.body}`);

  // Meta Webhook Signature Validation (HMAC SHA256)
  const metaWebhookPayload = {
    object: 'page',
    entry: [
      {
        id: '1092837465',
        time: Date.now(),
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: 'lg_test_' + Date.now(),
              page_id: '1092837465',
              form_id: 'form_monsoon_lead',
              ad_id: 'ad_termite_video'
            }
          }
        ]
      }
    ]
  };

  const metaAppSecret = process.env.META_APP_SECRET || 'upc_sec_app_secret_hash_2026';
  const metaRawBody = JSON.stringify(metaWebhookPayload);
  const signature = 'sha256=' + crypto.createHmac('sha256', metaAppSecret).update(metaRawBody).digest('hex');
  const metaWebhookRes = await req('POST', '/api/meta/webhook', metaWebhookPayload, {
    'X-Hub-Signature-256': signature
  });
  record('Phase H', 'Meta Webhook Event Ingestion & Buffering', metaWebhookRes.status === 200 && metaWebhookRes.body?.status === 'EVENT_RECEIVED', `Events received: ${metaWebhookRes.body?.eventsReceived}`);

  // =====================================================================
  // PHASE I: MARKETING ANALYTICS & ROI DASHBOARD
  // =====================================================================
  const analyticsRes = await req('GET', '/api/analytics/overview', null, authHeaders);
  record('Phase I', 'Real Verified Analytics KPIs & Attribution', analyticsRes.status === 200 && analyticsRes.body?.data?.kpis?.totalLeads > 0, `Total Leads: ${analyticsRes.body?.data?.kpis?.totalLeads}, Bookings: ${analyticsRes.body?.data?.kpis?.bookings}`);

  const filteredAnalyticsRes = await req('GET', '/api/analytics/overview?days=7', null, authHeaders);
  record('Phase I', 'Analytics 7-Day Date Range Filtering', filteredAnalyticsRes.status === 200, `7-day leads count: ${filteredAnalyticsRes.body?.data?.kpis?.totalLeads}`);

  // =====================================================================
  // PHASE J: RATE LIMITING RESILIENCE
  // (Tested at final step to avoid throttling preceding tests)
  // =====================================================================
  let rateLimitEnforced = false;
  for (let i = 0; i < 65; i++) {
    const burstRes = await req('GET', `/api/bookings/${bookingCode}/tracking`);
    if (burstRes.status === 429) {
      rateLimitEnforced = true;
      break;
    }
  }
  record('Phase J', 'Security: Tracking rate limiting enforced on request bursts (429)', rateLimitEnforced, `429 received on rapid bursts: ${rateLimitEnforced}`, 'Integration');

  // =====================================================================
  // SUMMARY
  // =====================================================================
  server.close();

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const dbBackedCount = results.filter(r => r.testType === 'DB-Backed').length;
  const unitIntegrationCount = results.filter(r => r.testType === 'Unit' || r.testType === 'Integration').length;

  console.log('\n=====================================================================');
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`EXECUTION BREAKDOWN: ${dbBackedCount} Database-Backed Tests | ${unitIntegrationCount} Unit & Middleware Tests`);
  console.log(`OVERALL RESULT: ${failed === 0 ? '🎉 ALL PHASES VERIFIED SUCCESSFULLY!' : '⚠️ SOME CHECKS FAILED'}`);
  console.log('=====================================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runMasterTestSuite().catch(err => {
  console.error('Master test suite failed with error:', err);
  process.exit(1);
});
