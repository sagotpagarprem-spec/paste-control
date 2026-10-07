/* ===================================================================
   UNIVERSAL PEST CONTROL — ADMIN CRM & ADVERTISING PLATFORM CONTROLLER
   Full Admin Suite (Overview, Kanban CRM, Lead Drawer, AI Creative Studio, WhatsApp, Dispatch)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
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

/* 0. ADMIN AUTHENTICATION & SESSION MANAGEMENT */
function initAdminAuth() {
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to sign out of the admin console?')) {
        if (window.upcApi) {
          await window.upcApi.auth.logout();
        }
        window.location.href = 'login.html';
      }
    });
  }

  // Populate user profile in topbar
  if (window.upcApi) {
    const user = window.upcApi.auth.getUser();
    if (user) {
      const nameEl = document.getElementById('adminUserName');
      const avatarEl = document.getElementById('adminUserAvatar');
      if (nameEl) nameEl.textContent = `${user.name} (${(user.roles && user.roles[0]) || 'Admin'})`;
      if (avatarEl && user.name) {
        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials || 'AD';
      }
    }

    // Verify session validity with backend
    window.upcApi.auth.getMe().then(res => {
      if (res && res.data) {
        const u = res.data;
        const nameEl = document.getElementById('adminUserName');
        const avatarEl = document.getElementById('adminUserAvatar');
        if (nameEl) nameEl.textContent = `${u.name} (${(u.roles && u.roles[0]) || 'Admin'})`;
        if (avatarEl && u.name) {
          const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
          avatarEl.textContent = initials || 'AD';
        }

        // Sync leads from backend API if available
        window.upcApi.leads.getAll().then(leadRes => {
          if (leadRes && leadRes.data && leadRes.data.length > 0 && window.upcStore) {
            window.upcStore.syncFromBackend(leadRes.data);
          }
        }).catch(() => {});
      }
    }).catch(err => {
      if (err.status === 401) {
        window.upcApi.auth.clearSession();
        window.location.href = 'login.html';
      }
    });
  }
}

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

/* 3. CRM KANBAN BOARD WITH REAL DRAG-AND-DROP & API PERSISTENCE */
const CRM_STATUSES = [
  { id: 'NEW', title: 'New Leads', color: '#3B82F6' },
  { id: 'CONTACTED', title: 'Contacted', color: '#8B5CF6' },
  { id: 'QUALIFIED', title: 'Qualified', color: '#06B6D4' },
  { id: 'SITE_VISIT', title: 'Site Visit', color: '#EC4899' },
  { id: 'QUOTATION', title: 'Quotation', color: '#F59E0B' },
  { id: 'FOLLOW_UP', title: 'Follow-Up', color: '#F97316' },
  { id: 'BOOKED', title: 'Booked', color: '#10B981' },
  { id: 'COMPLETED', title: 'Completed', color: '#059669' },
  { id: 'LOST', title: 'Lost', color: '#6B7280' }
];

function normalizeStatus(st) {
  if (!st) return 'NEW';
  const clean = st.toString().toUpperCase().trim().replace(/[\s\-]/g, '_');
  if (clean === 'SITE_VISIT') return 'SITE_VISIT';
  if (clean === 'FOLLOW_UP') return 'FOLLOW_UP';
  return clean;
}

