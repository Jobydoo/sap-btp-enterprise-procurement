/**
 * SAP BTP Maroc • Hub Achats, Matériel & Marchés BTP
 * Contrôleur Frontend Fiori Horizon UX avec Support Bilingue (Français 🇲🇦 / English 🌐)
 */

// Application State
const AppState = {
    language: localStorage.getItem('sap_btp_lang') || 'fr',
    userRole: 'Admin', // Admin, Manager, Viewer
    currentTab: 'tab-dashboard',
    requests: [],
    selectedRequest: null,
    metrics: null,
    deptMetrics: [],
    integrations: [],
    rejectionTargetId: null
};

// =============================================================================
// I18N DICTIONARY (FRANÇAIS BTP MAROC / ENGLISH)
// =============================================================================
const i18n = {
    fr: {
        shellProduct: "SAP BTP Maroc • Bâtiment & Travaux Publics",
        shellApp: "Hub Investissements Engins & Chantiers",
        searchPlaceholder: "Rechercher dossiers, matériel, béton, acier, engins...",
        lblPersona: "Rôle BTP :",
        btpConnected: "BTP Connecté",
        kpiTitle1: "Investissements Engagés (MAD)",
        subTotalCapEx: "Montant total des marchés chantiers",
        kpiTitle2: "Taux d'Engagement Budgétaire",
        subBudgetUtil: "Sur 66,0M MAD Alloués (Exercice 2026)",
        kpiTitle3: "Dossiers en Attente de Visa",
        subPending: "Visa Conducteur de Travaux / Direction",
        kpiTitle4: "Alertes Barème LPEE & Risques",
        subHighRisk: "Écart prix unitaire ou anomalie technique",
        kpiTitle5: "Commandes S/4HANA Transmises",
        subS4Sync: "Demandes d'Achat (DA) répliquées",
        tabDashboard: "📊 Tableau de Bord Chantiers",
        tabCapex: "🏗️ Demandes Matériel & Fournitures",
        tabCopilot: "🤖 Assistant IA BTP Maroc",
        tabIntegrations: "🔄 Connecteurs S/4HANA & ERP",
        tabBulk: "📤 Import / Export Données",
        deptBudgetTitle: "Consommation Budgétaire par Pôle de Travaux (Exercice 2026 - MAD)",
        statusBreakdownTitle: "Répartition des Demandes par Statut",
        integrationMonitorTitle: "Supervision des Connexions SAP BTP & Systèmes Chantiers Maroc",
        btnRefresh: "🔄 Actualiser l'État",
        lblFilterDept: "Pôle de Travaux :",
        allDepts: "Tous les Pôles de Travaux",
        lblFilterStatus: "Statut du Dossier :",
        allStatuses: "Tous les Statuts",
        lblFilterPriority: "Priorité Chantier :",
        allPriorities: "Toutes les Priorités",
        btnNewRequest: "➕ Nouvelle Demande Chantier",
        btnExportCsv: "⬇️ Exporter en CSV",
        thStatus: "Statut",
        thTitle: "Désignation du Marché / Matériel",
        thDept: "Pôle de Travaux",
        thPriority: "Priorité",
        thTotal: "Montant (MAD)",
        thRisk: "Indice Risque LPEE",
        thS4: "N° DA S/4HANA",
        thActions: "Actions",
        statusDraft: "Brouillon",
        statusSubmitted: "Soumis pour Visa",
        statusDeptApproved: "Validé Technique",
        statusFinanceApproved: "Visa Financier",
        statusOrderCreated: "Commande S/4HANA",
        statusRejected: "Rejeté",
        btnSubmit: "📤 Soumettre pour Visa Technique",
        btnDeptApprove: "✅ Accorder Visa Conducteur Travaux",
        btnFinanceApprove: "💼 Visa Direction Générale & Financière",
        btnReject: "❌ Rejeter la Proposition",
        btnSyncS4: "🔄 Transmettre Bon de Commande SAP S/4HANA",
        btnRunAi: "🤖 Lancer le Scan IA des Risques & Prix",
        toastPersonaSwitch: "Rôle actif modifié :",
        toastSubmitted: "Dossier transmis au conducteur de travaux avec succès !",
        toastDeptApproved: "Visa technique accordé par le conducteur de travaux !",
        toastFinanceApproved: "Visa financier accordé. Bon pour commande S/4HANA !",
        toastRejected: "Dossier rejeté et retourné au métreur avec réserves.",
        toastS4Synced: "Commande transmise avec succès à SAP S/4HANA (Filiale MA01) !",
        toastAiDone: "Scan IA terminé : Analyse des barèmes LPEE effectuée.",
        toastCsvSuccess: "dossier(s) BTP importé(s) avec succès !"
    },
    en: {
        shellProduct: "SAP BTP • Moroccan Construction & Civil Works",
        shellApp: "CapEx Equipment & Works Procurement Hub",
        searchPlaceholder: "Search requests, materials, concrete, steel, machinery...",
        lblPersona: "BTP Persona:",
        btpConnected: "BTP Connected",
        kpiTitle1: "Committed CapEx (MAD)",
        subTotalCapEx: "Total works contract pipeline value",
        kpiTitle2: "Budget Utilization Rate",
        subBudgetUtil: "Of 66.0M MAD Allocated (FY2026)",
        kpiTitle3: "Pending Governance Queue",
        subPending: "Awaiting Site Mgr / Finance sign-off",
        kpiTitle4: "LPEE Pricing Alerts & Risks",
        subHighRisk: "Unit price variance or technical anomaly",
        kpiTitle5: "S/4HANA Orders Synced",
        subS4Sync: "Purchase Requisitions released",
        tabDashboard: "📊 Executive Analytics",
        tabCapex: "🏗️ CapEx Requests & Workflows",
        tabCopilot: "🤖 Moroccan BTP AI Copilot",
        tabIntegrations: "🔄 S/4HANA & Destinations",
        tabBulk: "📤 Bulk Data Center",
        deptBudgetTitle: "Works Division Budget Allocation & Utilization (FY2026 - MAD)",
        statusBreakdownTitle: "Workflow Status Breakdown",
        integrationMonitorTitle: "SAP BTP Foundation Connectivity & Site Systems Monitor",
        btnRefresh: "🔄 Refresh Status",
        lblFilterDept: "Works Division:",
        allDepts: "All Works Divisions",
        lblFilterStatus: "Workflow Status:",
        allStatuses: "All Statuses",
        lblFilterPriority: "Site Priority:",
        allPriorities: "All Priorities",
        btnNewRequest: "➕ New CapEx Request",
        btnExportCsv: "⬇️ Export to CSV",
        thStatus: "Status",
        thTitle: "Contract Description / Material",
        thDept: "Works Division",
        thPriority: "Priority",
        thTotal: "Total Amount (MAD)",
        thRisk: "LPEE Risk Score",
        thS4: "S/4HANA PR #",
        thActions: "Actions",
        statusDraft: "Draft",
        statusSubmitted: "Submitted",
        statusDeptApproved: "Technical Approved",
        statusFinanceApproved: "Finance Approved",
        statusOrderCreated: "S/4HANA Order Created",
        statusRejected: "Rejected",
        btnSubmit: "📤 Submit for Technical Review",
        btnDeptApprove: "✅ Approve as Site Manager",
        btnFinanceApprove: "💼 Executive Finance Sign-off",
        btnReject: "❌ Reject Proposal",
        btnSyncS4: "🔄 Release Purchase Order to S/4HANA",
        btnRunAi: "🤖 Run AI Risk & LPEE Benchmark Scan",
        toastPersonaSwitch: "Active BTP persona switched to:",
        toastSubmitted: "CapEx proposal submitted for technical review!",
        toastDeptApproved: "Site manager technical approval granted!",
        toastFinanceApproved: "Executive finance approval granted. Ready for S/4HANA!",
        toastRejected: "Proposal rejected with governance comments.",
        toastS4Synced: "Purchase requisition released to SAP S/4HANA (MA01)!",
        toastAiDone: "AI evaluation complete: LPEE benchmark scan finished.",
        toastCsvSuccess: "CapEx request(s) successfully imported!"
    }
};

