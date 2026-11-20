const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load helper domain modules
const aiService = require('../srv/ai-service');
const s4Connector = require('../srv/s4-connector');
const CSVHandler = require('../srv/csv-handler');

// Global in-memory data store for serverless execution
let dataStore = null;

function loadSeedData(forceReload = false) {
    if (dataStore && !forceReload) return dataStore;

    const dataDir = path.join(__dirname, '..', 'db', 'data');

    const readCSV = (fileName) => {
        const fullPath = path.join(dataDir, fileName);
        if (!fs.existsSync(fullPath)) return [];
        const content = fs.readFileSync(fullPath, 'utf8');
        return CSVHandler.parseCSV(content);
    };

    const rawRequests = readCSV('sap.btp.procurement-CapExRequests.csv');
    const rawItems = readCSV('sap.btp.procurement-CapExItems.csv');
    const rawBudgets = readCSV('sap.btp.procurement-Budgets.csv');
    const rawVendors = readCSV('sap.btp.procurement-Vendors.csv');
    const rawCostCenters = readCSV('sap.btp.procurement-CostCenters.csv');
    const rawAuditLogs = readCSV('sap.btp.procurement-AuditLogs.csv');
    const rawIntegrations = readCSV('sap.btp.procurement-SystemIntegrations.csv');

    dataStore = {
        requests: rawRequests.map(r => ({
            ...r,
            totalAmount: parseFloat(r.totalAmount) || 0,
            riskScore: parseFloat(r.riskScore) || 15.0,
            currency: r.currency || 'MAD',
            isExternalSynced: r.isExternalSynced === 'true' || r.isExternalSynced === true
        })),
        items: rawItems.map(it => ({
            ...it,
            itemNumber: parseInt(it.itemNumber, 10) || 10,
            quantity: parseFloat(it.quantity) || 1,
            unitPrice: parseFloat(it.unitPrice) || 0,
            lineTotal: parseFloat(it.lineTotal) || 0,
            isBenchmarkExceeded: it.isBenchmarkExceeded === 'true' || it.isBenchmarkExceeded === true,
            benchmarkDeviation: parseFloat(it.benchmarkDeviation) || 0
        })),
        budgets: rawBudgets.map(b => ({
            ...b,
            fiscalYear: parseInt(b.fiscalYear, 10) || 2026,
            totalBudget: parseFloat(b.totalBudget) || 0,
            committedAmount: parseFloat(b.committedAmount) || 0,
            spentAmount: parseFloat(b.spentAmount) || 0,
            remainingBudget: parseFloat(b.remainingBudget) || 0,
            currency: b.currency || 'MAD',
            utilizationPercent: parseFloat(b.utilizationPercent) || 0
        })),
        vendors: rawVendors.map(v => ({
            ...v,
            rating: parseFloat(v.rating) || 4.5,
            complianceScore: parseFloat(v.complianceScore) || 95.0,
            isActive: v.isActive === 'true' || v.isActive === true
        })),
        costCenters: rawCostCenters,
        auditLogs: rawAuditLogs.map(a => ({ ...a })),
        aiLogs: [],
        integrations: rawIntegrations.map(int => ({
            ...int,
            latencyMs: parseInt(int.latencyMs, 10) || 25,
            totalSyncedRecords: parseInt(int.totalSyncedRecords, 10) || 0
        }))
    };

    return dataStore;
}

// User Persona Helper - Spécialisé BTP Maroc
function getUserProfile(roleParam) {
    if (roleParam === 'Manager') {
        return {
            id: 'amine.elidrissi@btp-maroc.ma',
            name: 'Amine El Idrissi',
            title: 'Conducteur Principal de Travaux & Chantiers',
            roles: ['ProcurementManager', 'ProcurementViewer'],
            department: 'Génie Civil & Ouvrages d\'Art'
        };
    }
    if (roleParam === 'Viewer') {
        return {
            id: 'fatima.mansouri@btp-maroc.ma',
            name: 'Fatima Zahra Mansouri',
            title: 'Ingénieure Études de Prix & Métreur',
            roles: ['ProcurementViewer'],
            department: 'Terrassement & VRD'
        };
    }
    return {
        id: 'youssef.benjelloun@btp-maroc.ma',
        name: 'Youssef Benjelloun',
        title: 'Directeur des Marchés & Travaux (Admin BTP)',
        roles: ['ProcurementAdmin', 'ProcurementManager', 'ProcurementViewer', 'admin'],
        department: 'Direction Générale BTP Maroc'
    };
}

