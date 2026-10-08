import { Router, type Request, type Response } from "express";

export const dashboardRouter = Router();

function renderDashboardLayout(title: string, activeTab: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Silverstone Developers CRM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #090d16;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --bg-card-hover: #24344d;
      --border-subtle: #334155;
      --border-focus: #6366f1;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #ef4444;
      --blue: #3b82f6;
      --radius: 10px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation */
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
      font-weight: 700;
      font-size: 16px;
    }
    .brand-badge {
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    nav {
      display: flex;
      gap: 8px;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    nav a:hover {
      color: var(--text-main);
      background: var(--bg-card);
    }
    nav a.active {
      color: #fff;
      background: var(--primary);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: var(--bg-card-hover);
      border-color: #475569;
    }
    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }

    /* Layout Containers */
    main {
      flex: 1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }

    /* Badges & Chips */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-needs-reply { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-closed { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-failed { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-unread { background: #ef4444; color: #fff; border-radius: 10px; padding: 2px 6px; font-size: 10px; font-weight: 700; }

    /* Tables */
    .table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: var(--bg-card);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.5);
      color: var(--text-main);
    }
    tr:hover td {
      background: var(--bg-card);
    }
    tr.clickable {
      cursor: pointer;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
      justify-content: space-between;
    }
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    input[type="text"], select {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }
    input[type="text"]:focus, select:focus {
      border-color: var(--border-focus);
    }
    input[type="text"] { width: 280px; }

    /* Cards */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      padding: 20px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    /* Modal / Drawer */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .modal-backdrop.active {
      display: flex;
    }
    .modal-content {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      width: 90%;
      max-width: 600px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 24px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 12px;
    }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 20px;
      cursor: pointer;
    }
    .modal-close:hover { color: #fff; }

    /* Code & Timestamps */
    .code-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #93c5fd;
    }

    /* Date Chips & Quick Filters */
    .date-chip {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-muted);
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .date-chip:hover {
      border-color: #6366f1;
      color: #fff;
      background: var(--bg-card);
    }
    .date-chip.active {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      border-color: #6366f1;
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
    }

    .filter-tab {
      padding: 7px 15px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-muted);
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .filter-tab:hover {
      border-color: #475569;
      color: #fff;
      background: var(--bg-card);
    }
    .filter-tab.active {
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      border-color: #6366f1;
    }

    /* Stepper & Journey Flow Styles */
    .journey-stepper {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
    }
    .journey-step {
      display: flex;
      gap: 14px;
      position: relative;
      padding-bottom: 18px;
    }
    .journey-step:last-child {
      padding-bottom: 0;
    }
    .journey-step-line {
      position: absolute;
      left: 15px;
      top: 32px;
      bottom: 0;
      width: 2px;
      background: #334155;
    }
    .journey-step.completed .journey-step-line {
      background: #10b981;
    }
    .journey-step-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      z-index: 2;
      flex-shrink: 0;
    }
    .journey-step.completed .journey-step-icon {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10b981;
      color: #10b981;
    }
    .journey-step.active .journey-step-icon {
      background: rgba(99, 102, 241, 0.25);
      border: 2px solid #6366f1;
      color: #818cf8;
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
    }
    .journey-step.pending .journey-step-icon {
      background: var(--bg-card);
      border: 2px solid #334155;
      color: var(--text-dim);
    }
    .journey-step-content {
      flex: 1;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 14px;
      transition: all 0.15s ease;
    }
    .journey-step.completed .journey-step-content {
      border-left: 3px solid #10b981;
    }
    .journey-step.active .journey-step-content {
      border-left: 3px solid #6366f1;
      background: rgba(99, 102, 241, 0.08);
    }
  </style>
</head>
<body>
  <header>
    <a href="/contacts" class="brand">
      <span>Silverstone CRM</span>
      <span class="brand-badge">Milestone 2</span>
    </a>
    <nav>
      <a href="/contacts" class="${activeTab === "contacts" ? "active" : ""}">Contacts 360</a>
      <a href="/conversations" class="${activeTab === "conversations" ? "active" : ""}">Conversations</a>
      <a href="/duplicates" class="${activeTab === "duplicates" ? "active" : ""}">Duplicate Review</a>
    </nav>
    <div class="nav-actions">
      <span style="color: var(--emerald); font-size: 12px; font-weight: 600;">● Online</span>
      <a href="/api/contacts/export?format=csv" class="btn" title="Export Contacts to CSV">Export CSV</a>
    </div>
  </header>
  <main>
    ${contentHtml}
  </main>
</body>
</html>`;
}

/**
 * Redirect root and /dashboard to /contacts
 */
dashboardRouter.get("/", (_req: Request, res: Response) => {
  res.redirect("/contacts");
});

dashboardRouter.get("/dashboard", (_req: Request, res: Response) => {
  res.redirect("/contacts");
});

/**
 * GET /contacts
 * Contacts Table page with multi-field search, filters, and sorting.
 */
dashboardRouter.get("/contacts", (_req: Request, res: Response) => {
  const content = `
    <!-- Top Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">Contact 360 Database</h1>
        <p style="color: var(--text-muted);">Unified view of all WhatsApp prospects, automation flow steps, and customer replies.</p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span id="contactCountBadge" class="badge badge-active">Loading leads...</span>
        <button class="btn" onclick="fetchContacts()" title="Refresh List">🔄 Refresh</button>
      </div>
    </div>

    <!-- Single Day Date Filter Bar -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">📅 Date Filter (Single Day View):</span>
          <input type="date" id="dateFilterInput" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; background: var(--bg-card); color: #fff; border: 1px solid var(--border-subtle);" onchange="onCustomDateSelect(this.value)" />
          <button class="btn" style="padding: 5px 12px; font-size: 11px;" onclick="clearDateFilter()">Show All Dates</button>
        </div>
        <div id="activeDateBanner" style="font-size: 12px; font-weight: 600; color: #818cf8; display: none; background: rgba(99, 102, 241, 0.12); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.3);">
          ● Showing ONLY data for: <strong id="activeDateLabel" style="color: #fff;"></strong>
          <a href="javascript:void(0)" onclick="clearDateFilter()" style="color: #f87171; margin-left: 8px; text-decoration: none;">[✕ Clear]</a>
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <span style="font-size: 11px; color: var(--text-dim);">Quick Batch Dates:</span>
        <button class="date-chip active" id="chip-all" onclick="selectDateChip('')">All Dates (1,000)</button>
        <button class="date-chip" id="chip-2026-10-08" onclick="selectDateChip('2026-10-08')">08 Oct 2026 (Batch 5 - 200)</button>
        <button class="date-chip" id="chip-2026-10-06" onclick="selectDateChip('2026-10-06')">06 Oct 2026 (Batch 4 - 200)</button>
        <button class="date-chip" id="chip-2026-10-05" onclick="selectDateChip('2026-10-05')">05 Oct 2026 (Batch 3 - 200)</button>
        <button class="date-chip" id="chip-2026-10-04" onclick="selectDateChip('2026-10-04')">04 Oct 2026 (Batch 2 - 200)</button>
        <button class="date-chip" id="chip-2026-10-03" onclick="selectDateChip('2026-10-03')">03 Oct 2026 (Batch 1 - 200)</button>
      </div>
    </div>

    <!-- Quick Filter Tabs (Replied to Automation, Needs Reply, etc.) -->
    <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
      <button class="filter-tab active" id="tab-all" onclick="setEngagementTab('')">📋 All Prospects</button>
      <button class="filter-tab" id="tab-replied" onclick="setEngagementTab('replied')">💬 Replied to Automation</button>
      <button class="filter-tab" id="tab-unread" onclick="setEngagementTab('unread')">🟡 Needs Reply / Pending</button>
      <button class="filter-tab" id="tab-plans" onclick="setEngagementTab('plan')">📄 Floor Plans Requested</button>
      <button class="filter-tab" id="tab-brochure" onclick="setEngagementTab('brochure')">📑 Brochure Downloaded</button>
      <button class="filter-tab" id="tab-site" onclick="setEngagementTab('site_visit')">🏡 Site Visit / Call</button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <input type="text" id="searchInput" placeholder="Search name, full phone number, wa_id..." oninput="debounceFetchContacts()" />
        <select id="projectFilter" onchange="fetchContacts()">
          <option value="">All Projects</option>
          <option value="spring-hill">Spring Hill</option>
          <option value="mahal">Mahal</option>
          <option value="rajmahal">Rajmahal</option>
          <option value="applewood">Applewood</option>
          <option value="elements">Elements</option>
          <option value="villas">Villas</option>
        </select>
        <select id="leadSourceFilter" onchange="fetchContacts()">
          <option value="">All Lead Sources</option>
          <option value="broadcast_invitation">Broadcast Invitation</option>
          <option value="whatsapp_campaign">WhatsApp Campaign</option>
          <option value="inbound_qr">Inbound QR</option>
          <option value="direct">Direct WhatsApp</option>
        </select>
        <select id="unreadFilter" onchange="fetchContacts()">
          <option value="">All Read States</option>
          <option value="true">Unread (CRM)</option>
          <option value="false">Read / Acknowledged</option>
        </select>
      </div>
      <div class="filter-group">
        <select id="limitFilter" onchange="fetchContacts()">
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
          <option value="200" selected>200 per page (Full Batch)</option>
          <option value="500">500 per page</option>
          <option value="1000">1,000 (All)</option>
        </select>
        <select id="sortFilter" onchange="fetchContacts()">
          <option value="latest_activity">Sort: Latest Activity</option>
          <option value="newest_reply">Sort: Newest Customer Reply</option>
          <option value="newest">Sort: Newest Lead</option>
          <option value="oldest">Sort: Oldest Lead</option>
          <option value="most_messages">Sort: Most Messages</option>
          <option value="most_engagement">Sort: Most Engagement</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Lead Name</th>
            <th>Phone Number</th>
            <th>Project Interest</th>
            <th>Broadcast Date</th>
            <th>Last Activity / Reply</th>
            <th>Latest Inbound Reply</th>
            <th>Automation Flow Step</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="contactsTableBody">
          <tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading contacts...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Automation Flow Map Modal Dialog -->
    <div class="modal-backdrop" id="journeyModalBackdrop" onclick="closeJourneyModal()">
      <div class="modal-content" style="max-width: 720px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🗺️</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 700;" id="journeyModalName">Automation Journey Flow Map</h3>
              <div style="font-size: 12px; color: var(--text-muted);" id="journeyModalSub">Customer interaction step-by-step breakdown</div>
            </div>
          </div>
          <button class="modal-close" onclick="closeJourneyModal()">✕</button>
        </div>
        <div id="journeyModalBody" style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading journey data...</div>
        </div>
      </div>
    </div>

    <script>
      let debounceTimer;
      let selectedDate = "";
      let activeEngagementTab = "";

      function debounceFetchContacts() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchContacts, 300);
      }

      function selectDateChip(dateVal) {
        selectedDate = dateVal;
        document.getElementById("dateFilterInput").value = dateVal;
        
        // Update chip active classes
        document.querySelectorAll(".date-chip").forEach(el => el.classList.remove("active"));
        const targetChip = dateVal ? document.getElementById("chip-" + dateVal) : document.getElementById("chip-all");
        if (targetChip) targetChip.classList.add("active");

        updateDateBanner();
        fetchContacts();
      }

      function onCustomDateSelect(dateVal) {
        selectedDate = dateVal;
        document.querySelectorAll(".date-chip").forEach(el => el.classList.remove("active"));
        const targetChip = document.getElementById("chip-" + dateVal);
        if (targetChip) targetChip.classList.add("active");
        
        updateDateBanner();
        fetchContacts();
      }

      function clearDateFilter() {
        selectedDate = "";
        document.getElementById("dateFilterInput").value = "";
        document.querySelectorAll(".date-chip").forEach(el => el.classList.remove("active"));
        document.getElementById("chip-all").classList.add("active");
        updateDateBanner();
        fetchContacts();
      }

      function updateDateBanner() {
        const banner = document.getElementById("activeDateBanner");
        const label = document.getElementById("activeDateLabel");
        if (selectedDate) {
          banner.style.display = "inline-flex";
          const d = new Date(selectedDate);
          const readable = isNaN(d.getTime()) ? selectedDate : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          label.textContent = readable;
        } else {
          banner.style.display = "none";
        }
      }

      function setEngagementTab(tab) {
        activeEngagementTab = tab;
        document.querySelectorAll(".filter-tab").forEach(el => el.classList.remove("active"));
        const tabEl = document.getElementById("tab-" + (tab || "all"));
        if (tabEl) tabEl.classList.add("active");
        fetchContacts();
      }

      async function fetchContacts() {
        const search = document.getElementById("searchInput").value;
        const project = document.getElementById("projectFilter").value;
        const leadSource = document.getElementById("leadSourceFilter").value;
        const unread = document.getElementById("unreadFilter").value;
        const limit = document.getElementById("limitFilter").value || "200";
        const sortBy = document.getElementById("sortFilter").value;

        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (project) params.append("project", project);
        if (leadSource) params.append("leadSource", leadSource);
        if (unread) params.append("unread", unread);
        if (selectedDate) params.append("date", selectedDate);
        params.append("limit", limit);
        params.append("sortBy", sortBy);

        // Engagement tab mapping
        if (activeEngagementTab === "replied") {
          params.append("replied", "true");
        } else if (activeEngagementTab === "unread") {
          params.append("unread", "true");
        } else if (activeEngagementTab === "plan") {
          params.append("planRequested", "true");
        } else if (activeEngagementTab === "brochure") {
          params.append("brochureRequested", "true");
        } else if (activeEngagementTab === "site_visit") {
          params.append("siteVisitRequested", "true");
        }

        try {
          const res = await fetch('/api/contacts?' + params.toString());
          const data = await res.json();
          renderContacts(data.contacts || []);
          
          let countBadgeText = (data.total || 0) + ' Leads';
          if (selectedDate) {
            countBadgeText += ' (' + selectedDate + ' Only)';
          }
          document.getElementById("contactCountBadge").textContent = countBadgeText;
        } catch (e) {
          console.error("Failed to load contacts", e);
        }
      }

      function formatDateTime(dateStr) {
        if (!dateStr) return '<span style="color: var(--text-dim);">—</span>';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '<span style="color: var(--text-dim);">—</span>';
        
        const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        return '<div style="font-weight: 600; color: #f8fafc; font-size: 12.5px;">' + dateFormatted + '</div>' +
               '<div style="font-size: 11px; color: #94a3b8;">' + timeFormatted + '</div>';
      }

      function formatTimeAgo(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const sec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (sec < 60) return sec + 's ago';
        const min = Math.floor(sec / 60);
        if (min < 60) return min + 'm ago';
        const hr = Math.floor(min / 60);
        if (hr < 24) return hr + 'h ago';
        return Math.floor(hr / 24) + 'd ago';
      }

      function formatFullPhone(phone) {
        if (!phone) return '<span style="color: var(--text-dim);">—</span>';
        const clean = phone.replace(/\\D/g, '');
        const display = clean.startsWith('91') && clean.length === 12
          ? '+91 ' + clean.slice(2, 7) + ' ' + clean.slice(7)
          : '+' + clean;
        return '<div style="display: inline-flex; align-items: center; gap: 6px;">' +
          '<span class="code-text" style="font-weight: 600; font-size: 13px; color: #38bdf8; letter-spacing: 0.3px;">' + display + '</span>' +
          '<a href="https://wa.me/' + clean + '" target="_blank" onclick="event.stopPropagation();" title="Open WhatsApp Chat directly" style="text-decoration: none; font-size: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 1px 6px; color: #34d399; font-weight: 600;">💬 WA</a>' +
        '</div>';
      }

      function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function renderContacts(contacts) {
        const tbody = document.getElementById("contactsTableBody");
        if (contacts.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">' +
            (selectedDate ? 'No contacts found for date: ' + selectedDate : 'No contacts found matching criteria.') +
          '</td></tr>';
          return;
        }

        tbody.innerHTML = contacts.map(c => {
          const statusBadge = c.conversationStatus === 'OPEN'
            ? '<span class="badge badge-active">🟢 OPEN</span>'
            : (c.conversationStatus === 'CLOSED' ? '<span class="badge badge-closed">🔵 CLOSED</span>' : '<span class="badge">NONE</span>');
          
          const unreadBadge = c.unread 
            ? '<span class="badge badge-needs-reply">🟡 UNREAD (' + c.unreadCount + ')</span>'
            : '<span style="color: var(--text-dim); font-size: 11px;">Acknowledged</span>';

          const projectName = c.project ? c.project.toUpperCase() : 'GENERAL';

          // Latest Inbound Reply pill
          let replyHtml = '<span style="color: var(--text-dim); font-size: 12px;">No reply yet</span>';
          if (c.hasReplied || c.lastReplyText) {
            const replyText = c.lastReplyText || 'Inbound reply';
            replyHtml = '<div style="display: flex; flex-direction: column; gap: 2px;">' +
              '<div style="font-size: 12px; font-weight: 600; color: #34d399; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + escapeHtml(replyText) + '">💬 ' + escapeHtml(replyText) + '</div>' +
              (c.lastReplyAt ? '<div style="font-size: 10px; color: var(--text-dim);">' + formatTimeAgo(c.lastReplyAt) + '</div>' : '') +
            '</div>';
          }

          // Journey Step Badge
          const stepNum = c.currentJourneyStepNumber || (c.hasReplied ? 2 : 1);
          const stepBadgeColor = stepNum >= 6 ? '#10b981' : (stepNum >= 3 ? '#818cf8' : (stepNum === 2 ? '#34d399' : '#94a3b8'));
          const stepBadgeBg = stepNum >= 6 ? 'rgba(16, 185, 129, 0.15)' : (stepNum >= 3 ? 'rgba(129, 140, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)');
          const journeyBadge = '<span class="badge" style="background: ' + stepBadgeBg + '; color: ' + stepBadgeColor + '; border: 1px solid ' + stepBadgeColor + '40;">' +
            escapeHtml(c.currentJourneyStep || ('Step ' + stepNum + ': Dispatched')) +
          '</span>';

          return '<tr class="clickable" onclick="window.location.href=\\'/contacts/' + c.id + '\\'">' +
            '<td style="font-weight: 600; color: #f8fafc;">' + (c.name || 'Unnamed Prospect') + '</td>' +
            '<td>' + formatFullPhone(c.phone) + '</td>' +
            '<td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">' + projectName + '</span></td>' +
            '<td>' + formatDateTime(c.firstSeenAt) + '</td>' +
            '<td>' + formatDateTime(c.lastActivityAt) + '</td>' +
            '<td>' + replyHtml + '</td>' +
            '<td>' + journeyBadge + '</td>' +
            '<td>' + statusBadge + '<div style="margin-top: 4px;">' + unreadBadge + '</div></td>' +
            '<td>' +
              '<div style="display: flex; gap: 6px;" onclick="event.stopPropagation();">' +
                '<button class="btn" style="padding: 4px 8px; font-size: 11px; background: rgba(99, 102, 241, 0.15); border-color: #6366f1; color: #818cf8;" onclick="openJourneyModal(\\'' + c.id + '\\')" title="View Automation Journey Steps">🗺️ Flow</button>' +
                '<a href="/contacts/' + c.id + '" class="btn btn-primary" style="padding: 4px 10px; font-size: 11px;">Open 360</a>' +
              '</div>' +
            '</td>' +
          '</tr>';
        }).join('');
      }

      async function openJourneyModal(contactId) {
        document.getElementById("journeyModalBackdrop").classList.add("active");
        const body = document.getElementById("journeyModalBody");
        body.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Fetching customer journey events...</div>';

        try {
          const res = await fetch('/api/contacts/' + contactId);
          if (!res.ok) throw new Error("Contact not found");
          const data = await res.json();
          renderModalJourney(data);
        } catch (e) {
          console.error("Failed to load journey for modal", e);
          body.innerHTML = '<div style="color: var(--rose); padding: 20px;">Failed to load journey map.</div>';
        }
      }

      function closeJourneyModal() {
        document.getElementById("journeyModalBackdrop").classList.remove("active");
      }

      function renderModalJourney(data) {
        const c = data.contact;
        const msgs = data.messages || [];
        const events = data.events || data.projectEvents || [];
        const statuses = data.statuses || [];

        const displayName = c.name || "Unnamed Prospect";
        const cleanPhone = c.phone.replace(/\\D/g, '');
        const phoneFormatted = cleanPhone.startsWith('91') && cleanPhone.length === 12
          ? '+91 ' + cleanPhone.slice(2, 7) + ' ' + cleanPhone.slice(7)
          : '+' + cleanPhone;

        document.getElementById("journeyModalName").textContent = displayName + " — Automation Journey Flow";
        document.getElementById("journeyModalSub").innerHTML = 'Full Phone: <strong class="code-text" style="color: #38bdf8;">' + phoneFormatted + '</strong> | <a href="https://wa.me/' + cleanPhone + '" target="_blank" style="color: #34d399; font-weight: 600; text-decoration: none;">💬 Chat on WhatsApp</a>';

        // Evaluate Steps
        const outboundMsg = msgs.find(m => m.direction === 'outbound');
        const inboundMsg = msgs.find(m => m.direction === 'inbound');
        const projEv = events.find(e => e.event_type === 'PROJECT_SELECTED');
        const planEv = events.find(e => e.event_type === 'PLANS_REQUESTED' || e.event_type === 'PLAN_SENT' || e.event_type === 'SQFT_SELECTED' || e.event_type === 'BHK_SELECTED');
        const brochureEv = events.find(e => e.event_type === 'BROCHURE_REQUESTED' || e.event_type === 'BROCHURE_SENT');
        const conversionEv = events.find(e => e.event_type === 'SITE_VISIT_REQUESTED' || e.event_type === 'CALL_REQUESTED' || e.event_type === 'CHAT_REQUESTED');

        const isDelivered = statuses.some(s => s.status.toLowerCase() === 'delivered' || s.status.toLowerCase() === 'read');
        const isRead = statuses.some(s => s.status.toLowerCase() === 'read');

        // Step 1: Outbound Broadcast
        const step1Html = '<div class="journey-step completed">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">1</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🚀 Step 1: Outbound Automation Invitation Sent</strong>' +
              '<span style="color: var(--emerald); font-size: 11px; font-weight: 600;">✓ Dispatched</span>' +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              'Template: <span class="code-text">' + (outboundMsg?.template_name || 'silverstone_invitation') + '</span> sent to +' + c.phone +
              (outboundMsg ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(outboundMsg.created_at).toLocaleString() + '</span>' : '') +
              (outboundMsg?.wa_message_id ? '<br><span class="code-text" style="font-size: 10px; color: #64748b;">WAMID: ' + outboundMsg.wa_message_id + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 2: Delivery & Read
        const step2Class = isRead ? 'completed' : (isDelivered ? 'completed' : 'active');
        const step2Badge = isRead ? '<span style="color: #60a5fa; font-weight: 600;">✓✓ Read by Prospect</span>' : (isDelivered ? '<span style="color: var(--emerald); font-weight: 600;">✓✓ Delivered</span>' : '<span style="color: var(--amber);">● Sent / Pending</span>');
        const step2Html = '<div class="journey-step ' + step2Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">2</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📱 Step 2: Message Delivery & Read Receipts</strong>' +
              step2Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (isRead ? 'Customer opened and read the WhatsApp invitation message.' : (isDelivered ? 'Message reached customer device successfully.' : 'Message dispatched to WhatsApp network.')) +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 3: Customer Reply
        const step3Class = inboundMsg ? 'completed' : 'active';
        const step3Badge = inboundMsg ? '<span style="color: var(--emerald); font-weight: 600;">✓ Replied</span>' : '<span style="color: var(--amber);">⏳ Awaiting Reply</span>';
        const replyTextVal = inboundMsg ? (inboundMsg.body_text || (inboundMsg.button_id ? 'Tapped button: "' + inboundMsg.button_id + '"' : (inboundMsg.list_row_id ? 'Selected: "' + inboundMsg.list_row_id + '"' : 'Replied'))) : 'No reply received yet from customer.';
        const step3Html = '<div class="journey-step ' + step3Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">3</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">💬 Step 3: Customer Reply & Bot Engagement</strong>' +
              step3Badge +
            '</div>' +
            '<div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">' +
              escapeHtml(replyTextVal) +
              (inboundMsg ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(inboundMsg.created_at).toLocaleString() + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 4: Project Explored
        const step4Class = projEv ? 'completed' : 'pending';
        const step4Badge = projEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Project Explored</span>' : '<span style="color: var(--text-dim);">○ Not Yet Explored</span>';
        const projNameVal = projEv ? (projEv.event_value || 'Project').toUpperCase() : 'Prospect has not navigated to a specific project yet.';
        const step4Html = '<div class="journey-step ' + step4Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">4</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🏢 Step 4: Project Explored (Mahal / Rajmahal / Spring Hill)</strong>' +
              step4Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (projEv ? 'Customer viewed details for project: <strong style="color: #818cf8;">' + escapeHtml(projNameVal) + '</strong>' : projNameVal) +
              (projEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(projEv.created_at).toLocaleString() + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 5: Floor Plans
        const step5Class = planEv ? 'completed' : 'pending';
        const step5Badge = planEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Plans Requested</span>' : '<span style="color: var(--text-dim);">○ Not Requested</span>';
        const step5Html = '<div class="journey-step ' + step5Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">5</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📐 Step 5: Floor Plan & Layout Selection</strong>' +
              step5Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (planEv ? 'Customer requested floor plans for configuration: <strong style="color: #93c5fd;">' + escapeHtml(planEv.event_value || 'Floor Plans') + '</strong>. Bot delivered layout PDF.' : 'Customer has not requested floor plans yet.') +
              (planEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(planEv.created_at).toLocaleString() + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 6: Brochure Download
        const step6Class = brochureEv ? 'completed' : 'pending';
        const step6Badge = brochureEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Brochure Downloaded</span>' : '<span style="color: var(--text-dim);">○ Not Downloaded</span>';
        const step6Html = '<div class="journey-step ' + step6Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">6</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📄 Step 6: Project Brochure Download</strong>' +
              step6Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (brochureEv ? 'Customer requested digital brochure document. Full PDF brochure delivered via WhatsApp.' : 'Brochure not requested yet.') +
              (brochureEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(brochureEv.created_at).toLocaleString() + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 7: Sales Conversion Actions
        const step7Class = conversionEv ? 'completed' : 'pending';
        let conversionLabel = '○ In Pipeline';
        let conversionDetail = 'Customer has not yet requested a site visit, phone call, or agent chat.';
        if (conversionEv) {
          if (conversionEv.event_type === 'SITE_VISIT_REQUESTED') {
            conversionLabel = '✓ Site Visit Booked!';
            conversionDetail = 'Customer submitted site visit booking form for Silverstone project!';
          } else if (conversionEv.event_type === 'CALL_REQUESTED') {
            conversionLabel = '✓ Call Requested!';
            conversionDetail = 'Customer tapped Call Now button intent for sales desk.';
          } else if (conversionEv.event_type === 'CHAT_REQUESTED') {
            conversionLabel = '✓ Live Chat Requested!';
            conversionDetail = 'Customer requested live human sales agent handoff.';
          }
        }
        const step7Html = '<div class="journey-step ' + step7Class + '">' +
          '<div class="journey-step-icon">7</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🎯 Step 7: Sales Conversion & Human Hand-off</strong>' +
              '<span style="color: ' + (conversionEv ? 'var(--emerald)' : 'var(--text-dim)') + '; font-weight: 600;">' + conversionLabel + '</span>' +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              conversionDetail +
              (conversionEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + new Date(conversionEv.created_at).toLocaleString() + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        const body = document.getElementById("journeyModalBody");
        body.innerHTML = '<div class="journey-stepper">' +
          step1Html + step2Html + step3Html + step4Html + step5Html + step6Html + step7Html +
        '</div>';
      }

      // Initial load
      fetchContacts();
    </script>
  `;

  res.send(renderDashboardLayout("Contacts 360", "contacts", content));
});

/**
 * GET /contacts/:contactId
 * Comprehensive 3-Pane Contact 360 CRM Workspace.
 */
dashboardRouter.get("/contacts/:contactId", (req: Request, res: Response) => {
  const contactId = req.params.contactId;

  const content = `
    <!-- Top Contact 360 Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff;" id="contactAvatar">
          —
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h1 style="font-size: 20px; font-weight: 700;" id="contactHeaderName">Loading Contact...</h1>
            <span id="contactStatusChip" class="badge">...</span>
          </div>
          <div style="display: flex; gap: 14px; margin-top: 6px; font-size: 13px; color: var(--text-muted); align-items: center; flex-wrap: wrap;">
            <span>WhatsApp: <strong class="code-text" style="font-size: 14px; color: #38bdf8;" id="contactHeaderPhone">—</strong></span>
            <a id="contactHeaderWaBtn" href="#" target="_blank" class="btn" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #34d399; padding: 2px 8px; font-size: 11px; font-weight: 600; text-decoration: none;">💬 Open WhatsApp Chat</a>
            <span>Project: <strong style="color: #818cf8;" id="contactHeaderProject">—</strong></span>
            <span>Source: <strong id="contactHeaderSource">—</strong></span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <a href="/contacts" class="btn">← Back to Contacts</a>
        <a id="exportConvBtn" href="#" class="btn" target="_blank">Export Chat CSV</a>
      </div>
    </div>

    <!-- 3-Pane Grid -->
    <div style="display: grid; grid-template-columns: 280px 1fr 340px; gap: 20px; flex: 1;">
      
      <!-- Left Column: Quick Snapshot & Metrics -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <div class="card-title">Activity Snapshot</div>
          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <div>
              <div style="color: var(--text-dim); font-size: 11px; font-weight: 600;">FIRST SEEN / BROADCAST DATE</div>
              <div id="firstSeenText" style="font-weight: 500; margin-top: 2px;">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px; font-weight: 600;">LAST SEEN / ACTIVE DATE</div>
              <div id="lastSeenText" style="font-weight: 500; margin-top: 2px;">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px; font-weight: 600;">LAST INBOUND MESSAGE (CUSTOMER)</div>
              <div id="lastInboundText" style="font-weight: 500; color: #34d399; margin-top: 2px;">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px; font-weight: 600;">LAST OUTBOUND MESSAGE (BOT)</div>
              <div id="lastOutboundText" style="font-weight: 500; color: #60a5fa; margin-top: 2px;">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px; font-weight: 600;">CURRENT BOT STATE</div>
              <div class="code-text" id="currentStateBadge" style="margin-top: 2px;">—</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Message Stats</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <div style="background: var(--bg-card); padding: 10px; border-radius: 6px;">
              <div style="color: var(--text-dim); font-size: 11px;">TOTAL</div>
              <div style="font-size: 18px; font-weight: 700;" id="msgTotalCount">0</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 6px;">
              <div style="color: var(--text-dim); font-size: 11px;">INBOUND</div>
              <div style="font-size: 18px; font-weight: 700; color: #34d399;" id="msgInboundCount">0</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 6px;">
              <div style="color: var(--text-dim); font-size: 11px;">OUTBOUND</div>
              <div style="font-size: 18px; font-weight: 700; color: #60a5fa;" id="msgOutboundCount">0</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 6px;">
              <div style="color: var(--text-dim); font-size: 11px;">DELIVERED / READ</div>
              <div style="font-size: 18px; font-weight: 700; color: #818cf8;" id="msgReadCount">0</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Response Time</div>
          <div style="font-size: 13px;">
            <div style="color: var(--text-dim); font-size: 11px;">FIRST RESPONSE</div>
            <div style="font-size: 20px; font-weight: 700; color: #34d399; margin: 4px 0;" id="firstResponseDuration">—</div>
            <div style="color: var(--text-dim); font-size: 11px; margin-top: 8px;">AVERAGE RESPONSE</div>
            <div style="font-size: 14px; font-weight: 600;" id="avgResponseDuration">—</div>
          </div>
        </div>
      </div>

      <!-- Center Column: Visual Stepper + Conversation Timeline -->
      <div style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; height: calc(100vh - 180px); padding-right: 4px;">
        
        <!-- Top Section: Interactive Automation Flow & Stepper Map -->
        <div class="card" style="background: #0d1527; border: 1px solid #334155; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🗺️</span>
              <div>
                <h2 style="font-size: 15px; font-weight: 700; color: #f8fafc;">Automation Flow & Customer Journey Steps</h2>
                <div style="font-size: 11.5px; color: var(--text-muted);">Real-time progress map across all 7 automation interaction stages</div>
              </div>
            </div>
            <span id="pageJourneyStepBadge" class="badge badge-active">Analyzing...</span>
          </div>

          <!-- 7-Step Stepper Stream -->
          <div id="pageJourneyStepperArea" class="journey-stepper">
            <div style="text-align: center; color: var(--text-muted); padding: 20px;">Evaluating customer steps...</div>
          </div>
        </div>

        <!-- Bottom Section: Chronological Conversation Timeline -->
        <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; min-height: 450px;">
          <!-- Timeline Header & Event Filters -->
          <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card);">
            <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <span>Conversation & Message Log</span>
              <span id="timelineMessageCount" class="badge badge-active">0 items</span>
            </div>
            <div class="filter-group">
              <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="filterTimeline('all')">All</button>
              <button class="btn" style="padding: 4px 8px; font-size: 11px;" onclick="filterTimeline('messages')">Messages</button>
              <button class="btn" style="padding: 4px 8px; font-size: 11px;" onclick="filterTimeline('actions')">Actions</button>
              <button class="btn" style="padding: 4px 8px; font-size: 11px;" onclick="filterTimeline('projects')">Project</button>
            </div>
          </div>

          <!-- Scrollable Timeline Stream -->
          <div id="timelineScrollArea" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; background: #0c1220; max-height: 480px;">
            <div style="text-align: center; color: var(--text-muted); padding: 40px;">Loading timeline...</div>
          </div>

          <!-- Footer / State Info -->
          <div style="padding: 10px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-card); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
            <span id="timelineFooterState">Current State: INIT</span>
            <span style="color: var(--emerald);">● Connected to Webhook Analytics</span>
          </div>
        </div>

      </div>

      <!-- Right Column: Project Journey Matrix & Next Action -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Next Recommended Action Card -->
        <div class="card" style="border-left: 4px solid var(--primary);">
          <div class="card-title" style="color: #818cf8;">Next Recommended Action</div>
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px;" id="nextActionText">Evaluating next step...</div>
          <p style="color: var(--text-dim); font-size: 12px;">Derived deterministically from real customer events.</p>
        </div>

        <!-- Project Journey Matrix -->
        <div class="card">
          <div class="card-title">Project Journey Matrix</div>
          <div id="projectMatrixContainer" style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
            Loading project matrix...
          </div>
        </div>

        <!-- Campaign Attribution -->
        <div class="card">
          <div class="card-title">Campaign Attribution</div>
          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px;">
            <div>
              <div style="color: var(--text-dim); font-size: 11px;">LAST CAMPAIGN</div>
              <div id="lastCampaignName" class="code-text">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px;">LAST TEMPLATE</div>
              <div id="lastTemplateName" class="code-text">—</div>
            </div>
            <div>
              <div style="color: var(--text-dim); font-size: 11px;">DELIVERY STATUS</div>
              <div id="lastCampaignStatusText">—</div>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Message Details Modal / Drawer -->
    <div class="modal-backdrop" id="msgModalBackdrop" onclick="closeMsgModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size: 16px; font-weight: 600;" id="modalTitle">Message Metadata</h3>
          <button class="modal-close" onclick="closeMsgModal()">✕</button>
        </div>
        <div id="modalBody" style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>

    <script>
      const contactId = "${contactId}";
      let contact360Data = null;
      let activeTimelineFilter = "all";

      async function loadContact360() {
        try {
          const res = await fetch('/api/contacts/' + contactId);
          if (!res.ok) throw new Error("Contact not found");
          contact360Data = await res.json();
          renderContact360(contact360Data);
        } catch (e) {
          console.error("Failed to load contact 360", e);
          document.getElementById("contactHeaderName").textContent = "Contact Not Found";
        }
      }

      function formatExplicitDateTime(dateStr) {
        if (!dateStr) return '<span style="color: var(--text-dim);">—</span>';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '<span style="color: var(--text-dim);">—</span>';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }

      function renderContact360(data) {
        const c = data.contact;
        const s = data.summary;
        const eng = data.engagement;
        const msgs = data.messagesSummary;
        const camp = data.campaignSummary;

        // Header
        const displayName = c.name || "Unnamed Prospect";
        document.getElementById("contactHeaderName").textContent = displayName;
        document.getElementById("contactAvatar").textContent = displayName.charAt(0).toUpperCase();

        const cleanPhone = (c.phone || '').replace(/\\D/g, '');
        const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
          ? '+91 ' + cleanPhone.slice(2, 7) + ' ' + cleanPhone.slice(7)
          : '+' + (c.phone || '');
        document.getElementById("contactHeaderPhone").textContent = formattedPhone;
        
        const waBtn = document.getElementById("contactHeaderWaBtn");
        if (waBtn) waBtn.href = 'https://wa.me/' + cleanPhone;

        document.getElementById("contactHeaderProject").textContent = (c.project || 'General').toUpperCase();
        document.getElementById("contactHeaderSource").textContent = c.leadSource || 'direct';

        const statusChip = document.getElementById("contactStatusChip");
        if (s.unreadCount > 0) {
          statusChip.className = "badge badge-needs-reply";
          statusChip.textContent = "🟡 UNREAD (" + s.unreadCount + ")";
        } else if (s.status === "OPEN" || s.status === "ACTIVE") {
          statusChip.className = "badge badge-active";
          statusChip.textContent = "🟢 ACTIVE";
        } else {
          statusChip.className = "badge badge-closed";
          statusChip.textContent = "🔵 " + s.status;
        }

        // Export button
        if (data.conversation) {
          document.getElementById("exportConvBtn").href = '/api/conversations/' + data.conversation.id + '/export?format=csv';
        }

        // Snapshot
        document.getElementById("firstSeenText").innerHTML = formatExplicitDateTime(c.firstSeenAt);
        document.getElementById("lastSeenText").innerHTML = formatExplicitDateTime(c.lastSeenAt);
        document.getElementById("lastInboundText").innerHTML = formatExplicitDateTime(s.lastCustomerMessageAt);
        document.getElementById("lastOutboundText").innerHTML = formatExplicitDateTime(s.lastBusinessMessageAt);
        document.getElementById("currentStateBadge").textContent = s.currentState || 'INIT';

        // Stats
        document.getElementById("msgTotalCount").textContent = msgs.totalMessages || 0;
        document.getElementById("msgInboundCount").textContent = msgs.inboundCount || 0;
        document.getElementById("msgOutboundCount").textContent = msgs.outboundCount || 0;
        document.getElementById("msgReadCount").textContent = (msgs.readCount || msgs.deliveredCount || 0);

        // Response Time
        document.getElementById("firstResponseDuration").textContent = s.firstResponseTimeFormatted || 'Not yet answered';
        document.getElementById("avgResponseDuration").textContent = s.averageResponseTimeFormatted || '—';

        // Next Action
        document.getElementById("nextActionText").textContent = s.nextLogicalAction || 'No action currently recorded.';

        // Render Automation Stepper
        renderPageJourneyStepper(data);

        // Timeline
        renderTimeline();

        // Project Matrix
        renderProjectMatrix(eng.projectMatrix || {});

        // Campaign
        document.getElementById("lastCampaignName").textContent = camp.lastCampaign || 'None';
        document.getElementById("lastTemplateName").textContent = camp.lastTemplate || 'None';
        document.getElementById("lastCampaignStatusText").textContent = camp.lastCampaignStatus ? camp.lastCampaignStatus.toUpperCase() : 'None';
        document.getElementById("timelineFooterState").textContent = 'Current State: ' + (s.currentState || 'INIT');
      }

      function renderPageJourneyStepper(data) {
        const c = data.contact;
        const msgs = data.messages || [];
        const events = data.events || data.projectEvents || [];
        const statuses = data.statuses || [];

        const outboundMsg = msgs.find(m => m.direction === 'outbound');
        const inboundMsg = msgs.find(m => m.direction === 'inbound');
        const projEv = events.find(e => e.event_type === 'PROJECT_SELECTED');
        const planEv = events.find(e => e.event_type === 'PLANS_REQUESTED' || e.event_type === 'PLAN_SENT' || e.event_type === 'SQFT_SELECTED' || e.event_type === 'BHK_SELECTED');
        const brochureEv = events.find(e => e.event_type === 'BROCHURE_REQUESTED' || e.event_type === 'BROCHURE_SENT');
        const conversionEv = events.find(e => e.event_type === 'SITE_VISIT_REQUESTED' || e.event_type === 'CALL_REQUESTED' || e.event_type === 'CHAT_REQUESTED');

        const isDelivered = statuses.some(s => s.status.toLowerCase() === 'delivered' || s.status.toLowerCase() === 'read');
        const isRead = statuses.some(s => s.status.toLowerCase() === 'read');

        // Current Step Badge
        let highestStep = "Step 1: Dispatched";
        if (conversionEv) highestStep = "Step 7: Conversion Action";
        else if (brochureEv || planEv) highestStep = "Step 5: Layout / Brochure";
        else if (projEv) highestStep = "Step 4: Project Explored";
        else if (inboundMsg) highestStep = "Step 3: Replied";
        else if (isRead) highestStep = "Step 2: Read";
        else if (isDelivered) highestStep = "Step 2: Delivered";
        document.getElementById("pageJourneyStepBadge").textContent = highestStep;

        // Step 1
        const s1 = '<div class="journey-step completed">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">1</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🚀 Step 1: Outbound Automation Invitation Sent</strong>' +
              '<span style="color: var(--emerald); font-size: 11px; font-weight: 600;">✓ Dispatched</span>' +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              'Template: <span class="code-text">' + (outboundMsg?.template_name || 'silverstone_invitation') + '</span> sent to +' + c.phone +
              (outboundMsg ? ' on ' + formatExplicitDateTime(outboundMsg.created_at) : '') +
              (outboundMsg?.wa_message_id ? '<br><span class="code-text" style="font-size: 10px; color: #64748b;">WAMID: ' + outboundMsg.wa_message_id + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 2
        const s2Class = isRead ? 'completed' : (isDelivered ? 'completed' : 'active');
        const s2Badge = isRead ? '<span style="color: #60a5fa; font-weight: 600;">✓✓ Read by Prospect</span>' : (isDelivered ? '<span style="color: var(--emerald); font-weight: 600;">✓✓ Delivered</span>' : '<span style="color: var(--amber);">● Sent / Pending</span>');
        const s2 = '<div class="journey-step ' + s2Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">2</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📱 Step 2: Message Delivery & Read Receipts</strong>' +
              s2Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (isRead ? 'Customer opened and read the invitation on WhatsApp.' : (isDelivered ? 'Invitation delivered to customer device.' : 'Message dispatched to recipient.')) +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 3
        const s3Class = inboundMsg ? 'completed' : 'active';
        const s3Badge = inboundMsg ? '<span style="color: var(--emerald); font-weight: 600;">✓ Replied</span>' : '<span style="color: var(--amber);">⏳ Awaiting Reply</span>';
        const replyVal = inboundMsg ? (inboundMsg.body_text || (inboundMsg.button_id ? 'Clicked button: "' + inboundMsg.button_id + '"' : (inboundMsg.list_row_id ? 'Selected: "' + inboundMsg.list_row_id + '"' : 'Replied'))) : 'No reply received yet from customer.';
        const s3 = '<div class="journey-step ' + s3Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">3</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">💬 Step 3: Customer Reply & Bot Engagement</strong>' +
              s3Badge +
            '</div>' +
            '<div style="font-size: 12px; color: #cbd5e1;">' +
              escapeHtml(replyVal) +
              (inboundMsg ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + formatExplicitDateTime(inboundMsg.created_at) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 4
        const s4Class = projEv ? 'completed' : 'pending';
        const s4Badge = projEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Explored</span>' : '<span style="color: var(--text-dim);">○ Not Yet Explored</span>';
        const s4 = '<div class="journey-step ' + s4Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">4</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🏢 Step 4: Project Explored</strong>' +
              s4Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (projEv ? 'Customer viewed details for project: <strong style="color: #818cf8;">' + escapeHtml((projEv.event_value || 'Project').toUpperCase()) + '</strong>' : 'Customer has not navigated to a specific project yet.') +
              (projEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + formatExplicitDateTime(projEv.created_at) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 5
        const s5Class = planEv ? 'completed' : 'pending';
        const s5Badge = planEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Plans Sent</span>' : '<span style="color: var(--text-dim);">○ Not Requested</span>';
        const s5 = '<div class="journey-step ' + s5Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">5</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📐 Step 5: Floor Plan & Layout Selection</strong>' +
              s5Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (planEv ? 'Customer requested floor plans for configuration: <strong style="color: #93c5fd;">' + escapeHtml(planEv.event_value || 'Floor Plans') + '</strong>. Layout delivered via WhatsApp.' : 'Customer has not requested floor plans yet.') +
              (planEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + formatExplicitDateTime(planEv.created_at) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 6
        const s6Class = brochureEv ? 'completed' : 'pending';
        const s6Badge = brochureEv ? '<span style="color: var(--emerald); font-weight: 600;">✓ Brochure Sent</span>' : '<span style="color: var(--text-dim);">○ Not Requested</span>';
        const s6 = '<div class="journey-step ' + s6Class + '">' +
          '<div class="journey-step-line"></div>' +
          '<div class="journey-step-icon">6</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">📄 Step 6: Project Brochure Download</strong>' +
              s6Badge +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              (brochureEv ? 'Customer requested digital brochure document. Full brochure PDF sent via WhatsApp.' : 'Brochure not requested yet.') +
              (brochureEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + formatExplicitDateTime(brochureEv.created_at) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        // Step 7
        const s7Class = conversionEv ? 'completed' : 'pending';
        let convLabel = '○ In Pipeline';
        let convDetail = 'Customer has not yet requested a site visit, phone call, or agent chat.';
        if (conversionEv) {
          if (conversionEv.event_type === 'SITE_VISIT_REQUESTED') {
            convLabel = '✓ Site Visit Booked!';
            convDetail = 'Customer submitted site visit booking form for Silverstone project!';
          } else if (conversionEv.event_type === 'CALL_REQUESTED') {
            convLabel = '✓ Call Requested!';
            convDetail = 'Customer tapped Call Now button intent for sales desk.';
          } else if (conversionEv.event_type === 'CHAT_REQUESTED') {
            convLabel = '✓ Live Chat Requested!';
            convDetail = 'Customer requested live human sales agent handoff.';
          }
        }
        const s7 = '<div class="journey-step ' + s7Class + '">' +
          '<div class="journey-step-icon">7</div>' +
          '<div class="journey-step-content">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' +
              '<strong style="color: #f1f5f9; font-size: 13px;">🎯 Step 7: Sales Conversion & Human Hand-off</strong>' +
              '<span style="color: ' + (conversionEv ? 'var(--emerald)' : 'var(--text-dim)') + '; font-weight: 600;">' + convLabel + '</span>' +
            '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted);">' +
              convDetail +
              (conversionEv ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + formatExplicitDateTime(conversionEv.created_at) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

        document.getElementById("pageJourneyStepperArea").innerHTML = s1 + s2 + s3 + s4 + s5 + s6 + s7;
      }

      function filterTimeline(filter) {
        activeTimelineFilter = filter;
        renderTimeline();
      }

      function renderTimeline() {
        if (!contact360Data) return;
        const container = document.getElementById("timelineScrollArea");
        
        // Merge messages and events into a unified chronological stream
        const items = [];

        (contact360Data.messages || []).forEach(m => {
          items.push({
            kind: 'message',
            direction: m.direction,
            time: new Date(m.created_at),
            data: m
          });
        });

        (contact360Data.events || contact360Data.projectEvents || []).forEach(e => {
          items.push({
            kind: 'event',
            time: new Date(e.created_at),
            data: e
          });
        });

        items.sort((a, b) => a.time.getTime() - b.time.getTime());

        // Apply filter
        const filtered = items.filter(it => {
          if (activeTimelineFilter === 'all') return true;
          if (activeTimelineFilter === 'messages') return it.kind === 'message';
          if (activeTimelineFilter === 'actions') return it.kind === 'event';
          if (activeTimelineFilter === 'projects') {
            return it.kind === 'event' && ['PROJECT_SELECTED', 'BROCHURE_REQUESTED', 'PLANS_REQUESTED', 'BHK_SELECTED'].includes(it.data.event_type);
          }
          return true;
        });

        document.getElementById("timelineMessageCount").textContent = filtered.length + ' items';

        if (filtered.length === 0) {
          container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">No timeline items match this filter.</div>';
          return;
        }

        container.innerHTML = filtered.map(it => {
          const timeStr = formatExplicitDateTime(it.time);

          if (it.kind === 'event') {
            const ev = it.data;
            const val = ev.event_value ? ' : ' + ev.event_value : '';
            return '<div style="display: flex; justify-content: center; margin: 6px 0;">' +
              '<div style="background: rgba(30, 41, 59, 0.7); border: 1px dashed var(--border-subtle); padding: 4px 12px; border-radius: 20px; font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 8px;">' +
                '<span style="color: #64748b;">' + timeStr + '</span>' +
                '<strong style="color: #cbd5e1;">' + ev.event_type + '</strong>' +
                '<span style="color: #38bdf8;">' + val + '</span>' +
              '</div>' +
            '</div>';
          }

          const m = it.data;
          const isCustomer = m.direction === 'inbound';

          let contentHtml = '';
          if (m.body_text) {
            contentHtml = '<div style="white-space: pre-wrap;">' + escapeHtml(m.body_text) + '</div>';
          } else if (m.button_id) {
            contentHtml = '<div><span style="color: var(--text-dim); font-size: 11px;">Clicked button:</span> <strong>' + escapeHtml(m.button_id) + '</strong></div>';
          } else if (m.list_row_id) {
            contentHtml = '<div><span style="color: var(--text-dim); font-size: 11px;">Selected option:</span> <strong>' + escapeHtml(m.list_row_id) + '</strong></div>';
          } else if (m.template_name) {
            contentHtml = '<div><span style="color: var(--text-dim); font-size: 11px;">Template:</span> <span class="code-text">' + escapeHtml(m.template_name) + '</span></div>';
          } else {
            contentHtml = '<div><span style="color: var(--text-dim);">[' + m.message_type + ' message]</span></div>';
          }

          let receiptHtml = '';
          if (!isCustomer) {
            const st = (m.latestStatus || 'sent').toLowerCase();
            if (st === 'read') receiptHtml = '<span style="color: #60a5fa;" title="Read">✓✓ Read</span>';
            else if (st === 'delivered') receiptHtml = '<span style="color: var(--emerald);" title="Delivered">✓✓ Delivered</span>';
            else if (st === 'failed') receiptHtml = '<span style="color: var(--rose);" title="Failed">✕ Failed</span>';
            else receiptHtml = '<span style="color: var(--text-dim);" title="Sent">✓ Sent</span>';
          }

          const bubbleStyle = isCustomer
            ? 'background: #1e293b; border: 1px solid #334155; border-radius: 12px 12px 12px 2px; align-self: flex-start; max-width: 75%;'
            : 'background: #312e81; border: 1px solid #4338ca; border-radius: 12px 12px 2px 12px; align-self: flex-end; max-width: 75%;';

          const senderLabel = isCustomer
            ? '<span style="color: #34d399; font-weight: 600; font-size: 11px;">Customer</span>'
            : '<span style="color: #a5b4fc; font-weight: 600; font-size: 11px;">Silverstone Bot</span>';

          return '<div style="' + bubbleStyle + ' padding: 10px 14px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" onclick="openMsgModal(\\'' + m.id + '\\')">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 4px;">' +
              senderLabel +
              '<span style="font-size: 10px; color: var(--text-dim);">' + timeStr + '</span>' +
            '</div>' +
            '<div style="font-size: 13px; line-height: 1.4;">' + contentHtml + '</div>' +
            (receiptHtml ? '<div style="display: flex; justify-content: flex-end; margin-top: 4px; font-size: 10px;">' + receiptHtml + '</div>' : '') +
          '</div>';
        }).join('');
      }

      function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function renderProjectMatrix(matrix) {
        const container = document.getElementById("projectMatrixContainer");
        const keys = Object.keys(matrix);
        if (keys.length === 0) {
          container.innerHTML = '<div style="color: var(--text-dim);">No project interactions recorded.</div>';
          return;
        }

        container.innerHTML = keys.map(k => {
          const item = matrix[k];
          const viewedChip = item.viewed ? '<span style="color: var(--emerald);">✓ Viewed</span>' : '<span style="color: var(--text-dim);">—</span>';
          const selectedChip = item.selected ? '<span style="color: #818cf8; font-weight: 600;">✓ Selected</span>' : '<span style="color: var(--text-dim);">—</span>';
          const brochureChip = item.brochureRequested ? '<span style="color: #fbbf24;">✓ Brochure</span>' : '<span style="color: var(--text-dim);">—</span>';
          const planChip = item.plansRequested ? '<span style="color: #60a5fa;">✓ Plan</span>' : '<span style="color: var(--text-dim);">—</span>';

          let details = [];
          if (item.selectedSqft) details.push('Size: ' + item.selectedSqft);
          if (item.selectedBhk) details.push('BHK: ' + item.selectedBhk);

          return '<div style="background: var(--bg-card); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">' +
            '<div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #f1f5f9;">' + item.name + '</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">' +
              '<div>' + viewedChip + '</div>' +
              '<div>' + selectedChip + '</div>' +
              '<div>' + brochureChip + '</div>' +
              '<div>' + planChip + '</div>' +
            '</div>' +
            (details.length > 0 ? '<div style="margin-top: 6px; font-size: 11px; color: #93c5fd;">' + details.join(' | ') + '</div>' : '') +
          '</div>';
        }).join('');
      }

      function openMsgModal(msgId) {
        if (!contact360Data) return;
        const msg = (contact360Data.messages || []).find(m => m.id === msgId);
        if (!msg) return;

        const modalBody = document.getElementById("modalBody");
        modalBody.innerHTML = [
          '<div><span style="color: var(--text-dim); font-size: 11px;">MESSAGE ID</span><div class="code-text">' + msg.id + '</div></div>',
          msg.wa_message_id ? '<div><span style="color: var(--text-dim); font-size: 11px;">WHATSAPP MESSAGE ID</span><div class="code-text">' + msg.wa_message_id + '</div></div>' : '',
          '<div><span style="color: var(--text-dim); font-size: 11px;">DIRECTION</span><div style="font-weight: 600;">' + msg.direction.toUpperCase() + '</div></div>',
          '<div><span style="color: var(--text-dim); font-size: 11px;">TYPE</span><div>' + msg.message_type + '</div></div>',
          '<div><span style="color: var(--text-dim); font-size: 11px;">TIMESTAMP</span><div>' + formatExplicitDateTime(msg.created_at) + '</div></div>',
          msg.template_name ? '<div><span style="color: var(--text-dim); font-size: 11px;">TEMPLATE NAME</span><div class="code-text">' + msg.template_name + '</div></div>' : '',
          msg.campaign_id ? '<div><span style="color: var(--text-dim); font-size: 11px;">CAMPAIGN ID</span><div class="code-text">' + msg.campaign_id + '</div></div>' : '',
          '<div><span style="color: var(--text-dim); font-size: 11px;">CURRENT DELIVERY STATUS</span><div><strong style="color: #60a5fa;">' + (msg.latestStatus || 'sent').toUpperCase() + '</strong></div></div>'
        ].join('');

        document.getElementById("msgModalBackdrop").classList.add("active");
      }

      function closeMsgModal() {
        document.getElementById("msgModalBackdrop").classList.remove("active");
      }

      loadContact360();
    </script>
  `;

  res.send(renderDashboardLayout("Contact Detail", "contacts", content));
});

/**
 * GET /conversations
 * Conversation queue page.
 */
dashboardRouter.get("/conversations", (_req: Request, res: Response) => {
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">Conversation Queue</h1>
        <p style="color: var(--text-muted);">Real-time monitoring of all active customer sessions, replies, and follow-up states.</p>
      </div>
      <div>
        <span id="convCountBadge" class="badge badge-active">Loading...</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="filter-group">
        <input type="text" id="convSearchInput" placeholder="Search contact, phone, message text..." oninput="debounceFetchConvs()" />
        <select id="convNeedsReplyFilter" onchange="fetchConvs()">
          <option value="">All Reply States</option>
          <option value="true">🟡 Needs Reply (Customer Pending)</option>
          <option value="false">Replied / Business Responded</option>
        </select>
        <select id="convUnreadFilter" onchange="fetchConvs()">
          <option value="">All Read States</option>
          <option value="true">Unread (CRM)</option>
          <option value="false">Acknowledged</option>
        </select>
        <select id="convStatusFilter" onchange="fetchConvs()">
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Prospect</th>
            <th>Phone Number</th>
            <th>Latest Message</th>
            <th>Date & Time</th>
            <th>Project</th>
            <th>Current State</th>
            <th>Session Status</th>
            <th>Follow Up</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="convsTableBody">
          <tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading conversations...</td></tr>
        </tbody>
      </table>
    </div>

    <script>
      let convTimer;
      function debounceFetchConvs() {
        clearTimeout(convTimer);
        convTimer = setTimeout(fetchConvs, 300);
      }

      async function fetchConvs() {
        const search = document.getElementById("convSearchInput").value;
        const needsReply = document.getElementById("convNeedsReplyFilter").value;
        const unread = document.getElementById("convUnreadFilter").value;
        const status = document.getElementById("convStatusFilter").value;

        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (needsReply) params.append("needsReply", needsReply);
        if (unread) params.append("unread", unread);
        if (status) params.append("status", status);

        try {
          const res = await fetch('/api/conversations?' + params.toString());
          const data = await res.json();
          renderConvs(data.conversations || []);
          document.getElementById("convCountBadge").textContent = (data.total || 0) + ' Sessions';
        } catch (e) {
          console.error("Failed to load conversations", e);
        }
      }

      function formatDateTime(dateStr) {
        if (!dateStr) return '<span style="color: var(--text-dim);">—</span>';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '<span style="color: var(--text-dim);">—</span>';
        const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return '<div style="font-weight: 600; color: #f8fafc; font-size: 12.5px;">' + dateFormatted + '</div>' +
               '<div style="font-size: 11px; color: #94a3b8;">' + timeFormatted + '</div>';
      }

      function formatFullPhone(phone) {
        if (!phone) return '<span style="color: var(--text-dim);">—</span>';
        const clean = phone.replace(/\\D/g, '');
        const display = clean.startsWith('91') && clean.length === 12
          ? '+91 ' + clean.slice(2, 7) + ' ' + clean.slice(7)
          : '+' + clean;
        return '<div style="display: inline-flex; align-items: center; gap: 6px;">' +
          '<span class="code-text" style="font-weight: 600; font-size: 13px; color: #38bdf8; letter-spacing: 0.3px;">' + display + '</span>' +
          '<a href="https://wa.me/' + clean + '" target="_blank" onclick="event.stopPropagation();" title="Open WhatsApp Chat directly" style="text-decoration: none; font-size: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 1px 6px; color: #34d399; font-weight: 600;">💬 WA</a>' +
        '</div>';
      }

      function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function renderConvs(convs) {
        const tbody = document.getElementById("convsTableBody");
        if (convs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">No conversations found matching criteria.</td></tr>';
          return;
        }

        tbody.innerHTML = convs.map(c => {
          const followUpBadge = c.needsReply
            ? '<span class="badge badge-needs-reply">🟡 Needs Reply</span>'
            : (c.unread ? '<span class="badge badge-needs-reply">Unread</span>' : '<span style="color: var(--text-dim); font-size: 12px;">Up to date</span>');

          const statusBadge = c.status === 'OPEN'
            ? '<span class="badge badge-active">🟢 OPEN</span>'
            : '<span class="badge badge-closed">🔵 CLOSED</span>';

          return '<tr class="clickable" onclick="window.location.href=\\'/contacts/' + c.contactId + '\\'">' +
            '<td style="font-weight: 600; color: #f8fafc;">' + (c.contactName || 'Unnamed Prospect') + '</td>' +
            '<td>' + formatFullPhone(c.phone || c.contactPhone || c.phoneMasked) + '</td>' +
            '<td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + escapeHtml(c.latestMessageText || '—') + '</td>' +
            '<td>' + formatDateTime(c.lastActivityAt) + '</td>' +
            '<td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">' + (c.project ? c.project.toUpperCase() : 'GENERAL') + '</span></td>' +
            '<td><span class="code-text">' + (c.currentState || 'INIT') + '</span></td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + followUpBadge + '</td>' +
            '<td><a href="/contacts/' + c.contactId + '" class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="event.stopPropagation();">Open 360</a></td>' +
          '</tr>';
        }).join('');
      }

      fetchConvs();
    </script>
  `;

  res.send(renderDashboardLayout("Conversations", "conversations", content));
});

/**
 * GET /duplicates
 * Passive duplicate contact review page (no destructive auto-merging).
 */
dashboardRouter.get("/duplicates", (_req: Request, res: Response) => {
  const content = `
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">Contact Duplicate Detection Review</h1>
      <p style="color: var(--text-muted);">Passive inspection report identifying potential customer duplicates based on WhatsApp ID, normalized phone, or email. Strictly non-destructive.</p>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Match Signal</th>
            <th>Matched Value</th>
            <th>Contact A</th>
            <th>Contact B</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="dupeTableBody">
          <tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Scanning for duplicates...</td></tr>
        </tbody>
      </table>
    </div>

    <script>
      async function fetchDuplicates() {
        try {
          const res = await fetch('/api/duplicates');
          const data = await res.json();
          renderDuplicates(data.duplicates || []);
        } catch (e) {
          console.error("Failed to load duplicates", e);
        }
      }

      function renderDuplicates(dupes) {
        const tbody = document.getElementById("dupeTableBody");
        if (dupes.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--emerald);">✓ Zero duplicate contact anomalies detected across the database.</td></tr>';
          return;
        }

        tbody.innerHTML = dupes.map(d => {
          return '<tr>' +
            '<td><span class="badge badge-needs-reply">' + d.matchType.toUpperCase() + '</span></td>' +
            '<td class="code-text">' + d.matchValue + '</td>' +
            '<td>' + (d.contactA.name || 'Unnamed') + ' (' + d.contactA.id + ')</td>' +
            '<td>' + (d.contactB.name || 'Unnamed') + ' (' + d.contactB.id + ')</td>' +
            '<td><span style="color: var(--text-dim); font-size: 12px;">Flagged for manual review</span></td>' +
          '</tr>';
        }).join('');
      }

      fetchDuplicates();
    </script>
  `;

  res.send(renderDashboardLayout("Duplicate Review", "duplicates", content));
});
