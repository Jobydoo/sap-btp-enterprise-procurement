const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const cds = require('@sap/cds');

// Load supporting modules
const s4Connector = require('../srv/s4-connector');
const aiService = require('../srv/ai-service');
const CSVHandler = require('../srv/csv-handler');
const WorkflowEngine = require('../srv/workflow-engine');

let srv;
let db;

before(async () => {
    const projectRoot = path.resolve(__dirname, '..');
    process.chdir(projectRoot);

    await cds.deploy('db/schema.cds').to('sqlite:db.sqlite');
    srv = await cds.serve('ProcurementService').from('srv/procurement-service.cds');
    db = await cds.connect.to('db');
});

test('1. Database Initialization & Seed Data Verification', async () => {
    const { CapExRequests, Budgets, Vendors, CostCenters } = srv.entities;

    const requests = await srv.run(SELECT.from(CapExRequests));
    assert.ok(requests.length >= 5, `Expected at least 5 seeded requests, found ${requests.length}`);

    const budgets = await srv.run(SELECT.from(Budgets));
    assert.strictEqual(budgets.length, 5, `Expected 5 department budgets, found ${budgets.length}`);

    const vendors = await srv.run(SELECT.from(Vendors));
    assert.ok(vendors.length >= 6, `Expected at least 6 vendors, found ${vendors.length}`);

    const costCenters = await srv.run(SELECT.from(CostCenters));
    assert.strictEqual(costCenters.length, 5, `Expected 5 cost centers, found ${costCenters.length}`);
});

test('2. Workflow State Transitions (Draft -> Submitted -> Dept Approved -> Finance Approved)', async () => {
    const { CapExRequests, AuditLogs } = srv.entities;

    // Create a new test draft request
    const newReq = await srv.run(INSERT.into(CapExRequests).entries({
        title: 'Quantum Computing Cloud Sandbox',
        department: 'Engineering',
        requestedBy: 'researcher@corp.local',
        totalAmount: 50000.00,
        priority: 'HIGH',
        status: 'DRAFT',
        businessJustification: 'Algorithm research'
    }));

    const reqId = newReq.ID || (await srv.run(SELECT.one.from(CapExRequests).where({ title: 'Quantum Computing Cloud Sandbox' }))).ID;
    assert.ok(reqId, 'Request ID should exist');

    // Test submit action
    const submitted = await srv.send({
        event: 'submit',
        entity: 'CapExRequests',
        params: [{ ID: reqId }]
    });
    assert.strictEqual(submitted.status, 'SUBMITTED', 'Status should be SUBMITTED');
    assert.ok(submitted.submissionDate, 'Submission date should be recorded');

    // Test deptApprove action
    const deptApproved = await srv.send({
        event: 'deptApprove',
        entity: 'CapExRequests',
        data: { comments: 'Approved by Engineering Director.' },
        params: [{ ID: reqId }]
    });
    assert.strictEqual(deptApproved.status, 'DEPT_APPROVED', 'Status should be DEPT_APPROVED');

    // Test financeApprove action
    const finApproved = await srv.send({
        event: 'financeApprove',
        entity: 'CapExRequests',
        data: { comments: 'Treasury sign-off granted.' },
        params: [{ ID: reqId }]
    });
    assert.strictEqual(finApproved.status, 'FINANCE_APPROVED', 'Status should be FINANCE_APPROVED');
    assert.ok(finApproved.approvalDate, 'Approval date should be recorded');

    // Verify audit logs recorded for this request
    const audits = await srv.run(SELECT.from(AuditLogs).where({ recordId: reqId }));
    assert.ok(audits.length >= 3, `Expected at least 3 audit log entries, found ${audits.length}`);
    const actions = audits.map(a => a.action);
    assert.ok(actions.includes('SUBMIT'), 'Audit log should contain SUBMIT');
    assert.ok(actions.includes('DEPT_APPROVE'), 'Audit log should contain DEPT_APPROVE');
    assert.ok(actions.includes('FINANCE_APPROVE'), 'Audit log should contain FINANCE_APPROVE');
});

test('3. S/4HANA Cloud Destination Sync & PR Number Generation', async () => {
    const { CapExRequests, SystemIntegrations } = srv.entities;

    const target = await srv.run(SELECT.one.from(CapExRequests).where({ title: 'Quantum Computing Cloud Sandbox' }));
    assert.ok(target, 'Target request should exist');
    assert.strictEqual(target.status, 'FINANCE_APPROVED');

    // Execute S/4HANA sync
    const synced = await srv.send({
        event: 'syncWithS4HANA',
        entity: 'CapExRequests',
        params: [{ ID: target.ID }]
    });
    assert.strictEqual(synced.status, 'ORDER_CREATED', 'Status should transition to ORDER_CREATED');
    assert.ok(synced.s4PrNumber.startsWith('PR-'), `Expected S/4HANA PR number starting with PR-, got ${synced.s4PrNumber}`);
    assert.ok(synced.isExternalSynced, 'isExternalSynced should be true');

    // Check System Integration counter update
    const integration = await srv.run(SELECT.one.from(SystemIntegrations).where({ systemKey: 'S4HANA_CLOUD' }));
    assert.ok(integration.totalSyncedRecords > 0, 'Integration counter should be incremented');
});

