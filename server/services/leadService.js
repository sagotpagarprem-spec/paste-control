// Universal Pest Control — Lead Service
const leadModel = require('../models/leadModel');
const customerModel = require('../models/customerModel');
const notificationModel = require('../models/notificationModel');
const auditLogModel = require('../models/auditLogModel');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

// Allowed status values for CRM lifecycle
const VALID_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'LOST', 'SITE VISIT', 'QUOTATION', 'CANCELLED'];

class LeadService {
  async getLeads(filters) {
    return await leadModel.findAll(filters);
  }

  async getLeadById(id) {
    const lead = await leadModel.findById(id);
    if (!lead) {
      throw new Error('Lead not found.');
    }
    return lead;
  }

  /**
   * Create lead with automatic duplicate detection & attribution preservation
   */
  async createLead(data, ipAddress = null, userAgent = null) {
    // 1. Normalize and validate data fields
    let rawPhone = String(data.phone || '').trim();
    // Normalize phone by removing spaces, hyphens, and parentheses
    let phone = rawPhone.replace(/[\s\-\(\)]/g, '');
    if (phone.startsWith('+91') && phone.length === 13) {
      phone = phone.substring(3);
    } else if (phone.startsWith('91') && phone.length === 12) {
      phone = phone.substring(2);
    }

    if (!phone || phone.length < 10) {
      throw new Error('A valid 10-digit phone number is required.');
    }

    const name = data.name ? String(data.name).trim() : 'Inbound Inquiry';
    if (!name || name.length < 2) {
      throw new Error('A valid customer name is required.');
    }

    const email = data.email ? String(data.email).trim().toLowerCase() : null;
    const service = data.service || data.service_name || 'General Pest Control';

    // 2. Duplicate Detection: Check for recent existing active lead with same phone
    let isDuplicate = false;
    let duplicateOfId = null;
    let existingRecent = null;

    if (phone) {
      existingRecent = await leadModel.findRecentByPhone(phone, 48);
      if (existingRecent) {
        isDuplicate = true;
        duplicateOfId = existingRecent.id;
        // Record duplicate attempt and update original without destroying historical data
        await leadModel.recordDuplicateOnOriginal(existingRecent.id, {
          source: data.source || 'Website',
          service,
          message: data.message || data.notes
        });
      }
    }

    // 3. Sync or create customer record
    let customerId = null;
    if (phone) {
      try {
        const existingCustomer = await customerModel.findByPhone(phone);
        if (!existingCustomer) {
          const newCustomer = await customerModel.create({
            name,
            email,
            phone,
            property_type: data.property || data.property_type || 'Residential',
            address: data.address || null,
            city: data.city || 'Pune',
            area: data.area || null
          });
          customerId = newCustomer?.id;
        } else {
          customerId = existingCustomer.id;
        }
      } catch (custErr) {
        logger.warn(`Customer sync warning: ${custErr.message}`);
      }
    }

    // 4. Save lead in database
    const leadPayload = {
      ...data,
      customer_id: customerId,
      name,
      phone,
      email,
      service,
      property_type: data.property || data.property_type || 'Residential',
      city: data.city || 'Pune',
      area: data.area || null,
      address: data.address || null,
      message: data.message || data.notes || null,
      preferred_date: data.preferred_date || data.preferredDate || null,
      preferred_time: data.preferred_time || data.preferredTime || null,
      source: data.source || 'Website',
      // Real attribution only — do not fabricate if absent
      campaign: data.campaign || data.utm_campaign || null,
      campaign_id: data.campaign_id || data.campaignId || null,
      ad_id: data.ad_id || data.adId || null,
      adset_name: data.adset_name || data.adSet || null,
      adset_id: data.adset_id || data.adSetId || null,
      ad_name: data.ad_name || data.ad || null,
      platform: data.platform || null,
      leadgen_id: data.leadgen_id || data.leadgenId || null,
      utm_source: data.utm_source || data.utmSource || null,
      utm_medium: data.utm_medium || data.utmMedium || null,
      utm_campaign: data.utm_campaign || data.utmCampaign || null,
      utm_content: data.utm_content || data.utmContent || null,
      utm_term: data.utm_term || data.utmTerm || null,
      status: (data.status === 'NEW_LEAD' ? 'NEW' : data.status) || 'NEW',
      is_duplicate: isDuplicate,
      duplicate_of_id: duplicateOfId
    };

    const newLead = await leadModel.create(leadPayload);

    // 5. Create System Notification
    const notifTitle = isDuplicate ? '⚠️ Duplicate Lead Detected' : '🎯 New Lead Inbound';
    const notifMsg = isDuplicate
      ? `Repeat inquiry from ${newLead.name} (${newLead.phone}) for ${service}. Linked to lead #${existingRecent.lead_code}.`
      : `${newLead.name} requested ${service} via ${newLead.source || 'Website'}.`;

    try {
      await notificationModel.create({
        title: notifTitle,
        message: notifMsg,
        type: isDuplicate ? 'warning' : 'info',
        link: `/admin.html`
      });
    } catch (notifErr) {
      logger.warn(`Notification error: ${notifErr.message}`);
    }

    // 6. Audit Log
    try {
      await auditLogModel.log({
        action: isDuplicate ? 'LEAD_DUPLICATE_CAPTURED' : 'LEAD_CREATED',
        entityType: 'lead',
        entityId: String(newLead.id),
        ipAddress,
        userAgent,
        details: {
          leadCode: newLead.lead_code,
          source: newLead.source,
          campaign: newLead.campaign,
          isDuplicate,
          duplicateOfId
        }
      });
    } catch (auditErr) {
      logger.warn(`Audit log error: ${auditErr.message}`);
    }

    // 7. WhatsApp Business Automation (when enabled and non-duplicate)
    if (newLead.phone && !isDuplicate) {
      whatsappService.sendLeadWelcome(newLead).catch(err => {
        logger.warn(`[WhatsApp Auto] Lead welcome template failed for ${newLead.phone}: ${err.message}`);
      });
    }

    return {
      ...newLead,
      isDuplicate: isDuplicate,
      isDuplicateAlert: isDuplicate,
      duplicateOfId: duplicateOfId,
      duplicateMessage: isDuplicate ? `Recent active inquiry exists (#${existingRecent?.lead_code}). Inquiry recorded and timeline updated.` : null
    };
  }

