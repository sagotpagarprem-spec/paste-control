/**
 * =====================================================================
 * UNIVERSAL PEST CONTROL — META PIXEL & CONVERSION TRACKING (PHASE G)
 * Production Client-Side Conversion Tracking & Event Dispatcher
 * =====================================================================
 */

(function () {
  'use strict';

  // Prevent duplicate execution
  if (window._upcPixelInitialized) return;
  window._upcPixelInitialized = true;

  const firedEvents = new Set();
  let currentPixelId = null;

  /**
   * Safe Meta Pixel Base Snippet (Standard Facebook Pixel Library)
   */
  function initMetaPixelSnippet(pixelId) {
    if (!pixelId || typeof pixelId !== 'string') return;
    currentPixelId = pixelId.trim();

    /* eslint-disable */
    if (!window.fbq) {
      const fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.head.appendChild(script);
      }
    }
    /* eslint-enable */

    try {
      window.fbq('init', currentPixelId);
      window.fbq('track', 'PageView');
      console.info(`[Meta Pixel] Initialized for Pixel ID: ${currentPixelId}`);
    } catch (e) {
      console.warn('[Meta Pixel] Initialization warning:', e.message);
    }
  }

  /**
   * Public Event Tracking API with Deduplication and Safety Guards
   * @param {string} eventName - Standard Meta Event (e.g. 'Lead', 'ViewContent', 'Contact', 'Schedule')
   * @param {object} params - Event Parameters (e.g. { content_name: 'Termite Control', value: 3500, currency: 'INR' })
   * @param {string|null} eventId - Unique event identifier for Meta Server-Side / Browser Deduplication
   */
  window.trackMetaEvent = function (eventName, params = {}, eventId = null) {
    if (!eventName) return;

    // Check user consent (respect do-not-track if explicitly set)
    if (navigator.doNotTrack === '1') {
      return;
    }

    // Deduplication check: do not fire the exact same event + eventId twice
    const dedupKey = `${eventName}_${eventId || JSON.stringify(params)}`;
    if (firedEvents.has(dedupKey)) {
      return;
    }
    firedEvents.add(dedupKey);

    const eventOptions = eventId ? { eventID: String(eventId) } : {};

    // 1. Dispatch to Meta Pixel (fbq) if available
    if (typeof window.fbq === 'function') {
      try {
        window.fbq('track', eventName, params, eventOptions);
      } catch (err) {
        console.warn(`[Meta Pixel] Error tracking event "${eventName}":`, err.message);
      }
    }

    // 2. Also log pageview / interaction in our database-backed web analytics
    if (window.upcApi && window.upcApi.analytics) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        window.upcApi.analytics.track({
          pageUrl: window.location.href,
          path: window.location.pathname,
          referrer: document.referrer || null,
          source: urlParams.get('utm_source') || (eventName === 'Contact' ? 'WhatsApp_Click' : 'direct'),
          medium: urlParams.get('utm_medium') || null,
          campaign: urlParams.get('utm_campaign') || null,
          content: eventName,
          gclid: urlParams.get('gclid') || null,
          fbclid: urlParams.get('fbclid') || null
        }).catch(() => {});
      } catch (e) {}
    }
  };

  /**
   * Auto-fetch Pixel ID on page load from safe public endpoint
   */
  async function loadPixelConfiguration() {
    // 1. Check meta tag override first
    const metaTag = document.querySelector('meta[name="meta-pixel-id"]');
    if (metaTag && metaTag.content && metaTag.content !== 'YOUR_PIXEL_ID') {
      initMetaPixelSnippet(metaTag.content);
      return;
    }

    // 2. Check window override
    if (window.META_PIXEL_ID) {
      initMetaPixelSnippet(window.META_PIXEL_ID);
      return;
    }

    // 3. Fetch from safe public backend endpoint
    try {
      const res = await fetch('/api/meta/pixel-config');
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.pixelId) {
          initMetaPixelSnippet(json.data.pixelId);
        }
      }
    } catch (e) {
      // Offline / network failure: silent fallback without blocking UI
    }
  }

  // Initialize after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPixelConfiguration);
  } else {
    loadPixelConfiguration();
  }
})();
