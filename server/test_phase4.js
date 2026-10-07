// Phase 4 Test Suite — Universal Pest Control CMS & Dynamic Public Engine
const http = require('http');
const app = require('./app');
const { generateToken } = require('./utils/jwt');

async function runPhase4Tests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`\n======================================================`);
  console.log(`🚀 Running Phase 4 CMS Test Suite on ${baseUrl}`);
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

  // ---------------------------------------------------------
  // 1. SERVICES CMS & PUBLIC VISIBILITY
  // ---------------------------------------------------------
  // 1a. Public read services
  const publicServicesRes = await req('GET', '/api/cms/services');
  results.push({
    name: 'GET /api/cms/services (Public list active services)',
    passed: publicServicesRes.status === 200 && Array.isArray(publicServicesRes.body?.data) && publicServicesRes.body.data.length > 0,
    details: `Status: ${publicServicesRes.status}, count: ${publicServicesRes.body?.data?.length || 0}`
  });

  // 1b. Unauthenticated write rejected (Security check)
  const unauthServiceCreate = await req('POST', '/api/cms/services', { name: 'Unauthorized Service' });
  results.push({
    name: 'POST /api/cms/services without token (Security Check: 401)',
    passed: unauthServiceCreate.status === 401,
    details: `Status: ${unauthServiceCreate.status}`
  });

  // 1c. Admin create service
  const newServiceSlug = `thermal-bedbug-kill-${testSuffix}`;
  const createServiceRes = await req('POST', '/api/cms/services', {
    name: `Thermal Bedbug Eradication ${testSuffix}`,
    slug: newServiceSlug,
    category: 'BEDBUGS',
    description: 'Industrial heat chamber and chemical treatment for 100% bug elimination.',
    shortDescription: 'Zero odor, immediate relief heat treatment.',
    image: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=600&q=80',
    price: 3499,
    duration: '2 Hours',
    benefits: ['100% Egg Eradication', 'Organic Odorless Spray', '6 Months Guarantee'],
    process: ['Thermal Scan', 'Steam Injection', 'Residual Barrier'],
    faq: [{ q: 'Is it safe for pets?', a: 'Yes, after 2 hours venting.' }],
    seoTitle: 'Best Bedbug Treatment in Town | Universal Pest',
    seoDescription: 'Eliminate bedbugs in a single visit with scientific heat methods.',
    status: 'ACTIVE'
  }, authHeaders);

  const createdService = createServiceRes.body?.data;
  results.push({
    name: 'POST /api/cms/services (Admin create full service)',
    passed: createServiceRes.status === 201 && createdService && createdService.slug === newServiceSlug,
    details: `Status: ${createServiceRes.status}, id: ${createdService?.id}, slug: ${createdService?.slug}`
  });

  // 1d. Get service by slug
  const getSlugRes = await req('GET', `/api/cms/services/slug/${newServiceSlug}`);
  results.push({
    name: 'GET /api/cms/services/slug/:slug (Retrieve service details)',
    passed: getSlugRes.status === 200 && getSlugRes.body?.data?.slug === newServiceSlug && Array.isArray(getSlugRes.body.data.benefits),
    details: `Status: ${getSlugRes.status}, benefits: ${JSON.stringify(getSlugRes.body?.data?.benefits)}`
  });

  // 1e. Admin update service
  let serviceId = createdService?.id;
  const updateServiceRes = await req('PUT', `/api/cms/services/${serviceId}`, {
    price: 3799,
    duration: '2.5 Hours',
    shortDescription: 'Updated premium heat and cryo treatment.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/cms/services/:id (Admin update service)',
    passed: updateServiceRes.status === 200 && updateServiceRes.body?.data?.price === 3799,
    details: `Status: ${updateServiceRes.status}, price: ${updateServiceRes.body?.data?.price}`
  });

  // 1f. Admin delete/archive service
  const deleteServiceRes = await req('DELETE', `/api/cms/services/${serviceId}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/cms/services/:id (Admin soft-archive service)',
    passed: deleteServiceRes.status === 200 && deleteServiceRes.body?.success === true,
    details: `Status: ${deleteServiceRes.status}, msg: ${deleteServiceRes.body?.message}`
  });

  // ---------------------------------------------------------
  // 2. OFFERS CMS
  // ---------------------------------------------------------
  // 2a. Admin create offer
  const createOfferRes = await req('POST', '/api/cms/offers', {
    title: `Flash Monsoon Discount ${testSuffix}`,
    description: 'Get Flat 25% OFF on full house pest sanitization.',
    service: 'General Pest Control',
    discount: '25% OFF',
    validFrom: '2026-10-01',
    validUntil: '2026-11-30',
    image: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=600&q=80',
    cta: 'Book Monsoon Shield',
    terms: 'Applicable on bookings above ₹2,000.',
    status: 'ACTIVE'
  }, authHeaders);

  const createdOffer = createOfferRes.body?.data;
  results.push({
    name: 'POST /api/cms/offers (Admin create offer)',
    passed: createOfferRes.status === 201 && createdOffer && createdOffer.title.includes(testSuffix.toString()),
    details: `Status: ${createOfferRes.status}, id: ${createdOffer?.id}`
  });

  // 2b. Public read active offers
  const getOffersRes = await req('GET', '/api/cms/offers');
  results.push({
    name: 'GET /api/cms/offers (Public read active offers)',
    passed: getOffersRes.status === 200 && Array.isArray(getOffersRes.body?.data) && getOffersRes.body.data.length > 0,
    details: `Status: ${getOffersRes.status}, count: ${getOffersRes.body?.data?.length || 0}`
  });

  // 2c. Admin update offer
  const updateOfferRes = await req('PUT', `/api/cms/offers/${createdOffer?.id}`, {
    discount: '30% OFF',
    terms: 'Valid on all residential bookings.'
  }, authHeaders);
  results.push({
    name: 'PUT /api/cms/offers/:id (Admin update offer)',
    passed: updateOfferRes.status === 200 && updateOfferRes.body?.data?.discount === '30% OFF',
    details: `Status: ${updateOfferRes.status}, discount: ${updateOfferRes.body?.data?.discount}`
  });

  // 2d. Admin delete offer
  const deleteOfferRes = await req('DELETE', `/api/cms/offers/${createdOffer?.id}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/cms/offers/:id (Admin delete offer)',
    passed: deleteOfferRes.status === 200 && deleteOfferRes.body?.success === true,
    details: `Status: ${deleteOfferRes.status}`
  });

  // ---------------------------------------------------------
  // 3. REVIEWS CMS & STRICT MODERATION
  // ---------------------------------------------------------
  // 3a. Customer/Admin creates pending review
  const createReviewRes = await req('POST', '/api/cms/reviews', {
    customer: `Dr. Neha Kulkarni ${testSuffix}`,
    rating: 5,
    review: `Completely removed termites from our wooden library! Extremely satisfied with Universal Pest Control.`,
    service: 'Termite Radar Inspection & Barrier',
    location: 'Kothrud, Pune',
    status: 'PENDING',
    featured: 0
  });

  const createdReview = createReviewRes.body?.data;
  results.push({
    name: 'POST /api/cms/reviews (Submit review with PENDING status)',
    passed: (createReviewRes.status === 201 || createReviewRes.status === 200) && createdReview?.status === 'PENDING',
    details: `Status: ${createReviewRes.status}, id: ${createdReview?.id}, reviewStatus: ${createdReview?.status}`
  });

  // 3b. Verify unauthenticated public query DOES NOT include the PENDING review
  const publicReviewsRes1 = await req('GET', '/api/cms/reviews');
  const hasPendingInPublic = publicReviewsRes1.body?.data?.some(r => r.id === createdReview?.id);
  results.push({
    name: 'GET /api/cms/reviews (Security Check: PENDING review hidden from public)',
    passed: publicReviewsRes1.status === 200 && !hasPendingInPublic,
    details: `Status: ${publicReviewsRes1.status}, hidden: ${!hasPendingInPublic}`
  });

  // 3c. Admin approves the review
  const approveReviewRes = await req('PUT', `/api/cms/reviews/${createdReview?.id}/status`, {
    status: 'APPROVED',
    featured: 1
  }, authHeaders);
  results.push({
    name: 'PUT /api/cms/reviews/:id/status (Admin approves review)',
    passed: approveReviewRes.status === 200 && approveReviewRes.body?.data?.status === 'APPROVED',
    details: `Status: ${approveReviewRes.status}, newStatus: ${approveReviewRes.body?.data?.status}`
  });

  // 3d. Verify unauthenticated public query NOW displays the APPROVED review
  const publicReviewsRes2 = await req('GET', '/api/cms/reviews');
  const hasApprovedInPublic = publicReviewsRes2.body?.data?.some(r => r.id === createdReview?.id);
  results.push({
    name: 'GET /api/cms/reviews (Public now dynamically receives APPROVED review)',
    passed: publicReviewsRes2.status === 200 && hasApprovedInPublic,
    details: `Status: ${publicReviewsRes2.status}, visible: ${hasApprovedInPublic}`
  });

  // 3e. Admin deletes review
  const deleteReviewRes = await req('DELETE', `/api/cms/reviews/${createdReview?.id}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/cms/reviews/:id (Admin delete review)',
    passed: deleteReviewRes.status === 200 && deleteReviewRes.body?.success === true,
    details: `Status: ${deleteReviewRes.status}`
  });

  // ---------------------------------------------------------
  // 4. BLOG POSTS CMS & WORKFLOW STATUSES
  // ---------------------------------------------------------
  // 4a. Admin creates DRAFT blog post
  const blogSlug = `monsoon-termite-guide-${testSuffix}`;
  const createBlogRes = await req('POST', '/api/cms/blog', {
    title: `Monsoon Termite Prevention Checklist ${testSuffix}`,
    slug: blogSlug,
    excerpt: 'Crucial steps every homeowner should take before the heavy rains start.',
    content: 'Full article content describing damp wood, soil barriers, and subterranean termite behavior.',
    featuredImage: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=800&q=80',
    category: 'Termite Protection',
    author: 'Chief Entomologist Dr. R. Sharma',
    seoTitle: 'Monsoon Termite Checklist Pune | Universal Pest',
    seoDescription: 'Prevent termite infestation before it spreads to expensive furniture.',
    status: 'DRAFT'
  }, authHeaders);

  const createdBlog = createBlogRes.body?.data;
  results.push({
    name: 'POST /api/cms/blog (Admin create DRAFT blog post)',
    passed: createBlogRes.status === 201 && createdBlog && createdBlog.status === 'DRAFT',
    details: `Status: ${createBlogRes.status}, id: ${createdBlog?.id}, postStatus: ${createdBlog?.status}`
  });

  // 4b. Verify public unauthenticated query DOES NOT return DRAFT blog post
  const publicBlogRes1 = await req('GET', '/api/cms/blog');
  const hasDraftInPublic = publicBlogRes1.body?.data?.some(b => b.id === createdBlog?.id);
  results.push({
    name: 'GET /api/cms/blog (Security Check: DRAFT post hidden from public)',
    passed: publicBlogRes1.status === 200 && !hasDraftInPublic,
    details: `Status: ${publicBlogRes1.status}, hidden: ${!hasDraftInPublic}`
  });

  // 4c. Admin publishes blog post
  const publishBlogRes = await req('PUT', `/api/cms/blog/${createdBlog?.id}`, {
    status: 'PUBLISHED'
  }, authHeaders);
  results.push({
    name: 'PUT /api/cms/blog/:id (Admin transitions status to PUBLISHED)',
    passed: publishBlogRes.status === 200 && publishBlogRes.body?.data?.status === 'PUBLISHED',
    details: `Status: ${publishBlogRes.status}, publishedAt: ${publishBlogRes.body?.data?.publishedAt}`
  });

  // 4d. Verify public unauthenticated query NOW returns PUBLISHED post
  const publicBlogRes2 = await req('GET', '/api/cms/blog');
  const hasPublishedInPublic = publicBlogRes2.body?.data?.some(b => b.id === createdBlog?.id);
  results.push({
    name: 'GET /api/cms/blog (Public now sees PUBLISHED post)',
    passed: publicBlogRes2.status === 200 && hasPublishedInPublic,
    details: `Status: ${publicBlogRes2.status}, visible: ${hasPublishedInPublic}`
  });

  // 4e. Admin deletes blog post
  const deleteBlogRes = await req('DELETE', `/api/cms/blog/${createdBlog?.id}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/cms/blog/:id (Admin delete blog post)',
    passed: deleteBlogRes.status === 200 && deleteBlogRes.body?.success === true,
    details: `Status: ${deleteBlogRes.status}`
  });

  // ---------------------------------------------------------
  // 5. SERVICE AREAS CMS
  // ---------------------------------------------------------
  // 5a. Admin creates service area
  const createAreaRes = await req('POST', '/api/cms/service-areas', {
    city: 'Pune',
    area: `Viman Nagar East ${testSuffix}`,
    serviceAvailability: 'Daily 7 AM – 9 PM',
    seoTitle: 'Pest Control in Viman Nagar East Pune',
    seoDescription: 'Emergency 60-minute pest control across Viman Nagar East.',
    status: 'ACTIVE'
  }, authHeaders);

  const createdArea = createAreaRes.body?.data;
  results.push({
    name: 'POST /api/cms/service-areas (Admin create service area)',
    passed: createAreaRes.status === 201 && createdArea && createdArea.area.includes(testSuffix.toString()),
    details: `Status: ${createAreaRes.status}, id: ${createdArea?.id}`
  });

  // 5b. Public read active service areas
  const getAreasRes = await req('GET', '/api/cms/service-areas');
  results.push({
    name: 'GET /api/cms/service-areas (Public read coverage areas)',
    passed: getAreasRes.status === 200 && Array.isArray(getAreasRes.body?.data) && getAreasRes.body.data.length > 0,
    details: `Status: ${getAreasRes.status}, count: ${getAreasRes.body?.data?.length || 0}`
  });

  // 5c. Admin updates service area
  const updateAreaRes = await req('PUT', `/api/cms/service-areas/${createdArea?.id}`, {
    serviceAvailability: '24/7 Priority Emergency Coverage',
    status: 'ACTIVE'
  }, authHeaders);
  results.push({
    name: 'PUT /api/cms/service-areas/:id (Admin update service area)',
    passed: updateAreaRes.status === 200 && updateAreaRes.body?.data?.serviceAvailability.includes('24/7'),
    details: `Status: ${updateAreaRes.status}, availability: ${updateAreaRes.body?.data?.serviceAvailability}`
  });

  // 5d. Admin deletes service area
  const deleteAreaRes = await req('DELETE', `/api/cms/service-areas/${createdArea?.id}`, null, authHeaders);
  results.push({
    name: 'DELETE /api/cms/service-areas/:id (Admin delete service area)',
    passed: deleteAreaRes.status === 200 && deleteAreaRes.body?.success === true,
    details: `Status: ${deleteAreaRes.status}`
  });

  // ---------------------------------------------------------
  // 6. ADMIN CMS OVERVIEW & RBAC
  // ---------------------------------------------------------
  // 6a. Admin overview metrics
  const overviewRes = await req('GET', '/api/cms/admin/overview', null, authHeaders);
  results.push({
    name: 'GET /api/cms/admin/overview (Aggregated CMS statistics for dashboard)',
    passed: overviewRes.status === 200 && typeof overviewRes.body?.data?.servicesCount === 'number' && typeof overviewRes.body?.data?.reviews?.pending === 'number',
    details: `Status: ${overviewRes.status}, counts: ${JSON.stringify(overviewRes.body?.data)}`
  });

  // 6b. Unauthenticated access to CMS overview rejected
  const unauthOverviewRes = await req('GET', '/api/cms/admin/overview');
  results.push({
    name: 'GET /api/cms/admin/overview without token (Security Check: 401)',
    passed: unauthOverviewRes.status === 401,
    details: `Status: ${unauthOverviewRes.status}`
  });

  // Close server
  await new Promise((resolve) => server.close(resolve));

  // Print results
  console.log(`\n======================================================`);
  console.log(`📋 PHASE 4 TEST RESULTS`);
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
    console.log('🎉 ALL PHASE 4 CMS TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
