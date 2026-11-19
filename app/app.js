/**
 * SAP BTP CapEx Procurement & Asset Hub - Frontend Controller
 * Implements Fiori Horizon UX, OData V4 consumption, and BTP RBAC Simulation
 */

// Application State
const AppState = {
    userRole: 'Admin', // Admin, Manager, Viewer
    currentTab: 'tab-dashboard',
    requests: [],
    selectedRequest: null,
    metrics: null,
    deptMetrics: [],
    integrations: [],
    rejectionTargetId: null
};

// Helper: Format Currency
function formatCurrency(amount, currency = 'USD') {
    const val = parseFloat(amount) || 0;
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper: Format Date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateStr;
    }
}

// Helper: Common Fetch with Role Header
async function odataFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Role': AppState.userRole,
        ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        try {
            const errJson = await res.json();
            errMsg = errJson.error?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
    }

    if (res.status === 204) return null;
    return await res.json();
}

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupTabNavigation();
    setupPersonaSwitcher();
    setupEventListeners();
    await refreshAllData();
});

// Setup Fiori Icon Tab Bar
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.getAttribute('data-tab');
            AppState.currentTab = targetTab;

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(targetTab);
            if (content) content.classList.add('active');
        });
    });
}

// Setup Persona Switcher
function setupPersonaSwitcher() {
    const select = document.getElementById('personaSelect');
    select.addEventListener('change', async (e) => {
        AppState.userRole = e.target.value;
        showToast(`Switched active BTP persona to: ${e.target.selectedOptions[0].text}`);
        if (AppState.selectedRequest) {
            renderDrawerActions(AppState.selectedRequest);
        }
        await refreshAllData();
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Search
    document.getElementById('globalSearchInput').addEventListener('input', applyFilters);
    document.getElementById('filterDepartment').addEventListener('change', applyFilters);
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('filterPriority').addEventListener('change', applyFilters);

    // Refresh Integrations
    document.getElementById('btnRefreshIntegrations').addEventListener('click', fetchIntegrationsData);
    document.getElementById('btnPingAllDestinations').addEventListener('click', pingAllDestinations);

    // Drawer Close
    document.getElementById('btnCloseDrawer').addEventListener('click', closeDetailDrawer);

    // New Request Modal
    document.getElementById('btnOpenNewRequestModal').addEventListener('click', openNewRequestModal);
    document.getElementById('btnCloseNewModal').addEventListener('click', closeNewRequestModal);
    document.getElementById('btnCancelNewModal').addEventListener('click', closeNewRequestModal);
    document.getElementById('btnAddModalItem').addEventListener('click', addModalLineItem);
    document.getElementById('btnSaveNewRequest').addEventListener('click', saveNewRequest);

    // Rejection Modal
    document.getElementById('btnCloseRejectModal').addEventListener('click', closeRejectModal);
    document.getElementById('btnCancelReject').addEventListener('click', closeRejectModal);
    document.getElementById('btnConfirmReject').addEventListener('click', confirmRejection);

    // Copilot
    document.getElementById('btnSendCopilot').addEventListener('click', sendCopilotMessage);
    document.getElementById('copilotInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendCopilotMessage();
    });

    document.querySelectorAll('.copilot-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            document.getElementById('copilotInput').value = prompt;
            sendCopilotMessage();
        });
    });

    // CSV Bulk Tools
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('csvFileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#E8F2FF'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.background = '#F7FAFE'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#F7FAFE';
        if (e.dataTransfer.files.length) handleCSVFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleCSVFile(e.target.files[0]);
    });

    document.getElementById('btnProcessCSV').addEventListener('click', processAndUploadCSV);
    document.getElementById('btnDownloadTemplate').addEventListener('click', downloadSampleTemplate);
    document.getElementById('btnExportCSV').addEventListener('click', () => {
        window.location.href = '/api/export-csv';
    });
}