// Helper: Format Currency in Dirhams (MAD)
function formatCurrency(amount, currency = 'MAD') {
    const val = parseFloat(amount) || 0;
    if (AppState.language === 'en') {
        return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
    }
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

// Helper: Format Date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        const locale = AppState.language === 'fr' ? 'fr-FR' : 'en-US';
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    setupLanguageSelector();
    setupTabNavigation();
    setupPersonaSwitcher();
    setupEventListeners();
    applyLanguageTranslations();
    await refreshAllData();
});

// Setup Language Selector
function setupLanguageSelector() {
    const select = document.getElementById('langSelect');
    if (!select) return;
    select.value = AppState.language;
    select.addEventListener('change', (e) => {
        AppState.language = e.target.value;
        localStorage.setItem('sap_btp_lang', AppState.language);
        applyLanguageTranslations();
        renderKpiBanner(AppState.metrics);
        applyFilters();
        if (AppState.selectedRequest) {
            renderDrawerOverview(AppState.selectedRequest);
            renderDrawerActions(AppState.selectedRequest);
        }
        showToast(AppState.language === 'fr' ? 'Langue changée : Français (Maroc)' : 'Language switched: English');
    });
}

function applyLanguageTranslations() {
    const t = i18n[AppState.language] || i18n.fr;

    // Shellbar
    const txtProduct = document.getElementById('txtShellbarProduct');
    if (txtProduct) txtProduct.textContent = t.shellProduct;
    const txtApp = document.getElementById('txtShellbarApp');
    if (txtApp) txtApp.textContent = t.shellApp;
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.placeholder = t.searchPlaceholder;
    const lblPersona = document.getElementById('lblPersona');
    if (lblPersona) lblPersona.textContent = t.lblPersona;
    const healthText = document.getElementById('healthText');
    if (healthText) healthText.textContent = t.btpConnected;

    // KPI Banner
    const k1 = document.getElementById('kpiTitle1'); if (k1) k1.textContent = t.kpiTitle1;
    const k2 = document.getElementById('kpiTitle2'); if (k2) k2.textContent = t.kpiTitle2;
    const k3 = document.getElementById('kpiTitle3'); if (k3) k3.textContent = t.kpiTitle3;
    const k4 = document.getElementById('kpiTitle4'); if (k4) k4.textContent = t.kpiTitle4;
    const k5 = document.getElementById('kpiTitle5'); if (k5) k5.textContent = t.kpiTitle5;
    const s1 = document.getElementById('subTotalCapEx'); if (s1) s1.textContent = t.subTotalCapEx;
    const s2 = document.getElementById('subBudgetUtil'); if (s2) s2.textContent = t.subBudgetUtil;
    const s3 = document.getElementById('subPending'); if (s3) s3.textContent = t.subPending;
    const s4 = document.getElementById('subHighRisk'); if (s4) s4.textContent = t.subHighRisk;
    const s5 = document.getElementById('subS4Sync'); if (s5) s5.textContent = t.subS4Sync;

    // Tab buttons
    const tBtn1 = document.getElementById('tabBtnDashboard'); if (tBtn1) tBtn1.innerHTML = `<span class="tab-icon">📊</span> ${t.tabDashboard.replace('📊 ', '')}`;
    const tBtn2 = document.getElementById('tabBtnCapex'); if (tBtn2) tBtn2.innerHTML = `<span class="tab-icon">🏗️</span> ${t.tabCapex.replace('🏗️ ', '')}`;
    const tBtn3 = document.getElementById('tabBtnCopilot'); if (tBtn3) tBtn3.innerHTML = `<span class="tab-icon">🤖</span> ${t.tabCopilot.replace('🤖 ', '')}`;
    const tBtn4 = document.getElementById('tabBtnIntegrations'); if (tBtn4) tBtn4.innerHTML = `<span class="tab-icon">🔄</span> ${t.tabIntegrations.replace('🔄 ', '')}`;
    const tBtn5 = document.getElementById('tabBtnBulk'); if (tBtn5) tBtn5.innerHTML = `<span class="tab-icon">📤</span> ${t.tabBulk.replace('📤 ', '')}`;

    // Toolbar
    const bNew = document.getElementById('btnOpenNewRequestModal'); if (bNew) bNew.textContent = t.btnNewRequest;
    const bExp = document.getElementById('btnExportCSV'); if (bExp) bExp.textContent = t.btnExportCsv;

    // Table Headers
    const thS = document.getElementById('thStatus'); if (thS) thS.textContent = t.thStatus;
    const thT = document.getElementById('thTitle'); if (thT) thT.textContent = t.thTitle;
    const thD = document.getElementById('thDept'); if (thD) thD.textContent = t.thDept;
    const thP = document.getElementById('thPriority'); if (thP) thP.textContent = t.thPriority;
    const thTot = document.getElementById('thTotal'); if (thTotal) thTot.textContent = t.thTotal;
    const thR = document.getElementById('thRisk'); if (thR) thR.textContent = t.thRisk;
    const thS4 = document.getElementById('thS4'); if (thS4) thS4.textContent = t.thS4;
    const thA = document.getElementById('thActions'); if (thA) thA.textContent = t.thActions;
}

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
        const t = i18n[AppState.language] || i18n.fr;
        showToast(`${t.toastPersonaSwitch} ${e.target.selectedOptions[0].text}`);
        if (AppState.selectedRequest) {
            renderDrawerActions(AppState.selectedRequest);
        }
        await refreshAllData();
    });
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('globalSearchInput').addEventListener('input', applyFilters);
    document.getElementById('filterDepartment').addEventListener('change', applyFilters);
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('filterPriority').addEventListener('change', applyFilters);

    document.getElementById('btnRefreshIntegrations').addEventListener('click', fetchIntegrationsData);
    document.getElementById('btnPingAllDestinations').addEventListener('click', pingAllDestinations);

    document.getElementById('btnCloseDrawer').addEventListener('click', closeDetailDrawer);

    document.getElementById('btnOpenNewRequestModal').addEventListener('click', openNewRequestModal);
    document.getElementById('btnCloseNewModal').addEventListener('click', closeNewRequestModal);
    document.getElementById('btnCancelNewModal').addEventListener('click', closeNewRequestModal);
    document.getElementById('btnAddModalItem').addEventListener('click', addModalLineItem);
    document.getElementById('btnSaveNewRequest').addEventListener('click', saveNewRequest);

    document.getElementById('btnCloseRejectModal').addEventListener('click', closeRejectModal);
    document.getElementById('btnCancelReject').addEventListener('click', closeRejectModal);
    document.getElementById('btnConfirmReject').addEventListener('click', confirmRejection);

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
                <span><strong>${dept.department}</strong></span>
                <span>${percent}% Engagé (${formatCurrency(dept.totalCommitted)} / ${formatCurrency(dept.totalAllocated)})</span>
            </div>
            <div class="dept-bar-track">
                <div class="dept-bar-fill" style="width: ${percent}%; background-color: ${colorClass};"></div>
            </div>
            <div class="dept-metric-stats">
                <span>Dossiers suivis : <strong>${dept.requestCount || 0}</strong></span>
                <span>Taux de consommation : <strong>${percent}%</strong></span>
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
    container.innerHTML = '';

    const t = i18n[AppState.language] || i18n.fr;
    const statusLabels = {
        DRAFT: t.statusDraft,
        SUBMITTED: t.statusSubmitted,
        DEPT_APPROVED: t.statusDeptApproved,
        FINANCE_APPROVED: t.statusFinanceApproved,
        ORDER_CREATED: t.statusOrderCreated,
        REJECTED: t.statusRejected
    };

    const statusBadges = {
        DRAFT: 'badge-draft',
        SUBMITTED: 'badge-submitted',
        DEPT_APPROVED: 'badge-dept_approved',
        FINANCE_APPROVED: 'badge-finance_approved',
        ORDER_CREATED: 'badge-order_created',
        REJECTED: 'badge-rejected'
    };

    Object.keys(counts).forEach(st => {
        const row = document.createElement('div');
        row.className = 'status-dist-item';
        row.innerHTML = `
            <span class="badge ${statusBadges[st]}">${statusLabels[st]}</span>
            <span class="status-dist-count">${counts[st]}</span>
        `;
        container.appendChild(row);
    });
}