test('4. Workflow Rejection & State Machine Enforcement', async () => {
    const { CapExRequests } = srv.entities;

    // Create a request in DRAFT
    const draft = await srv.run(INSERT.into(CapExRequests).entries({
        title: 'Non-compliant Software Purchase',
        department: 'Marketing',
        requestedBy: 'marketer@corp.local',
        totalAmount: 120000.00,
        status: 'DRAFT'
    }));

    const draftId = draft.ID || (await srv.run(SELECT.one.from(CapExRequests).where({ title: 'Non-compliant Software Purchase' }))).ID;

    // Cannot reject a DRAFT request directly
    await assert.rejects(
        async () => {
            await srv.send({
                event: 'rejectProposal',
                entity: 'CapExRequests',
                data: { reason: 'Invalid' },
                params: [{ ID: draftId }]
            });
        },
        /Cannot reject request in status 'DRAFT'/
    );

    // Submit the request first
    await srv.send({
        event: 'submit',
        entity: 'CapExRequests',
        params: [{ ID: draftId }]
    });

    // Now reject with a reason
    const rejected = await srv.send({
        event: 'rejectProposal',
        entity: 'CapExRequests',
        data: { reason: 'Supplier rate exceeds corporate threshold.' },
        params: [{ ID: draftId }]
    });
    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejectionReason, 'Supplier rate exceeds corporate threshold.');
});

test('5. SAP AI Core / GenAI Hub Risk Evaluation & Anomaly Detection', async () => {
    const sampleRequest = {
        title: 'Ultra High-End Workstation',
        department: 'Operations',
        totalAmount: 180000.00
    };

    const sampleItems = [
        { itemNumber: 10, materialDescription: 'Sensor Kit', category: 'Hardware', quantity: 50, unitPrice: 3600, benchmarkDeviation: 22.0 }
    ];

    const sampleBudget = {
        department: 'Operations',
        totalBudget: 2500000,
        remainingBudget: 150000 // tight remaining budget
    };

    const sampleVendor = {
        supplierName: 'PwC Advisory Consulting',
        riskCategory: 'HIGH',
        rating: 3.8,
        complianceScore: 84.5
    };

    const evaluation = aiService.evaluateRisk(sampleRequest, sampleItems, sampleBudget, sampleVendor);

    assert.ok(evaluation.riskScore >= 45, `Risk score should be elevated due to vendor risk and tight budget, got ${evaluation.riskScore}`);
    assert.ok(evaluation.detectedAnomalies.includes('HIGH risk'), 'Should detect vendor HIGH risk flag');
    assert.ok(evaluation.detectedAnomalies.includes('above historical procurement benchmarks'), 'Should detect pricing benchmark anomaly');
    assert.ok(evaluation.executiveSummary.includes('Executive CapEx Assessment'), 'Should generate executive summary');
});

test('6. Copilot Natural Language Q&A Engine', async () => {
    const context = {
        requests: [
            { title: 'Server Upgrade', department: 'Operations', totalAmount: 100000, status: 'SUBMITTED', riskLevel: 'HIGH', riskScore: 75 }
        ],
        budgets: [
            { department: 'Operations', utilizationPercent: 94.0 },
            { department: 'Engineering', utilizationPercent: 71.3 }
        ],
        vendors: [
            { supplierName: 'Dell', riskCategory: 'LOW', rating: 4.85 }
        ]
    };

    const budgetReply = await aiService.answerCopilotQuery('Which department has the highest budget utilization?', context);
    assert.ok(budgetReply.reply.includes('Operations'), 'Copilot should identify Operations as high utilization');
    assert.strictEqual(budgetReply.confidenceScore, 0.94);

    const riskReply = await aiService.answerCopilotQuery('Show all high risk requests', context);
    assert.ok(riskReply.reply.includes('Risk Governance Report'), 'Copilot should provide Risk report');
});

test('7. CSV Bulk Import & Export Parser', async () => {
    const sampleCSV = `title,department,requestedBy,priority,businessJustification,materialDescription,category,quantity,unitPrice\n` +
        `"Bulk Smart Factory Robots","Operations","marcus@corp.local","HIGH","Automation initiative","Industrial Robot Arm","Machinery",2,45000\n` +
        `"Bulk Smart Factory Robots","Operations","marcus@corp.local","HIGH","Automation initiative","Controller Cabinet","Hardware",2,10000`;

    const tx = db.tx();
    const result = await CSVHandler.importRequests(tx, cds, sampleCSV);
    await tx.commit();

    assert.strictEqual(result.success, true, 'CSV import should succeed');
    assert.strictEqual(result.importedCount, 1, 'Should import 1 grouped request');

    // Test Export
    const { CapExRequests, CapExItems } = srv.entities;
    const reqs = await srv.run(SELECT.from(CapExRequests));
    const items = await srv.run(SELECT.from(CapExItems));

    const csvOutput = CSVHandler.exportToCSV(reqs, items);
    assert.ok(csvOutput.includes('RequestID,Title,Department'), 'CSV export should contain standard header');
    assert.ok(csvOutput.includes('Bulk Smart Factory Robots'), 'CSV export should contain imported request title');
});

test('8. Executive Metrics Aggregation Function', async () => {
    const metrics = await srv.getExecutiveMetrics();

    assert.ok(metrics.totalCommittedCapEx > 0, 'Total committed CapEx should be positive');
    assert.ok(metrics.totalBudgetAllocated > 0, 'Total budget allocated should be positive');
    assert.ok(metrics.overallBudgetUtilization > 0, 'Utilization should be calculated');
    assert.strictEqual(metrics.currency, 'USD');
    assert.ok(metrics.activeIntegrationsCount > 0, 'Active integrations should be tracked');
});