// =============================================================================
// DATA FETCHING & SYNCHRONIZATION
// =============================================================================
async function refreshAllData() {
    try {
        await Promise.all([
            fetchExecutiveMetrics(),
            fetchDepartmentAnalytics(),
            fetchCapExRequests(),
            fetchIntegrationsData()
        ]);
    } catch (err) {
        console.error('Data refresh error:', err);
    }
}

async function fetchExecutiveMetrics() {
    try {
        const data = await odataFetch('/odata/v4/procurement/getExecutiveMetrics()');
        AppState.metrics = data;
        renderKpiBanner(data);
    } catch (err) {
        console.warn('Could not load executive metrics:', err.message);
    }
}

async function fetchDepartmentAnalytics() {
    try {
        const data = await odataFetch('/odata/v4/procurement/getDepartmentAnalytics()');
        AppState.deptMetrics = data.value || [];
        renderDepartmentAnalytics(AppState.deptMetrics);
    } catch (err) {
        console.warn('Could not load department metrics:', err.message);
    }
}

async function fetchCapExRequests() {
    try {
        const data = await odataFetch('/odata/v4/procurement/CapExRequests?$expand=items,auditTrail,aiEvaluations&$orderby=modifiedAt desc');
        AppState.requests = data.value || [];
        applyFilters();
        renderStatusDistribution();
    } catch (err) {
        console.error('Error fetching CapEx requests:', err);
    }
}

async function fetchIntegrationsData() {
    try {
        const data = await odataFetch('/odata/v4/procurement/SystemIntegrations');
        AppState.integrations = data.value || [];
        renderIntegrations();
    } catch (err) {
        console.warn('Error fetching integrations:', err);
    }
}

// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================
function renderKpiBanner(metrics) {
    if (!metrics) return;
    document.getElementById('valTotalCapEx').textContent = formatCurrency(metrics.totalCommittedCapEx);
    document.getElementById('valBudgetUtil').textContent = `${metrics.overallBudgetUtilization}%`;
    document.getElementById('budgetProgressBar').style.width = `${Math.min(100, metrics.overallBudgetUtilization)}%`;
    document.getElementById('valPending').textContent = metrics.pendingApprovalsCount;
    document.getElementById('valHighRisk').textContent = metrics.highRiskRequestsCount;
    document.getElementById('valS4Sync').textContent = metrics.s4SyncedCount;
}

function renderDepartmentAnalytics(deptList) {
    const container = document.getElementById('deptAnalyticsList');
    container.innerHTML = '';

    deptList.forEach(dept => {
        const percent = Math.min(100, parseFloat(dept.utilizationRate) || 0);
        let colorClass = '#0070F2';
        if (percent > 90) colorClass = '#BB0000';
        else if (percent > 75) colorClass = '#E9730C';

        const row = document.createElement('div');
        row.className = 'dept-metric-row';
        row.innerHTML = `
            <div class="dept-metric-header">
                <span>${dept.department}</span>
                <span>${percent}% Utilized (${formatCurrency(dept.totalCommitted)} / ${formatCurrency(dept.totalAllocated)})</span>
            </div>
            <div class="dept-bar-track">
                <div class="dept-bar-fill" style="width: ${percent}%; background-color: ${colorClass};"></div>
            </div>
            <div class="dept-metric-stats">
                <span>Pending Approvals: <strong>${dept.pendingCount}</strong></span>
                <span>Approved / S4 Synced: <strong>${dept.approvedCount}</strong></span>
            </div>
        `;
        container.appendChild(row);
    });
}