function applyFilters() {
    const search = document.getElementById('globalSearchInput').value.toLowerCase();
    const dept = document.getElementById('filterDepartment').value;
    const status = document.getElementById('filterStatus').value;
    const priority = document.getElementById('filterPriority').value;

    const filtered = AppState.requests.filter(r => {
        const matchesSearch = !search ||
            (r.title && r.title.toLowerCase().includes(search)) ||
            (r.department && r.department.toLowerCase().includes(search)) ||
            (r.s4PrNumber && r.s4PrNumber.toLowerCase().includes(search)) ||
            (r.requestedBy && r.requestedBy.toLowerCase().includes(search));

        const matchesDept = dept === 'ALL' || r.department === dept;
        const matchesStatus = status === 'ALL' || r.status === status;
        const matchesPriority = priority === 'ALL' || r.priority === priority;

        return matchesSearch && matchesDept && matchesStatus && matchesPriority;
    });

    renderRequestsTable(filtered);
}

function renderRequestsTable(records) {
    const tbody = document.getElementById('capexTableBody');
    tbody.innerHTML = '';

    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">Aucun marché ou demande BTP trouvée pour ces critères.</td></tr>`;
        return;
    }

    const t = i18n[AppState.language] || i18n.fr;
    const statusLabels = {
        DRAFT: t.statusDraft,
        SUBMITTED: t.statusSubmitted,
        DEPT_APPROVED: t.statusDeptApproved,
        FINANCE_APPROVED: t.statusFinanceApproved,
        ORDER_CREATED: t.statusOrderCreated,
        REJECTED: t.statusRejected
    };

    records.forEach(r => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                openDetailDrawer(r.ID);
            }
        };

        const statusClass = `badge-${r.status.toLowerCase()}`;
        const riskBadge = getRiskBadge(r.riskScore, r.riskLevel);
        const s4Cell = r.s4PrNumber
            ? `<span class="badge badge-order_created text-mono">${r.s4PrNumber}</span>`
            : `<span class="text-muted">-</span>`;

        tr.innerHTML = `
            <td><span class="badge ${statusClass}">${statusLabels[r.status] || r.status}</span></td>
            <td><strong>${r.title}</strong><div class="text-muted text-sm">${r.requestedBy}</div></td>
            <td>${r.department}</td>
            <td><span class="badge badge-priority-${r.priority.toLowerCase()}">${r.priority}</span></td>
            <td><strong>${formatCurrency(r.totalAmount)}</strong></td>
            <td>${riskBadge}</td>
            <td>${s4Cell}</td>
            <td><button class="sap-btn sap-btn-ghost btn-sm" onclick="openDetailDrawer('${r.ID}')">Ouvrir ➔</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function getRiskBadge(score, level) {
    const s = parseFloat(score) || 15;
    if (s >= 70 || level === 'CRITICAL') return `<span class="badge badge-danger">CRITIQUE (${s})</span>`;
    if (s >= 45 || level === 'HIGH') return `<span class="badge badge-warning">ÉLEVÉ (${s})</span>`;
    if (s >= 25 || level === 'MEDIUM') return `<span class="badge badge-info">MOYEN (${s})</span>`;
    return `<span class="badge badge-finance_approved">FAIBLE (${s})</span>`;
}

// =============================================================================
// DETAIL DRAWER
// =============================================================================
function openDetailDrawer(id) {
    const req = AppState.requests.find(r => r.ID === id);
    if (!req) return;

    AppState.selectedRequest = req;
    renderDrawerOverview(req);
    renderDrawerActions(req);
    renderDrawerItems(req.items || []);
    renderDrawerAI(req);
    renderDrawerAudit(req.auditTrail || []);

    document.getElementById('requestDetailDrawer').classList.add('open');
}

function closeDetailDrawer() {
    document.getElementById('requestDetailDrawer').classList.remove('open');
    AppState.selectedRequest = null;
}

function renderDrawerOverview(req) {
    const t = i18n[AppState.language] || i18n.fr;
    document.getElementById('drawerDeptRequester').textContent = `${req.department} · ${req.requestedBy}`;
    document.getElementById('drawerTitle').textContent = req.title;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `badge badge-${req.status.toLowerCase()}`;
    const statusLabels = {
        DRAFT: t.statusDraft,
        SUBMITTED: t.statusSubmitted,
        DEPT_APPROVED: t.statusDeptApproved,
        FINANCE_APPROVED: t.statusFinanceApproved,
        ORDER_CREATED: t.statusOrderCreated,
        REJECTED: t.statusRejected
    };
    statusBadge.textContent = statusLabels[req.status] || req.status;

    document.getElementById('detailTotalAmount').textContent = formatCurrency(req.totalAmount);

    const riskBadge = document.getElementById('detailRiskBadge');
    riskBadge.innerHTML = getRiskBadge(req.riskScore, req.riskLevel);

    const s4Doc = document.getElementById('detailS4Pr');
    s4Doc.textContent = req.s4PrNumber || '-';

    document.getElementById('detailJustification').textContent = req.businessJustification || '-';
}

function renderDrawerActions(req) {
    const container = document.getElementById('drawerActionBar');
    container.innerHTML = '';

    const t = i18n[AppState.language] || i18n.fr;
    const role = AppState.userRole;
    const status = req.status;

    // AI Evaluation button
    const btnAi = document.createElement('button');
    btnAi.className = 'sap-btn sap-btn-secondary btn-sm';
    btnAi.innerHTML = t.btnRunAi;
    btnAi.onclick = () => triggerAIAnalysis(req.ID);
    container.appendChild(btnAi);

    // Workflow transition buttons according to BTP RBAC
    if (status === 'DRAFT' || status === 'REJECTED') {
        const btnSubmit = document.createElement('button');
        btnSubmit.className = 'sap-btn sap-btn-primary btn-sm';
        btnSubmit.innerHTML = t.btnSubmit;
        btnSubmit.onclick = () => submitCapExRequest(req.ID);
        container.appendChild(btnSubmit);
    }

    if (status === 'SUBMITTED' && (role === 'Manager' || role === 'Admin')) {
        const btnDeptApprove = document.createElement('button');
        btnDeptApprove.className = 'sap-btn sap-btn-primary btn-sm';
        btnDeptApprove.innerHTML = t.btnDeptApprove;
        btnDeptApprove.onclick = () => deptApproveRequest(req.ID);
        container.appendChild(btnDeptApprove);

        const btnReject = document.createElement('button');
        btnReject.className = 'sap-btn sap-btn-danger btn-sm';
        btnReject.innerHTML = t.btnReject;
        btnReject.onclick = () => openRejectModal(req.ID);
        container.appendChild(btnReject);
    }

    if (status === 'DEPT_APPROVED' && role === 'Admin') {
        const btnFinApprove = document.createElement('button');
        btnFinApprove.className = 'sap-btn sap-btn-primary btn-sm';
        btnFinApprove.innerHTML = t.btnFinanceApprove;
        btnFinApprove.onclick = () => financeApproveRequest(req.ID);
        container.appendChild(btnFinApprove);

        const btnReject = document.createElement('button');
        btnReject.className = 'sap-btn sap-btn-danger btn-sm';
        btnReject.innerHTML = t.btnReject;
        btnReject.onclick = () => openRejectModal(req.ID);
        container.appendChild(btnReject);
    }

    if (status === 'FINANCE_APPROVED' && role === 'Admin') {
        const btnSyncS4 = document.createElement('button');
        btnSyncS4.className = 'sap-btn sap-btn-primary btn-sm';
        btnSyncS4.innerHTML = t.btnSyncS4;
        btnSyncS4.onclick = () => syncWithS4HANA(req.ID);
        container.appendChild(btnSyncS4);
    }
}

function renderDrawerItems(items) {
    const tbody = document.getElementById('detailItemsBody');
    tbody.innerHTML = '';

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aucun poste spécifié.</td></tr>`;
        return;
    }

    items.forEach(it => {
        const tr = document.createElement('tr');
        const benchBadge = it.isBenchmarkExceeded
            ? `<span class="badge badge-danger">Surcoût +${it.benchmarkDeviation}%</span>`
            : `<span class="badge badge-finance_approved">Conforme Barème</span>`;

        tr.innerHTML = `
            <td>#${it.itemNumber}</td>
            <td><strong>${it.materialDescription}</strong></td>
            <td>${it.category}</td>
            <td>${it.quantity} ${it.unitOfMeasure || 'U'}</td>
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
        box.innerHTML = `<p class="text-muted">Aucune évaluation enregistrée. Cliquez sur <strong>« Lancer le Scan IA des Risques & Prix »</strong> ci-dessus pour confronter aux barèmes LPEE.</p>`;
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
            <strong>${aiLog.modelUsed}</strong> · <span class="badge ${aiLog.riskRating === 'LOW' ? 'badge-finance_approved' : 'badge-danger'}">Risque ${aiLog.riskRating} (${aiLog.riskScore}/100)</span>
        </div>
        <p style="margin-bottom: 8px;">${aiLog.executiveSummary}</p>
        <p><strong>Recommandation :</strong> ${aiLog.recommendation}</p>
        <div style="margin-top: 8px; font-size: 12px;">
            <strong>Constats & Écarts Détectés :</strong>
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
        timeline.innerHTML = `<p class="text-muted text-sm">Aucun événement d'audit enregistré.</p>`;
        return;
    }

    trail.forEach(event => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-header">
                <span><strong>${event.action}</strong> par ${event.performedBy}</span>
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
        const t = i18n[AppState.language] || i18n.fr;
        showToast(t.toastSubmitted);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur de soumission : ' + err.message);
    }
}

