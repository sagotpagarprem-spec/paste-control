/* ===================================================================
   UNIVERSAL PEST CONTROL — STATE STORE & DATA LAYER
   Persistent Reactive Store (CRM, Leads, Bookings, Ads, Analytics)
   =================================================================== */

const UPC_STORAGE_KEY = 'UPC_PLATFORM_DATA_V1';

const INITIAL_STATE = {
  leads: [
    {
      id: 'LD-901',
      name: 'Dr. Rajiv Malhotra',
      phone: '+91 98230 44129',
      email: 'rajiv.malhotra@gmail.com',
      service: 'Termite Control',
      property: 'Villa (4 BHK)',
      city: 'Pune',
      area: 'Koregaon Park',
      source: 'Instagram Lead Ad',
      campaign: 'Termite Monsoon Shield 2026',
      adName: 'Reel_Infestation_Detection_v2',
      status: 'NEW',
      urgency: 'Today',
      value: 14500,
      createdAt: '2026-10-05T18:30:00Z',
      followUpDate: '2026-10-06T10:00:00Z',
      assignedTo: 'Vikram Shinde (Sr. Inspector)',
      notes: 'Customer observed hollow baseboards in study room and wooden cupboards.',
      timeline: [
        { time: '10 mins ago', text: 'Lead submitted via Instagram Ad Form.' },
        { time: '5 mins ago', text: 'Automated WhatsApp welcome & brochure sent.' }
      ]
    },
    {
      id: 'LD-902',
      name: 'Chef Ananya Deshmukh',
      phone: '+91 98901 88320',
      email: 'kitchen@bistroolive.in',
      service: 'Commercial Pest Control',
      property: 'Restaurant (3,200 sq.ft)',
      city: 'Pune',
      area: 'Baner High Street',
      source: 'Google Ads',
      campaign: 'Commercial Kitchen HACCP Search',
      adName: 'Google_Search_RestaurantPest',
      status: 'SITE VISIT',
      urgency: 'Within 2–3 days',
      value: 28000,
      createdAt: '2026-10-04T14:15:00Z',
      followUpDate: '2026-10-06T11:30:00Z',
      assignedTo: 'Amit Kulkarni',
      notes: 'Annual AMC contract required for FSSAI/HACCP hygiene audit clearance.',
      timeline: [
        { time: 'Yesterday', text: 'Pre-audit consultation call completed.' },
        { time: 'Today 09:00', text: 'Site inspection scheduled for 11:30 AM.' }
      ]
    },
    {
      id: 'LD-903',
      name: 'Sameer Khandelwal',
      phone: '+91 97654 22091',
      email: 'sameer.k@tcs.com',
      service: 'Cockroach Control',
      property: 'Apartment (3 BHK)',
      city: 'Pune',
      area: 'Hinjawadi Phase 1',
      source: 'Website',
      campaign: 'Organic Search',
      adName: 'Organic Direct',
      status: 'CONTACTED',
      urgency: 'This week',
      value: 3200,
      createdAt: '2026-10-05T12:00:00Z',
      followUpDate: '2026-10-06T15:00:00Z',
      assignedTo: 'Pooja Patil',
      notes: 'German cockroach infestation around modular kitchen chimney & sink drain.',
      timeline: [
        { time: 'Yesterday', text: 'Lead submitted via Smart Multi-Step Wizard.' },
        { time: 'Yesterday', text: 'First call completed, sent herbal gel quote.' }
      ]
    },
    {
      id: 'LD-904',
      name: 'Priyanka Sen',
      phone: '+91 99220 11984',
      email: 'priyanka.sen@outlook.com',
      service: 'Bed Bug Control',
      property: 'Home (2 BHK)',
      city: 'Pune',
      area: 'Viman Nagar',
      source: 'Facebook Lead Ad',
      campaign: 'Bed Bug Steaming Solution',
      adName: 'FB_Story_SleepPeacefully',
      status: 'QUOTATION',
      urgency: 'Today',
      value: 5800,
      createdAt: '2026-10-04T09:30:00Z',
      followUpDate: '2026-10-06T16:00:00Z',
      assignedTo: 'Vikram Shinde',
      notes: 'Two master bedroom mattresses infested after international travel.',
      timeline: [
        { time: '2 days ago', text: 'Lead registered from Facebook Story ad.' },
        { time: 'Yesterday', text: '2-visit thermal fogging quote sent via WhatsApp.' }
      ]
    },
    {
      id: 'LD-905',
      name: 'Adarsh Logistics Park',
      phone: '+91 98221 66750',
      email: 'ops@adarshlogistics.com',
      service: 'Industrial Pest Control',
      property: 'Warehouse (45,000 sq.ft)',
      city: 'Pune',
      area: 'Chakan MIDC',
      source: 'Referral',
      campaign: 'B2B Client Referral',
      adName: 'N/A',
      status: 'BOOKED',
      urgency: 'This week',
      value: 95000,
      createdAt: '2026-10-01T11:00:00Z',
      followUpDate: '2026-10-07T09:00:00Z',
      assignedTo: 'Amit Kulkarni',
      notes: 'Quarterly rodent bait stations & bird netting for FMCG distribution center.',
      timeline: [
        { time: 'Oct 01', text: 'Lead referred by Godown Head.' },
        { time: 'Oct 03', text: 'Quotation approved and contract PO issued.' }
      ]
    }
  ],

  bookings: [
    {
      id: 'UPC-2026-8941',
      customerName: 'Dr. Rajiv Malhotra',
      phone: '+91 98230 44129',
      service: 'Termite Radar Inspection',
      address: 'Bungalow 14, Lane 7, Koregaon Park, Pune',
      date: '2026-10-06',
      timeSlot: '11:00 AM – 01:00 PM',
      technician: 'Vikram Shinde',
      status: 'Assigned',
      amount: 14500,
      paymentStatus: 'COD / Pay After Service'
    },
    {
      id: 'UPC-2026-8942',
      customerName: 'Chef Ananya Deshmukh',
      phone: '+91 98901 88320',
      service: 'Commercial Pest & Cockroach Gel AMC',
      address: 'Bistro Olive, Unit 4B, Baner High Street, Pune',
      date: '2026-10-06',
      timeSlot: '03:00 PM – 05:00 PM',
      technician: 'Ramesh Pawar',
      status: 'Confirmed',
      amount: 28000,
      paymentStatus: 'Pending Invoice'
    },
    {
      id: 'UPC-2026-8943',
      customerName: 'Sanjay Deshpande',
      phone: '+91 98811 55221',
      service: 'Mosquito Fogging & Anti-Larval',
      address: 'Greenwoods Society, Clubhouse & Perimeter, Baner',
      date: '2026-10-07',
      timeSlot: '09:00 AM – 11:00 AM',
      technician: 'Santosh Jadhav',
      status: 'Pending',
      amount: 8500,
      paymentStatus: 'Online Paid'
    }
  ],

  campaigns: [
    {
      id: 'CMP-META-01',
      name: 'Termite Monsoon Shield 2026',
      platform: 'Instagram / Facebook',
      objective: 'Lead Generation',
      status: 'Active',
      budget: '₹45,000 / month',
      spend: '₹18,420',
      leads: 68,
      cpl: '₹270.88',
      roas: '5.2x'
    },
    {
      id: 'CMP-META-02',
      name: 'Cockroach Odorless Gel Promo',
      platform: 'Instagram Reels',
      objective: 'Instant Booking',
      status: 'Active',
      budget: '₹25,000 / month',
      spend: '₹12,150',
      leads: 74,
      cpl: '₹164.18',
      roas: '4.8x'
    },
    {
      id: 'CMP-META-03',
      name: 'Commercial Kitchen HACCP FSSAI',
      platform: 'Facebook Feed & LinkedIn',
      objective: 'B2B Consultation',
      status: 'Active',
      budget: '₹35,000 / month',
      spend: '₹14,900',
      leads: 22,
      cpl: '₹677.27',
      roas: '7.1x'
    }
  ],

  notifications: [
    { id: 1, title: 'New High-Value Lead', text: 'Dr. Rajiv Malhotra requested Termite Inspection in Koregaon Park.', time: '10m ago', unread: true },
    { id: 2, title: 'Follow-up Due Today', text: 'Chef Ananya Deshmukh (Baner) scheduled for site inspection at 11:30 AM.', time: '1h ago', unread: true },
    { id: 3, title: 'Booking Confirmed', text: 'UPC-2026-8942 assigned to technician Ramesh Pawar.', time: '2h ago', unread: false }
  ]
};