function renderStatusDistribution() {
    const counts = {
        DRAFT: 0,
        SUBMITTED: 0,
        DEPT_APPROVED: 0,
        FINANCE_APPROVED: 0,
        ORDER_CREATED: 0,
        REJECTED: 0
    };

    AppState.requests.forEach(r => {
        if (counts[r.status] !== undefined) counts[r.status]++;
    });

    const container = document.getElementById('statusDistribution');
    container.innerHTML = `
        <div class="status-dist-item">
            <span><span class="badge badge-draft">DRAFT</span> In Preparation</span>
            <strong>${counts.DRAFT}</strong>
        </div>
        <div class="status-dist-item">
            <span><span class="badge badge-submitted">SUBMITTED</span> Awaiting Dept Mgr</span>
            <strong>${counts.SUBMITTED}</strong>
        </div>
        <div class="status-dist-item">
            <span><span class="badge badge-dept_approved">DEPT_APPROVED</span> Awaiting Finance</span>
            <strong>${counts.DEPT_APPROVED}</strong>
        </div>
        <div class="status-dist-item">
            <span><span class="badge badge-finance_approved">FINANCE_APPROVED</span> Ready for S/4HANA</span>
            <strong>${counts.FINANCE_APPROVED}</strong>
        </div>
        <div class="status-dist-item">
            <span><span class="badge badge-order_created">ORDER_CREATED</span> S/4HANA PR Synced</span>
            <strong>${counts.ORDER_CREATED}</strong>
        </div>
        <div class="status-dist-item">
            <span><span class="badge badge-rejected">REJECTED</span> Rework Required</span>
            <strong>${counts.REJECTED}</strong>
        </div>
    `;
}

function applyFilters() {
    const search = document.getElementById('globalSearchInput').value.toLowerCase();
    const dept = document.getElementById('filterDepartment').value;
    const status = document.getElementById('filterStatus').value;
    const priority = document.getElementById('filterPriority').value;

    const filtered = AppState.requests.filter(r => {
        const matchesSearch = !search ||
            r.title.toLowerCase().includes(search) ||
            r.department.toLowerCase().includes(search) ||
            r.requestedBy.toLowerCase().includes(search) ||
            (r.s4PrNumber && r.s4PrNumber.toLowerCase().includes(search));

        const matchesDept = dept === 'ALL' || r.department === dept;
        const matchesStatus = status === 'ALL' || r.status === status;
        const matchesPriority = priority === 'ALL' || r.priority === priority;

        return matchesSearch && matchesDept && matchesStatus && matchesPriority;
    });

    renderCapExTable(filtered);
}

