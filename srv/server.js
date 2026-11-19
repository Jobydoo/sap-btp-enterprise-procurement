const cds = require('@sap/cds');
const express = require('express');
const path = require('path');
const CSVHandler = require('./csv-handler');

cds.on('bootstrap', (app) => {
    // Enable JSON parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // =========================================================================
    // SAP BTP Persona Switcher Middleware (Mock Auth & RBAC)
    // =========================================================================
    app.use((req, res, next) => {
        // Allow user to switch personas via header, query param, or default to Admin
        const roleParam = req.query.userRole || req.headers['x-user-role'] || 'Admin';

        let userProfile = {
            id: 'sarah.jenkins@enterprise.corp',
            name: 'Sarah Jenkins',
            title: 'Chief Procurement Officer & Global Admin',
            roles: ['ProcurementAdmin', 'ProcurementManager', 'ProcurementViewer', 'admin'],
            department: 'Corporate Governance'
        };

        if (roleParam === 'Manager') {
            userProfile = {
                id: 'alex.rivera@enterprise.corp',
                name: 'Alex Rivera',
                title: 'Senior Engineering & Operations Manager',
                roles: ['ProcurementManager', 'ProcurementViewer'],
                department: 'Engineering'
            };
        } else if (roleParam === 'Viewer') {
            userProfile = {
                id: 'david.kim@enterprise.corp',
                name: 'David Kim',
                title: 'Procurement Specialist / Requester',
                roles: ['ProcurementViewer'],
                department: 'Operations'
            };
        }

        // Attach to CAP request user context
        req.user = new cds.User({
            id: userProfile.id,
            roles: userProfile.roles,
            attr: {
                department: userProfile.department,
                displayName: userProfile.name
            }
        });

        // Store profile for UI queries
        req.userProfile = userProfile;
        next();
    });

    // Endpoint for frontend to query current simulated persona
    app.get('/api/current-user', (req, res) => {
        res.json({
            user: req.userProfile
        });
    });

    // =========================================================================
    // REST API: Direct CSV Export Endpoint
    // =========================================================================
    app.get('/api/export-csv', async (req, res) => {
        try {
            const { CapExRequests, CapExItems } = cds.entities('sap.btp.procurement');
            const requests = await cds.run(SELECT.from(CapExRequests));
            const items = await cds.run(SELECT.from(CapExItems));

            const csvString = CSVHandler.exportToCSV(requests, items);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="SAP_BTP_CapEx_Portfolio_${new Date().toISOString().split('T')[0]}.csv"`);
            res.status(200).send(csvString);
        } catch (err) {
            res.status(500).json({ error: 'Failed to export CSV: ' + err.message });
        }
    });

    // =========================================================================
    // REST API: Enterprise Health & BTP Diagnostic Probe
    // =========================================================================
    app.get('/api/health', async (req, res) => {
        try {
            const { Budgets } = cds.entities('sap.btp.procurement');
            const count = await cds.run(SELECT.from(Budgets));

            res.json({
                status: 'HEALTHY',
                framework: 'SAP Cloud Application Programming Model (CAP)',
                version: cds.version,
                nodeVersion: process.version,
                database: cds.env.requires.db?.kind || 'sqlite',
                uptimeSeconds: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
                checks: {
                    persistence: count ? 'UP' : 'EMPTY',
                    xsuaa: 'MOCK_RBAC_ACTIVE',
                    destinations: 'CONFIGURED'
                }
            });
        } catch (err) {
            res.status(500).json({ status: 'UNHEALTHY', error: err.message });
        }
    });

    // Serve static files from app folder
    const appDir = path.join(__dirname, '..', 'app');
    app.use(express.static(appDir));
});

module.exports = cds.server;
