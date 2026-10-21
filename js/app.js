/* ===================================================================
   UNIVERSAL PEST CONTROL — PUBLIC WEBSITE CLIENT CONTROLLER
   Full Interactive Experience (Routing, Sliders, Multi-Step Wizard, Booking Engine)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initBeforeAfterSlider();
  initCounters();
  initFaqAccordion();
  initQuickQuoteCalc();
  initMultiStepLeadWizard();
  initBookingEngine();
  initServiceDetailSwitch();
  initServiceAreaChecker();
  initOfferCouponCopy();
  initMobileBottomBar();
  initPublicCmsHydration();
  initTrackBookingModalHandlers();
});

/* 1. NAVIGATION & VIEW ROUTING */
function initNavigation() {
  if (window._navInitialized) return;
  window._navInitialized = true;
  const header = document.querySelector('.main-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // Mobile drawer elements
  const mobileToggle = document.getElementById('mobileMenuToggle') || document.querySelector('.mobile-toggle');
  const drawer = document.getElementById('mobileDrawer') || document.querySelector('.mobile-drawer');
  const drawerClose = document.getElementById('drawerCloseBtn') || document.querySelector('.drawer-close');
  const backdrop = document.getElementById('mobileDrawerBackdrop') || document.querySelector('.mobile-drawer-backdrop');

  // Unified Mobile Drawer State Controller
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    if (mobileToggle) {
      mobileToggle.setAttribute('aria-expanded', 'true');
    }
    document.body.classList.add('drawer-scroll-locked');
    if (drawerClose) {
      drawerClose.focus();
    } else {
      drawer.focus();
    }
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    if (mobileToggle) {
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('drawer-scroll-locked');
    if (mobileToggle && document.activeElement !== mobileToggle) {
      mobileToggle.focus();
    }
  }

  window.openMobileDrawer = openDrawer;
  window.closeMobileDrawer = closeDrawer;

  if (mobileToggle) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (drawer && drawer.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  if (drawerClose) {
    drawerClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
  }

  // Keyboard navigation: Escape key closes drawer, Tab traps focus
  document.addEventListener('keydown', (e) => {
    if (!drawer || !drawer.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer();
      return;
    }

    if (e.key === 'Tab') {
      const focusableEls = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusableEls.length === 0) return;
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  });

  // Close drawer if user clicks any interactive element inside drawer
  if (drawer) {
    drawer.addEventListener('click', (e) => {
      const target = e.target.closest('a, button[data-service-detail], .trigger-lead-modal');
      if (target && !target.classList.contains('drawer-close')) {
        closeDrawer();
      }
    });
  }

  // View Switcher (SPA-style navigation) - Event delegation to avoid duplicate handlers
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-view-target]');
    if (!link) return;
    e.preventDefault();
    const targetView = link.getAttribute('data-view-target');
    if (targetView) {
      switchView(targetView);
      closeDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function switchView(viewName) {
  if (typeof window.closeMobileDrawer === 'function') {
    window.closeMobileDrawer();
  }

  const allViews = document.querySelectorAll('.page-view');
  allViews.forEach(v => v.style.display = 'none');

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
  } else {
    // Default fallback to home
    const homeView = document.getElementById('view-home');
    if (homeView) homeView.style.display = 'block';
  }

  // Update active states
  document.querySelectorAll('[data-view-target]').forEach(l => {
    if (l.getAttribute('data-view-target') === viewName) {
      l.classList.add('active');
    } else {
      l.classList.remove('active');
    }
  });
}

/* 2. BEFORE / AFTER INTERACTIVE SLIDER */
function initBeforeAfterSlider() {
  const container = document.querySelector('.ba-container');
  const afterWrap = document.querySelector('.ba-image-after');
  const handle = document.querySelector('.ba-slider-handle');

  if (!container || !afterWrap || !handle) return;

  let isDragging = false;

  const updateSlider = (clientX) => {
    const rect = container.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    const percentage = (x / rect.width) * 100;
    afterWrap.style.width = `${percentage}%`;
    handle.style.left = `${percentage}%`;
  };

  handle.addEventListener('mousedown', () => isDragging = true);
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    updateSlider(e.clientX);
  });

  // Touch support for mobile
  handle.addEventListener('touchstart', () => isDragging = true);
  window.addEventListener('touchend', () => isDragging = false);
  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    if (e.touches.length > 0) {
      updateSlider(e.touches[0].clientX);
    }
  });

  // Click on container to move handle
  container.addEventListener('click', (e) => {
    updateSlider(e.clientX);
  });
}

/* 3. ANIMATED NUMBER COUNTERS */
function initCounters() {
  const counters = document.querySelectorAll('.stat-value[data-target]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counter = entry.target;
        const target = parseFloat(counter.getAttribute('data-target'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const isDecimal = target % 1 !== 0;
        
        let start = 0;
        const duration = 1800;
        const stepTime = 20;
        const totalSteps = duration / stepTime;
        const increment = target / totalSteps;

        const timer = setInterval(() => {
          start += increment;
          if (start >= target) {
            counter.textContent = (isDecimal ? target.toFixed(1) : Math.floor(target).toLocaleString()) + suffix;
            clearInterval(timer);
          } else {
            counter.textContent = (isDecimal ? start.toFixed(1) : Math.floor(start).toLocaleString()) + suffix;
          }
        }, stepTime);

        observer.unobserve(counter);
      }
    });
  }, { threshold: 0.25 });

  counters.forEach(c => observer.observe(c));
}

/* 4. FAQ ACCORDION */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* 5. QUICK QUOTE CALCULATOR (HERO) */
function initQuickQuoteCalc() {
  const propertySelect = document.getElementById('calc-property');
  const pestSelect = document.getElementById('calc-pest');
  const calcBtn = document.getElementById('calc-btn');

  if (!calcBtn) return;

  calcBtn.addEventListener('click', () => {
    const prop = propertySelect ? propertySelect.value : 'Residential Home';
    const pest = pestSelect ? pestSelect.value : 'General Pest';
    
    // Open the smart lead modal prefilled
    openLeadModal({ property: prop, pest: pest });
  });
}