function renderCapExTable(requests) {
    const tbody = document.getElementById('capexTableBody');
    tbody.innerHTML = '';

    if (!requests.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">No CapEx requests matching the selected filters.</td></tr>`;
        return;
    }

    requests.forEach(r => {
        const tr = document.createElement('tr');
        tr.onclick = () => openDetailDrawer(r.ID);

        const badgeClass = `badge-${r.status.toLowerCase()}`;
        const riskClass = r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH' ? 'badge-danger' : (r.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-draft');

        tr.innerHTML = `
            <td><span class="badge ${badgeClass}">${r.status}</span></td>
            <td><strong>${r.title}</strong></td>
            <td>${r.department}</td>
            <td><span class="badge badge-draft">${r.priority}</span></td>
            <td><strong>${formatCurrency(r.totalAmount, r.currency)}</strong></td>
            <td><span class="badge ${riskClass}">${r.riskLevel} (${r.riskScore || 0})</span></td>
            <td><span class="text-mono">${r.s4PrNumber || '-'}</span></td>
            <td><button class="sap-btn sap-btn-ghost btn-sm" onclick="event.stopPropagation(); openDetailDrawer('${r.ID}')">View ➔</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// =============================================================================
// OBJECT PAGE / DETAIL DRAWER
// =============================================================================
async function openDetailDrawer(requestId) {
    const req = AppState.requests.find(r => r.ID === requestId);
    if (!req) return;
    AppState.selectedRequest = req;

    document.getElementById('drawerTitle').textContent = req.title;
    document.getElementById('drawerDeptRequester').textContent = `${req.department} · Requested by ${req.requestedBy}`;
    document.getElementById('detailTotalAmount').textContent = formatCurrency(req.totalAmount, req.currency);
    document.getElementById('detailJustification').textContent = req.businessJustification || 'No justification provided.';
    document.getElementById('detailS4Pr').textContent = req.s4PrNumber || 'Not Synced to S/4HANA yet';

    // Status & Risk Badges
    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `badge badge-${req.status.toLowerCase()}`;
    statusBadge.textContent = req.status;

    const riskBadge = document.getElementById('detailRiskBadge');
    const riskClass = req.riskLevel === 'CRITICAL' || req.riskLevel === 'HIGH' ? 'badge-danger' : (req.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-draft');
    riskBadge.className = `badge ${riskClass}`;
    riskBadge.textContent = `${req.riskLevel} (${req.riskScore || 0}/100)`;

    // Render Actions Bar based on current status and user persona
    renderDrawerActions(req);

    // Render Line Items
    renderDrawerItems(req.items || []);

    // Render AI Evaluation Section
    renderDrawerAI(req);

    // Render Audit Trail
    renderDrawerAudit(req.auditTrail || []);

    document.getElementById('requestDetailDrawer').classList.add('open');
}

function closeDetailDrawer() {
    document.getElementById('requestDetailDrawer').classList.remove('open');
    AppState.selectedRequest = null;
}

function renderDrawerActions(req) {
    const container = document.getElementById('drawerActionBar');
    container.innerHTML = '';

    const role = AppState.userRole; // Admin, Manager, Viewer
    const status = req.status;

    // AI Analysis Action (always available)
    const btnAI = document.createElement('button');
    btnAI.className = 'sap-btn sap-btn-ghost btn-sm';
    btnAI.innerHTML = '🤖 Run AI Risk & Anomaly Scan';
    btnAI.onclick = () => triggerAIAnalysis(req.ID);
    container.appendChild(btnAI);

    // Workflow Actions
    if (status === 'DRAFT' || status === 'REJECTED') {
        const btnSubmit = document.createElement('button');
        btnSubmit.className = 'sap-btn sap-btn-primary btn-sm';
        btnSubmit.innerHTML = '📤 Submit for Approval';
        btnSubmit.onclick = () => submitCapExRequest(req.ID);
        container.appendChild(btnSubmit);
    }

    if (status === 'SUBMITTED' && (role === 'Manager' || role === 'Admin')) {
        const btnDeptApprove = document.createElement('button');
        btnDeptApprove.className = 'sap-btn sap-btn-primary btn-sm';
        btnDeptApprove.innerHTML = '✅ Department Approve';
        btnDeptApprove.onclick = () => deptApproveRequest(req.ID);
        container.appendChild(btnDeptApprove);

        const btnReject = document.createElement('button');
        btnReject.className = 'sap-btn sap-btn-danger btn-sm';
        btnReject.innerHTML = '❌ Reject Request';
        btnReject.onclick = () => openRejectModal(req.ID);
        container.appendChild(btnReject);
    }

    if (status === 'DEPT_APPROVED' && role === 'Admin') {
        const btnFinanceApprove = document.createElement('button');
        btnFinanceApprove.className = 'sap-btn sap-btn-primary btn-sm';
        btnFinanceApprove.innerHTML = '🏛️ Finance & Treasury Approve';
        btnFinanceApprove.onclick = () => financeApproveRequest(req.ID);
        container.appendChild(btnFinanceApprove);

        const btnReject = document.createElement('button');
        btnReject.className = 'sap-btn sap-btn-danger btn-sm';
        btnReject.innerHTML = '❌ Reject Request';
        btnReject.onclick = () => openRejectModal(req.ID);
        container.appendChild(btnReject);
    }

    if (status === 'FINANCE_APPROVED' && role === 'Admin') {
        const btnSyncS4 = document.createElement('button');
        btnSyncS4.className = 'sap-btn sap-btn-primary btn-sm';
        btnSyncS4.innerHTML = '🔄 Release to S/4HANA Cloud';
        btnSyncS4.onclick = () => syncWithS4HANA(req.ID);
        container.appendChild(btnSyncS4);
    }
}

function renderDrawerItems(items) {
    const tbody = document.getElementById('detailItemsBody');
    tbody.innerHTML = '';

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No line items specified.</td></tr>`;
        return;
    }

    items.forEach(it => {
        const tr = document.createElement('tr');
        const benchBadge = it.isBenchmarkExceeded
            ? `<span class="badge badge-danger">Exceeds +${it.benchmarkDeviation}%</span>`
            : `<span class="badge badge-finance_approved">In Benchmark</span>`;

        tr.innerHTML = `
            <td>#${it.itemNumber}</td>
            <td><strong>${it.materialDescription}</strong></td>
            <td>${it.category}</td>
            <td>${it.quantity} ${it.unitOfMeasure || 'EA'}</td>
            <td>${formatCurrency(it.unitPrice)}</td>
            <td><strong>${formatCurrency(it.lineTotal || (it.quantity * it.unitPrice))}</strong></td>
            <td>${benchBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDrawerAI(req) {
    const box = document.getElementById('aiEvaluationContent');
    const aiLog = (req.aiEvaluations && req.aiEvaluations.length) ? req.aiEvaluations[0] : null;

    if (!aiLog) {
        box.innerHTML = `<p class="text-muted">No evaluation recorded. Click <strong>"Run AI Risk & Anomaly Scan"</strong> above to inspect with SAP GenAI Hub.</p>`;
        return;
    }

    let anomalies = [];
    try {
        anomalies = JSON.parse(aiLog.detectedAnomalies);
    } catch {
        anomalies = [aiLog.detectedAnomalies];
    }

    box.innerHTML = `
        <div style="margin-bottom: 8px;">
            <strong>${aiLog.modelUsed}</strong> · <span class="badge ${aiLog.riskRating === 'LOW' ? 'badge-finance_approved' : 'badge-danger'}">${aiLog.riskRating} Risk (${aiLog.riskScore}/100)</span>
        </div>
        <p style="margin-bottom: 8px;">${aiLog.executiveSummary}</p>
        <p><strong>Recommendation:</strong> ${aiLog.recommendation}</p>
        <div style="margin-top: 8px; font-size: 12px;">
            <strong>Findings & Anomalies:</strong>
            <ul style="margin-left: 18px; margin-top: 4px;">
                ${anomalies.map(a => `<li>${a}</li>`).join('')}
            </ul>
        </div>
    `;
}

function renderDrawerAudit(trail) {
    const timeline = document.getElementById('detailAuditTimeline');
    timeline.innerHTML = '';

    if (!trail.length) {
        timeline.innerHTML = `<p class="text-muted text-sm">No audit events recorded.</p>`;
        return;
    }

    trail.forEach(event => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-header">
                <span><strong>${event.action}</strong> by ${event.performedBy}</span>
                <span class="text-muted">${formatDate(event.timestamp)}</span>
            </div>
            <div class="timeline-comment">${event.comments || ''}</div>
        `;
        timeline.appendChild(item);
    });
}

