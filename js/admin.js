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
  renderAdminBookings();
  renderAdminFollowups();
  renderAdminCustomers();
  initLeadDrawer();
  initAiCreativeStudio();
  initWhatsAppHub();
  initTechnicianDispatch();
  initNotificationDrawer();
  initCmsAdminListeners();

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

  // Trigger real backend hydrations on view change
  if (viewKey === 'bookings') renderAdminBookings();
  if (viewKey === 'followups') renderAdminFollowups();
  if (viewKey === 'customers') renderAdminCustomers();
  if (viewKey === 'leads' || viewKey === 'crm') { renderCrmKanban(); renderCrmTable(); }
  if (viewKey === 'cms-services') renderAdminCmsServices();
  if (viewKey === 'cms-offers') renderAdminCmsOffers();
  if (viewKey === 'cms-reviews') renderAdminCmsReviews();
  if (viewKey === 'cms-blog') renderAdminCmsBlogs();
  if (viewKey === 'cms-service-areas') renderAdminCmsAreas();
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

/* 9. SERVICE BOOKINGS MANAGEMENT */
const BOOKING_STATUSES = [
  'PENDING', 'CONFIRMED', 'ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
];

async function renderAdminBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('bookingSearchInput');
  const statusFilter = document.getElementById('bookingFilterStatus');
  const paginationInfo = document.getElementById('bookingPaginationInfo');

  const search = searchInput ? searchInput.value.trim() : '';
  const status = statusFilter ? statusFilter.value : '';

  try {
    let bookings = [];
    let staff = [];

    if (window.upcApi && window.upcApi.bookings) {
      const res = await window.upcApi.bookings.getAll({ search, status });
      bookings = res.data || [];
      if (paginationInfo) {
        const total = (res.meta && res.meta.total) !== undefined ? res.meta.total : bookings.length;
        paginationInfo.textContent = `Showing ${bookings.length} of ${total} bookings`;
      }
      try {
        const staffRes = await window.upcApi.users.getStaff();
        staff = staffRes.data || [];
      } catch (e) {}
    }

    if (bookings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:2.5rem; color:#64748B;">
            No service bookings found matching current filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = bookings.map(b => {
      const bCode = b.bookingCode || b.booking_code || `UPC-${b.id}`;
      const isArchived = b.isArchived || b.is_archived;

      return `
        <tr style="${isArchived ? 'opacity:0.6;' : ''}">
          <td><strong>${bCode}</strong></td>
          <td>
            <strong>${escapeHtml(b.customerName || b.name || 'Customer')}</strong><br>
            <span style="font-size:0.75rem; color:#64748B;">${escapeHtml(b.phone || '-')}</span>
          </td>
          <td>
            ${escapeHtml(b.serviceName || b.service || 'Pest Control')}<br>
            <span style="font-size:0.75rem; color:#64748B;">${escapeHtml(b.propertyType || 'Residential')}</span>
          </td>
          <td>${b.scheduledDate || b.date || '-'}</td>
          <td><span style="font-size:0.8rem; background:#F1F5F9; padding:0.2rem 0.5rem; border-radius:4px;">${escapeHtml(b.timeSlot || '-')}</span></td>
          <td>
            <select class="form-control" style="padding:0.25rem 0.5rem; font-size:0.8rem; width:135px;"
              onchange="assignBookingTechnician(${b.id}, this.value)">
              <option value="">Unassigned</option>
              ${staff.map(s => `
                <option value="${s.id}" ${(b.technicianId == s.id || b.technician_id == s.id) ? 'selected' : ''}>
                  ${escapeHtml(s.name)}
                </option>
              `).join('')}
            </select>
          </td>
          <td>
            <select class="form-control" style="padding:0.25rem 0.5rem; font-size:0.8rem; font-weight:700; width:130px;"
              onchange="updateBookingStatusLive(${b.id}, this.value)">
              ${BOOKING_STATUSES.map(st => `
                <option value="${st}" ${String(b.status).toUpperCase() === st ? 'selected' : ''}>${st}</option>
              `).join('')}
            </select>
          </td>
          <td><strong>₹${Number(b.amount || 0).toLocaleString()}</strong></td>
          <td>
            <div style="display:flex; gap:0.35rem;">
              <button class="btn btn-sm btn-white" title="Archive / Cancel Booking" onclick="cancelBookingLive(${b.id})">✕ Cancel</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load bookings:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#DC2626; padding:2rem;">Failed to load bookings: ${err.message}</td></tr>`;
  }
}

function getBookingStatusBadgeClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CONFIRMED') return 'badge-success';
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'ON_THE_WAY') return 'badge-primary';
  if (s === 'PENDING') return 'badge-warning';
  if (s === 'COMPLETED') return 'badge-success';
  if (s === 'CANCELLED') return 'badge-danger';
  return 'badge-neutral';
}

async function updateBookingStatusLive(bookingId, newStatus) {
  try {
    if (window.upcApi && window.upcApi.bookings) {
      await window.upcApi.bookings.updateStatus(bookingId, newStatus);
      showToast(`Booking status updated to ${newStatus}`, 'success');
      renderAdminBookings();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update booking status', 'error');
  }
}

async function assignBookingTechnician(bookingId, techId) {
  try {
    if (window.upcApi && window.upcApi.bookings) {
      await window.upcApi.bookings.update(bookingId, { technicianId: techId ? Number(techId) : null });
      showToast('Technician assigned successfully', 'success');
      renderAdminBookings();
    }
  } catch (err) {
    showToast(err.message || 'Failed to assign technician', 'error');
  }
}

async function cancelBookingLive(bookingId) {
  if (!confirm('Are you sure you want to cancel / archive this booking?')) return;
  try {
    if (window.upcApi && window.upcApi.bookings) {
      await window.upcApi.bookings.delete(bookingId);
      showToast('Booking cancelled and archived', 'info');
      renderAdminBookings();
    }
  } catch (err) {
    showToast(err.message || 'Failed to cancel booking', 'error');
  }
}

// Bind search and filters for bookings
document.addEventListener('DOMContentLoaded', () => {
  const bSearch = document.getElementById('bookingSearchInput');
  const bFilter = document.getElementById('bookingFilterStatus');
  const bRefresh = document.getElementById('btnRefreshBookings');

  let debounceTimer;
  if (bSearch) {
    bSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderAdminBookings(), 300);
    });
  }
  if (bFilter) bFilter.addEventListener('change', () => renderAdminBookings());
  if (bRefresh) bRefresh.addEventListener('click', () => {
    showToast('Refreshing bookings...', 'info');
    renderAdminBookings();
  });
});