class UPCStore {
  constructor() {
    this.data = this.loadState();
    this.listeners = [];
  }

  loadState() {
    try {
      const stored = localStorage.getItem(UPC_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load local storage state:', e);
    }
    this.saveState(INITIAL_STATE);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  saveState(state) {
    try {
      localStorage.setItem(UPC_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to local storage:', e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.saveState(this.data);
    this.listeners.forEach(fn => fn(this.data));
  }

  // Lead actions
  addLead(leadData) {
    const newLead = {
      id: `LD-${Math.floor(100 + Math.random() * 900)}`,
      status: 'NEW',
      createdAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      assignedTo: 'Vikram Shinde',
      timeline: [
        { time: 'Just now', text: `Lead registered via ${leadData.source || 'Website'}.` }
      ],
      ...leadData
    };
    this.data.leads.unshift(newLead);

    // Add alert notification
    this.addNotification({
      title: 'New Lead Generated!',
      text: `${newLead.name} requested ${newLead.service} (${newLead.property || 'Home'}).`,
      time: 'Just now',
      unread: true
    });

    this.notify();

    // Async sync with Production API if available
    if (window.upcApi) {
      window.upcApi.leads.create({
        name: newLead.name,
        phone: newLead.phone,
        email: newLead.email,
        service: newLead.service,
        property: newLead.property,
        city: newLead.city,
        area: newLead.area,
        source: newLead.source,
        campaign: newLead.campaign,
        urgency: newLead.urgency,
        value: newLead.value,
        notes: newLead.notes
      }).catch(() => {});
    }

    return newLead;
  }

  updateLeadStatus(leadId, newStatus) {
    const lead = this.data.leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = newStatus;
      lead.timeline.unshift({
        time: 'Just now',
        text: `Status updated to ${newStatus} by Admin.`
      });
      this.notify();

      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        window.upcApi.leads.update(leadId, { status: newStatus }).catch(() => {});
      }
    }
  }

  addLeadNote(leadId, noteText) {
    const lead = this.data.leads.find(l => l.id === leadId);
    if (lead) {
      lead.notes = lead.notes ? `${lead.notes}\n[${new Date().toLocaleTimeString()}]: ${noteText}` : noteText;
      lead.timeline.unshift({
        time: 'Just now',
        text: `Note added: "${noteText}"`
      });
      this.notify();

      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        window.upcApi.leads.addNote(leadId, noteText).catch(() => {});
      }
    }
  }

  // Synchronize state from live MySQL API
  syncFromBackend(backendLeads = []) {
    if (!Array.isArray(backendLeads) || backendLeads.length === 0) return;
    
    // Normalize backend leads to store schema
    const formatted = backendLeads.map(b => ({
      id: b.lead_code || `LD-${b.id}`,
      dbId: b.id,
      name: b.name,
      phone: b.phone,
      email: b.email || '',
      service: b.service_name,
      property: b.property_type || 'Residential',
      city: b.city || 'Pune',
      area: b.area || '',
      source: b.source || 'Website',
      campaign: b.campaign || '',
      adName: b.ad_name || '',
      status: b.status || 'NEW',
      urgency: b.urgency || 'Today',
      value: Number(b.estimated_value) || 0,
      createdAt: b.created_at,
      followUpDate: b.follow_up_date || '',
      assignedTo: b.assigned_to_name || 'Vikram Shinde',
      notes: b.notes ? (Array.isArray(b.notes) ? b.notes.map(n => n.note).join('\n') : b.notes) : '',
      timeline: b.timeline && Array.isArray(b.timeline) 
        ? b.timeline.map(t => ({ time: t.created_at || 'Recently', text: t.description }))
        : [{ time: 'Recent', text: `Lead received via ${b.source}` }]
    }));

    this.data.leads = formatted;
    this.notify();
  }

  // Booking actions
  createBooking(bookingData) {
    const newBooking = {
      id: `UPC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
      technician: 'Vikram Shinde (Assigned)',
      ...bookingData
    };
    this.data.bookings.unshift(newBooking);

    // Also auto-create or update lead
    this.addLead({
      name: newBooking.customerName,
      phone: newBooking.phone,
      service: newBooking.service,
      property: newBooking.propertyType || 'Residential',
      city: 'Pune',
      source: 'Direct Booking Engine',
      status: 'BOOKED',
      value: newBooking.amount || 4500
    });

    this.addNotification({
      title: 'New Service Booking Confirmed!',
      text: `Booking ${newBooking.id} received for ${newBooking.service} on ${newBooking.date}.`,
      time: 'Just now',
      unread: true
    });

    this.notify();

    // Async sync with Production API if available
    if (window.upcApi) {
      window.upcApi.bookings.create({
        booking_code: newBooking.id,
        name: newBooking.customerName,
        phone: newBooking.phone,
        service: newBooking.service,
        property: newBooking.propertyType,
        date: newBooking.date,
        slot: newBooking.timeSlot,
        address: newBooking.address,
        amount: newBooking.amount,
        notes: newBooking.notes
      }).catch(() => {});
    }

    return newBooking;
  }

  updateBookingStatus(bookingId, newStatus) {
    const booking = this.data.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.status = newStatus;
      this.notify();

      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        window.upcApi.bookings.updateStatus(bookingId, newStatus).catch(() => {});
      }
    }
  }

  // Notification actions
  addNotification(notif) {
    this.data.notifications.unshift({
      id: Date.now(),
      ...notif
    });
    this.notify();
  }

  markAllNotificationsRead() {
    this.data.notifications.forEach(n => n.unread = false);
    this.notify();
  }

  // Stats calculation
  getKpis() {
    const leads = this.data.leads;
    const bookings = this.data.bookings;
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'NEW').length;
    const qualified = leads.filter(l => ['QUALIFIED', 'SITE VISIT', 'QUOTATION', 'BOOKED', 'COMPLETED'].includes(l.status)).length;
    const bookedCount = leads.filter(l => ['BOOKED', 'COMPLETED'].includes(l.status)).length;
    const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0) + 
                         leads.filter(l => l.status === 'COMPLETED').reduce((s, l) => s + (l.value || 0), 0);
    const conversionRate = totalLeads > 0 ? ((bookedCount / totalLeads) * 100).toFixed(1) : '0';

    return {
      totalLeads,
      newLeads,
      qualified,
      bookedCount,
      totalRevenue,
      conversionRate
    };
  }
}

// Export singleton instance
window.upcStore = new UPCStore();