// =============================================================================
// WORKFLOW ACTIONS
// =============================================================================
async function submitCapExRequest(id) {
    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/submit`, { method: 'POST', body: '{}' });
        showToast('CapEx proposal successfully submitted for management review!');
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Workflow submission error: ' + err.message);
    }
}

async function deptApproveRequest(id) {
    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/deptApprove`, {
            method: 'POST',
            body: JSON.stringify({ comments: 'Department manager review approved. Budget verified.' })
        });
        showToast('Request department-approved! Forwarded to Finance.');
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Approval error: ' + err.message);
    }
}

async function financeApproveRequest(id) {
    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/financeApprove`, {
            method: 'POST',
            body: JSON.stringify({ comments: 'Central treasury sign-off granted. Ready for S/4HANA release.' })
        });
        showToast('Executive Finance Approval Granted!');
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Finance approval error: ' + err.message);
    }
}

function openRejectModal(id) {
    AppState.rejectionTargetId = id;
    document.getElementById('modalReject').classList.add('open');
}

function closeRejectModal() {
    AppState.rejectionTargetId = null;
    document.getElementById('rejectReasonText').value = '';
    document.getElementById('modalReject').classList.remove('open');
}

async function confirmRejection() {
    const id = AppState.rejectionTargetId;
    const reason = document.getElementById('rejectReasonText').value.trim();
    if (!reason) {
        alert('Please enter a rejection reason.');
        return;
    }

    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/rejectProposal`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        showToast('Proposal rejected and returned to requester with governance comments.');
        closeRejectModal();
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Rejection error: ' + err.message);
    }
}