async function deptApproveRequest(id) {
    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/deptApprove`, {
            method: 'POST',
            body: JSON.stringify({ comments: 'Avis favorable du Conducteur de Travaux. Conforme au planning.' })
        });
        const t = i18n[AppState.language] || i18n.fr;
        showToast(t.toastDeptApproved);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur de visa technique : ' + err.message);
    }
}

async function financeApproveRequest(id) {
    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/financeApprove`, {
            method: 'POST',
            body: JSON.stringify({ comments: 'Visa financier Direction Générale accordé. Autorisation S/4HANA.' })
        });
        const t = i18n[AppState.language] || i18n.fr;
        showToast(t.toastFinanceApproved);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur de visa financier : ' + err.message);
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
        alert('Veuillez préciser le motif du rejet.');
        return;
    }

    try {
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/rejectProposal`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        const t = i18n[AppState.language] || i18n.fr;
        showToast(t.toastRejected);
        closeRejectModal();
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur de rejet : ' + err.message);
    }
}

async function syncWithS4HANA(id) {
    try {
        showToast('Connexion à la Destination SAP BTP [S4HANA_CLOUD_DEST] (Maroc MA01)...');
        await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/syncWithS4HANA`, {
            method: 'POST',
            body: '{}'
        });
        const t = i18n[AppState.language] || i18n.fr;
        showToast(t.toastS4Synced);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur de synchronisation S/4HANA : ' + err.message);
    }
}

