const crypto = require('crypto');
const whatsappModel = require('../models/whatsappModel');
const customerModel = require('../models/customerModel');
const leadModel = require('../models/leadModel');
const notificationModel = require('../models/notificationModel');
const logger = require('../utils/logger');

// Clean and normalize phone numbers for WhatsApp Cloud API (E.164 without symbols)
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // If Indian 10-digit number without country code, prepend 91
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

function formatDisplayPhone(phone) {
  if (!phone) return '';
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.substring(2, 7)} ${cleaned.substring(7)}`;
  }
  return `+${cleaned}`;
}

class WhatsAppService {
  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '109283746501928';
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '209384756102938';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
    const isProd = process.env.NODE_ENV === 'production';
    this.mockMode = isProd ? false : process.env.WHATSAPP_MOCK_MODE !== 'false';
  }

  getEndpoint() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Send pre-approved WhatsApp template message (Strictly Official Cloud API compatible)
   */
  async sendTemplate({
    to,
    templateName,
    language = 'en',
    components = [],
    parameters = [],
    customerId = null,
    leadId = null,
    bookingId = null
  }) {
    if (!to) {
      throw new Error('Recipient phone number is required.');
    }
    if (!templateName) {
      throw new Error('Template name is required.');
    }

    // 1. Verify template exists and is APPROVED
    const template = await whatsappModel.getTemplateByName(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found in system.`);
    }
    if (template.status !== 'APPROVED') {
      throw new Error(`Template "${templateName}" is currently "${template.status}". Only APPROVED templates can be dispatched.`);
    }

    // 2. Build parameter list from either parameters array or components
    let bodyParams = parameters;
    if ((!bodyParams || bodyParams.length === 0) && components && components.length > 0) {
      const bodyComp = components.find(c => c.type === 'body');
      if (bodyComp && Array.isArray(bodyComp.parameters)) {
        bodyParams = bodyComp.parameters.map(p => p.text || String(p.value || ''));
      }
    }

    // 3. Render message body from template placeholders: {{1}}, {{2}}, ...
    let renderedBody = template.bodyText;
    if (Array.isArray(bodyParams)) {
      bodyParams.forEach((paramVal, idx) => {
        const regex = new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g');
        renderedBody = renderedBody.replace(regex, paramVal);
      });
    }

    // 4. Build standard Meta Cloud API payload
    const cleanedTo = cleanPhoneNumber(to);
    const displayTo = formatDisplayPhone(to);

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: (bodyParams || []).map(val => ({
              type: 'text',
              text: String(val)
            }))
          }
        ]
      }
    };

    // 5. Generate official-style Meta WAM ID
    const wamId = `wamid.HBg${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;

    // 6. Record message in database as QUEUED
    let msgRecord = await whatsappModel.createMessage({
      wamId,
      direction: 'OUTBOUND',
      toPhone: displayTo,
      fromPhone: '+91 98230 01122',
      customerId,
      leadId,
      bookingId,
      templateName,
      templateLanguage: language,
      messageType: 'TEMPLATE',
      body: renderedBody,
      status: 'QUEUED',
      metadata: {
        metaPayload,
        templateId: template.id,
        category: template.category,
        components
      }
    });

    // 7. Dispatch via Meta Cloud API or Enterprise Mock Sandbox
    try {
      if (!this.mockMode && this.apiToken && !this.apiToken.startsWith('EAAGMock')) {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metaPayload)
        });

        const respData = await response.json();
        if (!response.ok) {
          const errDetail = respData.error?.message || 'Meta Cloud API error';
          await whatsappModel.updateMessageStatus(msgRecord.id, 'FAILED', errDetail);
          throw new Error(`WhatsApp Cloud API error: ${errDetail}`);
        }

        const externalWamId = respData.messages?.[0]?.id || wamId;
        msgRecord = await whatsappModel.updateMessageStatus(msgRecord.id, 'SENT');
      } else {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Production environment cannot operate in WhatsApp mock mode or report simulated delivery.');
        }
        // Enterprise Sandbox / Mock Mode
        // Seamlessly progress QUEUED -> SENT -> DELIVERED
        logger.info(`[WhatsApp Cloud API Simulated] Dispatched template "${templateName}" to ${displayTo}`);
        msgRecord = await whatsappModel.updateMessageStatus(msgRecord.id, 'SENT');
        
        // Auto-simulate delivery in sandbox environment
        setTimeout(async () => {
          try {
            await whatsappModel.updateMessageStatus(msgRecord.id, 'DELIVERED');
          } catch (e) {}
        }, 150);
      }
    } catch (err) {
      logger.error(`Failed to dispatch WhatsApp template to ${to}: ${err.message}`);
      await whatsappModel.updateMessageStatus(msgRecord.id, 'FAILED', err.message);
      throw err;
    }

    return msgRecord;
  }

  /**
   * Send free-form text message (for customer support replies within 24hr service window)
   */
  async sendTextMessage({
    to,
    text,
    customerId = null,
    leadId = null,
    bookingId = null
  }) {
    if (!to || !text) {
      throw new Error('Recipient phone and message text are required.');
    }

    const cleanedTo = cleanPhoneNumber(to);
    const displayTo = formatDisplayPhone(to);

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text.trim()
      }
    };

    const wamId = `wamid.HBg${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;

    let msgRecord = await whatsappModel.createMessage({
      wamId,
      direction: 'OUTBOUND',
      toPhone: displayTo,
      fromPhone: '+91 98230 01122',
      customerId,
      leadId,
      bookingId,
      templateName: null,
      messageType: 'TEXT',
      body: text.trim(),
      status: 'QUEUED',
      metadata: { metaPayload }
    });

    try {
      if (!this.mockMode && this.apiToken && !this.apiToken.startsWith('EAAGMock')) {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metaPayload)
        });

        const respData = await response.json();
        if (!response.ok) {
          const errDetail = respData.error?.message || 'Meta Cloud API error';
          await whatsappModel.updateMessageStatus(msgRecord.id, 'FAILED', errDetail);
          throw new Error(`WhatsApp Cloud API error: ${errDetail}`);
        }

        msgRecord = await whatsappModel.updateMessageStatus(msgRecord.id, 'SENT');
      } else {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Production environment cannot operate in WhatsApp mock mode or report simulated delivery.');
        }
        logger.info(`[WhatsApp Cloud API Simulated] Dispatched text message to ${displayTo}`);
        msgRecord = await whatsappModel.updateMessageStatus(msgRecord.id, 'SENT');
        setTimeout(async () => {
          try {
            await whatsappModel.updateMessageStatus(msgRecord.id, 'DELIVERED');
          } catch (e) {}
        }, 150);
      }
    } catch (err) {
      logger.error(`Failed to dispatch WhatsApp text to ${to}: ${err.message}`);
      await whatsappModel.updateMessageStatus(msgRecord.id, 'FAILED', err.message);
      throw err;
    }

    return msgRecord;
  }

  /**
   * Validate official WhatsApp SHA256 Webhook Signature (X-Hub-Signature-256)
   */
  verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.META_APP_SECRET || '';

    // Reject WhatsApp webhook POST requests when app secret is missing
    if (!appSecret) {
      logger.warn('WhatsApp webhook rejected: META_APP_SECRET is not configured on server.');
      return false;
    }

    if (!signature) {
      logger.warn('WhatsApp webhook rejected: Missing X-Hub-Signature-256 header.');
      return false;
    }

    try {
      const rawBody = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const expectedHash = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(signature);
      const expBuffer = Buffer.from(expectedHash);
      if (sigBuffer.length !== expBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuffer, expBuffer);
    } catch (e) {
      logger.error(`WhatsApp signature verification error: ${e.message}`);
      return false;
    }
  }

  /**
   * Webhook Handshake Verification (GET /api/whatsapp/webhook)
   */
  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const isProduction = process.env.NODE_ENV === 'production';
    let expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken) {
      if (isProduction) {
        logger.warn('WhatsApp webhook verification failed: WHATSAPP_WEBHOOK_VERIFY_TOKEN must be configured in production.');
        return { verified: false, challenge: null };
      }
      expectedToken = 'upc_secure_webhook_verify_token_2026';
    } else if (isProduction && (expectedToken === 'upc_secure_webhook_verify_token_2026' || expectedToken.length < 16)) {
      logger.warn('WhatsApp webhook verification failed: Insecure default or short verify token rejected in production.');
      return { verified: false, challenge: null };
    }

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('WhatsApp webhook successfully verified by Meta Cloud API.');
      return { verified: true, challenge };
    }

    logger.warn(`WhatsApp webhook verification failed: Token mismatch or invalid mode (received: ${token ? '[TOKEN_PROVIDED]' : 'null'})`);
    return { verified: false, challenge: null };
  }

  /**
   * Process Inbound Webhook Payload (POST /api/whatsapp/webhook)
   * Handles delivery status receipts & inbound customer messages
   */
  async processWebhook(body) {
    if (!body || body.object !== 'whatsapp_business_account') {
      return { processed: false, reason: 'NOT_WHATSAPP_EVENT' };
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    const results = { statusesProcessed: 0, messagesProcessed: 0 };

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value || {};

        // 1. Process Status Updates (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            const wamId = st.id;
            const metaStatus = String(st.status || '').toUpperCase();
            const statusMap = {
              SENT: 'SENT',
              DELIVERED: 'DELIVERED',
              READ: 'READ',
              FAILED: 'FAILED'
            };
            const mappedStatus = statusMap[metaStatus] || 'SENT';
            const errorMsg = st.errors ? JSON.stringify(st.errors) : null;

            try {
              const updated = await whatsappModel.updateMessageStatus(wamId, mappedStatus, errorMsg);
              if (updated) results.statusesProcessed++;
            } catch (err) {
              logger.warn(`Could not update status for wamId ${wamId}: ${err.message}`);
            }
          }
        }

        // 2. Process Inbound Messages from Customers
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            const senderRaw = msg.from;
            const displayPhone = formatDisplayPhone(senderRaw);
            const bodyText = msg.text?.body || (msg.type === 'button' ? msg.button?.text : `[${msg.type} message]`);
            const wamId = msg.id || `wamid.IN${Date.now()}`;

            // Check if this inbound message is already persisted
            const existing = await whatsappModel.getMessageByWamId(wamId);
            if (existing) continue;

            // Associate with customer or lead if known
            let customerId = null;
            let leadId = null;
            let customerName = null;

            try {
              const cust = await customerModel.findByPhone(senderRaw);
              if (cust) {
                customerId = cust.id;
                customerName = cust.name;
              }
            } catch (e) {}

            try {
              const recentLeads = await leadModel.findAll({ search: senderRaw, limit: 1 });
              if (recentLeads && recentLeads.length > 0) {
                leadId = recentLeads[0].id;
                if (!customerName) customerName = recentLeads[0].name;
              }
            } catch (e) {}

            // Persist inbound message
            await whatsappModel.createMessage({
              wamId,
              direction: 'INBOUND',
              toPhone: '+91 98230 01122',
              fromPhone: displayPhone,
              customerId,
              leadId,
              messageType: 'TEXT',
              body: bodyText,
              status: 'READ',
              metadata: { metaInbound: msg }
            });

            // Trigger Real-time Admin Notification
            await notificationModel.create({
              title: `💬 WhatsApp from ${customerName || displayPhone}`,
              message: `"${bodyText.substring(0, 100)}"`,
              type: 'info',
              link: '/admin.html'
            });

            results.messagesProcessed++;
          }
        }
      }
    }

    return { processed: true, ...results };
  }

  // =========================================================================
  // AUTOMATION WORKFLOWS (Strictly Pre-Approved Templates Only)
  // =========================================================================

  /**
   * Automation 1: New Lead Arrives -> Send lead_welcome_inspection
   */
  async sendLeadWelcome(lead) {
    if (!lead || !lead.phone) return null;
    const customerName = lead.name || 'Valued Customer';
    const serviceName = lead.service || 'Pest Control';
    const refCode = lead.lead_code || lead.leadCode || `#LEAD-${lead.id}`;

    return await this.sendTemplate({
      to: lead.phone,
      templateName: 'lead_welcome_inspection',
      language: 'en',
      parameters: [customerName, serviceName, refCode],
      leadId: lead.id,
      customerId: lead.customer_id || lead.customerId || null
    });
  }

  /**
   * Automation 2: Booking Created/Confirmed -> Send booking_confirmed_v1
   */
  async sendBookingConfirmation(booking) {
    const phone = booking.phone || booking.customerPhone;
    if (!booking || !phone) return null;

    const customerName = booking.customerName || booking.name || 'Valued Customer';
    const serviceName = booking.serviceName || booking.service || 'Comprehensive Pest Treatment';
    const date = booking.scheduledDate || booking.date || 'Upcoming Date';
    const time = booking.timeSlot || booking.time || '10:00 AM - 01:00 PM';
    const address = booking.address || 'Your registered service address';
    const bookingCode = booking.bookingCode || `#BK-${booking.id}`;

    return await this.sendTemplate({
      to: phone,
      templateName: 'booking_confirmed_v1',
      language: 'en',
      parameters: [customerName, serviceName, String(date), String(time), address, bookingCode],
      bookingId: booking.id,
      customerId: booking.customerId || booking.customer_id || null,
      leadId: booking.leadId || booking.lead_id || null
    });
  }

  /**
   * Automation 3: Technician Assigned/Dispatched -> Send technician_assigned_v1
   */
  async sendTechnicianAssigned(booking) {
    const phone = booking.phone || booking.customerPhone;
    if (!booking || !phone) return null;

    const customerName = booking.customerName || booking.name || 'Valued Customer';
    const technicianName = booking.technicianName || 'Certified Specialist';
    const technicianPhone = booking.technicianPhone || '+91 98230 01122';
    const schedule = `${booking.scheduledDate || 'Today'} (${booking.timeSlot || 'Scheduled Slot'})`;
    const trackLink = `https://upc.io/track/${booking.bookingCode || booking.id}`;

    return await this.sendTemplate({
      to: phone,
      templateName: 'technician_assigned_v1',
      language: 'en',
      parameters: [customerName, technicianName, technicianPhone, schedule, trackLink],
      bookingId: booking.id,
      customerId: booking.customerId || booking.customer_id || null
    });
  }

  /**
   * Automation 4: Service Completed -> Send service_completed_v1
   */
  async sendServiceCompleted(booking) {
    const phone = booking.phone || booking.customerPhone;
    if (!booking || !phone) return null;

    const customerName = booking.customerName || booking.name || 'Valued Customer';
    const serviceName = booking.serviceName || booking.service || 'Pest Control';
    const technicianName = booking.technicianName || 'Universal Pest Team';
    const warrantyRef = booking.bookingCode || `#WRN-${booking.id}`;

    return await this.sendTemplate({
      to: phone,
      templateName: 'service_completed_v1',
      language: 'en',
      parameters: [customerName, serviceName, technicianName, warrantyRef],
      bookingId: booking.id,
      customerId: booking.customerId || booking.customer_id || null
    });
  }

  /**
   * Automation 5: Review Request -> Send review_request_v1
   */
  async sendReviewRequest(booking) {
    const phone = booking.phone || booking.customerPhone;
    if (!booking || !phone) return null;

    const customerName = booking.customerName || booking.name || 'Valued Customer';
    const reviewUrl = 'https://upc.io/rate-service';

    return await this.sendTemplate({
      to: phone,
      templateName: 'review_request_v1',
      language: 'en',
      parameters: [customerName, reviewUrl],
      bookingId: booking.id,
      customerId: booking.customerId || booking.customer_id || null
    });
  }

  /**
   * Automation 6: Follow-up Reminder -> Send followup_reminder_v1
   */
  async sendFollowupReminder(followup, lead = null) {
    if (!followup) return null;
    const phone = followup.phone || followup.customerPhone || lead?.phone;
    if (!phone) return null;

    const customerName = followup.customerName || lead?.name || 'Valued Customer';
    const date = followup.scheduledDate || followup.date || 'Upcoming Date';
    const time = followup.scheduledTime || followup.time || '11:00 AM';

    return await this.sendTemplate({
      to: phone,
      templateName: 'followup_reminder_v1',
      language: 'en',
      parameters: [customerName, String(date), String(time)],
      leadId: followup.leadId || followup.lead_id || lead?.id || null
    });
  }
}

module.exports = new WhatsAppService();