async function syncWithS4HANA(id) {
    try {
        showToast('Connecting to SAP BTP Destination [S4HANA_CLOUD_DEST]...');
        const res = await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/syncWithS4HANA`, {
            method: 'POST',
            body: '{}'
        });
        showToast(`S/4HANA Sync Success! Purchase Requisition generated.`);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('S/4HANA destination sync error: ' + err.message);
    }
}

async function triggerAIAnalysis(id) {
    try {
        showToast('Invoking SAP AI Core GenAI Hub evaluation...');
        const evalResult = await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/triggerAIAnalysis`, {
            method: 'POST',
            body: '{}'
        });
        showToast(`AI Evaluation complete! Risk Score: ${evalResult.riskRating}`);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('AI Core error: ' + err.message);
    }
}

// =============================================================================
// MODAL: CREATE NEW CAPEX REQUEST
// =============================================================================
function openNewRequestModal() {
    document.getElementById('modalNewRequest').classList.add('open');
}

function closeNewRequestModal() {
    document.getElementById('modalNewRequest').classList.remove('open');
    document.getElementById('newRequestForm').reset();
}

function addModalLineItem() {
    const container = document.getElementById('modalItemsContainer');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'modal-item-row';
    div.dataset.index = index;
    div.innerHTML = `
        <input type="text" class="item-desc" placeholder="Material Description" required value="Enterprise Server Unit">
        <select class="item-cat">
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Facility">Facility</option>
            <option value="Machinery">Machinery</option>
            <option value="Consulting">Consulting</option>
        </select>
        <input type="number" class="item-qty" placeholder="Qty" min="1" value="1" required style="width: 70px;">
        <input type="number" class="item-price" placeholder="Unit Price ($)" min="1" value="15000" required style="width: 120px;">
        <span class="item-total">$15,000.00</span>
        <button type="button" class="sap-btn sap-btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

async function saveNewRequest() {
    const title = document.getElementById('newReqTitle').value.trim();
    const department = document.getElementById('newReqDept').value;
    const priority = document.getElementById('newReqPriority').value;
    const justification = document.getElementById('newReqJustification').value.trim();

    if (!title || !justification) {
        alert('Please fill in all mandatory fields.');
        return;
    }

    const itemRows = document.querySelectorAll('#modalItemsContainer .modal-item-row');
    const items = [];
    itemRows.forEach((row, idx) => {
        const desc = row.querySelector('.item-desc').value.trim();
        const cat = row.querySelector('.item-cat').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 1;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        if (desc && qty && price) {
            items.push({
                itemNumber: (idx + 1) * 10,
                materialDescription: desc,
                category: cat,
                quantity: qty,
                unitPrice: price,
                lineTotal: qty * price
            });
        }
    });

    if (!items.length) {
        alert('Please specify at least one line item.');
        return;
    }

    const totalAmount = items.reduce((sum, it) => sum + it.lineTotal, 0);

    const payload = {
        title,
        department,
        requestedBy: AppState.userRole === 'Admin' ? 'sarah.jenkins@enterprise.corp' : 'user.requester@enterprise.corp',
        priority,
        status: 'DRAFT',
        totalAmount,
        currency: 'USD',
        businessJustification: justification,
        items
    };

    try {
        const created = await odataFetch('/odata/v4/procurement/CapExRequests', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        showToast('CapEx Request successfully saved as Draft!');
        closeNewRequestModal();
        await refreshAllData();
        openDetailDrawer(created.ID);
    } catch (err) {
        alert('Error creating CapEx request: ' + err.message);
    }
}

// =============================================================================
// COPILOT CHAT
// =============================================================================
async function sendCopilotMessage() {
    const input = document.getElementById('copilotInput');
    const prompt = input.value.trim();
    if (!prompt) return;

    input.value = '';
    appendChatMessage('user', prompt);

    // Typing indicator placeholder
    const typingId = appendChatMessage('assistant', 'Thinking and querying BTP procurement knowledge graph...');

    try {
        const res = await odataFetch('/odata/v4/procurement/copilotQuery', {
            method: 'POST',
            body: JSON.stringify({ prompt, requestId: AppState.selectedRequest?.ID || null })
        });

        // Update assistant message
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        let formattedReply = `<p>${res.reply}</p>`;
        if (res.actionRecommended) {
            formattedReply += `<p class="mt-2"><strong>Recommended Action:</strong> ${res.actionRecommended} (Confidence: ${Math.round(res.confidenceScore * 100)}%)</p>`;
        }
        if (res.anomaliesDetected && res.anomaliesDetected.length) {
            formattedReply += `<div class="mt-2"><strong>Anomalies Detected:</strong><ul>${res.anomaliesDetected.map(a => `<li>⚠️ ${a}</li>`).join('')}</ul></div>`;
        }
        if (res.suggestedNextSteps && res.suggestedNextSteps.length) {
            formattedReply += `<div class="mt-2"><strong>Next Steps:</strong><ul>${res.suggestedNextSteps.map(s => `<li>➔ ${s}</li>`).join('')}</ul></div>`;
        }

        appendChatMessage('assistant', formattedReply, true);
    } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        appendChatMessage('assistant', `⚠️ Copilot encountered an error: ${err.message}`);
    }
}

function appendChatMessage(sender, content, isHtml = false) {
    const container = document.getElementById('chatMessages');
    const msgId = 'msg-' + Date.now();
    const div = document.createElement('div');
    div.className = `chat-message ${sender}`;
    div.id = msgId;

    const avatar = sender === 'assistant' ? '🤖' : '👤';
    div.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-bubble">${isHtml ? content : `<p>${content}</p>`}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return msgId;
}

// =============================================================================
// INTEGRATIONS & DESTINATIONS
// =============================================================================
function renderIntegrations() {
    const tbody = document.getElementById('destinationsTableBody');
    const quickGrid = document.getElementById('integrationQuickCards');
    const syncStream = document.getElementById('s4SyncStreamBox');

    tbody.innerHTML = '';
    quickGrid.innerHTML = '';
    syncStream.innerHTML = '';

    AppState.integrations.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${i.systemName}</strong></td>
            <td><code>${i.destinationName}</code></td>
            <td>${i.serviceType} (${i.authType})</td>
            <td><span class="badge badge-finance_approved">${i.status}</span></td>
            <td>${i.latencyMs} ms</td>
            <td><strong>${i.totalSyncedRecords}</strong></td>
            <td>${formatDate(i.lastPing)}</td>
            <td><button class="sap-btn sap-btn-ghost btn-sm" onclick="pingSingleDestination('${i.systemKey}')">Ping</button></td>
        `;
        tbody.appendChild(tr);

        const tile = document.createElement('div');
        tile.className = 'integration-tile';
        tile.innerHTML = `
            <div class="integration-tile-header">
                <span>${i.systemKey}</span>
                <span class="badge badge-finance_approved">${i.status}</span>
            </div>
            <div class="integration-tile-sub">${i.destinationName}</div>
            <div class="integration-metrics">
                <span>Latency: <strong>${i.latencyMs}ms</strong></span>
                <span>Synced: <strong>${i.totalSyncedRecords}</strong></span>
            </div>
        `;
        quickGrid.appendChild(tile);

        if (i.lastSyncMessage) {
            const line = document.createElement('div');
            line.className = 'stream-line';
            line.textContent = `[${formatDate(i.lastPing)}] ${i.systemKey}: ${i.lastSyncMessage}`;
            syncStream.appendChild(line);
        }
    });
}

