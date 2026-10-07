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

  async createLead(data, ipAddress = null, userAgent = null) {
    // Check or create customer record
    if (data.phone) {
      const existingCustomer = await customerModel.findByPhone(data.phone);
      if (!existingCustomer) {
        await customerModel.create({
          name: data.name,
          email: data.email,
          phone: data.phone,
          property_type: data.property || data.property_type || 'Residential',
          city: data.city || 'Pune',
          area: data.area || null
        });
      }
    }

    const newLead = await leadModel.create(data);

    // Create system notification for high value or new inbound lead
    await notificationModel.create({
      title: 'New Lead Inbound',
      message: `${newLead.name} requested ${newLead.service_name} (${newLead.property_type}) via ${newLead.source}.`,
      type: 'info',
      link: `/admin.html`
    });

    await auditLogModel.log({
      action: 'LEAD_CREATED',
      entityType: 'lead',
      entityId: String(newLead.id),
      ipAddress,
      userAgent,
      details: { leadCode: newLead.lead_code, source: newLead.source }
    });

    return newLead;
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
        ipAddress
      });
    }

    return updated;
  }
}

module.exports = new LeadService();