/* 10. FOLLOW-UP SYSTEM */
async function renderAdminFollowups() {
  const colOverdue = document.getElementById('followupColOverdue');
  const colToday = document.getElementById('followupColToday');
  const colUpcoming = document.getElementById('followupColUpcoming');

  if (!colOverdue || !colToday || !colUpcoming) return;

  try {
    let followups = [];
    let summary = { overdue: 0, today: 0, upcoming: 0 };

    if (window.upcApi && window.upcApi.followups) {
      const res = await window.upcApi.followups.getAll();
      followups = res.data || [];
      if (res.meta && res.meta.summary) {
        summary = res.meta.summary;
      }
    }

    // Update Counter Badges
    const bOverdue = document.getElementById('fuCountOverdue');
    const bToday = document.getElementById('fuCountToday');
    const bUpcoming = document.getElementById('fuCountUpcoming');
    const sbBadge = document.getElementById('sidebarFollowupsBadge');
    const badgeColOverdue = document.getElementById('badgeColOverdue');
    const badgeColToday = document.getElementById('badgeColToday');
    const badgeColUpcoming = document.getElementById('badgeColUpcoming');

    if (bOverdue) bOverdue.textContent = `${summary.overdue} Overdue`;
    if (bToday) bToday.textContent = `${summary.today} Today`;
    if (bUpcoming) bUpcoming.textContent = `${summary.upcoming} Upcoming`;
    if (sbBadge) sbBadge.textContent = `Due: ${summary.today + summary.overdue}`;
    if (badgeColOverdue) badgeColOverdue.textContent = summary.overdue;
    if (badgeColToday) badgeColToday.textContent = summary.today;
    if (badgeColUpcoming) badgeColUpcoming.textContent = summary.upcoming;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueList = followups.filter(f => f.status === 'PENDING' && f.scheduledDate < todayStr);
    const todayList = followups.filter(f => f.status === 'PENDING' && f.scheduledDate === todayStr);
    const upcomingList = followups.filter(f => f.status === 'PENDING' && f.scheduledDate > todayStr);

    // Render Overdue Column
    colOverdue.innerHTML = overdueList.length > 0 ? overdueList.map(f => `
      <div style="background:#FEF2F2; border-radius:8px; padding:1rem; border:1px solid #FCA5A5; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:700; color:#0F172A; font-size:0.925rem;">${escapeHtml(f.customerName)}</div>
          <span class="badge badge-danger" style="font-size:0.65rem;">OVERDUE</span>
        </div>
        <div style="font-size:0.78rem; color:#64748B; margin-top:0.2rem;">${escapeHtml(f.service || 'Service Inquiry')} (${f.leadCode || 'Lead'})</div>
        <div style="font-size:0.75rem; color:#B91C1C; margin:0.4rem 0; font-weight:700;">Scheduled: ${f.scheduledDate} ${f.scheduledTime || ''} • ${escapeHtml(f.phone || '')}</div>
        ${f.notes ? `<div style="font-size:0.75rem; color:#475569; font-style:italic; margin-bottom:0.5rem;">"${escapeHtml(f.notes)}"</div>` : ''}
        <div style="display:flex; gap:0.4rem; margin-top:0.5rem;">
          <button class="btn btn-sm btn-white" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="markFollowupDone(${f.id})">Done ✓</button>
          <button class="btn btn-sm btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="openLeadDrawer(${f.leadId})">Open Lead</button>
        </div>
      </div>
    `).join('') : '<div style="color:#64748B; font-size:0.825rem; padding:0.5rem;">No overdue follow-ups. All clear! 🎉</div>';

    // Render Today Column
    colToday.innerHTML = todayList.length > 0 ? todayList.map(f => `
      <div style="background:#FFFBEB; border-radius:8px; padding:1rem; border:1px solid #FCD34D; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:700; color:#0F172A; font-size:0.925rem;">${escapeHtml(f.customerName)}</div>
          <span class="badge badge-warning" style="font-size:0.65rem;">TODAY</span>
        </div>
        <div style="font-size:0.78rem; color:#64748B; margin-top:0.2rem;">${escapeHtml(f.service || 'Service Inquiry')} • Assigned: ${escapeHtml(f.assignedToName || 'Sales')}</div>
        <div style="font-size:0.75rem; color:#B45309; margin:0.4rem 0; font-weight:700;">Time: ${f.scheduledTime || '11:00 AM'} • ${escapeHtml(f.phone || '')}</div>
        ${f.notes ? `<div style="font-size:0.75rem; color:#475569; font-style:italic; margin-bottom:0.5rem;">"${escapeHtml(f.notes)}"</div>` : ''}
        <div style="display:flex; gap:0.4rem; margin-top:0.5rem;">
          <button class="btn btn-sm btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="showToast('Calling customer...', 'info')">Call</button>
          <button class="btn btn-sm btn-white" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="markFollowupDone(${f.id})">Done ✓</button>
          <button class="btn btn-sm btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="openLeadDrawer(${f.leadId})">Lead</button>
        </div>
      </div>
    `).join('') : '<div style="color:#64748B; font-size:0.825rem; padding:0.5rem;">No pending follow-ups for today.</div>';

    // Render Upcoming Column
    colUpcoming.innerHTML = upcomingList.length > 0 ? upcomingList.map(f => `
      <div style="background:#F8FAFC; border-radius:8px; padding:1rem; border:1px solid #E2E8F0; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:700; color:#0F172A; font-size:0.925rem;">${escapeHtml(f.customerName)}</div>
          <span class="badge badge-primary" style="font-size:0.65rem;">UPCOMING</span>
        </div>
        <div style="font-size:0.78rem; color:#64748B; margin-top:0.2rem;">${escapeHtml(f.service || 'Service Inquiry')}</div>
        <div style="font-size:0.75rem; color:#64748B; margin:0.4rem 0;">Date: ${f.scheduledDate} ${f.scheduledTime || ''}</div>
        ${f.notes ? `<div style="font-size:0.75rem; color:#475569; font-style:italic; margin-bottom:0.5rem;">"${escapeHtml(f.notes)}"</div>` : ''}
        <div style="display:flex; gap:0.4rem; margin-top:0.5rem;">
          <button class="btn btn-sm btn-white" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="markFollowupDone(${f.id})">Done ✓</button>
          <button class="btn btn-sm btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="openLeadDrawer(${f.leadId})">Open Lead</button>
        </div>
      </div>
    `).join('') : '<div style="color:#64748B; font-size:0.825rem; padding:0.5rem;">No upcoming follow-ups scheduled.</div>';

  } catch (err) {
    console.error('Failed to load followups:', err);
  }
}

async function markFollowupDone(followupId) {
  try {
    if (window.upcApi && window.upcApi.followups) {
      await window.upcApi.followups.update(followupId, { status: 'COMPLETED' });
      showToast('Follow-up marked completed! ✓', 'success');
      renderAdminFollowups();
    }
  } catch (err) {
    showToast(err.message || 'Failed to complete follow-up', 'error');
  }
}