// Helper: Parse Request Body
function getRequestBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') {
            return resolve(req.body);
        }
        if (typeof req.body === 'string') {
            try {
                return resolve(JSON.parse(req.body));
            } catch {
                return resolve({});
            }
        }
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch {
                resolve({ rawText: data });
            }
        });
    });
}

// Helper: Send JSON Response
function sendJson(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-User-Role, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.end(JSON.stringify(data));
}

// State transition validation
const VALID_TRANSITIONS = {
    'DRAFT': ['SUBMITTED'],
    'SUBMITTED': ['DEPT_APPROVED', 'REJECTED'],
    'DEPT_APPROVED': ['FINANCE_APPROVED', 'REJECTED'],
    'FINANCE_APPROVED': ['ORDER_CREATED'],
    'REJECTED': ['SUBMITTED', 'DRAFT'],
    'ORDER_CREATED': []
};

function canTransition(current, next) {
    const allowed = VALID_TRANSITIONS[current] || [];
    return allowed.includes(next);
}

function logAudit(store, { recordId, action, performedBy, userRole, previousStatus, newStatus, comments }) {
    const entry = {
        ID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        recordId,
        entityName: 'CapExRequests',
        action,
        performedBy: performedBy || 'youssef.benjelloun@btp-maroc.ma',
        userRole: userRole || 'ProcurementAdmin',
        previousStatus: previousStatus || '',
        newStatus: newStatus || '',
        comments: comments || `Action ${action} exécutée avec succès.`,
        ipAddress: '127.0.0.1'
    };
    store.auditLogs.unshift(entry);
    return entry;
}

function updateBudgetCommitment(store, department) {
    const committedReqs = store.requests.filter(r =>
        r.department === department &&
        ['SUBMITTED', 'DEPT_APPROVED', 'FINANCE_APPROVED', 'ORDER_CREATED'].includes(r.status)
    );
    const totalCommitted = committedReqs.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

    const budget = store.budgets.find(b => b.department === department);
    if (budget) {
        const total = parseFloat(budget.totalBudget) || 1;
        const spent = parseFloat(budget.spentAmount) || 0;
        budget.committedAmount = totalCommitted;
        budget.remainingBudget = total - (totalCommitted + spent);
        budget.utilizationPercent = Math.min(100, Math.round(((totalCommitted + spent) / total) * 10000) / 100);
    }
}

