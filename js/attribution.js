/* =====================================================================
   UNIVERSAL PEST CONTROL — AUTOMATED SOURCE ATTRIBUTION TRACKER
   Captures UTMs, click IDs, referrer & landing page dynamically
   ===================================================================== */

(function () {
  const STORAGE_KEY = 'UPC_ATTRIBUTION_V1';

  function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || params.get('source') || null,
      utmMedium: params.get('utm_medium') || null,
      utmCampaign: params.get('utm_campaign') || params.get('campaign') || null,
      utmContent: params.get('utm_content') || null,
      utmTerm: params.get('utm_term') || null,
      fbclid: params.get('fbclid') || null,
      gclid: params.get('gclid') || null,
      adName: params.get('ad_name') || params.get('ad') || null
    };
  }

  function detectTrafficChannel(params, referrer) {
    if (params.fbclid) return 'Meta Lead Ad (Facebook/Instagram)';
    if (params.gclid) return 'Google Paid Search (AdWords)';
    if (params.utmSource) {
      const src = params.utmSource.toLowerCase();
      if (src.includes('instagram')) return 'Instagram Ad';
      if (src.includes('facebook') || src.includes('meta')) return 'Facebook Ad';
      if (src.includes('google')) return 'Google Ads';
      if (src.includes('whatsapp')) return 'WhatsApp Campaign';
      return params.utmSource;
    }
    if (referrer) {
      const ref = referrer.toLowerCase();
      if (ref.includes('instagram.com')) return 'Instagram Organic';
      if (ref.includes('facebook.com')) return 'Facebook Organic';
      if (ref.includes('google.')) return 'Google Organic';
      if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'WhatsApp Referral';
      try {
        return `Referral (${new URL(referrer).hostname})`;
      } catch (e) {
        return 'Web Referral';
      }
    }
    return 'Website Direct';
  }

  function initAttribution() {
    const freshParams = parseQueryParams();
    const landingPage = window.location.href.split('#')[0];
    const referrer = document.referrer || null;

    // Retrieve previous first-touch attribution if user is navigating around site
    let stored = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {}

    // Check if new campaign parameters arrived in URL
    const hasNewParams = freshParams.utmSource || freshParams.fbclid || freshParams.gclid;

    let attributionData;
    if (hasNewParams || !stored) {
      const detectedSource = detectTrafficChannel(freshParams, referrer);
      attributionData = {
        source: detectedSource,
        campaign: freshParams.utmCampaign || 'Organic Direct 2026',
        adName: freshParams.adName || (freshParams.fbclid ? 'Meta_Click_Lead' : freshParams.gclid ? 'Google_Search_Lead' : null),
        utmSource: freshParams.utmSource,
        utmMedium: freshParams.utmMedium,
        utmCampaign: freshParams.utmCampaign,
        utmContent: freshParams.utmContent,
        utmTerm: freshParams.utmTerm,
        fbclid: freshParams.fbclid,
        gclid: freshParams.gclid,
        landingPage: landingPage,
        referrer: referrer,
        capturedAt: new Date().toISOString()
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attributionData));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(attributionData));
      } catch (e) {}
    } else {
      attributionData = stored;
    }

    window.upcAttribution = attributionData;
  }

  // Expose Global Helper
  window.getUpcAttribution = function () {
    if (!window.upcAttribution) {
      initAttribution();
    }
    return window.upcAttribution || {};
  };

  // Run on script execution
  initAttribution();
})();