async function triggerAIAnalysis(id) {
    try {
        showToast('Exécution de l\'analyse SAP AI Core & Barèmes BTP Maroc...');
        const evalResult = await odataFetch(`/odata/v4/procurement/CapExRequests(ID=${id})/triggerAIAnalysis`, {
            method: 'POST',
            body: '{}'
        });
        const t = i18n[AppState.language] || i18n.fr;
        showToast(`${t.toastAiDone} Risque : ${evalResult.riskRating}`);
        await refreshAllData();
        openDetailDrawer(id);
    } catch (err) {
        alert('Erreur SAP AI Core : ' + err.message);
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
        <input type="text" class="item-desc" placeholder="Désignation du poste" required value="Acier Haute Adhérence FeE500 Sonasid">
        <select class="item-cat">
            <option value="Hardware">Matériaux (Béton / Acier / Ciment)</option>
            <option value="Machinery">Engins & Matériel Lourd</option>
            <option value="Facility">Coffrage & Équipement Chantier</option>
            <option value="Consulting">Prestations & Essais LPEE</option>
            <option value="Software">Systèmes & Télématique</option>
        </select>
        <input type="number" class="item-qty" placeholder="Qté" min="1" value="20" required style="width: 70px;">
        <input type="number" class="item-price" placeholder="Prix Unitaire (MAD)" min="1" value="6500" required style="width: 150px;">
        <span class="item-total">130 000,00 MAD</span>
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
        alert('Veuillez renseigner tous les champs obligatoires.');
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
        alert('Veuillez spécifier au moins un poste de fourniture ou matériel.');
        return;
    }

    const totalAmount = items.reduce((sum, it) => sum + it.lineTotal, 0);

    const payload = {
        title,
        department,
        requestedBy: AppState.userRole === 'Admin' ? 'youssef.benjelloun@btp-maroc.ma' : 'amine.elidrissi@btp-maroc.ma',
        priority,
        status: 'DRAFT',
        totalAmount,
        currency: 'MAD',
        businessJustification: justification,
        items
    };

    try {
        const created = await odataFetch('/odata/v4/procurement/CapExRequests', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        showToast('Demande BTP enregistrée avec succès en brouillon !');
        closeNewRequestModal();
        await refreshAllData();
        openDetailDrawer(created.ID);
    } catch (err) {
        alert('Erreur lors de la création de la demande : ' + err.message);
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

    const typingMsg = AppState.language === 'fr'
        ? 'Analyse en cours via le graphe des chantiers SAP BTP Maroc...'
        : 'Thinking and querying BTP procurement knowledge graph...';
    const typingId = appendChatMessage('assistant', typingMsg);

    try {
        const res = await odataFetch('/odata/v4/procurement/copilotQuery', {
            method: 'POST',
            body: JSON.stringify({ prompt, requestId: AppState.selectedRequest?.ID || null })
        });

        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        let formattedReply = `<p>${res.reply}</p>`;
        if (res.actionRecommended) {
            formattedReply += `<p class="mt-2"><strong>Action Recommandée :</strong> ${res.actionRecommended} (Indice de confiance : ${Math.round(res.confidenceScore * 100)}%)</p>`;
        }
        if (res.anomaliesDetected && res.anomaliesDetected.length) {
            formattedReply += `<div class="mt-2"><strong>Anomalies Signalées :</strong><ul>${res.anomaliesDetected.map(a => `<li>⚠️ ${a}</li>`).join('')}</ul></div>`;
        }
        if (res.suggestedNextSteps && res.suggestedNextSteps.length) {
            formattedReply += `<div class="mt-2"><strong>Étapes Suivantes Préconisées :</strong><ul>${res.suggestedNextSteps.map(s => `<li>➔ ${s}</li>`).join('')}</ul></div>`;
        }

        appendChatMessage('assistant', formattedReply, true);
    } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        appendChatMessage('assistant', `⚠️ Erreur Copilot : ${err.message}`);
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
            <td><button class="sap-btn sap-btn-ghost btn-sm" onclick="pingSingleDestination('${i.systemKey}')">Tester</button></td>
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
                <span>Latence : <strong>${i.latencyMs}ms</strong></span>
                <span>Synchronisés : <strong>${i.totalSyncedRecords}</strong></span>
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
        showToast(`Test de connexion vers ${systemKey}...`);
        await odataFetch('/odata/v4/procurement/pingDestination', {
            method: 'POST',
            body: JSON.stringify({ systemKey })
        });
        showToast(`Destination ${systemKey} opérationnelle !`);
        await fetchIntegrationsData();
    } catch (err) {
        alert('Erreur de test destination : ' + err.message);
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
        showToast('Toutes les destinations SAP BTP Maroc sont vérifiées avec succès !');
        await fetchIntegrationsData();
    } catch (err) {
        alert('Erreur lors du test des destinations : ' + err.message);
    }
}

// =============================================================================
// CSV BULK TOOLS
// =============================================================================
let stagedCSVContent = null;

function handleCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Veuillez sélectionner un fichier .csv valide.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        stagedCSVContent = e.target.result;
        document.querySelector('.drop-text').textContent = `Fichier chargé : ${file.name} (${Math.round(file.size / 1024)} Ko)`;
        document.getElementById('btnProcessCSV').removeAttribute('disabled');
        showToast(`Fichier ${file.name} prêt pour l'importation.`);
    };
    reader.readAsText(file);
}

