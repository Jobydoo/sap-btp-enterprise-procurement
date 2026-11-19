const { test } = require('node:test');
const assert = require('node:assert');

const BASE_URL = 'http://localhost:4004';

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-User-Role': options.role || 'Admin',
            ...(options.headers || {})
        }
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, data };
}

test('BUTTON TEST 1: Persona Switcher (Admin, Manager, Viewer)', async () => {
    // Test Admin Persona
    const adminRes = await request('/api/current-user', { role: 'Admin' });
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.data.user.name, 'Sarah Jenkins');
    assert.ok(adminRes.data.user.roles.includes('ProcurementAdmin'));

    // Test Manager Persona
    const mgrRes = await request('/api/current-user', { role: 'Manager' });
    assert.strictEqual(mgrRes.status, 200);
    assert.strictEqual(mgrRes.data.user.name, 'Alex Rivera');
    assert.ok(mgrRes.data.user.roles.includes('ProcurementManager'));

    // Test Viewer Persona
    const viewerRes = await request('/api/current-user', { role: 'Viewer' });
    assert.strictEqual(viewerRes.status, 200);
    assert.strictEqual(viewerRes.data.user.name, 'David Kim');
    assert.ok(viewerRes.data.user.roles.includes('ProcurementViewer'));
});

test('BUTTON TEST 2: Executive Analytics - Refresh Status & Metrics APIs', async () => {
    // 1. KPI Metrics
    const metricsRes = await request('/odata/v4/procurement/getExecutiveMetrics()');
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(metricsRes.data.totalBudgetAllocated > 0);
    assert.ok(metricsRes.data.currency === 'USD');

    // 2. Department Analytics
    const deptRes = await request('/odata/v4/procurement/getDepartmentAnalytics()');
    assert.strictEqual(deptRes.status, 200);
    assert.ok(Array.isArray(deptRes.data.value));
    assert.strictEqual(deptRes.data.value.length, 5);

    // 3. Refresh Status (System Integrations)
    const intRes = await request('/odata/v4/procurement/SystemIntegrations');
    assert.strictEqual(intRes.status, 200);
    assert.ok(intRes.data.value.length >= 4);
});

test('BUTTON TEST 3: New CapEx Request Creation Modal & Save as Draft', async () => {
    const payload = {
        title: 'High-Throughput Edge TPU Acceleration Rack',
        department: 'Operations',
        requestedBy: 'sarah.jenkins@enterprise.corp',
        priority: 'CRITICAL',
        status: 'DRAFT',
        totalAmount: 140000.00,
        currency: 'USD',
        businessJustification: 'Edge machine vision inference on assembly conveyor line.',
        items: [
            {
                itemNumber: 10,
                materialDescription: 'Coral Dual Edge TPU PCIe Modules',
                category: 'Hardware',
                quantity: 40,
                unitPrice: 2000,
                lineTotal: 80000
            },
            {
                itemNumber: 20,
                materialDescription: 'Industrial Thermal Vibration Enclosure',
                category: 'Facility',
                quantity: 1,
                unitPrice: 60000,
                lineTotal: 60000
            }
        ]
    };

    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
    assert.ok(createRes.data.ID, 'New request should return generated UUID');
    assert.strictEqual(createRes.data.status, 'DRAFT');
    assert.strictEqual(parseFloat(createRes.data.totalAmount), 140000);

    // Verify it exists in table
    const getRes = await request(`/odata/v4/procurement/CapExRequests(ID=${createRes.data.ID})?$expand=items`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.items.length, 2);
});

test('BUTTON TEST 4: Full Multi-Step Workflow Buttons (Submit -> Dept Approve -> Finance Approve -> S/4HANA Sync)', async () => {
    // 1. Create a draft request to take through the entire lifecycle
    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify({
            title: 'Automated Guided Vehicle Fleet Upgrade',
            department: 'Engineering',
            requestedBy: 'marcus.vance@enterprise.corp',
            priority: 'HIGH',
            status: 'DRAFT',
            totalAmount: 75000.00,
            businessJustification: 'Fleet efficiency expansion'
        })
    });
    const id = createRes.data.ID;

    // 2. Button: 'Submit for Approval'
    const submitRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/submit`, {
        method: 'POST',
        body: '{}'
    });
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.data.status, 'SUBMITTED');
    assert.ok(submitRes.data.submissionDate);

    // 3. Button: 'Department Approve' (as Manager)
    const deptRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/deptApprove`, {
        method: 'POST',
        role: 'Manager',
        body: JSON.stringify({ comments: 'Director verified budget alignment.' })
    });
    assert.strictEqual(deptRes.status, 200);
    assert.strictEqual(deptRes.data.status, 'DEPT_APPROVED');

    // 4. Button: 'Finance & Treasury Approve' (as Admin)
    const finRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/financeApprove`, {
        method: 'POST',
        role: 'Admin',
        body: JSON.stringify({ comments: 'Treasury sign-off granted.' })
    });
    assert.strictEqual(finRes.status, 200);
    assert.strictEqual(finRes.data.status, 'FINANCE_APPROVED');
    assert.ok(finRes.data.approvalDate);

    // 5. Button: 'Release to S/4HANA Cloud' (as Admin)
    const s4Res = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/syncWithS4HANA`, {
        method: 'POST',
        role: 'Admin',
        body: '{}'
    });
    assert.strictEqual(s4Res.status, 200);
    assert.strictEqual(s4Res.data.status, 'ORDER_CREATED');
    assert.ok(s4Res.data.s4PrNumber.startsWith('PR-'));
    assert.ok(s4Res.data.isExternalSynced);
});

