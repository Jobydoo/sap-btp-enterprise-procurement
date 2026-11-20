const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const apiHandler = require('../api/index');

let server;
let baseUrl;

before(async () => {
    server = http.createServer((req, res) => {
        apiHandler(req, res);
    });
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

after(() => {
    if (server) server.close();
});

async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
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

test('API TEST 1: Persona Switcher BTP Maroc (Admin, Manager, Viewer)', async () => {
    const adminRes = await request('/api/current-user', { role: 'Admin' });
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.data.user.name, 'Youssef Benjelloun');
    assert.ok(adminRes.data.user.roles.includes('ProcurementAdmin'));

    const mgrRes = await request('/api/current-user', { role: 'Manager' });
    assert.strictEqual(mgrRes.status, 200);
    assert.strictEqual(mgrRes.data.user.name, 'Amine El Idrissi');
    assert.ok(mgrRes.data.user.roles.includes('ProcurementManager'));

    const viewerRes = await request('/api/current-user', { role: 'Viewer' });
    assert.strictEqual(viewerRes.status, 200);
    assert.strictEqual(viewerRes.data.user.name, 'Fatima Zahra Mansouri');
    assert.ok(viewerRes.data.user.roles.includes('ProcurementViewer'));
});

test('API TEST 2: Executive Analytics - Refresh Status & Metrics APIs (MAD)', async () => {
    const metricsRes = await request('/odata/v4/procurement/getExecutiveMetrics()');
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(metricsRes.data.totalBudgetAllocated > 0);
    assert.strictEqual(metricsRes.data.currency, 'MAD');

    const deptRes = await request('/odata/v4/procurement/getDepartmentAnalytics()');
    assert.strictEqual(deptRes.status, 200);
    assert.ok(Array.isArray(deptRes.data.value));
    assert.strictEqual(deptRes.data.value.length, 5);

    const intRes = await request('/odata/v4/procurement/SystemIntegrations');
    assert.strictEqual(intRes.status, 200);
    assert.ok(intRes.data.value.length >= 4);
});

test('API TEST 3: New CapEx Request Creation Modal & Save as Draft (BTP Materials)', async () => {
    const payload = {
        title: 'Centrale a Beton Mobile 60m3/h Chantier Dakhla',
        department: 'Gros Oeuvre & Batiment',
        requestedBy: 'youssef.benjelloun@btp-maroc.ma',
        priority: 'CRITICAL',
        status: 'DRAFT',
        totalAmount: 1800000.00,
        currency: 'MAD',
        businessJustification: 'Fourniture autonome en beton pret a l emploi pour quai portuaire.',
        items: [
            {
                itemNumber: 10,
                materialDescription: 'Malaxeur Planétaire Automatisé BTP',
                category: 'Machinery',
                quantity: 1,
                unitPrice: 1200000,
                lineTotal: 1200000
            },
            {
                itemNumber: 20,
                materialDescription: 'Silo à Ciment 100T avec Filtre Dépoussiéreur',
                category: 'Facility',
                quantity: 2,
                unitPrice: 300000,
                lineTotal: 600000
            }
        ]
    };

    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    assert.strictEqual(createRes.status, 201);
    assert.ok(createRes.data.ID);
    assert.strictEqual(createRes.data.status, 'DRAFT');
    assert.strictEqual(parseFloat(createRes.data.totalAmount), 1800000);

    const getRes = await request(`/odata/v4/procurement/CapExRequests(ID=${createRes.data.ID})?$expand=items`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.items.length, 2);
});

test('API TEST 4: Full Multi-Step Workflow Buttons (Submit -> Dept Approve -> Finance Approve -> S/4HANA Sync)', async () => {
    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify({
            title: 'Lot Acier FeE500 Sonasid pour Pont Haubans',
            department: 'Genie Civil & Ouvrages d\'Art',
            requestedBy: 'amine.elidrissi@btp-maroc.ma',
            priority: 'HIGH',
            status: 'DRAFT',
            totalAmount: 750000.00,
            currency: 'MAD',
            businessJustification: 'Armatures haute adhérence pour chevêtres et voussoirs'
        })
    });
    const id = createRes.data.ID;

    // Submit
    const submitRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/submit`, {
        method: 'POST',
        body: '{}'
    });
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.data.status, 'SUBMITTED');
    assert.ok(submitRes.data.submissionDate);

    // Dept Approve
    const deptRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/deptApprove`, {
        method: 'POST',
        role: 'Manager',
        body: JSON.stringify({ comments: 'Visa technique accordé. Conforme aux cadencements de ferraillage.' })
    });
    assert.strictEqual(deptRes.status, 200);
    assert.strictEqual(deptRes.data.status, 'DEPT_APPROVED');

    // Finance Approve
    const finRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/financeApprove`, {
        method: 'POST',
        role: 'Admin',
        body: JSON.stringify({ comments: 'Visa financier accordé. Bon pour commande S/4HANA.' })
    });
    assert.strictEqual(finRes.status, 200);
    assert.strictEqual(finRes.data.status, 'FINANCE_APPROVED');
    assert.ok(finRes.data.approvalDate);

    // Release to S/4HANA
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

test('API TEST 5: Reject Request Button & Reason Validation Modal', async () => {
    const createRes = await request('/odata/v4/procurement/CapExRequests', {
        method: 'POST',
        body: JSON.stringify({
            title: 'Achat Engin de Terrassement Hors Barème',
            department: 'Terrassement & VRD',
            requestedBy: 'fatima.mansouri@btp-maroc.ma',
            priority: 'LOW',
            status: 'DRAFT',
            totalAmount: 1100000.00
        })
    });
    const id = createRes.data.ID;

    await request(`/odata/v4/procurement/CapExRequests(ID=${id})/submit`, { method: 'POST', body: '{}' });

    const rejectRes = await request(`/odata/v4/procurement/CapExRequests(ID=${id})/rejectProposal`, {
        method: 'POST',
        role: 'Admin',
        body: JSON.stringify({ reason: 'Le tarif unitaire dépasse le barème LPEE de 30%.' })
    });

    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.data.status, 'REJECTED');
    assert.strictEqual(rejectRes.data.rejectionReason, 'Le tarif unitaire dépasse le barème LPEE de 30%.');
});

test('API TEST 6: Button "Run AI Risk & Anomaly Scan" (BTP LPEE Standards)', async () => {
    const listRes = await request('/odata/v4/procurement/CapExRequests?$top=1');
    const firstReq = listRes.data.value[0];

    const aiRes = await request(`/odata/v4/procurement/CapExRequests(ID=${firstReq.ID})/triggerAIAnalysis`, {
        method: 'POST',
        body: '{}'
    });

    assert.strictEqual(aiRes.status, 200);
    assert.ok(aiRes.data.riskScore >= 0);
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(aiRes.data.riskRating));
    assert.ok(aiRes.data.executiveSummary.includes('Évaluation Décisionnelle BTP'));
    assert.ok(aiRes.data.modelUsed.includes('SAP GenAI Hub Maroc'));
});

test('API TEST 7: SAP GenAI Copilot Chips & Custom Q&A Button (French BTP Queries)', async () => {
    // Quick Prompt Chip 1: Budget Headroom
    const chip1 = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Quels chantiers ou directions dépassent leur budget alloué ?' })
    });
    assert.strictEqual(chip1.status, 200);
    assert.ok(chip1.data.reply.includes('Génie Civil') || chip1.data.reply.includes('Genie Civil'));
    assert.strictEqual(chip1.data.confidenceScore, 0.94);

    // Quick Prompt Chip 2: High Risk Proposals
    const chip2 = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Identifier les anomalies de prix sur le béton et l\'acier Sonasid' })
    });
    assert.strictEqual(chip2.status, 200);
    assert.ok(chip2.data.reply.includes('Gouvernance des Risques BTP'));

    // Custom Query: Supplier audit
    const custom = await request('/odata/v4/procurement/copilotQuery', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Analyser la conformité et les risques des fournisseurs BTP au Maroc' })
    });
    assert.strictEqual(custom.status, 200);
    assert.ok(custom.data.reply.includes('LafargeHolcim') || custom.data.reply.includes('Sonasid'));
});

test('API TEST 8: S/4HANA Destination Buttons (Ping All & Single Ping)', async () => {
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

test('API TEST 9: Bulk Data Center Buttons (Export CSV & Import CSV in MAD)', async () => {
    const exportRes = await request('/api/export-csv');
    assert.strictEqual(exportRes.status, 200);
    assert.ok(exportRes.headers.get('content-type').includes('text/csv'));
    assert.ok(exportRes.data.includes('RequestID,Title,Department'));

    const csvContent = `title,department,requestedBy,priority,businessJustification,materialDescription,category,quantity,unitPrice\n` +
        `"Béton B30 Spécial Tablier Viaduc","Genie Civil & Ouvrages d'Art","amine.elidrissi@btp-maroc.ma","HIGH","Coulage tablier viaduc","Béton B30 LafargeHolcim Hydrofuge","Hardware",200,1050`;

    const importRes = await request('/odata/v4/procurement/importCapExCSV', {
        method: 'POST',
        body: JSON.stringify({ csvContent })
    });

    assert.strictEqual(importRes.status, 200);
    assert.strictEqual(importRes.data.success, true);
    assert.strictEqual(importRes.data.importedCount, 1);
});

test('API TEST 10: Health & Diagnostic Endpoint', async () => {
    const healthRes = await request('/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'HEALTHY');
    assert.strictEqual(healthRes.data.checks.persistence, 'UP');
    assert.strictEqual(healthRes.data.checks.destinations, 'CONFIGURED');
});