async function processAndUploadCSV() {
    if (!stagedCSVContent) return;
    const feedbackBox = document.getElementById('csvValidationFeedback');
    feedbackBox.style.display = 'block';
    feedbackBox.innerHTML = '<p class="text-muted">Analyse du schéma BTP, contrôle des prix et importation...</p>';

    try {
        const result = await odataFetch('/odata/v4/procurement/importCapExCSV', {
            method: 'POST',
            body: JSON.stringify({ csvContent: stagedCSVContent })
        });

        if (result.success) {
            feedbackBox.innerHTML = `
                <div class="badge badge-finance_approved" style="margin-bottom: 6px;">SUCCÈS</div>
                <p><strong>${result.message}</strong></p>
                ${result.errors.length ? `<ul class="text-sm mt-2">${result.errors.map(e => `<li>⚠️ ${e}</li>`).join('')}</ul>` : ''}
            `;
            const t = i18n[AppState.language] || i18n.fr;
            showToast(`${result.importedCount} ${t.toastCsvSuccess}`);
            stagedCSVContent = null;
            document.getElementById('btnProcessCSV').setAttribute('disabled', 'true');
            await refreshAllData();
        } else {
            feedbackBox.innerHTML = `
                <div class="badge badge-danger" style="margin-bottom: 6px;">ÉCHEC VALIDATION</div>
                <p>${result.message}</p>
                <ul class="text-sm mt-2">${result.errors.map(e => `<li>❌ ${e}</li>`).join('')}</ul>
            `;
        }
    } catch (err) {
        feedbackBox.innerHTML = `<p class="badge badge-danger">Erreur de téléversement : ${err.message}</p>`;
    }
}

function downloadSampleTemplate() {
    const csvContent = `title,department,requestedBy,priority,businessJustification,materialDescription,category,quantity,unitPrice\n` +
        `"Fourniture Acier Sonasid Viaduc TGV","Genie Civil & Ouvrages d'Art","amine.elidrissi@btp-maroc.ma","HIGH","Ferraillage tablier viaduc","Acier FeE500 Sonasid D20","Hardware",80,6500\n` +
        `"Beton Pret a l'Emploi B25 Fondations","Gros Oeuvre & Batiment","youssef.benjelloun@btp-maroc.ma","MEDIUM","Coulage semelles filantes","Beton Pret a l'Emploi LafargeHolcim","Hardware",250,900\n` +
        `"Location Mensuelle Grue a Tour Liebherr","Gros Oeuvre & Batiment","youssef.benjelloun@btp-maroc.ma","HIGH","Levage elements prefabriques","Grue a Tour Liebherr 280 EC-H","Machinery",2,120000`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Modele_Import_Chantiers_BTP_Maroc.csv';
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
