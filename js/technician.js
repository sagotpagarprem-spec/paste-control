/* ===================================================================
   UNIVERSAL PEST CONTROL — TECHNICIAN FIELD PORTAL CONTROLLER (PHASE 5)
   Job execution, status transitions, GPS navigation, and customer contact
   =================================================================== */

let activeTechId = null;
let currentTab = 'today';
let cachedJobsData = { today: [], upcoming: [], completed: [] };

document.addEventListener('DOMContentLoaded', async () => {
  // Set current date banner
  const todayLabel = document.getElementById('techTodayDateLabel');
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  await initTechnicianSession();
});

async function initTechnicianSession() {
  if (!window.upcApi || !window.upcApi.technicians) return;

  try {
    const res = await window.upcApi.technicians.getAll();
    const technicians = res.data || [];

    if (technicians.length === 0) {
      document.getElementById('techJobsList').innerHTML = `
        <div style="text-align:center; padding:3rem; color:#64748B;">
          No registered field technicians found. Please add technicians in the Admin Console.
        </div>
      `;
      return;
    }

    const select = document.getElementById('techActiveSelect');
    if (!select) return;

    select.innerHTML = technicians.map(t => `
      <option value="${t.id}">${escapeHtml(t.name)} (${escapeHtml(t.specialization || 'Tech')})</option>
    `).join('');

    // Restore saved technician from localStorage or use first
    const savedId = localStorage.getItem('upc_active_technician_id');
    const matching = technicians.find(t => String(t.id) === String(savedId));

    if (matching) {
      activeTechId = matching.id;
      select.value = matching.id;
    } else {
      activeTechId = technicians[0].id;
      select.value = technicians[0].id;
    }

    updateActiveTechUI(technicians.find(t => t.id === activeTechId));

    select.addEventListener('change', (e) => {
      activeTechId = Number(e.target.value);
      localStorage.setItem('upc_active_technician_id', activeTechId);
      const chosen = technicians.find(t => t.id === activeTechId);
      updateActiveTechUI(chosen);
      loadTechnicianJobs();
    });

    const availSelect = document.getElementById('techHeaderAvailSelect');
    if (availSelect) {
      availSelect.addEventListener('change', async (e) => {
        try {
          await window.upcApi.technicians.updateAvailability(activeTechId, e.target.value);
          showToast(`Availability set to ${e.target.value}`, 'success');
        } catch (err) {
          showToast('Failed to update availability', 'error');
        }
      });
    }

    await loadTechnicianJobs();
  } catch (err) {
    console.error('Failed to load technician roster:', err);
    showToast('Failed to connect to technician service: ' + err.message, 'error');
  }
}

function updateActiveTechUI(tech) {
  if (!tech) return;
  const avatar = document.getElementById('techHeaderAvatar');
  if (avatar) avatar.src = tech.profileImage || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=120&q=80';

  const availSelect = document.getElementById('techHeaderAvailSelect');
  if (availSelect) availSelect.value = tech.availability || 'AVAILABLE';
}

async function loadTechnicianJobs() {
  if (!activeTechId || !window.upcApi) return;

  const container = document.getElementById('techJobsList');
  if (!container) return;

  try {
    const res = await window.upcApi.technicians.getJobs(activeTechId);
    const data = res.data || { today: [], upcoming: [], completed: [] };
    cachedJobsData = data;

    // Update tab counters
    const countToday = document.getElementById('countToday');
    const countUpcoming = document.getElementById('countUpcoming');
    const countCompleted = document.getElementById('countCompleted');

    if (countToday) countToday.textContent = (data.today || []).length;
    if (countUpcoming) countUpcoming.textContent = (data.upcoming || []).length;
    if (countCompleted) countCompleted.textContent = (data.completed || []).length;

    renderCurrentTabJobs();
  } catch (err) {
    console.error('Failed to load jobs:', err);
    container.innerHTML = `
      <div style="background:#FFFFFF; border-radius:12px; padding:2rem; text-align:center; color:#DC2626;">
        Failed to fetch field schedule: ${err.message}
      </div>
    `;
  }
}

