/* ===================================================================
   UNIVERSAL PEST CONTROL — ADMIN CRM & ADVERTISING PLATFORM CONTROLLER
   Full Admin Suite (Overview, Kanban CRM, Lead Drawer, AI Creative Studio, WhatsApp, Dispatch)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.upcStore) return;

  initAdminNavigation();
  renderAdminOverview();
  renderCrmKanban();
  renderCrmTable();
  initLeadDrawer();
  initAiCreativeStudio();
  initWhatsAppHub();
  initTechnicianDispatch();
  initNotificationDrawer();

  // Subscribe to store updates for real-time reactive sync
  window.upcStore.subscribe(() => {
    renderAdminOverview();
    renderCrmKanban();
    renderCrmTable();
    updateNotificationBadge();
  });
});

/* 1. ADMIN NAVIGATION & SECTION SWITCHING */
function initAdminNavigation() {
  const menuItems = document.querySelectorAll('.admin-nav-item[data-admin-view]');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-admin-view');
      switchAdminSection(targetView);
    });
  });

  // Mobile sidebar toggle
  const adminMobileBtn = document.getElementById('adminSidebarToggle');
  const sidebar = document.querySelector('.admin-sidebar');
  if (adminMobileBtn && sidebar) {
    adminMobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }
}

function switchAdminSection(viewKey) {
  // Hide all admin sections
  const sections = document.querySelectorAll('.admin-view-section');
  sections.forEach(s => s.style.display = 'none');

  const target = document.getElementById(`admin-sec-${viewKey}`);
  if (target) target.style.display = 'block';

  // Update active state in nav
  document.querySelectorAll('.admin-nav-item').forEach(i => {
    if (i.getAttribute('data-admin-view') === viewKey) {
      i.classList.add('active');
    } else {
      i.classList.remove('active');
    }
  });

  // Close mobile sidebar
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
}

/* 2. OVERVIEW KPI CARDS & CHARTS */
function renderAdminOverview() {
  const kpis = window.upcStore.getKpis();

  const totalLeadsEl = document.getElementById('kpiTotalLeads');
  const newLeadsEl = document.getElementById('kpiNewLeads');
  const bookedEl = document.getElementById('kpiBookings');
  const revenueEl = document.getElementById('kpiRevenue');
  const conversionEl = document.getElementById('kpiConversion');

  if (totalLeadsEl) totalLeadsEl.textContent = kpis.totalLeads;
  if (newLeadsEl) newLeadsEl.textContent = kpis.newLeads;
  if (bookedEl) bookedEl.textContent = kpis.bookedCount;
  if (revenueEl) revenueEl.textContent = `₹${kpis.totalRevenue.toLocaleString()}`;
  if (conversionEl) conversionEl.textContent = `${kpis.conversionRate}%`;

  // Render SVG interactive charts
  renderLeadsOverTimeChart();
  renderServiceBreakdownChart();
}

function renderLeadsOverTimeChart() {
  const container = document.getElementById('chartLeadsOverTime');
  if (!container) return;

  // Render crisp high-tech SVG Area & Line Chart
  container.innerHTML = `
    <svg viewBox="0 0 600 200" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <!-- Horizontal Grid Lines -->
      <line x1="40" y1="30" x2="580" y2="30" stroke="#F1F5F9" stroke-width="1" />
      <line x1="40" y1="75" x2="580" y2="75" stroke="#F1F5F9" stroke-width="1" />
      <line x1="40" y1="120" x2="580" y2="120" stroke="#F1F5F9" stroke-width="1" />
      <line x1="40" y1="165" x2="580" y2="165" stroke="#E2E8F0" stroke-width="1.5" />

      <!-- Area fill -->
      <path d="M 60 150 Q 140 120, 220 90 T 380 60 T 540 35 L 540 165 L 60 165 Z" fill="url(#areaGradient)" />

      <!-- Stroke curve -->
      <path d="M 60 150 Q 140 120, 220 90 T 380 60 T 540 35" fill="none" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" />

      <!-- Data Dots with Pulse Glow -->
      <circle cx="60" cy="150" r="5" fill="#064E3B" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="220" cy="90" r="5" fill="#064E3B" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="380" cy="60" r="5" fill="#064E3B" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="540" cy="35" r="6" fill="#10B981" stroke="#FFFFFF" stroke-width="2.5" />

      <!-- Labels -->
      <text x="60" y="185" fill="#94A3B8" font-size="11" text-anchor="middle">Mon</text>
      <text x="180" y="185" fill="#94A3B8" font-size="11" text-anchor="middle">Tue</text>
      <text x="300" y="185" fill="#94A3B8" font-size="11" text-anchor="middle">Wed</text>
      <text x="420" y="185" fill="#94A3B8" font-size="11" text-anchor="middle">Thu</text>
      <text x="540" y="185" fill="#10B981" font-size="11" font-weight="700" text-anchor="middle">Today</text>
    </svg>
  `;
}