/* 6. SMART MULTI-STEP LEAD MODAL & WIZARD */
let currentWizardStep = 1;
let leadFormData = {
  property: 'Home',
  pest: 'Cockroach',
  urgency: 'Today',
  name: '',
  phone: '',
  email: '',
  city: 'Pune'
};

function initMultiStepLeadWizard() {
  const modal = document.getElementById('smartLeadModal');
  const closeBtn = document.getElementById('closeLeadModal');
  const triggerBtns = document.querySelectorAll('.trigger-lead-modal');

  triggerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      openLeadModal();
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      closeLeadModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLeadModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeLeadModal();
      }
    });
  }

  // Options cards click
  setupWizardOptionCards('step1-options', (val) => leadFormData.property = val);
  setupWizardOptionCards('step2-options', (val) => leadFormData.pest = val);
  setupWizardOptionCards('step3-options', (val) => leadFormData.urgency = val);

  // Wizard navigation buttons
  const nextBtn = document.getElementById('wizardNextBtn');
  const prevBtn = document.getElementById('wizardPrevBtn');
  const submitBtn = document.getElementById('wizardSubmitBtn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentWizardStep < 4) {
        currentWizardStep++;
        updateWizardUI();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardUI();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const name = document.getElementById('lead-name')?.value.trim();
      const phone = document.getElementById('lead-phone')?.value.trim();
      const email = document.getElementById('lead-email')?.value.trim();
      const city = document.getElementById('lead-city')?.value.trim() || 'Pune';

      if (!name || !phone) {
        showToast('Please provide your name and mobile number.', 'error');
        return;
      }

      // Collect automated UTM and channel attribution
      const attr = window.getUpcAttribution ? window.getUpcAttribution() : {};

      leadFormData.name = name;
      leadFormData.phone = phone;
      leadFormData.email = email;
      leadFormData.city = city;
      leadFormData.service = leadFormData.pest || 'Cockroach Control';
      leadFormData.propertyType = leadFormData.property || 'Home';
      leadFormData.source = attr.source || 'Website Smart Lead Wizard';

      const payload = {
        ...attr,
        name,
        phone,
        email,
        city,
        service: leadFormData.service,
        propertyType: leadFormData.propertyType,
        urgency: leadFormData.urgency || 'Today',
        source: attr.source || 'Website Smart Lead Wizard'
      };

      // 1. Submit directly to Production Backend API
      const origBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Submitting enquiry...</span>';

      try {
        if (!window.upcApi) {
          throw new Error('Service connection offline. Please call our helpline directly.');
        }

        const apiRes = await window.upcApi.leads.create(payload);
        if (apiRes && apiRes.data && apiRes.data.isDuplicateAlert) {
          showToast('ℹ️ Repeat inquiry noted! Existing account updated.', 'info');
        }

        // 2. Save into Reactive Store for UI reactivity only after backend confirmation
        if (window.upcStore) {
          window.upcStore.addLead({
            ...leadFormData,
            id: apiRes?.data?.id,
            leadCode: apiRes?.data?.leadCode
          });
        }

        // 3. Dispatch Meta Lead conversion event only upon verified server confirmation
        if (typeof window.trackMetaEvent === 'function') {
          window.trackMetaEvent('Lead', {
            content_name: leadFormData.pest || 'Pest Inspection',
            value: 1500,
            currency: 'INR'
          }, apiRes?.data?.leadCode || apiRes?.data?.id);
        }

        // Show confirmed success step
        showWizardSuccess();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnText;
        showToast(err.message || 'Failed to submit inquiry. Please check your details and try again.', 'error');
      }
    });
  }

  // Embedded Lead Gen form on homepage
  const embeddedForm = document.getElementById('embeddedLeadForm');
  if (embeddedForm) {
    embeddedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('embed-name')?.value.trim();
      const phone = document.getElementById('embed-phone')?.value.trim();
      const email = document.getElementById('embed-email')?.value.trim();
      const pest = document.getElementById('embed-pest')?.value;
      const prop = document.getElementById('embed-property')?.value;
      const city = document.getElementById('embed-city')?.value || 'Pune';
      const msg = document.getElementById('embed-message')?.value;

      if (!name || !phone) {
        showToast('Please fill in your name and phone number', 'error');
        return;
      }

      const submitBtn = embeddedForm.querySelector('button[type="submit"]');
      const origBtnText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      // Collect automated UTM and channel attribution
      const attr = window.getUpcAttribution ? window.getUpcAttribution() : {};

      const payload = {
        ...attr,
        name,
        phone,
        email,
        city,
        service: pest || 'General Pest Control',
        propertyType: prop || 'Home',
        message: msg,
        notes: msg,
        source: attr.source || 'Homepage Embedded Form',
        urgency: 'High'
      };

      try {
        if (!window.upcApi) {
          throw new Error('Service connection offline. Please call our helpline directly.');
        }

        const res = await window.upcApi.leads.create(payload);
        if (res && res.data && res.data.isDuplicateAlert) {
          showToast('ℹ️ Notice: Active inquiry exists. Your update has been logged!', 'info');
        } else {
          showToast('🎉 Free Inspection Request Received! Specialist calling in 15 mins.', 'success');
        }

        if (window.upcStore) {
          window.upcStore.addLead({
            ...payload,
            id: res?.data?.id,
            leadCode: res?.data?.leadCode
          });
        }

        if (typeof window.trackMetaEvent === 'function') {
          window.trackMetaEvent('Lead', {
            content_name: payload.service || 'Free Inspection',
            value: 1500,
            currency: 'INR'
          }, res?.data?.leadCode || res?.data?.id);
        }

        embeddedForm.reset();
      } catch (err) {
        showToast(err.message || 'Failed to submit enquiry. Please verify your details and try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnText;
        }
      }
    });
  }

  // Contact Page Callback Form
  const callbackForm = document.getElementById('contactCallbackForm');
  if (callbackForm) {
    callbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('callback-name')?.value.trim();
      const phone = document.getElementById('callback-phone')?.value.trim();
      const msg = document.getElementById('callback-message')?.value.trim();

      if (!name || !phone) {
        showToast('Please provide your name and contact phone.', 'error');
        return;
      }

      const submitBtn = callbackForm.querySelector('button[type="submit"]');
      const origBtnText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
      }

      const attr = window.getUpcAttribution ? window.getUpcAttribution() : {};

      const payload = {
        ...attr,
        name,
        phone,
        service: 'General Callback Request',
        propertyType: 'Residential',
        message: msg,
        notes: msg,
        source: attr.source || 'Direct Callback Request',
        urgency: 'Immediate'
      };

      try {
        if (!window.upcApi) {
          throw new Error('Service connection offline. Please call our helpline directly.');
        }

        const res = await window.upcApi.leads.create(payload);
        showToast('📞 Callback registered! Our senior specialist will call you in 15 mins.', 'success');

        if (window.upcStore) {
          window.upcStore.addLead({
            ...payload,
            id: res?.data?.id,
            leadCode: res?.data?.leadCode
          });
        }

        if (typeof window.trackMetaEvent === 'function') {
          window.trackMetaEvent('Lead', {
            content_name: 'Direct Callback',
            value: 1000,
            currency: 'INR'
          }, res?.data?.leadCode || res?.data?.id);
        }

        callbackForm.reset();
      } catch (err) {
        showToast(err.message || 'Could not register callback request. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnText;
        }
      }
    });
  }
}