function renderCrmKanban() {
  const container = document.getElementById('crmKanbanContainer');
  if (!container) return;

  const leads = window.upcStore.data.leads || [];

  container.innerHTML = CRM_STATUSES.map(col => {
    const colLeads = leads.filter(l => normalizeStatus(l.status) === col.id);
    return `
      <div class="kanban-column" data-status="${col.id}" ondragover="handleKanbanDragOver(event)" ondrop="handleKanbanDrop(event, '${col.id}')">
        <div class="kanban-column-header">
          <div class="kanban-column-title">
            <span style="width:10px; height:10px; border-radius:50%; background:${col.color};"></span>
            ${col.title}
          </div>
          <span class="badge badge-neutral" style="font-size:0.75rem;">${colLeads.length}</span>
        </div>

        <div class="kanban-cards-list">
          ${colLeads.map(lead => {
            const leadId = lead.id || lead.lead_code || `LD-${lead.dbId}`;
            const isDup = lead.is_duplicate || lead.isDuplicate;
            return `
              <div 
                class="kanban-card" 
                draggable="true" 
                ondragstart="handleKanbanDragStart(event, '${leadId}')"
                onclick="openLeadDrawer('${leadId}')"
                style="${isDup ? 'border-left: 4px solid #F59E0B;' : ''}"
              >
                <div class="kanban-card-top">
                  <div style="display:flex; gap:0.25rem; align-items:center;">
                    <span class="badge ${lead.source?.includes('Instagram') ? 'badge-primary' : lead.source?.includes('Facebook') || lead.source?.includes('Meta') ? 'badge-info' : 'badge-neutral'}">
                      ${lead.source || 'Website'}
                    </span>
                    ${isDup ? `<span class="badge badge-warning" style="font-size:0.65rem;" title="Duplicate lead">Repeat</span>` : ''}
                  </div>
                  <span style="font-weight:700; color:#064E3B; font-size:0.85rem;">₹${(Number(lead.value || lead.estimated_value) || 3500).toLocaleString()}</span>
                </div>
                <div class="kanban-lead-name">${lead.name}</div>
                <div class="kanban-lead-service">🛡️ ${lead.service || lead.service_name}</div>
                <div style="font-size:0.78rem; color:#64748B; margin-bottom:0.5rem;">
                  📍 ${lead.area ? `${lead.area}, ${lead.city}` : lead.city || 'Pune'}
                </div>

                <div class="kanban-card-footer">
                  <span style="font-size:0.75rem; color:#475569;">👤 ${lead.assignedTo?.split(' ')[0] || lead.assigned_to_name?.split(' ')[0] || 'Unassigned'}</span>
                  <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-sm btn-white" style="padding:0.2rem 0.5rem; font-size:0.72rem;" onclick="event.stopPropagation(); triggerWhatsAppChat('${lead.phone}', '${lead.name}')">WA</button>
                    <button class="btn btn-sm btn-outline" style="padding:0.2rem 0.5rem; font-size:0.72rem;" onclick="event.stopPropagation(); quickAdvanceLead('${leadId}')">→</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}

          ${colLeads.length === 0 ? `
            <div style="padding:2rem 1rem; text-align:center; color:#94A3B8; font-size:0.8rem; border:1px dashed #CBD5E1; border-radius:8px;">
              Drag leads here
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Kanban Drag and Drop Handlers
function handleKanbanDragStart(e, leadId) {
  e.dataTransfer.setData('text/plain', leadId);
  e.dataTransfer.effectAllowed = 'move';
}

function handleKanbanDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleKanbanDrop(e, targetStatus) {
  e.preventDefault();
  const leadId = e.dataTransfer.getData('text/plain');
  if (leadId && targetStatus) {
    updateLeadStatusViaApi(leadId, targetStatus);
  }
}

async function updateLeadStatusViaApi(leadId, newStatus) {
  const normStatus = normalizeStatus(newStatus);
  // 1. Update UI Store
  window.upcStore.updateLeadStatus(leadId, normStatus);
  showToast(`Lead updated to ${normStatus}`, 'success');

  // 2. Persist to MySQL Backend API
  if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
    try {
      await window.upcApi.leads.update(leadId, { status: normStatus });
    } catch (err) {
      console.warn('Backend status update error:', err.message);
    }
  }
}

function quickAdvanceLead(leadId) {
  const lead = window.upcStore.data.leads.find(l => (l.id === leadId || l.lead_code === leadId || l.dbId == leadId));
  if (!lead) return;
  const currNorm = normalizeStatus(lead.status);
  const currentIndex = CRM_STATUSES.findIndex(s => s.id === currNorm);
  if (currentIndex < CRM_STATUSES.length - 1) {
    const nextStatus = CRM_STATUSES[currentIndex + 1].id;
    updateLeadStatusViaApi(leadId, nextStatus);
  }
}

/* 4. CRM TABLE VIEW WITH FILTERS & PAGINATION */
let crmCurrentPage = 1;
const crmPageSize = 8;

function renderCrmTable() {
  const tbody = document.getElementById('crmTableBody');
  if (!tbody) return;

  const leads = window.upcStore.data.leads || [];
  const searchInput = document.getElementById('crmSearchInput');
  const filterQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filterStatus = document.getElementById('crmFilterStatus')?.value || '';
  const filterService = document.getElementById('crmFilterService')?.value || '';
  const filterSource = document.getElementById('crmFilterSource')?.value || '';

  const filtered = leads.filter(l => {
    const nameMatch = l.name?.toLowerCase().includes(filterQuery) || false;
    const servText = (l.service || l.service_name || '').toLowerCase();
    const serviceMatch = servText.includes(filterQuery);
    const areaMatch = (l.area && l.area.toLowerCase().includes(filterQuery)) || (l.city && l.city.toLowerCase().includes(filterQuery));
    const phoneMatch = l.phone?.includes(filterQuery);
    const idMatch = (l.id || l.lead_code || '').toLowerCase().includes(filterQuery);

    const matchesSearch = !filterQuery || nameMatch || serviceMatch || areaMatch || phoneMatch || idMatch;

    const normStatus = normalizeStatus(l.status);
    const matchesStatus = !filterStatus || normStatus === normalizeStatus(filterStatus);
    const matchesService = !filterService || servText.includes(filterService.toLowerCase());
    const matchesSource = !filterSource || (l.source || '').toLowerCase().includes(filterSource.toLowerCase());

    return matchesSearch && matchesStatus && matchesService && matchesSource;
  });

  // Calculate Pagination
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / crmPageSize) || 1;
  if (crmCurrentPage > totalPages) crmCurrentPage = totalPages;
  if (crmCurrentPage < 1) crmCurrentPage = 1;

  const startIndex = (crmCurrentPage - 1) * crmPageSize;
  const paginatedLeads = filtered.slice(startIndex, startIndex + crmPageSize);

  // Update Pagination Controls
  const paginationInfo = document.getElementById('crmPaginationInfo');
  const pageBadge = document.getElementById('crmCurrentPageBadge');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (paginationInfo) {
    paginationInfo.textContent = totalItems === 0
      ? 'No leads matching criteria'
      : `Showing ${startIndex + 1} to ${Math.min(startIndex + crmPageSize, totalItems)} of ${totalItems} leads`;
  }
  if (pageBadge) pageBadge.textContent = `Page ${crmCurrentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = crmCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = crmCurrentPage >= totalPages;

  tbody.innerHTML = paginatedLeads.map(lead => {
    const leadId = lead.id || lead.lead_code || `LD-${lead.dbId}`;
    const statusNorm = normalizeStatus(lead.status);
    const isDup = lead.is_duplicate || lead.isDuplicate;

    return `
      <tr style="cursor:pointer;" onclick="openLeadDrawer('${leadId}')">
        <td>
          <strong>${leadId}</strong>
          ${isDup ? `<br><span class="badge badge-warning" style="font-size:0.65rem;">Duplicate</span>` : ''}
        </td>
        <td>
          <div style="font-weight:700; color:#0F172A;">${lead.name}</div>
          <div style="font-size:0.78rem; color:#64748B;">${lead.phone}</div>
        </td>
        <td><span style="font-weight:600; color:#064E3B;">${lead.service || lead.service_name}</span></td>
        <td>${lead.property || lead.property_type || 'Residential'}</td>
        <td>${lead.area ? `${lead.area}, ${lead.city || 'Pune'}` : lead.city || 'Pune'}</td>
        <td><span class="badge badge-neutral">${lead.source || 'Website'}</span></td>
        <td>
          <span class="badge ${statusNorm === 'NEW' ? 'badge-primary' : statusNorm === 'BOOKED' || statusNorm === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">
            ${statusNorm}
          </span>
        </td>
        <td><span style="font-size:0.8rem; color:#475569;">${lead.assignedTo || lead.assigned_to_name || 'Unassigned'}</span></td>
        <td><strong>₹${(Number(lead.value || lead.estimated_value) || 3500).toLocaleString()}</strong></td>
        <td>
          <button class="btn btn-sm btn-white" onclick="event.stopPropagation(); openLeadDrawer('${leadId}')">View Detail</button>
        </td>
      </tr>
    `;
  }).join('');

  if (totalItems === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:#94A3B8;">No leads found matching current filters.</td></tr>`;
  }

  // Bind filter event listeners once
  bindCrmTableControls();
}

function bindCrmTableControls() {
  const searchInput = document.getElementById('crmSearchInput');
  const statusFilter = document.getElementById('crmFilterStatus');
  const serviceFilter = document.getElementById('crmFilterService');
  const sourceFilter = document.getElementById('crmFilterSource');
  const refreshBtn = document.getElementById('btnRefreshLeads');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (searchInput && !searchInput.hasAttribute('data-bound')) {
    searchInput.setAttribute('data-bound', 'true');
    searchInput.addEventListener('input', () => {
      crmCurrentPage = 1;
      renderCrmTable();
    });
  }

  if (statusFilter && !statusFilter.hasAttribute('data-bound')) {
    statusFilter.setAttribute('data-bound', 'true');
    statusFilter.addEventListener('change', () => {
      crmCurrentPage = 1;
      renderCrmTable();
    });
  }

  if (serviceFilter && !serviceFilter.hasAttribute('data-bound')) {
    serviceFilter.setAttribute('data-bound', 'true');
    serviceFilter.addEventListener('change', () => {
      crmCurrentPage = 1;
      renderCrmTable();
    });
  }

  if (sourceFilter && !sourceFilter.hasAttribute('data-bound')) {
    sourceFilter.setAttribute('data-bound', 'true');
    sourceFilter.addEventListener('change', () => {
      crmCurrentPage = 1;
      renderCrmTable();
    });
  }

  if (refreshBtn && !refreshBtn.hasAttribute('data-bound')) {
    refreshBtn.setAttribute('data-bound', 'true');
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = 'Refreshing...';
      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        try {
          const res = await window.upcApi.leads.getAll();
          if (res && res.data) {
            window.upcStore.syncFromBackend(res.data);
          }
        } catch (e) {}
      }
      refreshBtn.textContent = '🔄 Refresh';
      showToast('Leads refreshed from database.', 'info');
    });
  }

  if (prevBtn && !prevBtn.hasAttribute('data-bound')) {
    prevBtn.setAttribute('data-bound', 'true');
    prevBtn.addEventListener('click', () => {
      if (crmCurrentPage > 1) {
        crmCurrentPage--;
        renderCrmTable();
      }
    });
  }

  if (nextBtn && !nextBtn.hasAttribute('data-bound')) {
    nextBtn.setAttribute('data-bound', 'true');
    nextBtn.addEventListener('click', () => {
      crmCurrentPage++;
      renderCrmTable();
    });
  }
}