function renderServiceBreakdownChart() {
  const container = document.getElementById('chartServiceBreakdown');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.95rem; justify-content:center; height:100%;">
      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:0.25rem;">
          <span>Termite Radar Control</span>
          <span style="color:#064E3B; font-weight:700;">42% (₹1.8L)</span>
        </div>
        <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
          <div style="width:42%; height:100%; background:#064E3B;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:0.25rem;">
          <span>Commercial Kitchen AMC</span>
          <span style="color:#10B981; font-weight:700;">28% (₹1.2L)</span>
        </div>
        <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
          <div style="width:28%; height:100%; background:#10B981;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:0.25rem;">
          <span>Cockroach Odorless Gel</span>
          <span style="color:#F59E0B; font-weight:700;">18% (₹48K)</span>
        </div>
        <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
          <div style="width:18%; height:100%; background:#F59E0B;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:0.25rem;">
          <span>Bed Bug Thermal & Others</span>
          <span style="color:#64748B; font-weight:700;">12% (₹32K)</span>
        </div>
        <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
          <div style="width:12%; height:100%; background:#64748B;"></div>
        </div>
      </div>
    </div>
  `;
}

/* 3. CRM KANBAN BOARD */
const CRM_STATUSES = [
  { id: 'NEW', title: 'New Leads', color: '#3B82F6' },
  { id: 'CONTACTED', title: 'Contacted', color: '#8B5CF6' },
  { id: 'QUALIFIED', title: 'Qualified', color: '#06B6D4' },
  { id: 'SITE VISIT', title: 'Site Visit', color: '#EC4899' },
  { id: 'QUOTATION', title: 'Quotation', color: '#F59E0B' },
  { id: 'FOLLOW-UP', title: 'Follow-Up', color: '#F97316' },
  { id: 'BOOKED', title: 'Booked', color: '#10B981' },
  { id: 'COMPLETED', title: 'Completed', color: '#059669' },
  { id: 'LOST', title: 'Lost', color: '#6B7280' }
];

function renderCrmKanban() {
  const container = document.getElementById('crmKanbanContainer');
  if (!container) return;

  const leads = window.upcStore.data.leads;

  container.innerHTML = CRM_STATUSES.map(col => {
    const colLeads = leads.filter(l => l.status === col.id);
    return `
      <div class="kanban-column" data-status="${col.id}">
        <div class="kanban-column-header">
          <div class="kanban-column-title">
            <span style="width:10px; height:10px; border-radius:50%; background:${col.color};"></span>
            ${col.title}
          </div>
          <span class="badge badge-neutral" style="font-size:0.75rem;">${colLeads.length}</span>
        </div>

        <div class="kanban-cards-list">
          ${colLeads.map(lead => `
            <div class="kanban-card" onclick="openLeadDrawer('${lead.id}')">
              <div class="kanban-card-top">
                <span class="badge ${lead.source?.includes('Instagram') ? 'badge-primary' : lead.source?.includes('Facebook') ? 'badge-info' : 'badge-neutral'}">
                  ${lead.source || 'Website'}
                </span>
                <span style="font-weight:700; color:#064E3B; font-size:0.85rem;">₹${(lead.value || 3500).toLocaleString()}</span>
              </div>
              <div class="kanban-lead-name">${lead.name}</div>
              <div class="kanban-lead-service">🛡️ ${lead.service}</div>
              <div style="font-size:0.78rem; color:#64748B; margin-bottom:0.5rem;">
                📍 ${lead.area ? `${lead.area}, ${lead.city}` : lead.city || 'Pune'}
              </div>

              <div class="kanban-card-footer">
                <span>👤 ${lead.assignedTo?.split(' ')[0] || 'Unassigned'}</span>
                <div style="display:flex; gap:0.4rem;">
                  <button class="btn btn-sm btn-white" style="padding:0.2rem 0.5rem; font-size:0.72rem;" onclick="event.stopPropagation(); triggerWhatsAppChat('${lead.phone}', '${lead.name}')">WA</button>
                  <button class="btn btn-sm btn-outline" style="padding:0.2rem 0.5rem; font-size:0.72rem;" onclick="event.stopPropagation(); quickAdvanceLead('${lead.id}')">→</button>
                </div>
              </div>
            </div>
          `).join('')}

          ${colLeads.length === 0 ? `
            <div style="padding:2rem 1rem; text-align:center; color:#94A3B8; font-size:0.8rem; border:1px dashed #CBD5E1; border-radius:8px;">
              No leads in this stage
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function quickAdvanceLead(leadId) {
  const lead = window.upcStore.data.leads.find(l => l.id === leadId);
  if (!lead) return;
  const currentIndex = CRM_STATUSES.findIndex(s => s.id === lead.status);
  if (currentIndex < CRM_STATUSES.length - 1) {
    const nextStatus = CRM_STATUSES[currentIndex + 1].id;
    window.upcStore.updateLeadStatus(leadId, nextStatus);
    showToast(`Lead moved to ${nextStatus}`, 'info');
  }
}

/* 4. CRM TABLE VIEW */
function renderCrmTable() {
  const tbody = document.getElementById('crmTableBody');
  if (!tbody) return;

  const leads = window.upcStore.data.leads;
  const searchInput = document.getElementById('crmSearchInput');
  const filterQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = leads.filter(l => {
    return l.name.toLowerCase().includes(filterQuery) ||
           l.service.toLowerCase().includes(filterQuery) ||
           (l.area && l.area.toLowerCase().includes(filterQuery)) ||
           l.status.toLowerCase().includes(filterQuery);
  });

  tbody.innerHTML = filtered.map(lead => `
    <tr style="cursor:pointer;" onclick="openLeadDrawer('${lead.id}')">
      <td><strong>${lead.id}</strong></td>
      <td>
        <div style="font-weight:700; color:#0F172A;">${lead.name}</div>
        <div style="font-size:0.78rem; color:#64748B;">${lead.phone}</div>
      </td>
      <td><span style="font-weight:600; color:#064E3B;">${lead.service}</span></td>
      <td>${lead.property || 'Home'}</td>
      <td>${lead.area || 'Pune'}</td>
      <td><span class="badge badge-neutral">${lead.source}</span></td>
      <td>
        <span class="badge ${lead.status === 'NEW' ? 'badge-primary' : lead.status === 'BOOKED' ? 'badge-success' : 'badge-warning'}">
          ${lead.status}
        </span>
      </td>
      <td><strong>₹${(lead.value || 3500).toLocaleString()}</strong></td>
      <td>
        <button class="btn btn-sm btn-white" onclick="event.stopPropagation(); openLeadDrawer('${lead.id}')">View</button>
      </td>
    </tr>
  `).join('');

  if (searchInput && !searchInput.hasAttribute('data-bound')) {
    searchInput.setAttribute('data-bound', 'true');
    searchInput.addEventListener('input', () => renderCrmTable());
  }
}

/* 5. LEAD DETAIL DRAWER */
let activeDrawerLeadId = null;

function initLeadDrawer() {
  const closeBtn = document.getElementById('closeLeadDrawer');
  const drawer = document.getElementById('leadDetailDrawer');

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
      activeDrawerLeadId = null;
    });
  }

  // Quick Note Add
  const addNoteBtn = document.getElementById('btnAddLeadNote');
  const noteInput = document.getElementById('leadNoteInput');
  if (addNoteBtn && noteInput) {
    addNoteBtn.addEventListener('click', () => {
      const text = noteInput.value.trim();
      if (!text || !activeDrawerLeadId) return;
      window.upcStore.addLeadNote(activeDrawerLeadId, text);
      noteInput.value = '';
      openLeadDrawer(activeDrawerLeadId);
      showToast('Note recorded in activity timeline.', 'success');
    });
  }

  // Status Change Selector
  const statusSelect = document.getElementById('drawerStatusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      if (activeDrawerLeadId) {
        window.upcStore.updateLeadStatus(activeDrawerLeadId, statusSelect.value);
        showToast(`Status changed to ${statusSelect.value}`, 'success');
      }
    });
  }
}

function openLeadDrawer(leadId) {
  activeDrawerLeadId = leadId;
  const lead = window.upcStore.data.leads.find(l => l.id === leadId);
  const drawer = document.getElementById('leadDetailDrawer');
  if (!lead || !drawer) return;

  // Populate drawer elements
  document.getElementById('drawerLeadName').textContent = lead.name;
  document.getElementById('drawerLeadId').textContent = lead.id;
  document.getElementById('drawerLeadPhone').textContent = lead.phone;
  document.getElementById('drawerLeadEmail').textContent = lead.email || 'N/A';
  document.getElementById('drawerLeadService').textContent = lead.service;
  document.getElementById('drawerLeadProperty').textContent = lead.property || 'Home';
  document.getElementById('drawerLeadLocation').textContent = `${lead.area || ''}, ${lead.city || 'Pune'}`;
  document.getElementById('drawerLeadSource').textContent = lead.source;
  document.getElementById('drawerLeadCampaign').textContent = lead.campaign || 'N/A';
  document.getElementById('drawerLeadAdName').textContent = lead.adName || 'N/A';
  document.getElementById('drawerLeadValue').textContent = `₹${(lead.value || 3500).toLocaleString()}`;

  const statusSelect = document.getElementById('drawerStatusSelect');
  if (statusSelect) statusSelect.value = lead.status;

  // Activity Timeline
  const timelineEl = document.getElementById('drawerTimeline');
  if (timelineEl) {
    timelineEl.innerHTML = (lead.timeline || []).map(t => `
      <div class="timeline-event">
        <div class="timeline-dot"></div>
        <div style="font-size:0.75rem; color:#94A3B8; font-weight:700;">${t.time}</div>
        <div style="font-size:0.875rem; color:#1E293B; margin-top:0.2rem;">${t.text}</div>
      </div>
    `).join('');
  }

  drawer.classList.add('open');
}

/* 6. CREATIVE STUDIO & AI AD GENERATOR */
function initAiCreativeStudio() {
  const generateBtn = document.getElementById('btnAiGenerateCreative');
  if (!generateBtn) return;

  generateBtn.addEventListener('click', () => {
    const service = document.getElementById('aiStudioService')?.value || 'Cockroach Control';
    const city = document.getElementById('aiStudioLocation')?.value || 'Pune';
    const tone = document.getElementById('aiStudioTone')?.value || 'Professional';
    const offer = document.getElementById('aiStudioOffer')?.value || 'Free Inspection';

    // Simulate AI Generation with realistic high-converting marketing copywriting
    generateBtn.textContent = '✨ Generating with AI...';
    generateBtn.disabled = true;

    setTimeout(() => {
      generateBtn.textContent = '✨ Generate High-Converting Creative';
      generateBtn.disabled = false;

      let generatedHeadline = '';
      let generatedBody = '';
      let generatedCta = 'Get Free Inspection';

      if (service.includes('Cockroach')) {
        generatedHeadline = `Say Goodbye to German Cockroaches in ${city}.`;
        generatedBody = `100% Odorless Bayer Gel Baiting. No need to empty kitchen cabinets or leave your home. Child & pet safe. Over 25,000+ happy homes in ${city}.`;
        generatedCta = 'Claim Free Kitchen Inspection';
      } else if (service.includes('Termite')) {
        generatedHeadline = `Protect Your Wooden Interiors from Termite Rot.`;
        generatedBody = `Non-destructive Ultrasonic Radar detection finds underground colonies before damage spreads. 5-Year Government-approved warranty.`;
        generatedCta = 'Book Radar Termite Check';
      } else {
        generatedHeadline = `HACCP & FSSAI Compliant Commercial Pest Control.`;
        generatedBody = `Zero downtime audit-ready pest management for restaurants, hotels, and warehouses across ${city}. Digital trend documentation included.`;
        generatedCta = 'Request Commercial Audit';
      }

      // Update editable inputs
      const hlInput = document.getElementById('studioHeadlineInput');
      const bodyInput = document.getElementById('studioPrimaryTextInput');
      if (hlInput) hlInput.value = generatedHeadline;
      if (bodyInput) bodyInput.value = generatedBody;

      // Update Live Mobile Mockup Preview
      const previewHl = document.getElementById('previewAdHeadline');
      const previewBody = document.getElementById('previewAdBody');
      const previewCta = document.getElementById('previewAdCta');

      if (previewHl) previewHl.textContent = generatedHeadline;
      if (previewBody) previewBody.textContent = generatedBody;
      if (previewCta) previewCta.textContent = generatedCta;

      showToast('✨ AI Ad Creative Generated! Preview updated.', 'success');
    }, 700);
  });
}

/* 7. WHATSAPP BUSINESS HUB */
function initWhatsAppHub() {
  const sendBtn = document.getElementById('btnWaSendMessage');
  const input = document.getElementById('waMessageInput');
  const stream = document.getElementById('waMessagesStream');

  if (sendBtn && input && stream) {
    sendBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;

      appendWaBubble(text, 'outgoing');
      input.value = '';

      // Auto-reply simulation
      setTimeout(() => {
        appendWaBubble('Thank you! What is the convenient time for the inspection team to arrive?', 'incoming');
      }, 1200);
    });
  }

  // Quick Template Buttons
  const templateBtns = document.querySelectorAll('[data-wa-template]');
  templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-wa-template');
      let msg = '';
      if (type === 'quote') {
        msg = 'Hello! Your customized Universal Pest Control quotation is ready: ₹3,999 with 1-Year Comprehensive Warranty. Reply YES to confirm.';
      } else if (type === 'enroute') {
        msg = 'Hello! Your senior pest technician Vikram Shinde is ON THE WAY (ETA: 25 mins). Live tracking link: https://upc.io/t/902';
      } else if (type === 'confirm') {
        msg = 'Hi, your Free Site Inspection is confirmed for today at 02:00 PM. Our technician carries sanitized gear & ID.';
      }

      if (input) {
        input.value = msg;
        input.focus();
      }
    });
  });
}

function appendWaBubble(text, direction) {
  const stream = document.getElementById('waMessagesStream');
  if (!stream) return;

  const bubble = document.createElement('div');
  bubble.className = `wa-bubble ${direction}`;
  bubble.innerHTML = `
    <div>${text}</div>
    <div style="font-size:0.68rem; color:#64748B; text-align:right; margin-top:0.25rem;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}

function triggerWhatsAppChat(phone, name) {
  // Jump to WhatsApp view and select thread
  switchAdminSection('whatsapp');
  const customerNameEl = document.getElementById('waActiveCustomer');
  if (customerNameEl) customerNameEl.textContent = `${name} (${phone})`;
  showToast(`WhatsApp thread opened for ${name}`, 'info');
}

/* 8. TECHNICIAN DISPATCH */
function initTechnicianDispatch() {
  const completeBtns = document.querySelectorAll('.btn-complete-job');
  completeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const jobCard = btn.closest('.tech-job-card');
      if (jobCard) {
        btn.textContent = '✅ Service Completed';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-white');
        jobCard.style.opacity = '0.7';
        showToast('Technician completed job. Audit report generated!', 'success');
      }
    });
  });
}