function setupWizardOptionCards(containerId, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const cards = container.querySelectorAll('.wizard-option-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const val = card.getAttribute('data-value');
      callback(val);
    });
  });
}

function openLeadModal(prefill = {}) {
  const modal = document.getElementById('smartLeadModal');
  if (!modal) return;
  currentWizardStep = 1;
  if (prefill.property) leadFormData.property = prefill.property;
  if (prefill.pest) leadFormData.pest = prefill.pest;
  updateWizardUI();
  modal.classList.add('active');
  document.body.classList.add('modal-open');
}
window.openLeadModal = openLeadModal;

function closeLeadModal() {
  const modal = document.getElementById('smartLeadModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}
window.closeLeadModal = closeLeadModal;

function updateWizardUI() {
  // Hide all step sections
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`wizard-step-${i}`);
    if (stepEl) stepEl.style.display = (i === currentWizardStep) ? 'block' : 'none';
  }

  // Success step
  const successEl = document.getElementById('wizard-step-success');
  if (successEl) successEl.style.display = 'none';

  // Progress Bar
  const fill = document.getElementById('wizardBarFill');
  if (fill) fill.style.width = `${(currentWizardStep / 4) * 100}%`;

  // Buttons
  const prevBtn = document.getElementById('wizardPrevBtn');
  const nextBtn = document.getElementById('wizardNextBtn');
  const submitBtn = document.getElementById('wizardSubmitBtn');

  if (prevBtn) prevBtn.style.visibility = (currentWizardStep === 1) ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.display = (currentWizardStep === 4) ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = (currentWizardStep === 4) ? 'inline-flex' : 'none';
}

function showWizardSuccess() {
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`wizard-step-${i}`);
    if (stepEl) stepEl.style.display = 'none';
  }
  const successEl = document.getElementById('wizard-step-success');
  if (successEl) successEl.style.display = 'block';

  const footerBtns = document.getElementById('wizardFooterBtns');
  if (footerBtns) footerBtns.style.display = 'none';

  // Update dynamic customer name
  const nameSpan = document.getElementById('successLeadName');
  if (nameSpan) nameSpan.textContent = leadFormData.name;
}

/* 7. COMPLETE 8-STEP BOOKING ENGINE */
let bookingState = {
  service: 'Termite Radar Inspection & Barrier',
  propertySize: '3 BHK Home',
  address: '',
  city: 'Pune',
  date: 'Tomorrow, Oct 07',
  timeSlot: '11:00 AM – 01:00 PM',
  customerName: '',
  phone: '',
  email: '',
  instructions: '',
  amount: 4500
};

function initBookingEngine() {
  // Step navigation in booking view
  const serviceCards = document.querySelectorAll('.booking-service-choice');
  serviceCards.forEach(card => {
    card.addEventListener('click', () => {
      serviceCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      bookingState.service = card.getAttribute('data-service');
      bookingState.amount = parseInt(card.getAttribute('data-price') || '4500');
      updateBookingReview();
    });
  });

  // Time slot buttons
  const timeBtns = document.querySelectorAll('.time-slot-btn');
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timeBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      bookingState.timeSlot = btn.getAttribute('data-slot');
      updateBookingReview();
    });
  });

  // Next / Back buttons in booking flow
  const bNextBtns = document.querySelectorAll('[data-booking-next]');
  bNextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStepNum = parseInt(btn.getAttribute('data-booking-next'));
      goToBookingStep(nextStepNum);
    });
  });

  const bBackBtns = document.querySelectorAll('[data-booking-back]');
  bBackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const prevStepNum = parseInt(btn.getAttribute('data-booking-back'));
      goToBookingStep(prevStepNum);
    });
  });

  // Final booking submit
  const confirmBookingBtn = document.getElementById('btnConfirmFinalBooking');
  if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', async () => {
      const name = document.getElementById('b-name')?.value.trim();
      const phone = document.getElementById('b-phone')?.value.trim();
      const address = document.getElementById('b-address')?.value.trim();
      const instructions = document.getElementById('b-instructions')?.value.trim();
      const propertyType = document.getElementById('b-property-size')?.value || '3 BHK Apartment';
      const city = document.getElementById('b-city')?.value.trim() || 'Pune';
      const date = document.getElementById('b-date')?.value || new Date().toISOString().split('T')[0];

      if (!name || !phone || !address) {
        showToast('Please fill in your name, contact number, and service address.', 'error');
        return;
      }

      bookingState.customerName = name;
      bookingState.phone = phone;
      bookingState.address = address;
      bookingState.city = city;
      bookingState.propertyType = propertyType;
      bookingState.date = date;
      bookingState.instructions = instructions;

      confirmBookingBtn.disabled = true;
      confirmBookingBtn.textContent = 'Processing Booking... ⏳';

      const payload = {
        name,
        customerName: name,
        phone,
        service: bookingState.service || 'Termite Radar Inspection & Barrier',
        propertyType,
        address,
        city,
        date,
        timeSlot: bookingState.timeSlot || '11:00 AM – 01:00 PM',
        instructions,
        amount: bookingState.amount || 3999,
        status: 'CONFIRMED'
      };

      try {
        if (!window.upcApi || !window.upcApi.bookings) {
          throw new Error('Booking service is currently unavailable. Please call dispatch directly at +91 98230 44129.');
        }

        const res = await window.upcApi.bookings.create(payload);
        if (!res || !res.data) {
          throw new Error((res && res.message) || 'Server was unable to confirm your booking. Please try again or contact support.');
        }

        const createdBooking = res.data;
        const realBookingCode = createdBooking.bookingCode || createdBooking.booking_code;

        if (!realBookingCode) {
          throw new Error('Service dispatch did not return a valid booking confirmation code.');
        }

        if (window.upcStore) {
          window.upcStore.addBookingRecord(createdBooking);
        }

        // Show step 8: Confirmation with real canonical booking code
        const bCode = document.getElementById('confirmedBookingId');
        if (bCode) bCode.textContent = realBookingCode;

        goToBookingStep(8);
        showToast('🎉 Booking Confirmed! Assigned senior technician on standby.', 'success');
      } catch (err) {
        showToast(err.message || 'Booking submission failed. Please try again.', 'error');
      } finally {
        confirmBookingBtn.disabled = false;
        confirmBookingBtn.textContent = 'Confirm & Dispatch Technician 🚀';
      }
    });
  }
}