async function pingSingleDestination(systemKey) {
    try {
        showToast(`Pinging ${systemKey}...`);
        await odataFetch('/odata/v4/procurement/pingDestination', {
            method: 'POST',
            body: JSON.stringify({ systemKey })
        });
        showToast(`${systemKey} responded in healthy state!`);
        await fetchIntegrationsData();
    } catch (err) {
        alert('Ping error: ' + err.message);
    }
}

async function pingAllDestinations() {
    try {
        for (const i of AppState.integrations) {
            await odataFetch('/odata/v4/procurement/pingDestination', {
                method: 'POST',
                body: JSON.stringify({ systemKey: i.systemKey })
            });
        }
        showToast('All 4 SAP BTP Destinations successfully verified!');
        await fetchIntegrationsData();
    } catch (err) {
        alert('Error pinging destinations: ' + err.message);
    }
}

// =============================================================================
// CSV BULK TOOLS
// =============================================================================
let stagedCSVContent = null;

function handleCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Please select a valid .csv file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        stagedCSVContent = e.target.result;
        document.querySelector('.drop-text').textContent = `Loaded: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        document.getElementById('btnProcessCSV').removeAttribute('disabled');
        showToast(`File ${file.name} ready for import processing.`);
    };
    reader.readAsText(file);
}

async function processAndUploadCSV() {
    if (!stagedCSVContent) return;
    const feedbackBox = document.getElementById('csvValidationFeedback');
    feedbackBox.style.display = 'block';
    feedbackBox.innerHTML = '<p class="text-muted">Parsing, validating against schema, and importing...</p>';

    try {
        const result = await odataFetch('/odata/v4/procurement/importCapExCSV', {
            method: 'POST',
            body: JSON.stringify({ csvContent: stagedCSVContent })
        });

        if (result.success) {
            feedbackBox.innerHTML = `
                <div class="badge badge-finance_approved" style="margin-bottom: 6px;">SUCCESS</div>
                <p><strong>${result.message}</strong></p>
                ${result.errors.length ? `<ul class="text-sm mt-2">${result.errors.map(e => `<li>⚠️ ${e}</li>`).join('')}</ul>` : ''}
            `;
            showToast(`Imported ${result.importedCount} CapEx requests!`);
            stagedCSVContent = null;
            document.getElementById('btnProcessCSV').setAttribute('disabled', 'true');
            await refreshAllData();
        } else {
            feedbackBox.innerHTML = `
                <div class="badge badge-danger" style="margin-bottom: 6px;">VALIDATION FAILED</div>
                <p>${result.message}</p>
                <ul class="text-sm mt-2">${result.errors.map(e => `<li>❌ ${e}</li>`).join('')}</ul>
            `;
        }
    } catch (err) {
        feedbackBox.innerHTML = `<p class="badge badge-danger">Upload failed: ${err.message}</p>`;
    }
}

function downloadSampleTemplate() {
    const csvContent = `title,department,requestedBy,priority,businessJustification,materialDescription,category,quantity,unitPrice\n` +
        `"Autonomous Automated Guided Vehicles (AGV)","Operations","marcus.vance@enterprise.corp","HIGH","Warehouse automation initiative","OTTO 1500 Heavy-Duty AGV Platform","Machinery",4,65000\n` +
        `"Autonomous Automated Guided Vehicles (AGV)","Operations","marcus.vance@enterprise.corp","HIGH","Warehouse automation initiative","Fleet Management Supervisory Software","Software",1,25000\n` +
        `"Advanced Enterprise Cyber Defense Suite","IT Infrastructure","chloe.chen@enterprise.corp","CRITICAL","Zero-trust perimeter security deployment","CrowdStrike Falcon Enterprise 3-Year Protection","Software",500,120\n` +
        `"Cleanroom HVAC HEPA Filtration Expansion","Engineering","elena.rostova@enterprise.corp","MEDIUM","ISO Class 5 semiconductor laboratory upgrade","Camfil CamClose High Efficiency Air Filters","Facility",20,1800`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CapEx_Bulk_Import_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================
function showToast(message) {
    let toast = document.getElementById('sapToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sapToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #1C2D42;
            color: #FFFFFF;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            font-size: 13px;
            font-weight: 600;
            z-index: 999;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(20px);
            opacity: 0;
            border-left: 4px solid #0070F2;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3500);
}