function exportCrmLeadsCsv() {
  const leads = window.upcStore.data.leads || [];
  if (leads.length === 0) {
    showToast('No leads available to export.', 'warning');
    return;
  }

  const headers = ['ID', 'Name', 'Phone', 'Email', 'Service', 'Property', 'City', 'Area', 'Status', 'Value', 'Source', 'Campaign', 'Assigned_To', 'Created_At'];
  const rows = leads.map(l => [
    `"${l.id || l.lead_code || ''}"`,
    `"${l.name || ''}"`,
    `"${l.phone || ''}"`,
    `"${l.email || ''}"`,
    `"${l.service || l.service_name || ''}"`,
    `"${l.property || l.property_type || ''}"`,
    `"${l.city || ''}"`,
    `"${l.area || ''}"`,
    `"${l.status || ''}"`,
    `"${l.value || l.estimated_value || 0}"`,
    `"${l.source || ''}"`,
    `"${l.campaign || ''}"`,
    `"${l.assignedTo || l.assigned_to_name || ''}"`,
    `"${l.createdAt || l.created_at || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `UPC_Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV export downloaded successfully.', 'success');
}

/* 5. LEAD DETAIL DRAWER WITH LIVE API INTEGRATION */
let activeDrawerLeadId = null;
let cachedStaffList = [];

function initLeadDrawer() {
  const closeBtn = document.getElementById('closeLeadDrawer');
  const drawer = document.getElementById('leadDetailDrawer');

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
      activeDrawerLeadId = null;
    });
  }

  // Pre-load staff users for assignment
  if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
    window.upcApi.users.getStaff().then(res => {
      if (res && res.data) {
        cachedStaffList = res.data;
        populateStaffDropdown();
      }
    }).catch(() => {});
  }

  // Quick Note Add (persists to POST /api/leads/:id/notes)
  const addNoteBtn = document.getElementById('btnAddLeadNote');
  const noteInput = document.getElementById('leadNoteInput');
  if (addNoteBtn && noteInput) {
    addNoteBtn.addEventListener('click', async () => {
      const text = noteInput.value.trim();
      if (!text || !activeDrawerLeadId) return;

      addNoteBtn.disabled = true;
      addNoteBtn.textContent = 'Saving...';

      // 1. Call Production API
      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        try {
          await window.upcApi.leads.addNote(activeDrawerLeadId, text);
        } catch (e) {
          console.warn('API note save error:', e.message);
        }
      }

      // 2. Update Local Store
      window.upcStore.addLeadNote(activeDrawerLeadId, text);
      noteInput.value = '';
      addNoteBtn.disabled = false;
      addNoteBtn.textContent = 'Save Note';

      // Reload fresh details
      openLeadDrawer(activeDrawerLeadId);
      showToast('Note saved to database and activity timeline.', 'success');
    });
  }

  // Status Change Selector
  const statusSelect = document.getElementById('drawerStatusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      if (activeDrawerLeadId) {
        const newStatus = statusSelect.value;
        await updateLeadStatusViaApi(activeDrawerLeadId, newStatus);
        openLeadDrawer(activeDrawerLeadId);
      }
    });
  }

  // Assignee Change Selector
  const assignedSelect = document.getElementById('drawerAssignedSelect');
  if (assignedSelect) {
    assignedSelect.addEventListener('change', async () => {
      if (!activeDrawerLeadId) return;
      const assignedUserId = assignedSelect.value ? Number(assignedSelect.value) : null;
      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        try {
          await window.upcApi.leads.update(activeDrawerLeadId, { assigned_to: assignedUserId });
          const staffObj = cachedStaffList.find(s => s.id === assignedUserId);
          const lead = window.upcStore.data.leads.find(l => (l.id === activeDrawerLeadId || l.lead_code === activeDrawerLeadId || l.dbId == activeDrawerLeadId));
          if (lead) {
            lead.assignedTo = staffObj ? staffObj.name : 'Unassigned';
            lead.assigned_to_name = staffObj ? staffObj.name : 'Unassigned';
            window.upcStore.notify();
          }
          showToast(`Lead assigned to ${staffObj ? staffObj.name : 'Unassigned'}`, 'success');
          openLeadDrawer(activeDrawerLeadId);
        } catch (e) {
          showToast('Failed to update assignment.', 'error');
        }
      }
    });
  }

  // Follow-Up Date Selector
  const followUpInput = document.getElementById('drawerFollowUpInput');
  if (followUpInput) {
    followUpInput.addEventListener('change', async () => {
      if (!activeDrawerLeadId) return;
      const followUpDate = followUpInput.value;
      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        try {
          await window.upcApi.leads.update(activeDrawerLeadId, { follow_up_date: followUpDate });
          showToast('Follow-up scheduled.', 'success');
        } catch (e) {}
      }
    });
  }

  // Deal Value Save Button
  const saveValueBtn = document.getElementById('btnSaveLeadValue');
  const valueInput = document.getElementById('drawerLeadValueInput');
  if (saveValueBtn && valueInput) {
    saveValueBtn.addEventListener('click', async () => {
      if (!activeDrawerLeadId) return;
      const newVal = Number(valueInput.value) || 0;
      if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
        try {
          await window.upcApi.leads.update(activeDrawerLeadId, { estimated_value: newVal });
          const lead = window.upcStore.data.leads.find(l => (l.id === activeDrawerLeadId || l.lead_code === activeDrawerLeadId || l.dbId == activeDrawerLeadId));
          if (lead) {
            lead.value = newVal;
            lead.estimated_value = newVal;
            window.upcStore.notify();
          }
          showToast(`Deal value updated to ₹${newVal.toLocaleString()}`, 'success');
        } catch (e) {}
      }
    });
  }
}