/* 9. NOTIFICATION DRAWER */
function initNotificationDrawer() {
  const bellBtn = document.getElementById('btnAdminNotifBell');
  const drawer = document.getElementById('adminNotifDrawer');
  const closeBtn = document.getElementById('btnCloseNotifDrawer');

  if (bellBtn && drawer) {
    bellBtn.addEventListener('click', () => {
      drawer.classList.toggle('open');
      if (window.upcStore) {
        window.upcStore.markAllNotificationsRead();
        updateNotificationBadge();
      }
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  }

  updateNotificationBadge();
}

function updateNotificationBadge() {
  const badge = document.getElementById('adminNotifCount');
  const list = document.getElementById('adminNotifList');
  if (!badge || !window.upcStore) return;

  const notifs = window.upcStore.data.notifications || [];
  const unreadCount = notifs.filter(n => n.unread).length;

  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';

  if (list) {
    list.innerHTML = notifs.map(n => `
      <div style="padding:0.85rem; border-bottom:1px solid #F1F5F9; background:${n.unread ? '#F0FDF4' : '#FFFFFF'}; border-radius:6px; margin-bottom:0.5rem;">
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748B; font-weight:700;">
          <span>${n.title}</span>
          <span>${n.time}</span>
        </div>
        <div style="font-size:0.85rem; color:#0F172A; margin-top:0.25rem;">${n.text}</div>
      </div>
    `).join('');
  }
}

// Global expose
window.openLeadDrawer = openLeadDrawer;
window.triggerWhatsAppChat = triggerWhatsAppChat;
window.quickAdvanceLead = quickAdvanceLead;
window.switchAdminSection = switchAdminSection;