test('BUTTON TEST 5: Reject Request Button & Reason Validation Modal', async () => {
    // Create and submit request
    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify({
            title: 'Unbudgeted Executive Luxury Vehicle',
            department: 'Marketing',
            requestedBy: 'user@corp.local',
            priority: 'LOW',
            status: 'DRAFT',
            totalAmount: 110000.00
        })
    });
    const id = createRes.data.ID;

    await request(`/odata/v4/procurement/CapExRequests(ID=${id})/submit`, { method: 'POST', body: '{}' });

    // Click 'Reject Request' button
    const rejectRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/rejectProposal`, {
        method: 'POST',
        role: 'Admin',
        body: JSON.stringify({ reason: 'Asset does not qualify under enterprise CapEx depreciation policy.' })
    });

    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.data.status, 'REJECTED');
    assert.strictEqual(rejectRes.data.rejectionReason, 'Asset does not qualify under enterprise CapEx depreciation policy.');
});

test('BUTTON TEST 6: Button "Run AI Risk & Anomaly Scan"', async () => {
    const listRes = await request('/odata/v4/procurement/CapExRequests?$top=1');
    const firstReq = listRes.data.value[0];

    const aiRes = await request(`/odata/v4/procurement/CapExRequests(ID=${firstReq.ID})/triggerAIAnalysis`, {
        method: 'POST',
        body: '{}'
    });

    assert.strictEqual(aiRes.status, 200);
    assert.ok(aiRes.data.riskScore >= 0);
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(aiRes.data.riskRating));
    assert.ok(aiRes.data.executiveSummary.includes('Executive CapEx Assessment'));
    assert.ok(aiRes.data.modelUsed.includes('SAP GenAI Hub'));
});

test('BUTTON TEST 7: SAP GenAI Copilot Chips & Custom Q&A Button', async () => {
    // Quick Prompt Chip 1: Budget Headroom
    const chip1 = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Which departments are closest to exceeding their budget?' })
    });
    assert.strictEqual(chip1.status, 200);
    assert.ok(chip1.data.reply.includes('Operations'));
    assert.strictEqual(chip1.data.confidenceScore, 0.94);

    // Quick Prompt Chip 2: High Risk Proposals
    const chip2 = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Show all high risk requests with vendor pricing anomalies' })
    });
    assert.strictEqual(chip2.status, 200);
    assert.ok(chip2.data.reply.includes('Risk Governance Report'));

    // Custom Query: Supplier audit
    const custom = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Analyze vendor performance and high-risk suppliers' })
    });
    assert.strictEqual(custom.status, 200);
    assert.ok(custom.data.reply.includes('Dell Technologies'));
});

test('BUTTON TEST 8: S/4HANA Destination Buttons (Ping All & Single Ping)', async () => {
    // Ping All Destinations (sequential test of each key)
    const systems = ['S4HANA_CLOUD', 'SAP_AI_CORE', 'EVENT_MESH', 'CREDENTIAL_STORE'];
    for (const key of systems) {
        const pingRes = await request('/odata/v4/procurement/pingDestination', {
            method: 'POST',
            body: JSON.stringify({ systemKey: key })
        });
        assert.strictEqual(pingRes.status, 200);
        assert.strictEqual(pingRes.data.status, 'CONNECTED');
        assert.ok(pingRes.data.latencyMs >= 0);
        assert.ok(pingRes.data.lastPing);
    }
});

test('BUTTON TEST 9: Bulk Data Center Buttons (Export CSV & Import CSV)', async () => {
    // 1. Export CSV
    const exportRes = await request('/api/export-csv');
    assert.strictEqual(exportRes.status, 200);
    assert.ok(exportRes.headers.get('content-type').includes('text/csv'));
    assert.ok(exportRes.data.includes('RequestID,Title,Department'));

    // 2. Process and Import CSV
    const csvContent = `title,department,requestedBy,priority,businessJustification,materialDescription,category,quantity,unitPrice\n` +
        `"Industrial Optical Sort Machine","Operations","marcus@corp.local","HIGH","Defect sorting","Laser Optical Spectrometer","Machinery",1,55000`;

    const importRes = await request('/odata/v4/procurement/importCapExCSV', {
        method: 'POST',
        body: JSON.stringify({ csvContent })
    });

    assert.strictEqual(importRes.status, 200);
    assert.strictEqual(importRes.data.success, true);
    assert.strictEqual(importRes.data.importedCount, 1);
});

test('BUTTON TEST 10: Health & Diagnostic Endpoint', async () => {
    const healthRes = await request('/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'HEALTHY');
    assert.strictEqual(healthRes.data.checks.persistence, 'UP');
    assert.strictEqual(healthRes.data.checks.destinations, 'CONFIGURED');
});