function goToBookingStep(stepNum) {
  // Update step indicator pills
  const pills = document.querySelectorAll('.b-step-pill');
  pills.forEach((pill, idx) => {
    const pStep = idx + 1;
    pill.classList.remove('active', 'completed');
    if (pStep === stepNum) pill.classList.add('active');
    else if (pStep < stepNum) pill.classList.add('completed');
  });

  // Show/Hide step sections
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`b-step-${i}`);
    if (el) el.style.display = (i === stepNum) ? 'block' : 'none';
  }

  if (stepNum === 7) {
    updateBookingReview();
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function updateBookingReview() {
  const serviceReview = document.getElementById('rev-service');
  const dateReview = document.getElementById('rev-date');
  const timeReview = document.getElementById('rev-time');
  const totalReview = document.getElementById('rev-total');

  if (serviceReview) serviceReview.textContent = bookingState.service;
  if (dateReview) dateReview.textContent = bookingState.date;
  if (timeReview) timeReview.textContent = bookingState.timeSlot;
  if (totalReview) totalReview.textContent = `₹${bookingState.amount.toLocaleString()}`;
}

/* 8. SERVICE DETAIL PAGE SWITCHER */
const SERVICES_DATA = {
  cockroach: {
    title: 'Cockroach Control & Prevention',
    badge: 'Low-Odor Herbal Gel',
    tagline: 'Eradicate German & American cockroaches with zero need to empty kitchen cabinets.',
    price: 'From ₹1,499',
    symptoms: [
      'Droppings like black pepper under sinks and gas stove corners',
      'Unpleasant oily, musty odor in kitchen cabinets',
      'Cockroaches visible during nighttime water intake',
      'Egg capsules (ootheca) attached behind refrigerator coils'
    ],
    process: [
      { step: '01', title: 'Infestation Assessment', desc: 'Identify nesting hubs, moisture points, and cracks.' },
      { step: '02', title: 'Bayer Maxforce Gel Baiting', desc: 'Micro-dot application inside hinges, electrical points, and appliances.' },
      { step: '03', title: 'Drain Treatment', desc: 'Biological enzyme drain flush to eliminate breeding in pipelines.' },
      { step: '04', title: 'Preventive Barrier', desc: 'Residual perimeter spray along balcony and utility lines.' }
    ]
  },
  termite: {
    title: 'Termite Radar Inspection & Drill-Fill-Seal',
    badge: '3-Year & 5-Year Warranty',
    tagline: 'Non-repellent termiticide creates a lethal undetectable shield around your foundation and woodwork.',
    price: 'From ₹3,999',
    symptoms: [
      'Mud tubes or tunnels along skirting boards and door frames',
      'Hollow-sounding wood when tapped lightly',
      'Discarded translucent wings near windowsills during monsoon',
      'Tight-fitting doors or windows due to warped wood moisture'
    ],
    process: [
      { step: '01', title: 'Ultrasonic Radar Detection', desc: 'Scan wall interiors and floorboards without breaking any tiles.' },
      { step: '02', title: 'Drill-Fill-Seal Barrier', desc: 'Precision 12mm holes drilled at 45-degree angle at 1-foot intervals.' },
      { step: '03', title: 'Imidacloprid Chemical Infiltration', desc: 'Pressurized injection of Bayer Premise termiticide.' },
      { step: '04', title: 'Invisible Aesthetic Sealing', desc: 'Holes sealed with color-matched wax chalk matching your flooring.' }
    ]
  },
  bedbug: {
    title: 'Thermal Steam & Cryo Bed Bug Extermination',
    badge: 'Dual-Visit Guaranteed Clearance',
    tagline: 'Eliminate adult bugs and eggs in a single treatment without destroying mattresses or upholstery.',
    price: 'From ₹2,499',
    symptoms: [
      'Itchy red bite clusters or zigzag lines on arms and neck',
      'Blood stains and dark fecal rust spots on bedsheets and headboards',
      'Sweet, pungent cilantro-like odor in heavily infested bedrooms',
      'Cast skins shed by growing nymphs in mattress seams'
    ],
    process: [
      { step: '01', title: '180°C High-Pressure Dry Steaming', desc: 'Instant kill of eggs and nymphs hidden deep in fabric seams.' },
      { step: '02', title: 'Crack & Crevice Micro-Aerosol', desc: 'Flushes hidden harborages behind switch plates and bed frames.' },
      { step: '03', title: 'Long-Lasting Residual Spray', desc: 'Non-toxic barrier on baseboards and perimeter floors.' },
      { step: '04', title: '14-Day Mandatory Follow-up', desc: 'Second visit to inspect and certify complete eradication.' }
    ]
  },
  commercial: {
    title: 'Commercial Pest Management & HACCP Audits',
    badge: 'ISO & FSSAI Audit Compliant',
    tagline: 'Custom Integrated Pest Management (IPM) for restaurants, hotels, warehouses, and IT parks.',
    price: 'Custom B2B Contract',
    symptoms: [
      'Risk of FSSAI audit penalties or food hygiene license suspension',
      'Contamination of raw food stock in cold storage or dry pantries',
      'Rodent gnawing marks on wiring and electrical conduits',
      'Customer complaints and negative online review hazards'
    ],
    process: [
      { step: '01', title: 'Hazard Analysis & Critical Control Points (HACCP)', desc: 'Thorough mapping of facility ingress and perimeter vulnerabilities.' },
      { step: '02', title: 'Tamper-Resistant Bait Stations', desc: 'Barcoded exterior rodent monitoring and fly light traps (ILTs).' },
      { step: '03', title: 'Non-Toxic Exclusion Protocols', desc: 'Sealing entry points, dock levelers, and air curtain checks.' },
      { step: '04', title: 'Digital Pest Trend Reports', desc: 'Real-time audit certificates and chemical log books provided for inspectors.' }
    ]
  }
};

let publicCmsState = {
  services: [],
  offers: [],
  reviews: [],
  blogs: [],
  areas: []
};

function initServiceDetailSwitch() {
  if (window._serviceDetailSwitchInitialized) return;
  window._serviceDetailSwitchInitialized = true;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-service-detail]');
    if (!link) return;
    e.preventDefault();
    const serviceKey = link.getAttribute('data-service-detail');
    if (serviceKey) {
      renderServiceDetailPage(serviceKey);
      switchView('service-detail');
      if (typeof window.closeMobileDrawer === 'function') {
        window.closeMobileDrawer();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function renderServiceDetailPage(key) {
  // Find in live CMS services first
  let liveService = publicCmsState.services.find(s =>
    s.slug === key ||
    s.slug.replace(/-/g, '').includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
    s.name.toLowerCase().includes(key.toLowerCase()) ||
    s.id == key
  );

  const fallback = SERVICES_DATA[key] || SERVICES_DATA['termite'];

  const titleEl = document.getElementById('sd-title');
  const badgeEl = document.getElementById('sd-badge');
  const taglineEl = document.getElementById('sd-tagline');
  const priceEl = document.getElementById('sd-price');
  const symptomsEl = document.getElementById('sd-symptoms-list');
  const processEl = document.getElementById('sd-process-grid');

  if (liveService) {
    if (titleEl) titleEl.textContent = liveService.name;
    if (badgeEl) badgeEl.textContent = liveService.category ? `${liveService.category} Pest Solution` : 'Certified Solution';
    if (taglineEl) taglineEl.textContent = liveService.shortDescription || liveService.description;
    if (priceEl) priceEl.textContent = `From ₹${liveService.price.toLocaleString()}`;

    if (symptomsEl) {
      const perks = (liveService.benefits && liveService.benefits.length > 0)
        ? liveService.benefits
        : fallback.symptoms;
      symptomsEl.innerHTML = perks.map(s => `
        <li style="display:flex; align-items:flex-start; gap:0.65rem; margin-bottom:0.75rem; font-size:0.95rem;">
          <span style="color:#10B981; font-weight:bold;">✓</span> ${s}
        </li>
      `).join('');
    }

    if (processEl) {
      const steps = (liveService.process && liveService.process.length > 0)
        ? liveService.process
        : fallback.process;
      processEl.innerHTML = steps.map(p => `
        <div class="step-card">
          <div class="step-number-badge">${p.step || '01'}</div>
          <h4 class="step-title">${p.title}</h4>
          <p class="step-desc">${p.desc}</p>
        </div>
      `).join('');
    }
  } else {
    // Graceful fallback to static data
    if (titleEl) titleEl.textContent = fallback.title;
    if (badgeEl) badgeEl.textContent = fallback.badge;
    if (taglineEl) taglineEl.textContent = fallback.tagline;
    if (priceEl) priceEl.textContent = fallback.price;

    if (symptomsEl) {
      symptomsEl.innerHTML = fallback.symptoms.map(s => `
        <li style="display:flex; align-items:flex-start; gap:0.65rem; margin-bottom:0.75rem; font-size:0.95rem;">
          <span style="color:#DC2626; font-weight:bold;">⚠️</span> ${s}
        </li>
      `).join('');
    }

    if (processEl) {
      processEl.innerHTML = fallback.process.map(p => `
        <div class="step-card">
          <div class="step-number-badge">${p.step}</div>
          <h4 class="step-title">${p.title}</h4>
          <p class="step-desc">${p.desc}</p>
        </div>
      `).join('');
    }
  }
}

/* 9. SERVICE AREA CHECKER */
function initServiceAreaChecker() {
  const input = document.getElementById('pincodeInput');
  const checkBtn = document.getElementById('pincodeCheckBtn');
  const resultBox = document.getElementById('pincodeResult');

  if (!checkBtn || !input || !resultBox) return;

  checkBtn.addEventListener('click', () => {
    const val = input.value.trim().toLowerCase();
    if (val.length < 3) {
      showToast('Please enter a valid pincode or locality name.', 'error');
      return;
    }

    // Match against live CMS areas
    const matchedArea = publicCmsState.areas.find(a =>
      a.area.toLowerCase().includes(val) ||
      a.city.toLowerCase().includes(val) ||
      (a.seoDescription && a.seoDescription.toLowerCase().includes(val))
    );

    resultBox.style.display = 'block';

    if (matchedArea) {
      resultBox.innerHTML = `
        <div style="background:#ECFDF5; border:1px solid #10B981; border-radius:12px; padding:1.25rem; display:flex; align-items:center; gap:1rem;">
          <div style="width:44px; height:44px; border-radius:50%; background:#10B981; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.25rem;">✓</div>
          <div>
            <h4 style="color:#064E3B; margin-bottom:0.25rem;">Active Service Hub: ${matchedArea.area}</h4>
            <p style="color:#065F46; font-size:0.875rem; margin:0;">
              2 Senior Technicians available in <strong>"${input.value.trim()}"</strong>. Rapid dispatch targeted within 45 minutes.<br>
              <small style="opacity:0.9;">Available: ${matchedArea.serviceAvailability || 'All Services'}</small>
            </p>
          </div>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div style="background:#ECFDF5; border:1px solid #10B981; border-radius:12px; padding:1.25rem; display:flex; align-items:center; gap:1rem;">
          <div style="width:44px; height:44px; border-radius:50%; background:#10B981; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.25rem;">✓</div>
          <div>
            <h4 style="color:#064E3B; margin-bottom:0.25rem;">Active Service Hub Detected!</h4>
            <p style="color:#065F46; font-size:0.875rem; margin:0;">Mobile dispatch team servicing "${input.value.trim()}" zone. Rapid dispatch targeted within 45 minutes.</p>
          </div>
        </div>
      `;
    }
  });
}

/* ===================================================================
   CMS PUBLIC DATA HYDRATION (PHASE 4 DYNAMIC CONSUMPTION)
   =================================================================== */
async function initPublicCmsHydration() {
  if (!window.upcApi) return;

  try {
    await Promise.allSettled([
      loadPublicServices(),
      loadPublicOffers(),
      loadPublicReviews(),
      loadPublicBlogs(),
      loadPublicServiceAreas()
    ]);
  } catch (err) {
    console.warn('Public CMS Hydration notice:', err.message);
  }
}

// 1. SERVICES HYDRATION
async function loadPublicServices() {
  try {
    const res = await window.upcApi.cms.getServices();
    if (!res || !res.data || !Array.isArray(res.data) || res.data.length === 0) return;

    publicCmsState.services = res.data;

    // Render Home Services Grid
    const grid = document.getElementById('publicServicesGrid');
    if (grid) {
      grid.innerHTML = res.data.map(s => {
        const perks = Array.isArray(s.benefits) ? s.benefits.slice(0, 3) : [];
        return `
          <div class="service-card">
            <div class="service-card-image">
              <img src="${s.image || 'assets/images/hero.jpg'}" alt="${s.name}">
              <span class="service-card-badge">${s.category || 'Specialized'}</span>
            </div>
            <div class="service-card-body">
              <h3 class="service-card-title">${s.name}</h3>
              <p class="service-card-desc">${s.shortDescription || s.description || 'Scientific, odorless pest management solution.'}</p>
              <ul class="service-perks-list">
                ${perks.map(p => `<li class="service-perk-item">✓ ${p}</li>`).join('')}
              </ul>
              <div class="service-card-footer">
                <div class="service-price-from">Starting at <strong>₹${s.price.toLocaleString()}</strong></div>
                <button class="btn btn-outline btn-sm" data-service-detail="${s.slug}">Learn More</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      initServiceDetailSwitch();
    }

    // Populate Navigation Dropdown Menu
    const navDropdown = document.querySelector('.nav-dropdown');
    if (navDropdown) {
      const icons = { Structural: '🪵', Residential: '🪳', Commercial: '🏢', General: '🐭', Outdoor: '🦟' };
      navDropdown.innerHTML = res.data.map(s => `
        <li>
          <a class="dropdown-link" data-service-detail="${s.slug}">
            <span class="dropdown-icon">${icons[s.category] || '🛡️'}</span> ${s.name}
          </a>
        </li>
      `).join('');
      initServiceDetailSwitch();
    }

    // Populate Quick Quote Calculator Dropdown
    const calcPest = document.getElementById('calc-pest');
    if (calcPest) {
      calcPest.innerHTML = res.data.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }
  } catch (err) {
    console.warn('Failed loading CMS services:', err.message);
  }
}

// 2. OFFERS HYDRATION
async function loadPublicOffers() {
  try {
    const res = await window.upcApi.cms.getOffers();
    if (!res || !res.data || !Array.isArray(res.data) || res.data.length === 0) return;

    publicCmsState.offers = res.data;

    const grid = document.getElementById('publicOffersGrid');
    if (grid) {
      grid.innerHTML = res.data.map(o => `
        <div class="service-card" style="padding:2rem;">
          <span class="badge badge-warning" style="margin-bottom:1rem;">${o.discount}</span>
          <h3 style="font-size:1.35rem; margin-bottom:0.5rem;">${o.title}</h3>
          <p style="color:#64748B; font-size:0.9rem; margin-bottom:1.5rem;">${o.description || ''}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; padding:0.75rem 1rem; border-radius:8px; border:1px dashed #CBD5E1;">
            <code style="font-weight:800; color:#064E3B; font-size:1.1rem;">${o.cta}</code>
            <button class="btn btn-sm btn-outline" data-copy-coupon="${o.cta}">Copy</button>
          </div>
          ${o.terms ? `<small style="display:block; margin-top:0.75rem; color:#94A3B8; font-size:0.75rem;">*${o.terms}</small>` : ''}
        </div>
      `).join('');

      initOfferCouponCopy();
    }
  } catch (err) {
    console.warn('Failed loading CMS offers:', err.message);
  }
}

// 3. REVIEWS HYDRATION (APPROVED ONLY)
async function loadPublicReviews() {
  try {
    const res = await window.upcApi.cms.getReviews();
    if (!res || !res.data || !Array.isArray(res.data) || res.data.length === 0) return;

    publicCmsState.reviews = res.data;

    const grid = document.getElementById('publicReviewsGrid');
    if (grid) {
      grid.innerHTML = res.data.map(r => {
        const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(r.rating)));
        const initials = r.image || r.customer.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        return `
          <div class="testimonial-card">
            <div class="star-rating" style="color:#F59E0B;">${stars}</div>
            <p style="margin-top:1rem; font-size:0.925rem; color:#334155; line-height:1.6;">
              "${r.review}"
            </p>
            <div class="testimonial-author">
              <div class="author-avatar">${initials}</div>
              <div>
                <div class="author-name">${r.customer}</div>
                <div class="author-meta">${r.location || 'Pune'} • ${r.service || 'Verified Service'}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Failed loading CMS reviews:', err.message);
  }
}

// 4. BLOGS HYDRATION (PUBLISHED ONLY)
async function loadPublicBlogs() {
  try {
    const res = await window.upcApi.cms.getBlogPosts();
    if (!res || !res.data || !Array.isArray(res.data) || res.data.length === 0) return;

    publicCmsState.blogs = res.data;

    const grid = document.getElementById('publicBlogsGrid');
    if (grid) {
      grid.innerHTML = res.data.map(b => {
        const pubDate = b.publishedAt ? new Date(b.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
        return `
          <div class="service-card">
            <div class="service-card-image">
              <img src="${b.featuredImage || 'assets/images/hero.jpg'}" alt="${b.title}">
              <span class="service-card-badge">${b.category}</span>
            </div>
            <div class="service-card-body">
              <div style="font-size:0.75rem; color:#64748B; margin-bottom:0.4rem;">${pubDate} • 5 min read</div>
              <h3 class="service-card-title">${b.title}</h3>
              <p class="service-card-desc">${b.excerpt || ''}</p>
              <div class="service-card-footer">
                <span style="font-size:0.8rem; font-weight:700; color:#064E3B;">By ${b.author}</span>
                <button class="btn btn-outline btn-sm" onclick="showArticleModal('${b.slug}')">Read Article →</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Failed loading CMS blogs:', err.message);
  }
}

// 5. SERVICE AREAS HYDRATION
async function loadPublicServiceAreas() {
  try {
    const res = await window.upcApi.cms.getServiceAreas();
    if (!res || !res.data || !Array.isArray(res.data) || res.data.length === 0) return;

    publicCmsState.areas = res.data;

    const grid = document.getElementById('publicAreasGrid');
    if (grid) {
      // Group areas into 2 balanced columns
      const half = Math.ceil(res.data.length / 2);
      const col1 = res.data.slice(0, half);
      const col2 = res.data.slice(half);

      grid.innerHTML = `
        <div style="background:#fff; border-radius:16px; padding:2rem; border:1px solid #E2E8F0;">
          <h3 style="color:#064E3B; margin-bottom:1rem;">Active Hubs & Metropolitan Coverage</h3>
          <ul style="list-style:none; line-height:2.2; color:#334155;">
            ${col1.map(a => `<li>📍 <strong>${a.area}</strong> (${a.city}) — <small style="color:#64748B;">${a.serviceAvailability || 'All Services'}</small></li>`).join('')}
          </ul>
        </div>
        <div style="background:#fff; border-radius:16px; padding:2rem; border:1px solid #E2E8F0;">
          <h3 style="color:#064E3B; margin-bottom:1rem;">Regional Express Dispatch Zones</h3>
          <ul style="list-style:none; line-height:2.2; color:#334155;">
            ${col2.map(a => `<li>📍 <strong>${a.area}</strong> (${a.city}) — <small style="color:#64748B;">${a.serviceAvailability || 'All Services'}</small></li>`).join('')}
          </ul>
        </div>
      `;
    }
  } catch (err) {
    console.warn('Failed loading CMS service areas:', err.message);
  }
}

// Global article modal viewer
window.showArticleModal = function(slug) {
  const article = publicCmsState.blogs.find(b => b.slug === slug);
  if (!article) {
    showToast('Article loading...', 'info');
    return;
  }

  let modal = document.getElementById('publicArticleModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'publicArticleModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:760px; max-height:85vh; overflow-y:auto; padding:2.5rem; border-radius:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
          <div>
            <span id="artModalCategory" class="badge badge-primary">Category</span>
            <h2 id="artModalTitle" style="margin-top:0.5rem; font-size:1.6rem; line-height:1.3;">Article Title</h2>
            <div id="artModalMeta" style="font-size:0.85rem; color:#64748B; margin-top:0.25rem;">By Author • Date</div>
          </div>
          <button onclick="document.getElementById('publicArticleModal').style.display='none'" class="btn btn-white btn-sm" style="font-size:1.2rem; line-height:1;">✕</button>
        </div>
        <div id="artModalContent" style="color:#334155; line-height:1.8; font-size:1rem; white-space:pre-line;">
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('artModalCategory').textContent = article.category;
  document.getElementById('artModalTitle').textContent = article.title;
  document.getElementById('artModalMeta').textContent = `By ${article.author} • Published ${new Date(article.publishedAt || Date.now()).toLocaleDateString()}`;
  document.getElementById('artModalContent').innerHTML = article.content.replace(/\n\n/g, '<br><br>');

  modal.style.display = 'flex';
};

/* 10. OFFERS / COUPON COPY */
function initOfferCouponCopy() {
  const copyBtns = document.querySelectorAll('[data-copy-coupon]');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-copy-coupon');
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Coupon code "${code}" copied to clipboard!`, 'info');
      }).catch(() => {
        showToast(`Code: ${code}`, 'info');
      });
    });
  });
}

/* 11. MOBILE BOTTOM BAR */
function initMobileBottomBar() {
  const bookNowBtn = document.querySelector('.mobile-btn-book');
  if (bookNowBtn) {
    bookNowBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('booking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/* 12. TOAST NOTIFICATION UTILITY */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="font-size:1.25rem;">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
    <div style="font-size:0.9rem; font-weight:600; color:#0F172A;">${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global expose
window.showToast = showToast;
window.switchView = switchView;
window.openLeadModal = openLeadModal;

/* 13. CUSTOMER LIVE BOOKING TRACKING (PHASE 5) */
function openTrackBookingModal(defaultCode = '') {
  const modal = document.getElementById('modalTrackBooking');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.classList.add('drawer-scroll-locked');
  const input = document.getElementById('trackBookingInput');
  if (input) {
    if (defaultCode) {
      input.value = defaultCode;
      searchCustomerBookingTracking();
    }
    setTimeout(() => input.focus(), 60);
  }
}

function closeTrackBookingModal() {
  const modal = document.getElementById('modalTrackBooking');
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('drawer-scroll-locked');
}

function initTrackBookingModalHandlers() {
  const modal = document.getElementById('modalTrackBooking');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTrackBookingModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = document.getElementById('modalTrackBooking');
      if (m && m.style.display === 'flex') {
        closeTrackBookingModal();
      }
    }
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function searchCustomerBookingTracking() {
  const input = document.getElementById('trackBookingInput');
  const resultArea = document.getElementById('trackingResultArea');
  if (!input || !resultArea) return;

  const query = input.value.trim();
  if (!query) {
    showToast('Please enter your Booking Reference Code', 'error');
    return;
  }

  // Check if query is a phone number (10+ digits)
  if (/^\+?[0-9\s\-]{10,15}$/.test(query) || /^\d{10}$/.test(query.replace(/[\s\-]/g, ''))) {
    resultArea.style.display = 'block';
    resultArea.innerHTML = `
      <div style="background:#FFFBEB; border:1px solid #FDE68A; color:#92400E; padding:1.25rem; border-radius:12px; text-align:center; line-height:1.5;">
        🔒 <strong>Customer Privacy Protection Active</strong><br>
        For customer privacy and security, tracking by phone number alone is disabled without verified OTP.<br>
        Please enter your unique <strong>Booking Reference Code</strong> (e.g. <code>UPC-2026-XXXX</code>) sent in your confirmation SMS/email, or contact dispatch at <strong>+91 98230 44129</strong>.
      </div>
    `;
    return;
  }

  resultArea.style.display = 'block';
  resultArea.innerHTML = `
    <div style="text-align:center; padding:2rem; color:#64748B;">
      Connecting to dispatch telemetry... 📡
    </div>
  `;

  try {
    if (!window.upcApi || !window.upcApi.bookings) {
      throw new Error('API client not available.');
    }

    const res = await window.upcApi.bookings.getTracking(query);
    const data = res.data;

    if (!data) {
      resultArea.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:1.25rem; border-radius:10px; text-align:center;">
          No active booking found matching "${escapeHtml(query)}". Please verify your booking reference code.
        </div>
      `;
      return;
    }

    const tech = data.technician;
    const stages = data.stages || [];

    resultArea.innerHTML = `
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:1.25rem; margin-bottom:1.25rem; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <div style="min-width:0;">
            <div style="font-size:0.75rem; color:#64748B; font-weight:700;">BOOKING REFERENCE</div>
            <strong style="font-size:1.15rem; color:#0F172A; word-break:break-all;">${escapeHtml(data.bookingCode)}</strong>
          </div>
          <span class="badge ${data.currentStatus === 'COMPLETED' ? 'badge-success' : 'badge-primary'}" style="font-size:0.8rem; padding:0.35rem 0.65rem; flex-shrink:0;">
            ${data.currentStatus}
          </span>
        </div>
        <div style="font-size:0.88rem; color:#334155; line-height:1.5; word-break:break-word;">
          <div><strong>Service:</strong> ${escapeHtml(data.serviceName)} (${escapeHtml(data.propertyType || 'Residential')})</div>
          <div><strong>Appointment:</strong> 📅 ${data.scheduledDate} • ⏰ ${escapeHtml(data.timeSlot)}</div>
          <div><strong>Service Location:</strong> 📍 ${escapeHtml(data.city || 'Pune')} (Confirmed on file)</div>
        </div>
      </div>

      <!-- Assigned Technician Card -->
      ${tech ? `
        <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-radius:12px; padding:1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap; box-sizing:border-box;">
          <img src="${escapeHtml(tech.profileImage)}" alt="${escapeHtml(tech.name)}"
               style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #10B981; flex-shrink:0;">
          <div style="flex-grow:1; min-width:140px;">
            <div style="font-size:0.72rem; color:#065F46; font-weight:700; text-transform:uppercase;">Assigned Certified Technician</div>
            <div style="font-size:1.05rem; font-weight:800; color:#064E3B;">${escapeHtml(tech.name)}</div>
            <div style="font-size:0.8rem; color:#047857;">⭐ ${tech.rating || 4.9} Verified Specialist${tech.phone ? ` • <a href="tel:${escapeHtml(tech.phone)}" style="color:#065F46; font-weight:700; text-decoration:underline;">${escapeHtml(tech.phone)}</a>` : ''}</div>
          </div>
          ${tech.phone ? `
          <a href="tel:${escapeHtml(tech.phone)}" class="btn btn-sm btn-primary" style="padding:0.4rem 0.8rem; border-radius:8px; text-decoration:none; flex-shrink:0;">
            📞 Call
          </a>` : `
          <a href="tel:+919823044129" class="btn btn-sm btn-primary" style="padding:0.4rem 0.8rem; border-radius:8px; text-decoration:none; flex-shrink:0;">
            📞 Dispatch
          </a>`}
        </div>
      ` : `
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:0.85rem; margin-bottom:1.5rem; font-size:0.85rem; color:#92400E; word-break:break-word;">
          ⏳ <strong>Technician Dispatch:</strong> Our operations manager is currently assigning the nearest certified specialist in your zone.
        </div>
      `}

      <!-- Milestones Timeline -->
      <div style="margin-top:1rem; min-width:0;">
        <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#64748B; margin-bottom:0.75rem; letter-spacing:0.04em;">SERVICE PROGRESS MILESTONES</div>
        <div style="display:flex; flex-direction:column; gap:0.85rem; position:relative; padding-left:1.75rem; min-width:0;">
          <div style="position:absolute; left:9px; top:8px; bottom:8px; width:2px; background:#E2E8F0;"></div>
          ${stages.map((st, i) => {
            const isCompleted = st.completed;
            const isActive = st.active;
            const dotColor = isCompleted ? '#10B981' : (isActive ? '#0284C7' : '#CBD5E1');
            const icon = isCompleted ? '✓' : (isActive ? '●' : (i + 1));
            return `
              <div style="position:relative; min-width:0;">
                <div style="position:absolute; left:-1.75rem; top:2px; width:20px; height:20px; border-radius:50%; background:${dotColor}; color:#FFFFFF; font-size:0.7rem; font-weight:800; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 3px #FFFFFF;">
                  ${icon}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:0.25rem;">
                  <strong style="font-size:0.92rem; color:${isCompleted || isActive ? '#0F172A' : '#94A3B8'}; word-break:break-word;">
                    ${escapeHtml(st.label)}
                  </strong>
                  ${st.timestamp ? `<span style="font-size:0.75rem; color:#64748B; flex-shrink:0;">${new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                </div>
                <div style="font-size:0.8rem; color:#64748B; margin-top:0.15rem; word-break:break-word;">
                  ${escapeHtml(st.description)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    resultArea.innerHTML = `
      <div style="background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:1.25rem; border-radius:10px; text-align:center;">
        Failed to fetch tracking data: ${err.message}
      </div>
    `;
  }
}

// Global exposes
window.openTrackBookingModal = openTrackBookingModal;
window.closeTrackBookingModal = closeTrackBookingModal;
window.searchCustomerBookingTracking = searchCustomerBookingTracking;