// Main Vercel Serverless Handler
module.exports = async (req, res) => {
    // Enable CORS preflight
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-User-Role, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        return res.end();
    }

    const store = loadSeedData();
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const roleHeader = req.headers['x-user-role'] || parsedUrl.searchParams.get('userRole') || 'Admin';
    const currentUser = getUserProfile(roleHeader);

    try {
        // =========================================================================
        // REST ENDPOINTS: Health & Current User & CSV Export
        // =========================================================================
        if (pathname === '/api/health') {
            return sendJson(res, 200, {
                status: 'HEALTHY',
                framework: 'SAP Cloud Application Programming Model (CAP) - BTP Maroc',
                version: '10.2.2',
                nodeVersion: process.version,
                database: 'sqlite',
                uptimeSeconds: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
                checks: {
                    persistence: 'UP',
                    xsuaa: 'MOCK_RBAC_ACTIVE',
                    destinations: 'CONFIGURED'
                }
            });
        }

        if (pathname === '/api/current-user') {
            return sendJson(res, 200, {
                user: currentUser
            });
        }

        if (pathname === '/api/export-csv') {
            const csvText = CSVHandler.exportToCSV(store.requests, store.items);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="SAP_BTP_Maroc_Chantiers_${new Date().toISOString().split('T')[0]}.csv"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(csvText);
        }

        // =========================================================================
        // ODATA V4: Executive Analytics & Integrations
        // =========================================================================
        if (pathname === '/odata/v4/procurement/getExecutiveMetrics()' || pathname === '/odata/v4/procurement/getExecutiveMetrics') {
            const committedStatuses = ['SUBMITTED', 'DEPT_APPROVED', 'FINANCE_APPROVED', 'ORDER_CREATED'];
            const committedRequests = store.requests.filter(r => committedStatuses.includes(r.status));
            const totalCommittedCapEx = committedRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
            const totalBudgetAllocated = store.budgets.reduce((sum, b) => sum + (parseFloat(b.totalBudget) || 0), 0);
            const overallBudgetUtilization = totalBudgetAllocated > 0
                ? Math.round((totalCommittedCapEx / totalBudgetAllocated) * 10000) / 100
                : 0;

            const pendingApprovalsCount = store.requests.filter(r => ['SUBMITTED', 'DEPT_APPROVED'].includes(r.status)).length;
            const highRiskRequestsCount = store.requests.filter(r => (parseFloat(r.riskScore) >= 50) || ['HIGH', 'CRITICAL'].includes(r.riskLevel)).length;
            const s4SyncedCount = store.requests.filter(r => r.isExternalSynced || r.status === 'ORDER_CREATED').length;

            return sendJson(res, 200, {
                totalCommittedCapEx,
                totalBudgetAllocated,
                overallBudgetUtilization,
                pendingApprovalsCount,
                highRiskRequestsCount,
                s4SyncedCount,
                currency: 'MAD'
            });
        }

        if (pathname === '/odata/v4/procurement/getDepartmentAnalytics()' || pathname === '/odata/v4/procurement/getDepartmentAnalytics') {
            const analytics = store.budgets.map(b => {
                const deptRequests = store.requests.filter(r => r.department === b.department);
                const committedReqs = deptRequests.filter(r => ['SUBMITTED', 'DEPT_APPROVED', 'FINANCE_APPROVED', 'ORDER_CREATED'].includes(r.status));
                const totalCommitted = committedReqs.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
                const totalAllocated = parseFloat(b.totalBudget) || 1;
                const utilizationRate = Math.min(100, Math.round((totalCommitted / totalAllocated) * 10000) / 100);

                return {
                    department: b.department,
                    totalAllocated,
                    totalCommitted,
                    utilizationRate,
                    requestCount: deptRequests.length
                };
            });

            return sendJson(res, 200, { value: analytics });
        }

        if (pathname === '/odata/v4/procurement/SystemIntegrations') {
            return sendJson(res, 200, { value: store.integrations });
        }

        if (pathname === '/odata/v4/procurement/pingDestination' && req.method === 'POST') {
            const body = await getRequestBody(req);
            const systemKey = body.systemKey || 'S4HANA_CLOUD';
            const pingResult = await s4Connector.pingDestination(systemKey);

            const intg = store.integrations.find(i => i.systemKey === systemKey);
            if (intg) {
                intg.status = pingResult.status;
                intg.latencyMs = pingResult.latencyMs;
                intg.lastPing = pingResult.lastPing;
            }

            return sendJson(res, 200, pingResult);
        }

        if (pathname === '/odata/v4/procurement/copilotQuery' && req.method === 'POST') {
            const body = await getRequestBody(req);
            const prompt = body.prompt || '';
            const replyObj = await aiService.answerCopilotQuery(prompt, {
                requests: store.requests,
                budgets: store.budgets,
                vendors: store.vendors
            });
            return sendJson(res, 200, replyObj);
        }

        if (pathname === '/odata/v4/procurement/importCapExCSV' && req.method === 'POST') {
            const body = await getRequestBody(req);
            const csvContent = body.csvContent || '';
            const rows = CSVHandler.parseCSV(csvContent);

            if (!rows.length) {
                return sendJson(res, 400, {
                    error: { message: 'Le fichier CSV est vide ou le format d\'en-tête est incorrect.' }
                });
            }

            let importedCount = 0;
            const requestGroups = new Map();

            rows.forEach((row) => {
                const title = row.title || row.Title;
                const department = row.department || row.Department;
                const requestedBy = row.requestedBy || row.RequestedBy || currentUser.name;
                const priority = (row.priority || row.Priority || 'MEDIUM').toUpperCase();
                const justification = row.businessJustification || row.Justification || 'Importation lot BTP via fichier CSV';
                const description = row.materialDescription || row.Description || row.ItemDescription || 'Fourniture / Matériel Chantier';
                const category = row.category || row.Category || 'Hardware';
                const quantity = parseFloat(row.quantity || row.Quantity || 1);
                const unitPrice = parseFloat(row.unitPrice || row.UnitPrice || 0);

                if (!title || !department) return;

                const groupKey = `${title}__${department}`;
                if (!requestGroups.has(groupKey)) {
                    requestGroups.set(groupKey, {
                        title,
                        department,
                        requestedBy,
                        priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'MEDIUM',
                        businessJustification: justification,
                        items: []
                    });
                }

                requestGroups.get(groupKey).items.push({
                    materialDescription: description,
                    category,
                    quantity,
                    unitPrice,
                    lineTotal: quantity * unitPrice
                });
            });

            for (const group of requestGroups.values()) {
                const reqId = crypto.randomUUID();
                const totalAmount = group.items.reduce((sum, it) => sum + it.lineTotal, 0);

                const newReq = {
                    ID: reqId,
                    title: group.title,
                    description: `Demande de matériel BTP importée par lot comportant ${group.items.length} poste(s).`,
                    department: group.department,
                    requestedBy: group.requestedBy,
                    totalAmount,
                    currency: 'MAD',
                    priority: group.priority,
                    status: 'DRAFT',
                    riskScore: 20.0,
                    riskLevel: 'LOW',
                    businessJustification: group.businessJustification,
                    isExternalSynced: false,
                    submissionDate: null,
                    approvalDate: null,
                    rejectionReason: null,
                    s4PrNumber: null
                };

                store.requests.unshift(newReq);

                group.items.forEach((it, idx) => {
                    store.items.push({
                        ID: crypto.randomUUID(),
                        request_ID: reqId,
                        itemNumber: (idx + 1) * 10,
                        materialDescription: it.materialDescription,
                        category: it.category,
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                        lineTotal: it.lineTotal,
                        unitOfMeasure: 'U',
                        targetVendor_ID: store.vendors[0]?.ID,
                        costCenter_ID: store.costCenters[0]?.ID,
                        deliveryDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
                        isBenchmarkExceeded: false,
                        benchmarkDeviation: 0.00
                    });
                });

                logAudit(store, {
                    recordId: reqId,
                    action: 'CSV_IMPORT',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: '',
                    newStatus: 'DRAFT',
                    comments: `Demande BTP importée par lot avec ${group.items.length} poste(s).`
                });

                importedCount++;
            }

            return sendJson(res, 200, {
                success: true,
                importedCount,
                message: `Importation réussie de ${importedCount} dossier(s) BTP avec postes associés.`,
                errors: []
            });
        }

        // =========================================================================
        // ODATA V4: CapExRequests Actions & CRUD
        // =========================================================================
        const actionMatch = pathname.match(/\/odata\/v4\/procurement\/CapExRequests\((?:ID=)?([a-f0-9\-]+)\)\/([a-zA-Z0-9]+)/);
        if (actionMatch && req.method === 'POST') {
            const reqId = actionMatch[1];
            const action = actionMatch[2];
            const body = await getRequestBody(req);

            const request = store.requests.find(r => r.ID === reqId);
            if (!request) {
                return sendJson(res, 404, { error: { message: `Demande BTP ${reqId} introuvable.` } });
            }

            const reqItems = store.items.filter(it => it.request_ID === reqId);

            if (action === 'submit') {
                if (!canTransition(request.status, 'SUBMITTED')) {
                    return sendJson(res, 400, { error: { message: `Impossible de soumettre une demande en statut '${request.status}'. Seuls les statuts BROUILLON ou REJETÉ sont autorisés.` } });
                }
                const prevStatus = request.status;
                request.status = 'SUBMITTED';
                request.submissionDate = new Date().toISOString();
                request.rejectionReason = null;

                logAudit(store, {
                    recordId: reqId,
                    action: 'SUBMIT',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: prevStatus,
                    newStatus: 'SUBMITTED',
                    comments: 'Demande transmise au conducteur principal de travaux pour visa technique.'
                });

                updateBudgetCommitment(store, request.department);
                return sendJson(res, 200, request);
            }

            if (action === 'deptApprove') {
                if (!canTransition(request.status, 'DEPT_APPROVED')) {
                    return sendJson(res, 400, { error: { message: `Impossible de valider techniquement la demande en statut '${request.status}'. Le statut doit être SOUMIS.` } });
                }
                const prevStatus = request.status;
                request.status = 'DEPT_APPROVED';

                logAudit(store, {
                    recordId: reqId,
                    action: 'DEPT_APPROVE',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: prevStatus,
                    newStatus: 'DEPT_APPROVED',
                    comments: body.comments || 'Visa technique accordé par le Conducteur de Travaux. Conforme au planning.'
                });

                return sendJson(res, 200, request);
            }

            if (action === 'financeApprove') {
                if (!canTransition(request.status, 'FINANCE_APPROVED')) {
                    return sendJson(res, 400, { error: { message: `Impossible d'accorder le visa financier en statut '${request.status}'. Le statut doit être VALIDÉ DIRECTION TECHNIQUE.` } });
                }
                const prevStatus = request.status;
                request.status = 'FINANCE_APPROVED';
                request.approvalDate = new Date().toISOString();

                logAudit(store, {
                    recordId: reqId,
                    action: 'FINANCE_APPROVE',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: prevStatus,
                    newStatus: 'FINANCE_APPROVED',
                    comments: body.comments || 'Visa financier Direction Générale accordé. Autorisation de bon de commande S/4HANA.'
                });

                return sendJson(res, 200, request);
            }

            if (action === 'rejectProposal') {
                if (!canTransition(request.status, 'REJECTED')) {
                    return sendJson(res, 400, { error: { message: `Impossible de rejeter la demande en statut '${request.status}'.` } });
                }
                const reason = body.reason || 'Dépassement de barème LPEE ou budget insuffisant.';
                const prevStatus = request.status;
                request.status = 'REJECTED';
                request.rejectionReason = reason;

                logAudit(store, {
                    recordId: reqId,
                    action: 'REJECT',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: prevStatus,
                    newStatus: 'REJECTED',
                    comments: `Demande rejetée : ${reason}`
                });

                updateBudgetCommitment(store, request.department);
                return sendJson(res, 200, request);
            }

            if (action === 'syncWithS4HANA') {
                if (request.status !== 'FINANCE_APPROVED') {
                    return sendJson(res, 400, { error: { message: `Impossible de synchroniser avec S/4HANA en statut '${request.status}'. Le visa FINANCE_APPROVED est requis.` } });
                }
                const s4Result = await s4Connector.createPurchaseRequisition(request, reqItems);
                request.status = 'ORDER_CREATED';
                request.s4PrNumber = s4Result.s4PrNumber;
                request.isExternalSynced = true;

                logAudit(store, {
                    recordId: reqId,
                    action: 'SYNC_S4',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: 'FINANCE_APPROVED',
                    newStatus: 'ORDER_CREATED',
                    comments: `Demande d'achat transmise à SAP S/4HANA Cloud (Filiale MA01). N° DA généré : ${s4Result.s4PrNumber}.`
                });

                const intg = store.integrations.find(i => i.systemKey === 'S4HANA_CLOUD');
                if (intg) {
                    intg.totalSyncedRecords = (intg.totalSyncedRecords || 0) + 1;
                    intg.lastPing = new Date().toISOString();
                }

                return sendJson(res, 200, request);
            }

            if (action === 'triggerAIAnalysis') {
                const budget = store.budgets.find(b => b.department === request.department);
                const vendor = store.vendors[0];
                const evalResult = aiService.evaluateRisk(request, reqItems, budget, vendor);

                store.aiLogs.push({ ...evalResult, request_ID: reqId });
                request.riskScore = evalResult.riskScore;
                request.riskLevel = evalResult.riskRating;

                logAudit(store, {
                    recordId: reqId,
                    action: 'AI_ANALYSIS',
                    performedBy: 'SAP AI Core Orchestration (Copilot BTP)',
                    userRole: 'SystemAgent',
                    previousStatus: request.status,
                    newStatus: request.status,
                    comments: `Évaluation GenAI Hub terminée. Score de risque chantier : ${evalResult.riskScore} (${evalResult.riskRating}).`
                });

                return sendJson(res, 200, evalResult);
            }
        }

        // Match Single Request: /CapExRequests(ID=...) or /CapExRequests(...)
        const singleMatch = pathname.match(/\/odata\/v4\/procurement\/CapExRequests\((?:ID=)?([a-f0-9\-]+)\)/);
        if (singleMatch && req.method === 'GET') {
            const reqId = singleMatch[1];
            const request = store.requests.find(r => r.ID === reqId);
            if (!request) {
                return sendJson(res, 404, { error: { message: `Demande BTP ${reqId} introuvable.` } });
            }
            const copy = { ...request };
            copy.items = store.items.filter(it => it.request_ID === reqId);
            copy.auditTrail = store.auditLogs.filter(a => a.recordId === reqId);
            copy.aiEvaluations = store.aiLogs.filter(ai => ai.request_ID === reqId);
            return sendJson(res, 200, copy);
        }

        // Match CapExRequests Collection
        if (pathname === '/odata/v4/procurement/CapExRequests') {
            if (req.method === 'GET') {
                const top = parseInt(parsedUrl.searchParams.get('$top'), 10);
                let list = store.requests.map(r => {
                    const copy = { ...r };
                    copy.items = store.items.filter(it => it.request_ID === r.ID);
                    copy.auditTrail = store.auditLogs.filter(a => a.recordId === r.ID);
                    copy.aiEvaluations = store.aiLogs.filter(ai => ai.request_ID === r.ID);
                    return copy;
                });

                if (!isNaN(top) && top > 0) {
                    list = list.slice(0, top);
                }

                return sendJson(res, 200, { value: list });
            }

            if (req.method === 'POST') {
                const body = await getRequestBody(req);
                const newId = body.ID || crypto.randomUUID();
                const items = Array.isArray(body.items) ? body.items : [];

                const calculatedTotal = items.length > 0
                    ? items.reduce((sum, it) => sum + ((parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0)), 0)
                    : (parseFloat(body.totalAmount) || 0);

                const newRequest = {
                    ID: newId,
                    title: body.title || 'Nouvelle Demande Matériel BTP',
                    description: body.description || '',
                    department: body.department || 'Gros Oeuvre & Batiment',
                    requestedBy: body.requestedBy || currentUser.name,
                    totalAmount: calculatedTotal,
                    currency: body.currency || 'MAD',
                    priority: body.priority || 'MEDIUM',
                    status: body.status || 'DRAFT',
                    submissionDate: body.status === 'SUBMITTED' ? new Date().toISOString() : null,
                    approvalDate: null,
                    rejectionReason: null,
                    riskScore: parseFloat(body.riskScore) || 15.00,
                    riskLevel: body.riskLevel || 'LOW',
                    businessJustification: body.businessJustification || '',
                    s4PrNumber: null,
                    isExternalSynced: false
                };

                store.requests.unshift(newRequest);

                items.forEach((it, idx) => {
                    const qty = parseFloat(it.quantity) || 1;
                    const price = parseFloat(it.unitPrice) || 0;
                    store.items.push({
                        ID: crypto.randomUUID(),
                        request_ID: newId,
                        itemNumber: it.itemNumber || (idx + 1) * 10,
                        materialDescription: it.materialDescription || 'Fourniture BTP',
                        category: it.category || 'Hardware',
                        quantity: qty,
                        unitPrice: price,
                        lineTotal: Math.round(qty * price * 100) / 100,
                        unitOfMeasure: it.unitOfMeasure || 'U',
                        targetVendor_ID: it.targetVendor_ID || store.vendors[0]?.ID,
                        costCenter_ID: it.costCenter_ID || store.costCenters[0]?.ID,
                        deliveryDate: it.deliveryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                        isBenchmarkExceeded: false,
                        benchmarkDeviation: 0.00
                    });
                });

                logAudit(store, {
                    recordId: newId,
                    action: 'CREATE',
                    performedBy: currentUser.id,
                    userRole: currentUser.roles[0],
                    previousStatus: '',
                    newStatus: newRequest.status,
                    comments: `Création demande BTP '${newRequest.title}' sur le pôle ${newRequest.department}.`
                });

                const createdCopy = { ...newRequest };
                createdCopy.items = store.items.filter(it => it.request_ID === newId);
                return sendJson(res, 201, createdCopy);
            }
        }

        // Fallback: 404 Not Found
        sendJson(res, 404, { error: { message: `Route ${pathname} introuvable.` } });
    } catch (err) {
        console.error('[API Router Error]', err);
        sendJson(res, 500, { error: { message: 'Erreur Serveur Interne : ' + err.message } });
    }
};