function switchTechTab(tabKey) {
  currentTab = tabKey;

  document.querySelectorAll('.tech-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (tabKey === 'today') document.getElementById('tabBtnToday')?.classList.add('active');
  if (tabKey === 'upcoming') document.getElementById('tabBtnUpcoming')?.classList.add('active');
  if (tabKey === 'completed') document.getElementById('tabBtnCompleted')?.classList.add('active');

  renderCurrentTabJobs();
}

function renderCurrentTabJobs() {
  const container = document.getElementById('techJobsList');
  if (!container) return;

  const jobs = cachedJobsData[currentTab] || [];

  if (jobs.length === 0) {
    let emptyText = "No jobs scheduled for today. Ready for dispatch!";
    if (currentTab === 'upcoming') emptyText = "No upcoming jobs queued yet.";
    if (currentTab === 'completed') emptyText = "No completed jobs in history.";

    container.innerHTML = `
      <div style="background:#FFFFFF; border-radius:14px; padding:3rem 1.5rem; text-align:center; color:#64748B; border:1px solid #E2E8F0;">
        <div style="font-size:2rem; margin-bottom:0.5rem;">🎉</div>
        <div style="font-size:1.05rem; font-weight:700; color:#0F172A; margin-bottom:0.25rem;">${emptyText}</div>
        <div style="font-size:0.825rem;">Stay on standby. New dispatch notifications arrive here.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = jobs.map(j => renderJobCardHtml(j)).join('');
}

function renderJobCardHtml(j) {
  const status = (j.status || 'ASSIGNED').toUpperCase();
  const addressQuery = encodeURIComponent(`${j.address || ''}, ${j.city || 'Pune'}`);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
  const telUrl = `tel:${j.phone}`;

  let workflowButtonHtml = '';

  if (status === 'ASSIGNED') {
    workflowButtonHtml = `
      <button class="job-action-btn btn-accept" onclick="executeJobAction(${j.id}, 'ACCEPTED')">
        ✅ Accept Job
      </button>
    `;
  } else if (status === 'ACCEPTED') {
    workflowButtonHtml = `
      <button class="job-action-btn btn-ontheway" onclick="executeJobAction(${j.id}, 'ON_THE_WAY')">
        🚗 On The Way
      </button>
    `;
  } else if (status === 'ON_THE_WAY') {
    workflowButtonHtml = `
      <button class="job-action-btn btn-arrive" onclick="executeJobAction(${j.id}, 'ARRIVED')">
        📍 Mark Arrived
      </button>
    `;
  } else if (status === 'ARRIVED') {
    workflowButtonHtml = `
      <button class="job-action-btn btn-start" onclick="executeJobAction(${j.id}, 'IN_PROGRESS')">
        🧪 Start Service
      </button>
    `;
  } else if (status === 'IN_PROGRESS') {
    workflowButtonHtml = `
      <button class="job-action-btn btn-complete" onclick="executeJobAction(${j.id}, 'COMPLETED')">
        🏁 Complete Service
      </button>
    `;
  } else if (status === 'COMPLETED') {
    workflowButtonHtml = `
      <div style="flex:1; text-align:center; padding:0.6rem; background:#DCFCE7; color:#166534; font-weight:700; border-radius:8px; font-size:0.85rem;">
        ✓ Service Completed & Certified
      </div>
    `;
  }

  return `
    <article class="tech-job-card">
      <!-- Top Row -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
        <span class="job-badge badge-${status}">${status}</span>
        <span style="font-size:0.8rem; font-weight:700; color:#475569;">#${escapeHtml(j.bookingCode)}</span>
      </div>

      <!-- Service Title & Slot -->
      <h3 style="font-size:1.15rem; margin:0 0 0.35rem 0; color:#0F172A; font-weight:800;">
        ${escapeHtml(j.serviceName || 'Pest Control')}
      </h3>
      <div style="font-size:0.82rem; color:#065F46; font-weight:700; margin-bottom:0.75rem; display:flex; gap:0.5rem; align-items:center;">
        <span>📅 ${j.scheduledDate || 'Today'}</span>
        <span>•</span>
        <span>⏰ ${escapeHtml(j.timeSlot || 'Anytime')}</span>
        <span>•</span>
        <span>₹${Number(j.amount || 0).toLocaleString()}</span>
      </div>

      <!-- Customer & Contact -->
      <div style="background:#F8FAFC; border-radius:10px; padding:0.85rem; margin-bottom:1rem; border:1px solid #E2E8F0;">
        <div style="font-weight:700; color:#0F172A; margin-bottom:0.25rem;">
          👤 ${escapeHtml(j.customerName)}
        </div>
        <div style="font-size:0.825rem; color:#475569; margin-bottom:0.5rem;">
          📍 ${escapeHtml(j.address || 'Address on file')}, ${escapeHtml(j.city || 'Pune')}
        </div>
        ${j.instructions ? `
          <div style="font-size:0.78rem; background:#FEF3C7; color:#92400E; padding:0.4rem 0.6rem; border-radius:6px; margin-top:0.35rem;">
            📝 <strong>Note:</strong> ${escapeHtml(j.instructions)}
          </div>
        ` : ''}
      </div>

      <!-- Action Buttons Row -->
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <a href="${telUrl}" class="job-action-btn btn-call" style="flex:1;">
          📞 Call
        </a>
        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="job-action-btn btn-navigate" style="flex:1;">
          🗺️ Navigate
        </a>
        ${workflowButtonHtml}
      </div>
    </article>
  `;
}

async function executeJobAction(bookingId, nextStatus) {
  if (!activeTechId || !window.upcApi) return;

  const notes = prompt(`Optional execution notes for status ${nextStatus}:`, '');
  if (notes === null) return; // user cancelled

  try {
    await window.upcApi.technicians.updateJobStatus(activeTechId, bookingId, nextStatus, notes);
    showToast(`Job status updated to ${nextStatus}`, 'success');
    await loadTechnicianJobs();
  } catch (err) {
    showToast(err.message || 'Failed to update job status', 'error');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#065F46' : (type === 'error' ? '#DC2626' : '#1E293B');
  toast.style.cssText = `
    background: ${bg};
    color: #FFFFFF;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    animation: fadeIn 0.2s ease-in;
  `;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.switchTechTab = switchTechTab;
window.executeJobAction = executeJobAction;