  async updateLead(id, data, user = null, ipAddress = null) {
    const updated = await leadModel.update(id, data, user ? user.id : null);
    if (!updated) {
      throw new Error('Lead not found.');
    }

    // If status became QUALIFIED, BOOKED, or COMPLETED, automatically ensure customer record is created/synced
    const targetStatus = data.status ? String(data.status).toUpperCase().replace(/[\-_]/g, ' ') : null;
    if (targetStatus && ['QUALIFIED', 'BOOKED', 'COMPLETED', 'SITE VISIT', 'QUOTATION'].includes(targetStatus) && updated && updated.phone) {
      try {
        const customer = await customerModel.upsertFromLeadOrBooking({
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
          address: updated.address,
          city: updated.city,
          area: updated.area,
          property_type: updated.propertyType || updated.property_type
        });
        if (customer && !updated.customerId && !updated.customer_id) {
          await leadModel.update(updated.id, { customer_id: customer.id });
        }
      } catch (e) {}
    }

    if (user) {
      try {
        await auditLogModel.log({
          userId: user.id,
          action: 'LEAD_UPDATED',
          entityType: 'lead',
          entityId: String(id),
          ipAddress,
          details: data
        });
      } catch (e) {}
    }

    return updated;
  }

  async updateStatus(id, status, user = null, ipAddress = null) {
    if (!status) {
      throw new Error('Status value is required.');
    }
    const normalizedStatus = String(status).toUpperCase().replace(/[\-_]/g, ' ');
    const isKnownStatus = VALID_STATUSES.some(s => s === normalizedStatus || s.replace(/\s+/g, '_') === normalizedStatus);
    if (!isKnownStatus) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    return await this.updateLead(id, { status: normalizedStatus }, user, ipAddress);
  }

  async assign(id, { userId, technicianId } = {}, user = null, ipAddress = null) {
    const updateData = {};
    if (userId !== undefined) updateData.assigned_to = userId ? Number(userId) : null;
    if (technicianId !== undefined) updateData.assigned_technician_id = technicianId ? Number(technicianId) : null;

    if (Object.keys(updateData).length === 0) {
      throw new Error('Please provide at least one valid assignment field (userId or technicianId).');
    }

    return await this.updateLead(id, updateData, user, ipAddress);
  }

  async archiveLead(id, user = null, ipAddress = null) {
    const updated = await leadModel.archive(id, user ? user.id : null);
    if (!updated) {
      throw new Error('Lead not found.');
    }

    if (user) {
      try {
        await auditLogModel.log({
          userId: user.id,
          action: 'LEAD_ARCHIVED',
          entityType: 'lead',
          entityId: String(id),
          ipAddress
        });
      } catch (e) {}
    }

    return updated;
  }

  async addNote(id, note, user = null, ipAddress = null) {
    const updated = await leadModel.addNote(id, note, user ? user.id : null);
    if (!updated) {
      throw new Error('Lead not found.');
    }

    if (user) {
      try {
        await auditLogModel.log({
          userId: user.id,
          action: 'LEAD_NOTE_ADDED',
          entityType: 'lead',
          entityId: String(id),
          ipAddress,
          details: { noteLength: note.length }
        });
      } catch (e) {}
    }

    return updated;
  }
}

module.exports = new LeadService();