// Schedule Follow-up Modal Handling
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('btnOpenScheduleFollowup');
  const modal = document.getElementById('modalScheduleFollowup');
  const closeBtn = document.getElementById('btnCloseFollowupModal');
  const saveBtn = document.getElementById('btnSaveScheduleFollowup');
  const leadSelect = document.getElementById('fuModalLeadSelect');
  const staffSelect = document.getElementById('fuModalAssignSelect');
  const refreshFuBtn = document.getElementById('btnRefreshFollowups');

  if (refreshFuBtn) {
    refreshFuBtn.addEventListener('click', () => {
      showToast('Refreshing follow-ups pipeline...', 'info');
      renderAdminFollowups();
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', async () => {
      modal.style.display = 'flex';
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const dateInput = document.getElementById('fuModalDate');
      if (dateInput) dateInput.value = tomorrow;

      // Populate Leads
      if (leadSelect && window.upcApi) {
        leadSelect.innerHTML = '<option value="">Loading active leads...</option>';
        try {
          const res = await window.upcApi.leads.getAll({ limit: 50 });
          const leads = res.data || [];
          leadSelect.innerHTML = '<option value="">Choose Lead...</option>' + leads.map(l => `
            <option value="${l.id}">${escapeHtml(l.name)} (${escapeHtml(l.service)}) - #${l.leadCode || l.id}</option>
          `).join('');
        } catch (e) {
          leadSelect.innerHTML = '<option value="">Error loading leads</option>';
        }
      }

      // Populate Staff
      if (staffSelect && window.upcApi) {
        staffSelect.innerHTML = '<option value="">Unassigned</option>';
        try {
          const sRes = await window.upcApi.users.getStaff();
          const staff = sRes.data || [];
          staffSelect.innerHTML = '<option value="">Unassigned</option>' + staff.map(s => `
            <option value="${s.id}">${escapeHtml(s.name)} (${s.roles ? s.roles[0] : 'Staff'})</option>
          `).join('');
        } catch (e) {}
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const leadId = document.getElementById('fuModalLeadSelect')?.value;
      const date = document.getElementById('fuModalDate')?.value;
      const time = document.getElementById('fuModalTime')?.value;
      const assignedTo = document.getElementById('fuModalAssignSelect')?.value;
      const notes = document.getElementById('fuModalNotes')?.value;

      if (!leadId || !date) {
        showToast('Please select a lead and date', 'error');
        return;
      }

      saveBtn.disabled = true;
      try {
        await window.upcApi.followups.create({
          leadId: Number(leadId),
          date,
          time,
          assignedTo: assignedTo ? Number(assignedTo) : null,
          notes
        });
        showToast('Follow-up scheduled and reminder queued! ⏰', 'success');
        modal.style.display = 'none';
        renderAdminFollowups();
      } catch (err) {
        showToast(err.message || 'Failed to schedule follow-up', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
});

/* 11. CUSTOMER MANAGEMENT */
async function renderAdminCustomers() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('customerSearchInput');
  const paginationInfo = document.getElementById('customerPaginationInfo');
  const search = searchInput ? searchInput.value.trim() : '';

  try {
    let customers = [];
    if (window.upcApi && window.upcApi.customers) {
      const res = await window.upcApi.customers.getAll({ search });
      customers = res.data || [];
      if (paginationInfo) {
        const total = (res.meta && res.meta.total) !== undefined ? res.meta.total : customers.length;
        paginationInfo.textContent = `Showing ${customers.length} of ${total} customers`;
      }
    }

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2.5rem; color:#64748B;">
            No customer profiles found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>
          <strong>${escapeHtml(c.name)}</strong><br>
          <span style="font-size:0.75rem; color:#64748B;">${escapeHtml(c.phone)}</span>
        </td>
        <td>${escapeHtml(c.city || 'Pune')} ${c.area ? '• ' + escapeHtml(c.area) : ''}</td>
        <td><span class="badge badge-neutral">${escapeHtml(c.propertyType || 'Residential')}</span></td>
        <td><span class="badge badge-primary">${c.totalBookings || 0} Bookings</span></td>
        <td><strong style="color:#059669;">₹${Number(c.totalSpent || 0).toLocaleString()}</strong></td>
        <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openCustomerProfile(${c.id})">View Profile</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load customers:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC2626; padding:2rem;">Failed to load customers: ${err.message}</td></tr>`;
  }
}

// Bind search and refresh for customers
document.addEventListener('DOMContentLoaded', () => {
  const cSearch = document.getElementById('customerSearchInput');
  const cRefresh = document.getElementById('btnRefreshCustomers');

  let debounceTimer;
  if (cSearch) {
    cSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderAdminCustomers(), 300);
    });
  }
  if (cRefresh) {
    cRefresh.addEventListener('click', () => {
      showToast('Refreshing customer directory...', 'info');
      renderAdminCustomers();
    });
  }

  // Customer Drawer Close
  const closeCustDrawer = document.getElementById('btnCloseCustomerDrawer');
  const custDrawer = document.getElementById('customerProfileDrawer');
  if (closeCustDrawer && custDrawer) {
    closeCustDrawer.addEventListener('click', () => {
      custDrawer.classList.remove('open');
    });
  }
});

let currentActiveCustomerId = null;

async function openCustomerProfile(customerId) {
  const drawer = document.getElementById('customerProfileDrawer');
  if (!drawer) return;

  currentActiveCustomerId = customerId;
  drawer.classList.add('open');

  try {
    const res = await window.upcApi.customers.getById(customerId);
    const c = res.data;
    if (!c) return;

    // Populate Details
    document.getElementById('custDrawerName').textContent = c.name;
    document.getElementById('custDrawerPhone').textContent = c.phone;
    document.getElementById('custDrawerEmail').textContent = c.email || 'Not provided';
    document.getElementById('custDrawerCity').textContent = c.city || 'Pune';
    document.getElementById('custDrawerProperty').textContent = c.propertyType || 'Residential';
    document.getElementById('custDrawerSpent').textContent = `₹${Number(c.stats?.totalSpent || c.totalSpent || 0).toLocaleString()}`;
    document.getElementById('custDrawerAddress').textContent = c.address || 'Address not registered yet';

    // Services Badges
    const sWrap = document.getElementById('custDrawerServices');
    if (sWrap) {
      const services = c.services || [];
      sWrap.innerHTML = services.length > 0 ? services.map(s => `
        <span class="badge badge-primary" style="font-size:0.75rem;">${escapeHtml(s)}</span>
      `).join('') : '<span style="color:#64748B; font-size:0.8rem;">No service history</span>';
    }

    // Bookings History
    const bWrap = document.getElementById('custDrawerBookings');
    if (bWrap) {
      const bookings = c.bookings || [];
      bWrap.innerHTML = bookings.length > 0 ? bookings.map(b => `
        <div style="background:#fff; border:1px solid #E2E8F0; border-radius:6px; padding:0.6rem 0.8rem; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>${b.bookingCode || b.id} - ${escapeHtml(b.serviceName || b.service)}</span>
            <span class="badge ${getBookingStatusBadgeClass(b.status)}" style="font-size:0.65rem;">${b.status}</span>
          </div>
          <div style="color:#64748B; font-size:0.75rem; margin-top:0.25rem;">
            📅 ${b.scheduledDate || b.date} • ₹${Number(b.amount || 0).toLocaleString()} • Tech: ${escapeHtml(b.technicianName || 'Unassigned')}
          </div>
        </div>
      `).join('') : '<span style="color:#64748B; font-size:0.8rem;">Zero bookings recorded</span>';
    }

    // Lead History
    const lWrap = document.getElementById('custDrawerLeads');
    if (lWrap) {
      const leads = c.leadHistory || [];
      lWrap.innerHTML = leads.length > 0 ? leads.map(l => `
        <div style="background:#fff; border:1px solid #E2E8F0; border-radius:6px; padding:0.6rem 0.8rem; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>#${l.leadCode} - ${escapeHtml(l.service)}</span>
            <span class="badge badge-neutral" style="font-size:0.65rem;">${l.status}</span>
          </div>
          <div style="color:#64748B; font-size:0.75rem; margin-top:0.25rem;">
            Source: ${escapeHtml(l.source || 'Website')} • Est: ₹${Number(l.estimatedValue || 0).toLocaleString()}
          </div>
        </div>
      `).join('') : '<span style="color:#64748B; font-size:0.8rem;">No prior leads</span>';
    }

    // Notes
    const nWrap = document.getElementById('custDrawerNotes');
    if (nWrap) {
      const notes = c.notes || [];
      nWrap.innerHTML = notes.map(n => `
        <div style="background:#F8FAFC; border-left:3px solid #059669; padding:0.5rem 0.75rem; font-size:0.8rem; border-radius:4px;">
          <div>${escapeHtml(n.note)}</div>
          <div style="font-size:0.7rem; color:#64748B; margin-top:0.2rem;">By ${escapeHtml(n.authorName || 'Staff')} • ${new Date(n.createdAt).toLocaleDateString()}</div>
        </div>
      `).join('');
    }

    // Reviews
    const rWrap = document.getElementById('custDrawerReviews');
    if (rWrap) {
      const reviews = c.reviews || [];
      rWrap.innerHTML = reviews.length > 0 ? reviews.map(r => `
        <div style="background:#FFFBEB; border:1px solid #FCD34D; border-radius:6px; padding:0.6rem 0.8rem; font-size:0.8rem;">
          <div style="color:#B45309; font-weight:700;">⭐ ${r.rating} / 5.0 (${escapeHtml(r.source || 'Direct')})</div>
          <div style="color:#0F172A; margin-top:0.25rem;">"${escapeHtml(r.reviewText || 'Positive feedback')}"</div>
        </div>
      `).join('') : '<span style="color:#64748B; font-size:0.8rem;">No customer reviews submitted</span>';
    }

  } catch (err) {
    showToast(err.message || 'Failed to load customer profile', 'error');
  }
}

// Add note to customer
document.addEventListener('DOMContentLoaded', () => {
  const addNoteBtn = document.getElementById('btnAddCustNote');
  const noteInput = document.getElementById('custNoteInput');

  if (addNoteBtn && noteInput) {
    addNoteBtn.addEventListener('click', async () => {
      const note = noteInput.value.trim();
      if (!note || !currentActiveCustomerId) return;

      addNoteBtn.disabled = true;
      try {
        await window.upcApi.customers.addNote(currentActiveCustomerId, note);
        showToast('Customer account note saved! 📝', 'success');
        noteInput.value = '';
        openCustomerProfile(currentActiveCustomerId);
      } catch (err) {
        showToast(err.message || 'Failed to save note', 'error');
      } finally {
        addNoteBtn.disabled = false;
      }
    });
  }
});

/* 12. NOTIFICATION DRAWER & REAL-TIME BADGE */
function initNotificationDrawer() {
  const bellBtn = document.getElementById('btnAdminNotifBell');
  const drawer = document.getElementById('adminNotifDrawer');
  const closeBtn = document.getElementById('btnCloseNotifDrawer');
  const markAllBtn = document.getElementById('btnMarkAllNotifsRead');

  if (bellBtn && drawer) {
    bellBtn.addEventListener('click', async () => {
      drawer.classList.toggle('open');
      if (drawer.classList.contains('open')) {
        await refreshLiveNotifications();
      }
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      try {
        if (window.upcApi && window.upcApi.notifications) {
          await window.upcApi.notifications.markAllRead();
          showToast('All notifications marked as read ✓', 'success');
          await refreshLiveNotifications();
        }
      } catch (e) {}
    });
  }

  refreshLiveNotifications();
}

async function refreshLiveNotifications() {
  const badge = document.getElementById('adminNotifCount');
  const list = document.getElementById('adminNotifList');

  try {
    let notifs = [];
    let unreadCount = 0;

    if (window.upcApi && window.upcApi.notifications) {
      const res = await window.upcApi.notifications.getAll();
      notifs = res.data || [];
      unreadCount = (res.meta && res.meta.unreadCount) !== undefined ? res.meta.unreadCount : notifs.filter(n => n.unread || !n.isRead).length;
    }

    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    if (list) {
      if (notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#64748B; padding:2rem;">No notifications right now.</div>';
        return;
      }

      list.innerHTML = notifs.map(n => {
        const typeBadge = getNotificationTypeBadge(n.type);
        const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
        const isUnread = n.unread || !n.isRead;

        return `
          <div style="padding:0.85rem; border-bottom:1px solid #F1F5F9; background:${isUnread ? '#F0FDF4' : '#FFFFFF'}; border-left:3px solid ${isUnread ? '#059669' : '#CBD5E1'}; border-radius:6px; margin-bottom:0.5rem; transition:background 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span class="badge ${typeBadge.cssClass}" style="font-size:0.65rem;">${typeBadge.label}</span>
              <span style="font-size:0.75rem; color:#64748B;">${timeStr}</span>
            </div>
            <div style="font-weight:700; font-size:0.85rem; color:#0F172A;">${escapeHtml(n.title)}</div>
            <div style="font-size:0.8rem; color:#475569; margin-top:0.2rem;">${escapeHtml(n.message)}</div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

function getNotificationTypeBadge(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'NEW_LEAD') return { label: '⚡ NEW LEAD', cssClass: 'badge-primary' };
  if (t === 'FOLLOWUP_DUE') return { label: '⏰ FOLLOW-UP', cssClass: 'badge-warning' };
  if (t === 'BOOKING_CREATED') return { label: '📋 NEW BOOKING', cssClass: 'badge-primary' };
  if (t === 'BOOKING_CONFIRMED') return { label: '✅ CONFIRMED', cssClass: 'badge-success' };
  if (t === 'BOOKING_ASSIGNED') return { label: '👷 DISPATCHED', cssClass: 'badge-primary' };
  if (t === 'BOOKING_COMPLETED') return { label: '🎉 COMPLETED', cssClass: 'badge-success' };
  return { label: 'INFO', cssClass: 'badge-neutral' };
}

function updateNotificationBadge() {
  refreshLiveNotifications();
}

// Global expose
window.openLeadDrawer = openLeadDrawer;
window.openCustomerProfile = openCustomerProfile;
window.triggerWhatsAppChat = triggerWhatsAppChat;
window.quickAdvanceLead = quickAdvanceLead;
window.switchAdminSection = switchAdminSection;
window.updateBookingStatusLive = updateBookingStatusLive;
window.assignBookingTechnician = assignBookingTechnician;
window.cancelBookingLive = cancelBookingLive;
window.markFollowupDone = markFollowupDone;
window.renderAdminBookings = renderAdminBookings;
window.renderAdminFollowups = renderAdminFollowups;
window.renderAdminCustomers = renderAdminCustomers;

/* =====================================================================
   PHASE 4: MASTER CMS MANAGEMENT (SERVICES, OFFERS, REVIEWS, BLOG, AREAS)
   ===================================================================== */
let adminCmsCache = {
  services: [],
  offers: [],
  reviews: [],
  blogs: [],
  areas: [],
  activeReviewTab: 'ALL',
  activeBlogTab: 'ALL'
};

function initCmsAdminListeners() {
  // --- 1. Services Listeners ---
  const btnAddService = document.getElementById('btnOpenAddServiceModal');
  const btnCloseService = document.getElementById('btnCloseServiceModal');
  const btnSaveService = document.getElementById('btnSaveCmsService');
  const catFilter = document.getElementById('cmsServiceCategoryFilter');
  const statusFilter = document.getElementById('cmsServiceStatusFilter');
  const searchService = document.getElementById('cmsServiceSearchInput');

  if (btnAddService) btnAddService.addEventListener('click', () => openCmsServiceModal());
  if (btnCloseService) btnCloseService.addEventListener('click', () => closeCmsModal('modalCmsService'));
  if (btnSaveService) btnSaveService.addEventListener('click', saveCmsService);
  if (catFilter) catFilter.addEventListener('change', () => renderAdminCmsServices());
  if (statusFilter) statusFilter.addEventListener('change', () => renderAdminCmsServices());
  if (searchService) searchService.addEventListener('input', () => renderAdminCmsServices());

  // --- 2. Offers Listeners ---
  const btnAddOffer = document.getElementById('btnOpenAddOfferModal');
  const btnCloseOffer = document.getElementById('btnCloseOfferModal');
  const btnSaveOffer = document.getElementById('btnSaveCmsOffer');

  if (btnAddOffer) btnAddOffer.addEventListener('click', () => openCmsOfferModal());
  if (btnCloseOffer) btnCloseOffer.addEventListener('click', () => closeCmsModal('modalCmsOffer'));
  if (btnSaveOffer) btnSaveOffer.addEventListener('click', saveCmsOffer);

  // --- 3. Reviews Listeners ---
  const btnAddReview = document.getElementById('btnOpenAddReviewModal');
  const btnCloseReview = document.getElementById('btnCloseReviewModal');
  const btnSaveReview = document.getElementById('btnSaveCmsReview');
  const reviewTabs = document.querySelectorAll('[data-cms-review-tab]');

  if (btnAddReview) btnAddReview.addEventListener('click', () => openCmsReviewModal());
  if (btnCloseReview) btnCloseReview.addEventListener('click', () => closeCmsModal('modalCmsReview'));
  if (btnSaveReview) btnSaveReview.addEventListener('click', saveCmsReview);

  reviewTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      reviewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      adminCmsCache.activeReviewTab = tab.getAttribute('data-cms-review-tab');
      renderAdminCmsReviews();
    });
  });

  // --- 4. Blog Listeners ---
  const btnAddBlog = document.getElementById('btnOpenAddBlogModal');
  const btnCloseBlog = document.getElementById('btnCloseBlogModal');
  const btnSaveBlog = document.getElementById('btnSaveCmsBlog');
  const blogTabs = document.querySelectorAll('[data-cms-blog-tab]');

  if (btnAddBlog) btnAddBlog.addEventListener('click', () => openCmsBlogModal());
  if (btnCloseBlog) btnCloseBlog.addEventListener('click', () => closeCmsModal('modalCmsBlog'));
  if (btnSaveBlog) btnSaveBlog.addEventListener('click', saveCmsBlog);

  blogTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      blogTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      adminCmsCache.activeBlogTab = tab.getAttribute('data-cms-blog-tab');
      renderAdminCmsBlogs();
    });
  });

  // --- 5. Service Areas Listeners ---
  const btnAddArea = document.getElementById('btnOpenAddAreaModal');
  const btnCloseArea = document.getElementById('btnCloseAreaModal');
  const btnSaveArea = document.getElementById('btnSaveCmsArea');

  if (btnAddArea) btnAddArea.addEventListener('click', () => openCmsAreaModal());
  if (btnCloseArea) btnCloseArea.addEventListener('click', () => closeCmsModal('modalCmsArea'));
  if (btnSaveArea) btnSaveArea.addEventListener('click', saveCmsArea);
}

function closeCmsModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'none';
}

// ---------------------------------------------------------------------
// 1. SERVICES CMS
// ---------------------------------------------------------------------
async function renderAdminCmsServices() {
  const tbody = document.getElementById('adminCmsServicesTableBody');
  if (!tbody || !window.upcApi) return;

  try {
    const res = await window.upcApi.cms.getServices({ all: 'true' });
    if (!res || !res.data) return;

    adminCmsCache.services = res.data;
    let list = res.data;

    const cat = document.getElementById('cmsServiceCategoryFilter')?.value || 'All';
    const st = document.getElementById('cmsServiceStatusFilter')?.value || 'All';
    const q = (document.getElementById('cmsServiceSearchInput')?.value || '').toLowerCase().trim();

    if (cat !== 'All') list = list.filter(s => s.category === cat);
    if (st !== 'All') list = list.filter(s => s.status === st);
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#94A3B8;">No services match current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const statusBadge = s.status === 'ACTIVE'
        ? '<span class="badge badge-success">ACTIVE</span>'
        : s.status === 'ARCHIVED'
        ? '<span class="badge badge-neutral">ARCHIVED</span>'
        : '<span class="badge badge-warning">INACTIVE</span>';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <img src="${s.image || 'assets/images/hero.jpg'}" alt="${escapeHtml(s.name)}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
              <div>
                <strong style="color:#0F172A; display:block;">${escapeHtml(s.name)}</strong>
                <small style="color:#64748B;">${escapeHtml(s.shortDescription || '').substring(0, 45)}...</small>
              </div>
            </div>
          </td>
          <td><code style="font-size:0.8rem; color:#064E3B;">${escapeHtml(s.slug)}</code></td>
          <td><span class="badge badge-primary">${escapeHtml(s.category)}</span></td>
          <td><strong style="color:#064E3B;">₹${(s.price || 0).toLocaleString()}</strong></td>
          <td><span style="font-size:0.85rem; color:#475569;">${escapeHtml(s.duration || '2 Hours')}</span></td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            <button class="btn btn-white btn-sm" onclick="openCmsServiceModal(${s.id})">Edit ✏️</button>
            ${s.status !== 'ARCHIVED' ? `<button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FCA5A5; margin-left:0.35rem;" onclick="deleteCmsServiceLive(${s.id})">Archive</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render admin services:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC2626; padding:1.5rem;">Error loading services: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCmsServiceModal(serviceId = null) {
  const modal = document.getElementById('modalCmsService');
  if (!modal) return;

  const titleEl = document.getElementById('modalServiceTitle');
  const editIdEl = document.getElementById('serviceEditId');
  const nameEl = document.getElementById('serviceInputName');
  const slugEl = document.getElementById('serviceInputSlug');
  const catEl = document.getElementById('serviceInputCategory');
  const priceEl = document.getElementById('serviceInputPrice');
  const statusEl = document.getElementById('serviceInputStatus');
  const durationEl = document.getElementById('serviceInputDuration');
  const warrantyEl = document.getElementById('serviceInputWarranty');
  const imageEl = document.getElementById('serviceInputImage');
  const shortDescEl = document.getElementById('serviceInputShortDesc');
  const descEl = document.getElementById('serviceInputDesc');
  const benefitsEl = document.getElementById('serviceInputBenefits');
  const seoTitleEl = document.getElementById('serviceInputSeoTitle');
  const seoDescEl = document.getElementById('serviceInputSeoDesc');

  if (serviceId) {
    const s = adminCmsCache.services.find(item => item.id == serviceId);
    if (!s) return;

    if (titleEl) titleEl.textContent = `Edit Service: ${s.name}`;
    if (editIdEl) editIdEl.value = s.id;
    if (nameEl) nameEl.value = s.name || '';
    if (slugEl) slugEl.value = s.slug || '';
    if (catEl) catEl.value = s.category || 'Residential';
    if (priceEl) priceEl.value = s.price || 0;
    if (statusEl) statusEl.value = s.status || 'ACTIVE';
    if (durationEl) durationEl.value = s.duration || '';
    if (warrantyEl) warrantyEl.value = s.warrantyMonths || 12;
    if (imageEl) imageEl.value = s.image || '';
    if (shortDescEl) shortDescEl.value = s.shortDescription || '';
    if (descEl) descEl.value = s.description || '';
    if (benefitsEl) benefitsEl.value = Array.isArray(s.benefits) ? s.benefits.join('\n') : '';
    if (seoTitleEl) seoTitleEl.value = s.seoTitle || '';
    if (seoDescEl) seoDescEl.value = s.seoDescription || '';
  } else {
    if (titleEl) titleEl.textContent = 'Add New Service';
    if (editIdEl) editIdEl.value = '';
    if (nameEl) nameEl.value = '';
    if (slugEl) slugEl.value = '';
    if (catEl) catEl.value = 'Residential';
    if (priceEl) priceEl.value = '';
    if (statusEl) statusEl.value = 'ACTIVE';
    if (durationEl) durationEl.value = '2 Hours';
    if (warrantyEl) warrantyEl.value = '12';
    if (imageEl) imageEl.value = 'assets/images/hero.jpg';
    if (shortDescEl) shortDescEl.value = '';
    if (descEl) descEl.value = '';
    if (benefitsEl) benefitsEl.value = '';
    if (seoTitleEl) seoTitleEl.value = '';
    if (seoDescEl) seoDescEl.value = '';
  }

  modal.style.display = 'flex';
}

async function saveCmsService(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('serviceEditId')?.value;
  const name = document.getElementById('serviceInputName')?.value.trim();
  const slug = document.getElementById('serviceInputSlug')?.value.trim();
  const price = document.getElementById('serviceInputPrice')?.value;

  if (!name || !price) {
    showToast('Service name and price are required.', 'error');
    return;
  }

  const benefitsRaw = document.getElementById('serviceInputBenefits')?.value || '';
  const benefits = benefitsRaw.split('\n').map(b => b.trim()).filter(Boolean);

  const payload = {
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: document.getElementById('serviceInputCategory')?.value || 'General',
    price: parseFloat(price),
    status: document.getElementById('serviceInputStatus')?.value || 'ACTIVE',
    duration: document.getElementById('serviceInputDuration')?.value.trim() || '2 Hours',
    warrantyMonths: parseInt(document.getElementById('serviceInputWarranty')?.value || '12', 10),
    image: document.getElementById('serviceInputImage')?.value.trim() || 'assets/images/hero.jpg',
    shortDescription: document.getElementById('serviceInputShortDesc')?.value.trim(),
    description: document.getElementById('serviceInputDesc')?.value.trim(),
    benefits,
    seoTitle: document.getElementById('serviceInputSeoTitle')?.value.trim(),
    seoDescription: document.getElementById('serviceInputSeoDesc')?.value.trim()
  };

  try {
    if (id) {
      await window.upcApi.cms.updateService(id, payload);
      showToast('Service updated successfully!', 'success');
    } else {
      await window.upcApi.cms.createService(payload);
      showToast('New service added successfully!', 'success');
    }
    closeCmsModal('modalCmsService');
    renderAdminCmsServices();
  } catch (err) {
    showToast(err.message || 'Failed to save service.', 'error');
  }
}

async function deleteCmsServiceLive(id) {
  if (!confirm('Are you sure you want to archive this service from the public catalog?')) return;
  try {
    await window.upcApi.cms.deleteService(id);
    showToast('Service archived.', 'info');
    renderAdminCmsServices();
  } catch (err) {
    showToast(err.message || 'Failed to archive service.', 'error');
  }
}

// ---------------------------------------------------------------------
// 2. OFFERS CMS
// ---------------------------------------------------------------------
async function renderAdminCmsOffers() {
  const tbody = document.getElementById('adminCmsOffersTableBody');
  if (!tbody || !window.upcApi) return;

  try {
    const res = await window.upcApi.cms.getOffers({ all: 'true' });
    if (!res || !res.data) return;

    adminCmsCache.offers = res.data;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#94A3B8;">No promotional offers configured.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(o => {
      const statusBadge = o.status === 'ACTIVE'
        ? '<span class="badge badge-success">ACTIVE</span>'
        : o.status === 'EXPIRED'
        ? '<span class="badge badge-danger">EXPIRED</span>'
        : '<span class="badge badge-warning">INACTIVE</span>';

      const validStr = o.validUntil ? `Until ${o.validUntil}` : 'No expiry';

      return `
        <tr>
          <td>
            <strong style="color:#0F172A; display:block;">${escapeHtml(o.title)}</strong>
            <small style="color:#64748B;">${escapeHtml(o.description || '').substring(0, 50)}</small>
          </td>
          <td><span class="badge badge-neutral">${escapeHtml(o.service || 'All Services')}</span></td>
          <td><span class="badge badge-warning" style="font-weight:800;">${escapeHtml(o.discount)}</span></td>
          <td><code style="font-size:0.9rem; font-weight:800; color:#064E3B;">${escapeHtml(o.cta)}</code></td>
          <td><span style="font-size:0.85rem; color:#64748B;">${validStr}</span></td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            <button class="btn btn-white btn-sm" onclick="openCmsOfferModal(${o.id})">Edit ✏️</button>
            <button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FCA5A5; margin-left:0.35rem;" onclick="deleteCmsOfferLive(${o.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render admin offers:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC2626; padding:1.5rem;">Error loading offers: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCmsOfferModal(offerId = null) {
  const modal = document.getElementById('modalCmsOffer');
  if (!modal) return;

  const titleEl = document.getElementById('modalOfferTitle');
  const editIdEl = document.getElementById('offerEditId');
  const titleInput = document.getElementById('offerInputTitle');
  const discInput = document.getElementById('offerInputDiscount');
  const ctaInput = document.getElementById('offerInputCta');
  const srvInput = document.getElementById('offerInputService');
  const stInput = document.getElementById('offerInputStatus');
  const vfInput = document.getElementById('offerInputValidFrom');
  const vuInput = document.getElementById('offerInputValidUntil');
  const descInput = document.getElementById('offerInputDesc');
  const termsInput = document.getElementById('offerInputTerms');

  if (offerId) {
    const o = adminCmsCache.offers.find(item => item.id == offerId);
    if (!o) return;

    if (titleEl) titleEl.textContent = `Edit Offer: ${o.title}`;
    if (editIdEl) editIdEl.value = o.id;
    if (titleInput) titleInput.value = o.title || '';
    if (discInput) discInput.value = o.discount || '';
    if (ctaInput) ctaInput.value = o.cta || '';
    if (srvInput) srvInput.value = o.service || '';
    if (stInput) stInput.value = o.status || 'ACTIVE';
    if (vfInput) vfInput.value = o.validFrom || '';
    if (vuInput) vuInput.value = o.validUntil || '';
    if (descInput) descInput.value = o.description || '';
    if (termsInput) termsInput.value = o.terms || '';
  } else {
    if (titleEl) titleEl.textContent = 'Create New Offer';
    if (editIdEl) editIdEl.value = '';
    if (titleInput) titleInput.value = '';
    if (discInput) discInput.value = '20% OFF';
    if (ctaInput) ctaInput.value = 'UPC20';
    if (srvInput) srvInput.value = '';
    if (stInput) stInput.value = 'ACTIVE';
    if (vfInput) vfInput.value = '';
    if (vuInput) vuInput.value = '';
    if (descInput) descInput.value = '';
    if (termsInput) termsInput.value = 'Valid on residential bookings.';
  }

  modal.style.display = 'flex';
}

async function saveCmsOffer(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('offerEditId')?.value;
  const title = document.getElementById('offerInputTitle')?.value.trim();
  const discount = document.getElementById('offerInputDiscount')?.value.trim();
  const cta = document.getElementById('offerInputCta')?.value.trim();

  if (!title || !discount || !cta) {
    showToast('Title, discount, and coupon CTA code are required.', 'error');
    return;
  }

  const payload = {
    title,
    discount,
    cta,
    service: document.getElementById('offerInputService')?.value.trim() || null,
    status: document.getElementById('offerInputStatus')?.value || 'ACTIVE',
    validFrom: document.getElementById('offerInputValidFrom')?.value || null,
    validUntil: document.getElementById('offerInputValidUntil')?.value || null,
    description: document.getElementById('offerInputDesc')?.value.trim() || null,
    terms: document.getElementById('offerInputTerms')?.value.trim() || null,
    image: 'assets/images/hero.jpg'
  };

  try {
    if (id) {
      await window.upcApi.cms.updateOffer(id, payload);
      showToast('Offer updated successfully!', 'success');
    } else {
      await window.upcApi.cms.createOffer(payload);
      showToast('Offer created successfully!', 'success');
    }
    closeCmsModal('modalCmsOffer');
    renderAdminCmsOffers();
  } catch (err) {
    showToast(err.message || 'Failed to save offer.', 'error');
  }
}

async function deleteCmsOfferLive(id) {
  if (!confirm('Are you sure you want to delete this promotional offer?')) return;
  try {
    await window.upcApi.cms.deleteOffer(id);
    showToast('Offer removed.', 'info');
    renderAdminCmsOffers();
  } catch (err) {
    showToast(err.message || 'Failed to delete offer.', 'error');
  }
}

// ---------------------------------------------------------------------
// 3. REVIEWS CMS (MODERATION & TESTIMONIALS)
// ---------------------------------------------------------------------
async function renderAdminCmsReviews() {
  const tbody = document.getElementById('adminCmsReviewsTableBody');
  if (!tbody || !window.upcApi) return;

  try {
    const res = await window.upcApi.cms.getReviews({ all: 'true' });
    if (!res || !res.data) return;

    adminCmsCache.reviews = res.data;

    // Update pending moderation badge
    const pendingCount = res.data.filter(r => r.status === 'PENDING').length;
    const badge = document.getElementById('cmsReviewPendingBadge');
    if (badge) badge.textContent = pendingCount;
    const sidebarBadge = document.getElementById('sidebarReviewsBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = pendingCount > 0 ? `${pendingCount} Pending` : 'All Clear';
      sidebarBadge.className = pendingCount > 0 ? 'badge badge-warning' : 'badge badge-success';
    }

    let list = res.data;
    if (adminCmsCache.activeReviewTab !== 'ALL') {
      list = list.filter(r => r.status === adminCmsCache.activeReviewTab);
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#94A3B8;">No reviews in this queue.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(r.rating)));
      const statusBadge = r.status === 'APPROVED'
        ? '<span class="badge badge-success">APPROVED</span>'
        : r.status === 'REJECTED'
        ? '<span class="badge badge-danger">REJECTED</span>'
        : '<span class="badge badge-warning">PENDING APPROVAL</span>';

      const featuredTag = r.featured ? '<span class="badge badge-primary">Featured ⭐</span>' : '<span style="color:#94A3B8; font-size:0.75rem;">Normal</span>';

      return `
        <tr>
          <td><strong style="color:#0F172A;">${escapeHtml(r.customer)}</strong></td>
          <td><span style="color:#F59E0B; font-weight:700;">${stars}</span></td>
          <td style="max-width:320px;">
            <p style="margin:0; font-size:0.875rem; color:#334155; line-height:1.5;">"${escapeHtml(r.review)}"</p>
          </td>
          <td>
            <div style="font-size:0.85rem; font-weight:600; color:#0F172A;">${escapeHtml(r.service || 'General')}</div>
            <small style="color:#64748B;">${escapeHtml(r.location || 'Pune')}</small>
          </td>
          <td>${statusBadge}</td>
          <td>${featuredTag}</td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:0.35rem;">
              ${r.status !== 'APPROVED' ? `<button class="btn btn-primary btn-sm" style="background:#059669; padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="updateCmsReviewStatusLive(${r.id}, 'APPROVED')">Approve ✓</button>` : ''}
              ${r.status !== 'REJECTED' ? `<button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FCA5A5; padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="updateCmsReviewStatusLive(${r.id}, 'REJECTED')">Reject ✕</button>` : ''}
              <button class="btn btn-white btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="openCmsReviewModal(${r.id})">Edit</button>
              <button class="btn btn-white btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#94A3B8;" onclick="deleteCmsReviewLive(${r.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render admin reviews:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC2626; padding:1.5rem;">Error loading reviews: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCmsReviewModal(reviewId = null) {
  const modal = document.getElementById('modalCmsReview');
  if (!modal) return;

  const titleEl = document.getElementById('modalReviewTitle');
  const editIdEl = document.getElementById('reviewEditId');
  const custInput = document.getElementById('reviewInputCustomer');
  const ratingInput = document.getElementById('reviewInputRating');
  const srvInput = document.getElementById('reviewInputService');
  const locInput = document.getElementById('reviewInputLocation');
  const textInput = document.getElementById('reviewInputText');
  const stInput = document.getElementById('reviewInputStatus');
  const featInput = document.getElementById('reviewInputFeatured');

  if (reviewId) {
    const r = adminCmsCache.reviews.find(item => item.id == reviewId);
    if (!r) return;

    if (titleEl) titleEl.textContent = `Edit Review: ${r.customer}`;
    if (editIdEl) editIdEl.value = r.id;
    if (custInput) custInput.value = r.customer || '';
    if (ratingInput) ratingInput.value = (r.rating || 5.0).toFixed(1);
    if (srvInput) srvInput.value = r.service || '';
    if (locInput) locInput.value = r.location || '';
    if (textInput) textInput.value = r.review || '';
    if (stInput) stInput.value = r.status || 'APPROVED';
    if (featInput) featInput.checked = Boolean(r.featured);
  } else {
    if (titleEl) titleEl.textContent = 'Add Manual Review';
    if (editIdEl) editIdEl.value = '';
    if (custInput) custInput.value = '';
    if (ratingInput) ratingInput.value = '5.0';
    if (srvInput) srvInput.value = 'Termite Radar Inspection & Barrier';
    if (locInput) locInput.value = 'Kalyani Nagar, Pune';
    if (textInput) textInput.value = '';
    if (stInput) stInput.value = 'APPROVED';
    if (featInput) featInput.checked = true;
  }

  modal.style.display = 'flex';
}

async function saveCmsReview(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('reviewEditId')?.value;
  const customer = document.getElementById('reviewInputCustomer')?.value.trim();
  const review = document.getElementById('reviewInputText')?.value.trim();

  if (!customer || !review) {
    showToast('Customer name and review content are required.', 'error');
    return;
  }

  const payload = {
    customer,
    review,
    rating: parseFloat(document.getElementById('reviewInputRating')?.value || '5'),
    service: document.getElementById('reviewInputService')?.value.trim() || 'General',
    location: document.getElementById('reviewInputLocation')?.value.trim() || 'Pune',
    status: document.getElementById('reviewInputStatus')?.value || 'APPROVED',
    featured: Boolean(document.getElementById('reviewInputFeatured')?.checked)
  };

  try {
    if (id) {
      await window.upcApi.cms.updateReview(id, payload);
      showToast('Review updated.', 'success');
    } else {
      await window.upcApi.cms.createReview(payload);
      showToast('Review added to catalog.', 'success');
    }
    closeCmsModal('modalCmsReview');
    renderAdminCmsReviews();
  } catch (err) {
    showToast(err.message || 'Failed to save review.', 'error');
  }
}

async function updateCmsReviewStatusLive(id, status) {
  try {
    await window.upcApi.cms.updateReviewStatus(id, status);
    showToast(`Review marked as ${status}.`, 'success');
    renderAdminCmsReviews();
  } catch (err) {
    showToast(err.message || 'Failed to update review status.', 'error');
  }
}

async function deleteCmsReviewLive(id) {
  if (!confirm('Are you sure you want to permanently delete this review?')) return;
  try {
    await window.upcApi.cms.deleteReview(id);
    showToast('Review deleted.', 'info');
    renderAdminCmsReviews();
  } catch (err) {
    showToast(err.message || 'Failed to delete review.', 'error');
  }
}

// ---------------------------------------------------------------------
// 4. BLOG CMS
// ---------------------------------------------------------------------
async function renderAdminCmsBlogs() {
  const tbody = document.getElementById('adminCmsBlogsTableBody');
  if (!tbody || !window.upcApi) return;

  try {
    const res = await window.upcApi.cms.getBlogPosts({ all: 'true' });
    if (!res || !res.data) return;

    adminCmsCache.blogs = res.data;

    let list = res.data;
    if (adminCmsCache.activeBlogTab !== 'ALL') {
      list = list.filter(b => b.status === adminCmsCache.activeBlogTab);
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#94A3B8;">No blog articles found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(b => {
      const statusBadge = b.status === 'PUBLISHED'
        ? '<span class="badge badge-success">PUBLISHED (PUBLIC)</span>'
        : b.status === 'DRAFT'
        ? '<span class="badge badge-warning">DRAFT</span>'
        : '<span class="badge badge-neutral">ARCHIVED</span>';

      const pubDate = b.publishedAt ? new Date(b.publishedAt).toLocaleDateString() : 'Unpublished';

      return `
        <tr>
          <td>
            <strong style="color:#0F172A; display:block;">${escapeHtml(b.title)}</strong>
            <small style="color:#64748B;">${escapeHtml(b.excerpt || '').substring(0, 50)}...</small>
          </td>
          <td><code style="font-size:0.8rem; color:#064E3B;">${escapeHtml(b.slug)}</code></td>
          <td><span class="badge badge-primary">${escapeHtml(b.category)}</span></td>
          <td><span style="font-size:0.85rem; color:#334155;">${escapeHtml(b.author)}</span></td>
          <td><span style="font-size:0.85rem; color:#64748B;">${pubDate}</span></td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            <button class="btn btn-white btn-sm" onclick="openCmsBlogModal(${b.id})">Edit ✏️</button>
            <button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FCA5A5; margin-left:0.35rem;" onclick="deleteCmsBlogLive(${b.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render admin blogs:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC2626; padding:1.5rem;">Error loading blogs: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCmsBlogModal(blogId = null) {
  const modal = document.getElementById('modalCmsBlog');
  if (!modal) return;

  const titleEl = document.getElementById('modalBlogTitle');
  const editIdEl = document.getElementById('blogEditId');
  const titleInput = document.getElementById('blogInputTitle');
  const slugInput = document.getElementById('blogInputSlug');
  const catInput = document.getElementById('blogInputCategory');
  const stInput = document.getElementById('blogInputStatus');
  const authorInput = document.getElementById('blogInputAuthor');
  const imgInput = document.getElementById('blogInputImage');
  const excInput = document.getElementById('blogInputExcerpt');
  const contentInput = document.getElementById('blogInputContent');
  const seoTitleInput = document.getElementById('blogInputSeoTitle');
  const seoDescInput = document.getElementById('blogInputSeoDesc');

  if (blogId) {
    const b = adminCmsCache.blogs.find(item => item.id == blogId);
    if (!b) return;

    if (titleEl) titleEl.textContent = `Edit Article: ${b.title}`;
    if (editIdEl) editIdEl.value = b.id;
    if (titleInput) titleInput.value = b.title || '';
    if (slugInput) slugInput.value = b.slug || '';
    if (catInput) catInput.value = b.category || 'Termite Science';
    if (stInput) stInput.value = b.status || 'PUBLISHED';
    if (authorInput) authorInput.value = b.author || '';
    if (imgInput) imgInput.value = b.featuredImage || '';
    if (excInput) excInput.value = b.excerpt || '';
    if (contentInput) contentInput.value = b.content || '';
    if (seoTitleInput) seoTitleInput.value = b.seoTitle || '';
    if (seoDescInput) seoDescInput.value = b.seoDescription || '';
  } else {
    if (titleEl) titleEl.textContent = 'New Blog Article';
    if (editIdEl) editIdEl.value = '';
    if (titleInput) titleInput.value = '';
    if (slugInput) slugInput.value = '';
    if (catInput) catInput.value = 'General Pest Prevention';
    if (stInput) stInput.value = 'PUBLISHED';
    if (authorInput) authorInput.value = 'Universal Pest Specialist';
    if (imgInput) imgInput.value = 'assets/images/hero.jpg';
    if (excInput) excInput.value = '';
    if (contentInput) contentInput.value = '';
    if (seoTitleInput) seoTitleInput.value = '';
    if (seoDescInput) seoDescInput.value = '';
  }

  modal.style.display = 'flex';
}

async function saveCmsBlog(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('blogEditId')?.value;
  const title = document.getElementById('blogInputTitle')?.value.trim();
  const content = document.getElementById('blogInputContent')?.value.trim();

  if (!title || !content) {
    showToast('Article title and content are required.', 'error');
    return;
  }

  const payload = {
    title,
    slug: document.getElementById('blogInputSlug')?.value.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: document.getElementById('blogInputCategory')?.value.trim() || 'General',
    status: document.getElementById('blogInputStatus')?.value || 'PUBLISHED',
    author: document.getElementById('blogInputAuthor')?.value.trim() || 'Universal Pest Specialist',
    featuredImage: document.getElementById('blogInputImage')?.value.trim() || 'assets/images/hero.jpg',
    excerpt: document.getElementById('blogInputExcerpt')?.value.trim() || null,
    content,
    seoTitle: document.getElementById('blogInputSeoTitle')?.value.trim() || null,
    seoDescription: document.getElementById('blogInputSeoDesc')?.value.trim() || null
  };

  try {
    if (id) {
      await window.upcApi.cms.updateBlogPost(id, payload);
      showToast('Article updated.', 'success');
    } else {
      await window.upcApi.cms.createBlogPost(payload);
      showToast('Article published.', 'success');
    }
    closeCmsModal('modalCmsBlog');
    renderAdminCmsBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to save blog post.', 'error');
  }
}

async function deleteCmsBlogLive(id) {
  if (!confirm('Are you sure you want to delete this article?')) return;
  try {
    await window.upcApi.cms.deleteBlogPost(id);
    showToast('Article deleted.', 'info');
    renderAdminCmsBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to delete article.', 'error');
  }
}

// ---------------------------------------------------------------------
// 5. SERVICE AREAS CMS
// ---------------------------------------------------------------------
async function renderAdminCmsAreas() {
  const tbody = document.getElementById('adminCmsAreasTableBody');
  if (!tbody || !window.upcApi) return;

  try {
    const res = await window.upcApi.cms.getServiceAreas({ all: 'true' });
    if (!res || !res.data) return;

    adminCmsCache.areas = res.data;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:#94A3B8;">No service areas configured.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(a => {
      const statusBadge = a.status === 'ACTIVE'
        ? '<span class="badge badge-success">ACTIVE</span>'
        : a.status === 'COMING_SOON'
        ? '<span class="badge badge-warning">COMING SOON</span>'
        : '<span class="badge badge-neutral">INACTIVE</span>';

      return `
        <tr>
          <td><strong style="color:#064E3B;">${escapeHtml(a.city)}</strong></td>
          <td><strong style="color:#0F172A;">${escapeHtml(a.area)}</strong></td>
          <td><span style="font-size:0.85rem; color:#475569;">${escapeHtml(a.serviceAvailability || 'All Services')}</span></td>
          <td>${statusBadge}</td>
          <td><small style="color:#64748B;">${escapeHtml(a.seoTitle || '—')}</small></td>
          <td style="text-align:right;">
            <button class="btn btn-white btn-sm" onclick="openCmsAreaModal(${a.id})">Edit ✏️</button>
            <button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FCA5A5; margin-left:0.35rem;" onclick="deleteCmsAreaLive(${a.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render admin service areas:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#DC2626; padding:1.5rem;">Error loading areas: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCmsAreaModal(areaId = null) {
  const modal = document.getElementById('modalCmsArea');
  if (!modal) return;

  const titleEl = document.getElementById('modalAreaTitle');
  const editIdEl = document.getElementById('areaEditId');
  const cityInput = document.getElementById('areaInputCity');
  const nameInput = document.getElementById('areaInputName');
  const stInput = document.getElementById('areaInputStatus');
  const availInput = document.getElementById('areaInputAvailability');
  const seoTitleInput = document.getElementById('areaInputSeoTitle');
  const seoDescInput = document.getElementById('areaInputSeoDesc');

  if (areaId) {
    const a = adminCmsCache.areas.find(item => item.id == areaId);
    if (!a) return;

    if (titleEl) titleEl.textContent = `Edit Area: ${a.area}`;
    if (editIdEl) editIdEl.value = a.id;
    if (cityInput) cityInput.value = a.city || 'Pune';
    if (nameInput) nameInput.value = a.area || '';
    if (stInput) stInput.value = a.status || 'ACTIVE';
    if (availInput) availInput.value = a.serviceAvailability || '';
    if (seoTitleInput) seoTitleInput.value = a.seoTitle || '';
    if (seoDescInput) seoDescInput.value = a.seoDescription || '';
  } else {
    if (titleEl) titleEl.textContent = 'Add Coverage Area';
    if (editIdEl) editIdEl.value = '';
    if (cityInput) cityInput.value = 'Pune';
    if (nameInput) nameInput.value = '';
    if (stInput) stInput.value = 'ACTIVE';
    if (availInput) availInput.value = 'All Services';
    if (seoTitleInput) seoTitleInput.value = '';
    if (seoDescInput) seoDescInput.value = '';
  }

  modal.style.display = 'flex';
}

async function saveCmsArea(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('areaEditId')?.value;
  const area = document.getElementById('areaInputName')?.value.trim();

  if (!area) {
    showToast('Area / Locality name is required.', 'error');
    return;
  }

  const payload = {
    city: document.getElementById('areaInputCity')?.value.trim() || 'Pune',
    area,
    status: document.getElementById('areaInputStatus')?.value || 'ACTIVE',
    serviceAvailability: document.getElementById('areaInputAvailability')?.value.trim() || 'All Services',
    seoTitle: document.getElementById('areaInputSeoTitle')?.value.trim() || null,
    seoDescription: document.getElementById('areaInputSeoDesc')?.value.trim() || null
  };

  try {
    if (id) {
      await window.upcApi.cms.updateServiceArea(id, payload);
      showToast('Coverage area updated.', 'success');
    } else {
      await window.upcApi.cms.createServiceArea(payload);
      showToast('Coverage area added.', 'success');
    }
    closeCmsModal('modalCmsArea');
    renderAdminCmsAreas();
  } catch (err) {
    showToast(err.message || 'Failed to save area.', 'error');
  }
}

async function deleteCmsAreaLive(id) {
  if (!confirm('Are you sure you want to delete this coverage area?')) return;
  try {
    await window.upcApi.cms.deleteServiceArea(id);
    showToast('Coverage area deleted.', 'info');
    renderAdminCmsAreas();
  } catch (err) {
    showToast(err.message || 'Failed to delete area.', 'error');
  }
}

// Global CMS Window Exports
window.openCmsServiceModal = openCmsServiceModal;
window.deleteCmsServiceLive = deleteCmsServiceLive;
window.openCmsOfferModal = openCmsOfferModal;
window.deleteCmsOfferLive = deleteCmsOfferLive;
window.openCmsReviewModal = openCmsReviewModal;
window.updateCmsReviewStatusLive = updateCmsReviewStatusLive;
window.deleteCmsReviewLive = deleteCmsReviewLive;
window.openCmsBlogModal = openCmsBlogModal;
window.deleteCmsBlogLive = deleteCmsBlogLive;
window.openCmsAreaModal = openCmsAreaModal;
window.deleteCmsAreaLive = deleteCmsAreaLive;
window.renderAdminCmsServices = renderAdminCmsServices;
window.renderAdminCmsOffers = renderAdminCmsOffers;
window.renderAdminCmsReviews = renderAdminCmsReviews;
window.renderAdminCmsBlogs = renderAdminCmsBlogs;
window.renderAdminCmsAreas = renderAdminCmsAreas;

