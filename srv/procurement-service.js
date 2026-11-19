const cds = require('@sap/cds');
const crypto = require('crypto');
const WorkflowEngine = require('./workflow-engine');
const s4Connector = require('./s4-connector');
const aiService = require('./ai-service');
const CSVHandler = require('./csv-handler');

module.exports = cds.service.impl(async function () {
    const {
        CapExRequests,
        CapExItems,
        Budgets,
        Vendors,
        CostCenters,
        AuditLogs,
        AIAnalysisLog,
        SystemIntegrations
    } = this.entities;

    const workflow = new WorkflowEngine(this.entities);

    // =========================================================================
    // ITEM LIFECYCLE HANDLERS: Calculations & Benchmark Checks
    // =========================================================================
    this.before(['CREATE', 'UPDATE'], CapExItems, async (req) => {
        const item = req.data;
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        item.lineTotal = Math.round(qty * price * 100) / 100;

        const benchmarks = {
            Hardware: 60000,
            Consulting: 2200,
            Machinery: 4000,
            Software: 1800,
            Facility: 80000,
            CloudServices: 50000
        };

        const standardBench = benchmarks[item.category] || 50000;
        if (price > standardBench) {
            item.isBenchmarkExceeded = true;
            item.benchmarkDeviation = Math.round(((price - standardBench) / standardBench) * 10000) / 100;
        } else {
            item.isBenchmarkExceeded = false;
            item.benchmarkDeviation = 0.00;
        }
    });

    this.after(['CREATE', 'UPDATE', 'DELETE'], CapExItems, async (data, req) => {
        const requestId = req.data?.request_ID || data?.request_ID;
        if (!requestId) return;

        const tx = cds.tx(req);
        const items = await tx.run(SELECT.from(CapExItems).where({ request_ID: requestId }));
        const newTotal = items.reduce((sum, it) => sum + (parseFloat(it.lineTotal) || 0), 0);

        await tx.run(
            UPDATE(CapExRequests)
                .set({ totalAmount: newTotal })
                .where({ ID: requestId })
        );
    });

    // =========================================================================
    // CAPEX REQUEST LIFECYCLE HANDLERS
    // =========================================================================
    this.before('CREATE', CapExRequests, async (req) => {
        const r = req.data;
        if (!r.status) r.status = 'DRAFT';
        if (!r.currency) r.currency = 'USD';
        if (!r.priority) r.priority = 'MEDIUM';
        if (!r.riskLevel) r.riskLevel = 'LOW';
        if (!r.riskScore) r.riskScore = 15.00;
    });

    this.after('CREATE', CapExRequests, async (data, req) => {
        const tx = cds.tx(req);
        const user = req.user?.id || 'enterprise.user@corp.local';
        const role = (req.user?.roles && req.user.roles[0]) || 'ProcurementViewer';

        await workflow.logAuditEvent(tx, {
            recordId: data.ID,
            action: 'CREATE',
            performedBy: user,
            userRole: role,
            previousStatus: '',
            newStatus: data.status,
            comments: `Created CapEx Request '${data.title}' in department ${data.department}.`
        });
    });

    // =========================================================================
    // WORKFLOW ACTIONS: Submit, Dept Approve, Finance Approve, Reject
    // =========================================================================
    this.on('submit', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        if (!WorkflowEngine.canTransition(request.status, 'SUBMITTED')) {
            return req.error(400, `Cannot submit request in status '${request.status}'. Only DRAFT or REJECTED can be submitted.`);
        }

        const now = new Date().toISOString();
        await tx.run(
            UPDATE(CapExRequests)
                .set({
                    status: 'SUBMITTED',
                    submissionDate: now,
                    rejectionReason: null
                })
                .where({ ID: requestId })
        );

        const user = req.user?.id || 'elena.rostova@enterprise.corp';
        const role = (req.user?.roles && req.user.roles[0]) || 'ProcurementViewer';

        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'SUBMIT',
            performedBy: user,
            userRole: role,
            previousStatus: request.status,
            newStatus: 'SUBMITTED',
            comments: 'Request submitted for department management review.'
        });

        await workflow.updateBudgetCommitment(tx, request.department, 2026);

        return await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
    });

    this.on('deptApprove', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const comments = req.data?.comments || 'Department manager review completed. Approved within budget.';
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        if (!WorkflowEngine.canTransition(request.status, 'DEPT_APPROVED')) {
            return req.error(400, `Cannot department-approve request in status '${request.status}'. Current status must be SUBMITTED.`);
        }

        await tx.run(
            UPDATE(CapExRequests)
                .set({ status: 'DEPT_APPROVED' })
                .where({ ID: requestId })
        );

        const user = req.user?.id || 'alex.rivera@enterprise.corp';
        const role = (req.user?.roles && req.user.roles[0]) || 'ProcurementManager';

        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'DEPT_APPROVE',
            performedBy: user,
            userRole: role,
            previousStatus: request.status,
            newStatus: 'DEPT_APPROVED',
            comments
        });

        return await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
    });

    this.on('financeApprove', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const comments = req.data?.comments || 'Treasury & Executive CapEx Committee sign-off granted. Ready for S/4HANA release.';
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        if (!WorkflowEngine.canTransition(request.status, 'FINANCE_APPROVED')) {
            return req.error(400, `Cannot finance-approve request in status '${request.status}'. Current status must be DEPT_APPROVED.`);
        }

        const now = new Date().toISOString();
        await tx.run(
            UPDATE(CapExRequests)
                .set({
                    status: 'FINANCE_APPROVED',
                    approvalDate: now
                })
                .where({ ID: requestId })
        );

        const user = req.user?.id || 'sarah.jenkins@enterprise.corp';
        const role = (req.user?.roles && req.user.roles[0]) || 'ProcurementAdmin';

        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'FINANCE_APPROVE',
            performedBy: user,
            userRole: role,
            previousStatus: request.status,
            newStatus: 'FINANCE_APPROVED',
            comments
        });

        return await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
    });

    this.on('rejectProposal', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const reason = req.data?.reason || 'Proposal rejected by governance committee. Please review line items and comments.';
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        if (!WorkflowEngine.canTransition(request.status, 'REJECTED')) {
            return req.error(400, `Cannot reject request in status '${request.status}'. Only SUBMITTED or DEPT_APPROVED can be rejected.`);
        }

        await tx.run(
            UPDATE(CapExRequests)
                .set({
                    status: 'REJECTED',
                    rejectionReason: reason
                })
                .where({ ID: requestId })
        );

        const user = req.user?.id || 'sarah.jenkins@enterprise.corp';
        const role = (req.user?.roles && req.user.roles[0]) || 'ProcurementAdmin';

        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'REJECT',
            performedBy: user,
            userRole: role,
            previousStatus: request.status,
            newStatus: 'REJECTED',
            comments: `Rejection rationale: ${reason}`
        });

        await workflow.updateBudgetCommitment(tx, request.department, 2026);

        return await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
    });

    // =========================================================================
    // EXTERNAL S/4HANA DESTINATION SYNC ACTION
    // =========================================================================
    this.on('syncWithS4HANA', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        if (request.status !== 'FINANCE_APPROVED') {
            return req.error(400, `Only requests in 'FINANCE_APPROVED' status can be released to S/4HANA Cloud.`);
        }

        const items = await tx.run(SELECT.from(CapExItems).where({ request_ID: requestId }));
        const s4Result = await s4Connector.createPurchaseRequisition(request, items);

        await tx.run(
            UPDATE(CapExRequests)
                .set({
                    status: 'ORDER_CREATED',
                    s4PrNumber: s4Result.s4PrNumber,
                    isExternalSynced: true
                })
                .where({ ID: requestId })
        );

        const user = req.user?.id || 'system.btp.worker';
        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'SYNC_S4',
            performedBy: user,
            userRole: 'ProcurementAdmin',
            previousStatus: 'FINANCE_APPROVED',
            newStatus: 'ORDER_CREATED',
            comments: `Generated S/4HANA Purchase Requisition #${s4Result.s4PrNumber} via Destination [S4HANA_CLOUD_DEST].`
        });

        await tx.run(
            UPDATE(SystemIntegrations)
                .set({
                    totalSyncedRecords: { '+=': 1 },
                    lastPing: new Date().toISOString(),
                    lastSyncMessage: `PR #${s4Result.s4PrNumber} successfully committed to S/4HANA Cloud OData endpoint.`
                })
                .where({ systemKey: 'S4HANA_CLOUD' })
        );

        return await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
    });

    // =========================================================================
    // SAP AI CORE / GENAI HUB ANALYSIS ACTION
    // =========================================================================
    this.on('triggerAIAnalysis', CapExRequests, async (req) => {
        const requestId = req.params[0]?.ID || req.params[0] || req.data?.ID;
        const tx = cds.tx(req);

        const request = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        if (!request) return req.error(404, `CapEx Request ${requestId} not found.`);

        const items = await tx.run(SELECT.from(CapExItems).where({ request_ID: requestId }));
        const budget = await tx.run(SELECT.one.from(Budgets).where({ department: request.department, fiscalYear: 2026 }));
        
        let vendor = null;
        if (items.length && items[0].targetVendor_ID) {
            vendor = await tx.run(SELECT.one.from(Vendors).where({ ID: items[0].targetVendor_ID }));
        }

        const evaluation = aiService.evaluateRisk(request, items, budget, vendor);
        evaluation.request_ID = requestId;

        await tx.run(INSERT.into(AIAnalysisLog).entries(evaluation));

        await tx.run(
            UPDATE(CapExRequests)
                .set({
                    riskScore: evaluation.riskScore,
                    riskLevel: evaluation.riskRating
                })
                .where({ ID: requestId })
        );

        await workflow.logAuditEvent(tx, {
            recordId: requestId,
            action: 'AI_EVALUATE',
            performedBy: 'SAP AI Core Agent',
            userRole: 'SystemAgent',
            previousStatus: request.status,
            newStatus: request.status,
            comments: `Evaluated portfolio risk: ${evaluation.riskRating} (${evaluation.riskScore}/100). Model: ${evaluation.modelUsed}`
        });

        return evaluation;
    });

    // =========================================================================
    // EXECUTIVE METRICS & ANALYTICS FUNCTIONS
    // =========================================================================
    this.on('getExecutiveMetrics', async (req) => {
        const tx = cds.tx(req);
        const requests = await tx.run(SELECT.from(CapExRequests));
        const budgets = await tx.run(SELECT.from(Budgets).where({ fiscalYear: 2026 }));
        const integrations = await tx.run(SELECT.from(SystemIntegrations));

        const totalBudgetAllocated = budgets.reduce((sum, b) => sum + (parseFloat(b.totalBudget) || 0), 0);
        const totalCommittedCapEx = requests
            .filter(r => ['SUBMITTED', 'DEPT_APPROVED', 'FINANCE_APPROVED', 'ORDER_CREATED'].includes(r.status))
            .reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

        const overallBudgetUtilization = totalBudgetAllocated > 0
            ? Math.round((totalCommittedCapEx / totalBudgetAllocated) * 10000) / 100
            : 0;

        const pendingApprovalsCount = requests.filter(r => ['SUBMITTED', 'DEPT_APPROVED'].includes(r.status)).length;
        const highRiskRequestsCount = requests.filter(r => ['HIGH', 'CRITICAL'].includes(r.riskLevel)).length;
        const approvedRequestsCount = requests.filter(r => ['FINANCE_APPROVED', 'ORDER_CREATED'].includes(r.status)).length;
        const s4SyncedCount = requests.filter(r => r.isExternalSynced).length;
        const activeIntegrationsCount = integrations.filter(i => i.status === 'CONNECTED').length;

        return {
            totalCommittedCapEx,
            totalBudgetAllocated,
            overallBudgetUtilization,
            pendingApprovalsCount,
            highRiskRequestsCount,
            approvedRequestsCount,
            s4SyncedCount,
            activeIntegrationsCount,
            currency: 'USD'
        };
    });

    this.on('getDepartmentAnalytics', async (req) => {
        const tx = cds.tx(req);
        const budgets = await tx.run(SELECT.from(Budgets).where({ fiscalYear: 2026 }));
        const requests = await tx.run(SELECT.from(CapExRequests));

        return budgets.map(b => {
            const deptReqs = requests.filter(r => r.department === b.department);
            const pendingCount = deptReqs.filter(r => ['SUBMITTED', 'DEPT_APPROVED'].includes(r.status)).length;
            const approvedCount = deptReqs.filter(r => ['FINANCE_APPROVED', 'ORDER_CREATED'].includes(r.status)).length;
            const totalAllocated = parseFloat(b.totalBudget) || 0;
            const totalCommitted = parseFloat(b.committedAmount) || 0;
            const totalSpent = parseFloat(b.spentAmount) || 0;

            return {
                department: b.department,
                totalAllocated,
                totalCommitted,
                totalSpent,
                utilizationRate: parseFloat(b.utilizationPercent) || 0,
                pendingCount,
                approvedCount
            };
        });
    });

    // =========================================================================
    // COPILOT, DESTINATION PING & BULK IMPORT
    // =========================================================================
    this.on('copilotQuery', async (req) => {
        const prompt = req.data?.prompt || '';
        const requestId = req.data?.requestId;
        const tx = cds.tx(req);

        const requests = await tx.run(SELECT.from(CapExRequests));
        const budgets = await tx.run(SELECT.from(Budgets).where({ fiscalYear: 2026 }));
        const vendors = await tx.run(SELECT.from(Vendors));

        let currentRequest = null;
        if (requestId) {
            currentRequest = await tx.run(SELECT.one.from(CapExRequests).where({ ID: requestId }));
        }

        return await aiService.answerCopilotQuery(prompt, { requests, budgets, vendors, currentRequest });
    });

    this.on('pingDestination', async (req) => {
        const systemKey = req.data?.systemKey || 'S4HANA_CLOUD';
        const tx = cds.tx(req);

        const pingResult = await s4Connector.pingDestination(systemKey);

        await tx.run(
            UPDATE(SystemIntegrations)
                .set({
                    status: pingResult.status,
                    lastPing: pingResult.lastPing,
                    latencyMs: pingResult.latencyMs,
                    lastSyncMessage: pingResult.message
                })
                .where({ systemKey })
        );

        return await tx.run(SELECT.one.from(SystemIntegrations).where({ systemKey }));
    });

    this.on('importCapExCSV', async (req) => {
        const csvContent = req.data?.csvContent;
        if (!csvContent) {
            return req.error(400, 'Missing mandatory csvContent parameter.');
        }

        const tx = cds.tx(req);
        return await CSVHandler.importRequests(tx, cds, csvContent);
    });
});
