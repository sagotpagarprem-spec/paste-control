// Universal Pest Control — Real AI-Assisted Creative Content Generation Engine (Phase 9)
const { query } = require('../config/database');
const campaignModel = require('../models/campaignModel');
const logger = require('../utils/logger');

class AiCreativeService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.requestTimeoutMs = 15000;
  }

  /**
   * Real AI Content Generator with Gemini 1.5 Flash & High-Precision Fallback
   */
  async generateContent(inputs) {
    const service = inputs.service || 'Comprehensive Pest Control';
    const location = inputs.location || 'Pune';
    const audience = inputs.audience || 'Homeowners & Society Residents';
    const offer = inputs.offer || 'Flat ₹500 OFF + Free Radar Inspection';
    const tone = inputs.tone || 'Urgent & Professional';
    const platform = inputs.platform || 'ALL (Meta, IG, WhatsApp, FB)';
    const format = inputs.format || 'Single Image / Reel';

    let generated = null;

    // 1. If API key is available, attempt real Google Gemini API call server-side
    if (this.geminiApiKey && !this.geminiApiKey.includes('placeholder')) {
      try {
        generated = await this.callGeminiApi({ service, location, audience, offer, tone, platform, format });
      } catch (err) {
        logger.warn(`AI API call encountered issue: ${err.message}. Using high-precision domain engine.`);
        // Re-throw if it's a specific rate-limit or timeout that caller wants to know about,
        // or seamlessly fall back to domain engine with an annotation.
        if (err.code === 'RATE_LIMIT_EXCEEDED') {
          throw err;
        }
      }
    }

    // 2. If Gemini is not configured or failed non-fatally, use high-precision pest control copywriting engine
    if (!generated) {
      generated = this.generateDomainAssets({ service, location, audience, offer, tone, platform, format });
    }

    return {
      service,
      location,
      audience,
      offer,
      tone,
      platform,
      format,
      headline: generated.headline,
      primaryText: generated.primaryText,
      description: generated.description,
      cta: generated.cta || 'Book Free Inspection',
      instagramCaption: generated.instagramCaption,
      facebookCopy: generated.facebookCopy,
      whatsappCopy: generated.whatsappCopy,
      creativeConcept: generated.creativeConcept,
      reelScript: generated.reelScript,
      engine: generated.engine || 'Domain Precision Engine v2'
    };
  }

  /**
   * Server-side call to Google Gemini 1.5 API
   */
  async callGeminiApi(params) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const promptText = `
You are a senior direct-response marketing copywriter specializing in home services and pest control for Indian cities (specifically ${params.location}).
Generate a complete, high-converting ad creative kit with exact parameters:
Service: ${params.service}
Target City: ${params.location}
Target Audience: ${params.audience}
Promotional Offer: ${params.offer}
Brand Tone: ${params.tone}
Ad Platform: ${params.platform}
Media Format: ${params.format}

You MUST return valid JSON ONLY with these EXACT keys:
{
  "headline": "compelling 1-line headline (under 12 words) with punchy benefit",
  "primaryText": "high-converting body copy (60-90 words) explaining scientific detection, odorless safety for kids/pets, and warranty",
  "description": "short link description (under 15 words) mentioning location and offer",
  "cta": "action-oriented CTA like Book Free Inspection, Get 20% Off, or Book Odorless Treatment",
  "instagramCaption": "engaging Instagram caption with emojis, bullet points, call to DM/link in bio, and 4 relevant hashtags",
  "facebookCopy": "Facebook feed post emphasizing family safety, zero cabinet emptying, and verified ISO technicians",
  "whatsappCopy": "short WhatsApp broadcast message under 45 words with bolding",
  "creativeConcept": "visual direction for graphic designer or video editor describing image layout, badges, and colors",
  "reelScript": "30-second video script formatted into [0-4s Hook], [4-15s Proof/Demo], [15-25s Safety], [25-30s CTA]"
}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json'
          }
        })
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const error = new Error('AI API rate limit exceeded. Please wait a few seconds before generating again.');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.status = 429;
        throw error;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errText.substring(0, 200)}`);
      }

      const json = await response.json();
      const rawOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutput) {
        const error = new Error('AI service returned an empty generation response.');
        error.code = 'INVALID_RESPONSE';
        throw error;
      }

      // Parse JSON from output
      let parsed;
      try {
        parsed = JSON.parse(rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim());
      } catch (parseErr) {
        const error = new Error('Invalid JSON format returned by AI engine.');
        error.code = 'INVALID_RESPONSE';
        throw error;
      }

      parsed.engine = `Google Gemini (${this.geminiModel})`;
      return parsed;

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`AI generation request timed out after ${this.requestTimeoutMs / 1000}s.`);
        timeoutErr.code = 'TIMEOUT';
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * High-Precision Domain Copywriting Engine
   */
  generateDomainAssets(inputs) {
    const { service, location, audience, offer, tone } = inputs;
    const isTermite = service.toLowerCase().includes('termite');
    const isCockroach = service.toLowerCase().includes('cockroach');
    const isBedBug = service.toLowerCase().includes('bed');
    const isCommercial = service.toLowerCase().includes('commercial') || service.toLowerCase().includes('kitchen');

    let headline = '';
    let primaryText = '';
    let description = '';
    let cta = 'Book Free Inspection';
    let instagramCaption = '';
    let facebookCopy = '';
    let whatsappCopy = '';
    let creativeConcept = '';
    let reelScript = '';

    if (isTermite) {
      headline = `🛡️ Protect Your Home Before Termites Destroy It — Free Radar Scan in ${location}`;
      primaryText = `Termites silently devour wooden furniture, flooring, and door frames from the inside out, unseen until hollow wood crumbles. Universal Pest Control's certified team uses non-destructive acoustic radar technology to spot hidden colonies deep inside your walls without drilling unnecessary holes. 100% Odorless, government-certified chemicals with a comprehensive 1-Year Warranty.`;
      description = `Pune's #1 Rated Termite Defense. ${offer}. Instant booking confirmation.`;
      cta = 'Get Free Inspection';
      instagramCaption = `Is that wood dust or a silent termite invasion? 🐜🪵\n\nDon't wait for your door frames to collapse. Get our non-destructive Ultrasonic Radar Scan across ${location} today.\n\n✨ Certified Odorless Chemicals\n✨ 1-Year Comprehensive Warranty\n✨ Special Offer: ${offer}\n\n👉 Tap link in bio to book your free inspection in 60 seconds! #PestControlPune #${service.replace(/\s+/g, '')} #HomeCare`;
      facebookCopy = `🚨 Homeowners in ${location}: Termites cause over ₹50,000 in hidden structural damage before you even notice them.\n\nUniversal Pest Control provides zero-drill radar detection and hospital-safe odorless barrier treatments.\n\n✔️ 100% Odorless & Child-Safe\n✔️ Certified Termiticide with 1-Year Guarantee\n✔️ ${offer}\n\nClick below to book your verified technician visit today!`;
      whatsappCopy = `Hello! Universal Pest Control is offering a *Free Termite Radar Inspection* in ${location}. Detect hidden wood infestation with zero wall damage. Includes 1-Year Warranty. Reply *YES* to claim: ${offer}.`;
      creativeConcept = `Split-screen visual: On the left, a beautiful wooden door frame. On the right, thermal/radar overlay showing live subterranean termites inside the beam. High-contrast warning badge: "Don't let them eat your savings."`;
      reelScript = `[0-3s Hook]: Close-up of tapping a hollow door frame with audio of hollow wood crunching. Host: "If your wooden door sounds like this, you have unwanted roommates."\n[3-10s Solution]: Cut to technician pointing laser radar device onto wall. "Our radar scans through concrete and wood without drilling."\n[10-20s Proof]: Technician shows odorless gel application. "Safe for babies and pets, certified ISO 9001."\n[20-30s CTA]: Onscreen graphic: "${offer}". Host: "Tap the link below for Pune same-day inspection."`;
    } else if (isCockroach) {
      headline = `🪳 Stop German Cockroaches in 24 Hours — No Odor, No Emptying Kitchen Cabinets`;
      primaryText = `Tired of spray cans that only make cockroaches scatter into your utensils? Our German herbal gel baiting targets hidden nests in microwave crevices and drain pipes. Safe for food areas, children, and pets with no messy cleanup or foul chemical smell. 100% eradication guarantee.`;
      description = `Certified Odorless Gel Treatment in ${location}. ${offer}.`;
      cta = 'Book Odorless Treatment';
      instagramCaption = `No need to empty your kitchen cabinets ever again! 🍳✨\n\nOur German herbal gel bait technology wipes out cockroach colonies at the source within 24 hours.\n\n🛡️ 100% Odorless & Food-Safe\n🛡️ Child & Pet Friendly\n🛡️ ${offer}\n\n📲 DM us or tap link in bio for same-day service in ${location}! #CockroachControl #PuneHomes #KitchenHygiene`;
      facebookCopy = `Kitchen clean, but cockroaches still appearing at night? Ordinary sprays only scatter them deeper into your walls.\n\nUniversal Pest Control uses advanced micro-dot herbal baiting that eliminates the entire nest in 24 hours. No chemical smell, no need to pack dishes.\n\n📍 Serving all areas of ${location}.\n🎁 Special Promotion: ${offer}.\n\nBook online for instant slot confirmation!`;
      whatsappCopy = `Hi! Say goodbye to kitchen cockroaches with Universal Pest Control's *100% Odorless Herbal Gel*. No cabinet emptying needed. Safe for kids & pets. Reply *BOOK* to activate ${offer}.`;
      creativeConcept = `Modern clean modular kitchen with subtle glowing green safety shield overlay. Floating benefit badges: "No Odor", "No Emptying Shelves", "Baby & Pet Safe".`;
      reelScript = `[0-4s]: Person opening kitchen drawer at night and jumping back. "Spray cans don't work because they only kill the 1% you see."\n[4-15s]: Technician applying microscopic gel dots behind hinges. "Our German gel bait spreads through the entire colony overnight."\n[15-25s]: Child playing safely near kitchen counter. "No smell, no fumes, totally safe for families."\n[25-30s]: Host smiling holding 1-Year warranty certificate: "${offer}. Tap below to book!"`;
    } else if (isCommercial) {
      headline = `🏢 Commercial Pest Audit for FSSAI & HACCP Compliance in ${location}`;
      primaryText = `Zero-tolerance pest management for commercial kitchens, restaurants, food packaging units, and corporate offices. Complete documentation, digital inspection reports, and non-toxic bait stations compliant with FDA and FSSAI standards. Rapid 2-hour emergency dispatch.`;
      description = `FSSAI Certified Commercial Pest Audit. 24/7 Rapid Response.`;
      cta = 'Request Corporate Audit';
      instagramCaption = `Protect your brand reputation and FSSAI hygiene rating with certified commercial pest control across ${location}. 👨‍🍳📋\n\n✅ HACCP & FSSAI Compliant Audits\n✅ Digital Audit Logbooks\n✅ Eco-friendly Night Shift Services\n\nDM for an executive facility audit proposal! #CommercialPestControl #FSSAI #PuneRestaurants`;
      facebookCopy = `One negative customer review or health inspection penalty can destroy years of restaurant reputation.\n\nUniversal Pest Control provides scheduled B2B pest defense with audit-ready logbooks and zero operational downtime.\n\nCall our enterprise dispatch desk for a customized commercial service proposal in ${location}.`;
      whatsappCopy = `Universal Pest Control B2B Desk: Get an *FSSAI & HACCP Compliant Pest Audit* for your facility in ${location}. Full compliance documentation included. Reply *PROPOSAL* for pricing.`;
      creativeConcept = `Executive chef in sanitized stainless-steel kitchen giving thumbs up next to Universal Pest Control certified audit certificate with green ISO stamp.`;
      reelScript = `[0-5s]: Chef inspecting a spotless kitchen. "In our kitchen, food safety is non-negotiable."\n[5-18s]: Universal Pest Control specialist setting tamper-proof digital monitoring stations during off-hours.\n[18-30s]: Showing tablet with instant digital audit report. "Certified FSSAI compliance with zero downtime. Link below to book your facility audit."`;
    } else if (isBedBug) {
      headline = `🛏️ Sleep Peacefully Tonight — 100% Thermal & Herbal Bed Bug Extermination in ${location}`;
      primaryText = `Waking up with red, itchy bite marks? Bed bugs hide deep inside mattress seams, headboards, and electrical switchboards. Universal Pest Control uses high-pressure superheated steam combined with non-staining contact emulsions to eliminate both live bugs and eggs in a single visit. Guaranteed 180-day relief.`;
      description = `Pune's Proven Bed Bug Steam Eradication. ${offer}.`;
      cta = 'End Bed Bug Bites';
      instagramCaption = `Stop waking up to sleepless nights and bed bug bites! 😴🚫\n\nOur two-stage superheated steam + odorless emulsion destroys both bugs and eggs on contact.\n\n✔️ 100% Non-Staining & Odorless\n✔️ 180-Day Relief Guarantee\n✔️ ${offer}\n\nCall or DM now for same-day emergency inspection! #BedBugControl #SleepPeacefully #PuneHomes`;
      facebookCopy = `Bed bugs spread fast and ruin sleep. Don't throw away expensive mattresses—our professional thermal steam extermination neutralizes eggs without damaging fabric.\n\n100% child-safe, odorless, and backed by our warranty.\n\nClick to schedule service in ${location} today!`;
      whatsappCopy = `Universal Pest Control: Get instant relief from bed bugs in ${location}. *Superheated Steam + Herbal Treatment* destroys eggs & bugs. Reply *SLEEP* to claim: ${offer}.`;
      creativeConcept = `Crisp white bedroom with glowing protective aura around the bed. Badge: "Safe for Mattresses & Linens • 180-Day Guarantee".`;
      reelScript = `[0-3s Hook]: Close-up of alarm clock at 3:15 AM with text: "Still waking up itching?"\n[3-12s]: Technician steaming mattress seam. "Bed bug eggs survive ordinary sprays. Our 120°C dry steam kills eggs instantly."\n[12-20s]: Technician smoothing clean bedsheet. "No stains, no toxic smell, sleep in your bed tonight."\n[20-30s]: "${offer} across Pune. Tap below to book!"`;
    } else {
      headline = `🌿 100% Safe Herbal Pest Control Across ${location} — 1-Year Guarantee`;
      primaryText = `Keep your home pest-free with Pune's trusted eco-friendly pest control specialists. Odorless treatments certified safe for senior citizens, infants, and pets. Our verified, uniformed technicians arrive equipped with sanitized gear and ID cards. 50,000+ happy homes protected.`;
      description = `Comprehensive Home Pest Treatment. ${offer}.`;
      cta = 'Book Free Inspection';
      instagramCaption = `Pest-free peace of mind in ${location}! 🏡✨ Certified herbal treatments for termites, cockroaches, bed bugs, and rodents.\n\n🌿 100% Odorless & Eco-Friendly\n🛡️ 1-Year Comprehensive Warranty\n🎁 ${offer}\n\nTap link in bio to book your slot today! #PunePestControl #HomeHygiene`;
      facebookCopy = `Looking for trusted pest control in ${location}? Universal Pest Control delivers 5-star certified service with odorless, eco-friendly treatments and guaranteed 1-Year protection.\n\nBook your free inspection today and enjoy ${offer}!`;
      whatsappCopy = `Hello! Universal Pest Control provides *100% Odorless & Eco-Friendly* pest treatment across ${location}. Includes 1-Year Warranty & free inspection. Claim ${offer} today!`;
      creativeConcept = `Happy family relaxing in a pristine living room with gentle pest shield graphic surrounding the home. Trust badges: "50,000+ Pune Homes Protected", "4.9★ Rated".`;
      reelScript = `[0-4s]: Happy dog and toddler playing on living room rug. "Your home deserves treatments that are tough on pests, but 100% safe for family."\n[4-15s]: Uniformed technician stepping inside wearing shoe covers. "Verified technicians, odorless formulas, zero hassle."\n[15-30s]: "Book in 60 seconds with our instant scheduler. ${offer}. Tap below!"`;
    }

    return {
      headline,
      primaryText,
      description,
      cta,
      instagramCaption,
      facebookCopy,
      whatsappCopy,
      creativeConcept,
      reelScript,
      engine: 'Domain Precision Engine v2'
    };
  }

  /**
   * Save generated content to database
   */
  async saveGeneration(data, userId = null) {
    const result = await query(
      `INSERT INTO ai_creative_generations (
        service, location, audience, offer, tone, platform, format,
        headline, primary_text, description, cta,
        instagram_caption, facebook_copy, whatsapp_copy,
        creative_concept, reel_script, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.service,
        data.location || 'Pune',
        data.audience || 'Homeowners',
        data.offer || null,
        data.tone || 'Urgent & Professional',
        data.platform || 'ALL',
        data.format || 'Single Image / Reel',
        data.headline,
        data.primaryText,
        data.description || null,
        data.cta || 'Book Free Inspection',
        data.instagramCaption || null,
        data.facebookCopy || null,
        data.whatsappCopy || null,
        data.creativeConcept || null,
        data.reelScript || null,
        data.status || 'SAVED',
        userId
      ]
    );

    return this.getGenerationById(result.insertId);
  }

  async getGenerationById(id) {
    const rows = await query(`SELECT * FROM ai_creative_generations WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async listGenerations({ status = '', limit = 50 } = {}) {
    let sql = `SELECT * FROM ai_creative_generations WHERE 1=1`;
    const params = [];
    if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const rows = await query(sql, params);
    return rows;
  }

  /**
   * Approve generation and automatically link as ready Meta Creative (Workflow step)
   * Note: NEVER publishes automatically; creates an APPROVED asset in meta_creatives
   * that can only be deployed via explicit admin action.
   */
  async approveAndSyncCreative(generationId) {
    const gen = await this.getGenerationById(generationId);
    if (!gen) {
      throw new Error(`Creative generation #${generationId} not found.`);
    }

    // Mark as APPROVED in AI table
    await query(`UPDATE ai_creative_generations SET status = 'APPROVED' WHERE id = ?`, [generationId]);

    // Create synchronized record in meta_creatives ready for publishing
    const creative = await campaignModel.createCreative({
      name: `AI: ${gen.headline.substring(0, 50)}...`,
      headline: gen.headline,
      primaryText: gen.primary_text,
      description: gen.description,
      cta: gen.cta || 'GET_QUOTE',
      aiGenerated: true,
      status: 'APPROVED'
    });

    return {
      generation: await this.getGenerationById(generationId),
      metaCreative: creative
    };
  }
}

module.exports = new AiCreativeService();