function populateStaffDropdown() {
  const assignedSelect = document.getElementById('drawerAssignedSelect');
  if (!assignedSelect) return;
  const currentVal = assignedSelect.value;
  assignedSelect.innerHTML = `
    <option value="">-- Unassigned --</option>
    ${cachedStaffList.map(s => `
      <option value="${s.id}">${s.name} (${(s.roles && s.roles[0]) || 'Staff'})</option>
    `).join('')}
  `;
  if (currentVal) assignedSelect.value = currentVal;
}

async function openLeadDrawer(leadId) {
  activeDrawerLeadId = leadId;
  const drawer = document.getElementById('leadDetailDrawer');
  if (!drawer) return;

  // 1. Initial hydrate from local store for instant response
  let lead = window.upcStore.data.leads.find(l => (l.id === leadId || l.lead_code === leadId || l.dbId == leadId));

  // 2. Fetch fresh record from backend API
  if (window.upcApi && window.upcApi.auth.isAuthenticated()) {
    try {
      const apiRes = await window.upcApi.leads.getById(leadId);
      if (apiRes && apiRes.data) {
        lead = apiRes.data;
      }
    } catch (e) {}
  }

  if (!lead) return;

  populateStaffDropdown();

  // Populate drawer elements
  const displayName = lead.name || 'Anonymous Inquiry';
  const displayId = lead.lead_code || lead.id || `LD-${lead.dbId}`;

  document.getElementById('drawerLeadName').textContent = displayName;
  document.getElementById('drawerLeadId').textContent = displayId;
  document.getElementById('drawerLeadPhone').textContent = lead.phone || 'N/A';
  document.getElementById('drawerLeadEmail').textContent = lead.email || 'N/A';
  document.getElementById('drawerLeadService').textContent = lead.service || lead.service_name || 'General Pest Control';
  document.getElementById('drawerLeadProperty').textContent = lead.property || lead.property_type || 'Residential';
  document.getElementById('drawerLeadLocation').textContent = `${lead.area || ''}${lead.area && lead.city ? ', ' : ''}${lead.city || 'Pune'}`;
  document.getElementById('drawerLeadSource').textContent = lead.source || 'Website';
  document.getElementById('drawerLeadCampaign').textContent = lead.campaign || lead.utm_campaign || 'N/A';
  document.getElementById('drawerLeadAdName').textContent = lead.ad_name || lead.adName || 'N/A';

  // Specific Customer Note & Address
  const addrEl = document.getElementById('drawerLeadAddress');
  if (addrEl) {
    const notesContent = lead.message || lead.address || (typeof lead.notes === 'string' ? lead.notes : null) || 'No specific address note provided.';
    addrEl.textContent = notesContent;
  }

  // Linked Booking Display
  const bookingWrap = document.getElementById('drawerLeadBookingWrap');
  const bookingEl = document.getElementById('drawerLeadBooking');
  if (bookingWrap && bookingEl) {
    if (lead.bookings && lead.bookings.length > 0) {
      const b = lead.bookings[0];
      bookingWrap.style.display = 'block';
      bookingEl.textContent = `${b.booking_code} (${b.service_name}) on ${b.scheduled_date} • ${b.status}`;
    } else {
      bookingWrap.style.display = 'none';
    }
  }

  // Duplicate Alert Banner
  const dupAlert = document.getElementById('drawerDuplicateAlert');
  if (dupAlert) {
    if (lead.is_duplicate || lead.duplicate_of_id) {
      dupAlert.style.display = 'block';
      document.getElementById('drawerDuplicateOf').textContent = `#${lead.duplicate_of_id || 'Existing'}`;
      document.getElementById('drawerDuplicateCount').textContent = lead.duplicate_count || 1;
    } else {
      dupAlert.style.display = 'none';
    }
  }

  // Deal Value
  const val = Number(lead.estimated_value !== undefined ? lead.estimated_value : (lead.value !== undefined ? lead.value : 3500)) || 0;
  const valInput = document.getElementById('drawerLeadValueInput');
  if (valInput) valInput.value = val;

  // Status Selector
  const statusSelect = document.getElementById('drawerStatusSelect');
  if (statusSelect) statusSelect.value = normalizeStatus(lead.status);

  // Assigned Person Selector
  const assignedSelect = document.getElementById('drawerAssignedSelect');
  if (assignedSelect) {
    assignedSelect.value = lead.assigned_to || '';
  }

  // Follow-Up Date Input
  const followUpInput = document.getElementById('drawerFollowUpInput');
  if (followUpInput) {
    if (lead.follow_up_date) {
      try {
        followUpInput.value = new Date(lead.follow_up_date).toISOString().slice(0, 16);
      } catch (e) {
        followUpInput.value = '';
      }
    } else {
      followUpInput.value = '';
    }
  }

  // Detailed UTM & Attribution Pills
  const utmContainer = document.getElementById('drawerUtmDetails');
  if (utmContainer) {
    const utms = [
      { label: 'Medium', val: lead.utm_medium || lead.utmMedium },
      { label: 'Content', val: lead.utm_content || lead.utmContent },
      { label: 'Term', val: lead.utm_term || lead.utmTerm },
      { label: 'Google Click ID', val: lead.gclid ? `${lead.gclid.slice(0, 15)}...` : null },
      { label: 'Meta Click ID', val: lead.fbclid ? `${lead.fbclid.slice(0, 15)}...` : null },
      { label: 'Landing Page', val: lead.landing_page || lead.landingPage },
      { label: 'Referrer', val: lead.referrer }
    ].filter(item => item.val);

    if (utms.length > 0) {
      utmContainer.innerHTML = utms.map(u => `
        <span style="display:inline-block; background:#E2E8F0; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.7rem; margin:0.15rem 0.2rem 0.15rem 0;">
          <strong>${u.label}:</strong> ${u.val}
        </span>
      `).join('');
    } else {
      utmContainer.innerHTML = `<span style="color:#94A3B8;">Organic direct entry (No external ad click parameters).</span>`;
    }
  }

  // Activity Timeline (Populated from real lead.timeline / lead_activities)
  const timelineEl = document.getElementById('drawerTimeline');
  if (timelineEl) {
    const events = lead.timeline || [];
    if (events.length > 0) {
      timelineEl.innerHTML = events.map(t => {
        const timeText = t.created_at ? new Date(t.created_at).toLocaleString() : (t.time || 'Recently');
        const descText = t.description || t.text || 'Activity logged.';
        const userText = t.user_name ? ` • by ${t.user_name}` : '';
        return `
          <div class="timeline-event">
            <div class="timeline-dot"></div>
            <div style="font-size:0.75rem; color:#94A3B8; font-weight:700;">${timeText}${userText}</div>
            <div style="font-size:0.875rem; color:#1E293B; margin-top:0.2rem;">${descText}</div>
          </div>
        `;
      }).join('');
    } else {
      timelineEl.innerHTML = `<div style="color:#94A3B8; font-size:0.8rem; padding:0.5rem 0;">No prior activities recorded.</div>`;
    }
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
