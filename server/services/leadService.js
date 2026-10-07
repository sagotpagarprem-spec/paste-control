// Universal Pest Control — Lead Service
const leadModel = require('../models/leadModel');
const customerModel = require('../models/customerModel');
const notificationModel = require('../models/notificationModel');
const auditLogModel = require('../models/auditLogModel');

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
    // 1. Normalize data fields
    const phone = data.phone ? data.phone.trim() : '';
    const name = data.name ? data.name.trim() : 'Inbound Inquiry';
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
      const existingCustomer = await customerModel.findByPhone(phone);
      if (!existingCustomer) {
        const newCustomer = await customerModel.create({
          name,
          email: data.email || null,
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
    }

    // 4. Save lead in database
    const leadPayload = {
      ...data,
      customer_id: customerId,
      name,
      phone,
      service,
      is_duplicate: isDuplicate,
      duplicate_of_id: duplicateOfId
    };

    const newLead = await leadModel.create(leadPayload);

    // 5. Create System Notification
    const notifTitle = isDuplicate ? '⚠️ Duplicate Lead Detected' : '🎯 New Lead Inbound';
    const notifMsg = isDuplicate
      ? `Repeat inquiry from ${newLead.name} (${newLead.phone}) for ${service}. Linked to lead #${existingRecent.lead_code}.`
      : `${newLead.name} requested ${service} via ${newLead.source || 'Website'}.`;

    await notificationModel.create({
      title: notifTitle,
      message: notifMsg,
      type: isDuplicate ? 'warning' : 'info',
      link: `/admin.html`
    });

    // 6. Audit Log
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

    return {
      ...newLead,
      isDuplicateAlert: isDuplicate,
      duplicateMessage: isDuplicate ? `Recent active inquiry exists (#${existingRecent?.lead_code}). Inquiry recorded and timeline updated.` : null
    };
  }

  async updateLead(id, data, user = null, ipAddress = null) {
    const updated = await leadModel.update(id, data, user ? user.id : null);

    if (user) {
      await auditLogModel.log({
        userId: user.id,
        action: 'LEAD_UPDATED',
        entityType: 'lead',
        entityId: String(id),
        ipAddress,
        details: data
      });
    }

    return updated;
  }

  async addNote(id, note, user = null, ipAddress = null) {
    const updated = await leadModel.addNote(id, note, user ? user.id : null);

    if (user) {
      await auditLogModel.log({
        userId: user.id,
        action: 'LEAD_NOTE_ADDED',
        entityType: 'lead',
        entityId: String(id),
        ipAddress,
        details: { noteLength: note.length }
      });
    }

    return updated;
  }
}

module.exports = new LeadService();
