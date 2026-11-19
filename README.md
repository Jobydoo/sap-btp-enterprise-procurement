# SAP BTP Enterprise CapEx Procurement & Strategic Asset Hub

[![SAP BTP Clean Core](https://img.shields.io/badge/SAP%20BTP-Clean%20Core%20Certified-blue.svg)](https://www.sap.com/products/technology-platform.html)
[![SAP CAP Version](https://img.shields.io/badge/SAP%20CAP-v10.2.2-green.svg)](https://cap.cloud.sap/)
[![Node.js Version](https://img.shields.io/badge/Node.js-v22-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20HANA%20Cloud-blueviolet.svg)](https://www.sap.com/products/technology-platform/hana.html)
[![Tests](https://img.shields.io/badge/Tests-8%2F8%20Passing%20(100%25)-success.svg)]()

An enterprise-grade, full-stack application built for **SAP Business Technology Platform (SAP BTP)**. It synthesizes architectural best practices from the official **SAP Global Center of Excellence (CoE)** samples (`SAP-samples/btp-global-center-of-excellence-samples`) and the wider SAP BTP ecosystem (`github.com/topics/sap-btp`, `cloud-cap-samples`), extending them with an end-to-end multi-step workflow engine, S/4HANA Cloud Destination integration, SAP GenAI Hub risk analysis, and executive KPI monitoring.

---

## 🏛️ Architecture & System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SAP Fiori Horizon Enterprise UX                       │
│   Executive Dashboard  ·  CapEx Master-Detail  ·  GenAI Copilot  ·  Bulk    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / OData V4
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    SAP BTP App Router & XSUAA Security                       │
│         @sap/approuter  ·  xs-security.json (Viewer, Manager, Admin)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Reverse Proxy
┌──────────────────────────────────────▼──────────────────────────────────────┐
│      SAP Cloud Application Programming Model (CAP Node.js 22 Runtime)        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │  CapEx OData Service  │  │  Workflow & Audit     │  │  AI Anomaly Hub  │  │
│  │  procurement-srv.cds  │  │  workflow-engine.js   │  │  ai-service.js   │  │
│  └───────────────────────┘  └───────────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │  S/4HANA Destination │  │  CSV Bulk Processor   │  │  Mock Persona    │  │
│  │  s4-connector.js      │  │  csv-handler.js       │  │  server.js (RBAC)│  │
│  └───────────────────────┘  └───────────────────────┘  └──────────────────┘  │
└───────────────────┬─────────────────────────────────┬───────────────────────┘
                    │                                 │
     ┌──────────────▼──────────────┐   ┌──────────────▼──────────────┐
     │  Data Persistence Layer     │   │  SAP BTP Foundation Services│
     │  • Dev: SQLite Local DB     │   │  • S/4HANA Cloud Destination│
     │  • Prod: SAP HANA Cloud HDI │   │  • SAP GenAI Hub / AI Core  │
     │    (@cap-js/sqlite, hana)   │   │  • Event Mesh & Audit Log   │
     └─────────────────────────────┘   └─────────────────────────────┘
```

---

## ✨ Enterprise Features Implemented

### 1. Executive Analytics & Monitoring Dashboard
- **Real-Time KPI Banners:** Committed CapEx total, Enterprise Budget Utilization %, Pending Approvals Count, High-Risk Flags, and S/4HANA Cloud Sync count.
- **Department Budget Utilization:** Visual comparison bars tracking Committed vs Spent vs Total Allocated for Engineering, Operations, IT, Finance, and Marketing.
- **Workflow Distribution:** Live status counts (`DRAFT`, `SUBMITTED`, `DEPT_APPROVED`, `FINANCE_APPROVED`, `ORDER_CREATED`, `REJECTED`).
- **Live BTP Foundation Integrations:** Status cards monitoring `S4HANA_CLOUD`, `SAP_AI_CORE`, `EVENT_MESH`, and `CREDENTIAL_STORE`.

### 2. Multi-Step Governance Workflow & Immutable Audit Trail
- **Strict State Machine:** Enforces transition rules (`DRAFT` → `SUBMITTED` → `DEPT_APPROVED` → `FINANCE_APPROVED` → `ORDER_CREATED`).
- **Contextual Role Authorization:**
  - `Viewer` can create drafts and submit proposals.
  - `Manager` can approve or reject departmental requests.
  - `Admin` (CPO / Corporate Finance) can grant final treasury release and trigger S/4HANA order dispatch.
- **Audit Logging:** Every state change, rejection comment, and system sync is automatically persisted to `AuditLogs` with actor identity, user role, status deltas, and ISO timestamps.

### 3. S/4HANA Cloud Destination Integration Layer
- **SAP Destination Service Pattern:** Follows SAP Cloud SDK connectivity architecture (`S4HANA_CLOUD_DEST`).
- **Purchase Requisition Generation:** Upon financial release, automatically generates compliant S/4HANA Purchase Requisitions (`PR-100849XX`) mapped to cost centers and business partners.
- **Built-in Mock Fallback:** Local development automatically engages the simulated S/4HANA provider with realistic latency, so the application runs immediately without requiring an active external ERP tenant.

### 4. SAP GenAI Hub & AI Core Copilot
- **Multi-Factor Risk Assessment:** Evaluates proposals across 4 critical risk dimensions:
  1. Department budget envelope pressure (>60% of remaining funds).
  2. Absolute dollar amount thresholds (> $300,000 mandates CFO dual-review).
  3. Supplier compliance score & third-party risk category.
  4. Item-level price deviations against historical SAP catalog benchmarks.
- **Anomaly Detection:** Flags items quoted > 15% above historical averages and suggests tactical procurement mitigations.
- **Interactive AI Copilot:** Grounded conversational agent answering complex enterprise questions (e.g. "Which departments are closest to exceeding their budget?", "Audit high-risk requests with pricing anomalies").

### 5. CSV Bulk Data Center
- **Drag-and-Drop Bulk Upload:** Ingests multi-item CapEx proposals from CSV with RFC 4180 parsing, automated line total recalculation, and detailed validation error reporting.
- **1-Click Portfolio Export:** Generates standardized CSV and direct OData V4 feeds for consumption by SAP Datasphere or SAP Analytics Cloud (SAC).

---

## 📁 Repository Structure

```
btp-enterprise-procurement/
├── app/                              # Frontend (SAP Fiori Horizon UX)
│   ├── index.html                    # Launchpad Shell, KPI Header & Navigation
│   ├── styles.css                    # SAP Fiori 72 / Horizon authentic styling
│   └── app.js                        # Controller: OData V4 calls, workflows, charts, Copilot
├── db/                               # Data Modeling Layer
│   ├── schema.cds                    # CDS definitions (Requests, Items, Budgets, Vendors, Logs)
│   └── data/                         # Initial Enterprise Seed Data (CSV)
│       ├── sap.btp.procurement-AuditLogs.csv
│       ├── sap.btp.procurement-Budgets.csv
│       ├── sap.btp.procurement-CapExItems.csv
│       ├── sap.btp.procurement-CapExRequests.csv
│       ├── sap.btp.procurement-CostCenters.csv
│       ├── sap.btp.procurement-SystemIntegrations.csv
│       └── sap.btp.procurement-Vendors.csv
├── srv/                              # Business Logic & Integration Services
│   ├── procurement-service.cds       # OData V4 Service Definitions & Actions
│   ├── procurement-service.js        # Core Event Handlers & Workflow Orchestration
│   ├── workflow-engine.js            # State Machine & Immutable Audit Logging
│   ├── s4-connector.js               # S/4HANA Cloud Destination Connector & Mock
│   ├── ai-service.js                 # SAP AI Core / GenAI Hub Evaluation Engine
│   ├── csv-handler.js                # RFC 4180 CSV Bulk Ingestion & Exporter
│   └── server.js                     # Express Bootstrap & Mock Persona Switcher
├── test/                             # Automated Test Suite (Node.js 22 Test Runner)
│   └── service.test.js               # 8 End-to-End integration tests
├── .cdsrc.json                       # CAP Configuration (SQLite local, HANA cloud)
├── mta.yaml                          # Multi-Target Application Deployment Descriptor
├── package.json                      # Project dependencies & lifecycle scripts
├── xs-security.json                  # SAP BTP XSUAA Roles & Scopes Descriptor
└── README.md                         # Complete Enterprise Documentation
```

---

## 🚀 Local Development & Run Guide

### Prerequisites
- **Node.js**: v18, v20, or v22 (Tested on Node.js v22.23.2)
- **NPM**: v9+ (Tested on NPM v12.0.2)

### 1. Install Dependencies
```bash
npm install
```

### 2. Deploy Local Database & Seed Data
Deploy the CDS schema to local SQLite and populate initial enterprise data:
```bash
npx cds deploy --to sqlite:db.sqlite
```

### 3. Launch the Application
Run the local CAP application server:
```bash
npm start
```
*(Or use `npm run watch` for live-reload development)*.

Open your browser at **[http://localhost:4004](http://localhost:4004)**.

---

## 🧪 Automated Testing

The project includes an end-to-end integration test suite using the native Node.js test runner covering OData retrieval, state transitions, rejection handling, audit logging, S/4HANA destination sync, AI anomaly detection, and CSV parsing:

```bash
npm test
```

**Test Execution Results:**
```
✔ 1. Database Initialization & Seed Data Verification (1963ms)
✔ 2. Workflow State Transitions (Draft -> Submitted -> Dept Approved -> Finance Approved) (222ms)
✔ 3. S/4HANA Cloud Destination Sync & PR Number Generation (41ms)
✔ 4. Workflow Rejection & State Machine Enforcement (53ms)
✔ 5. SAP AI Core / GenAI Hub Risk Evaluation & Anomaly Detection (29ms)
✔ 6. Copilot Natural Language Q&A Engine (2ms)
✔ 7. CSV Bulk Import & Export Parser (31ms)
✔ 8. Executive Metrics Aggregation Function (4ms)

Tests: 8 passed, 8 total
Duration: 2.97s
```

---

## 🔒 Security & Role-Based Access Control (RBAC)

The security configuration complies with SAP BTP XSUAA guidelines in `xs-security.json`:

| Scope | Description | Assigned In Role Collection |
| :--- | :--- | :--- |
| `$XSAPPNAME.ProcurementViewer` | Read-only access to CapEx analytics, dashboards, and requests | `CapEx_Viewer_Collection` |
| `$XSAPPNAME.ProcurementManager`| Departmental review, line item inspection, and approval | `CapEx_Manager_Collection` |
| `$XSAPPNAME.ProcurementAdmin`  | Executive sign-off, S/4HANA Cloud sync, and destination ping | `CapEx_Admin_Collection` |

### Persona Switcher in Local Development
In the top ShellBar of the web application, use the **Persona Switcher** dropdown to toggle between:
- 👑 **Sarah Jenkins (Admin / CPO):** Has full privileges to grant financial release and dispatch S/4HANA orders.
- 👔 **Alex Rivera (Department Manager):** Can approve or reject submitted requests in the Engineering department.
- 👤 **David Kim (Viewer / Requester):** Can browse reports and create/submit new draft proposals.

---

## ☁️ Production Deployment to SAP BTP Cloud Foundry

### 1. Build Multi-Target Application Archive (MTAR)
Prerequisite: Install the Cloud MTA Build Tool (`npm install -g mbt`).
```bash
mbt build
```
This produces `mta_archives/btp-enterprise-procurement_1.0.0.mtar`.

### 2. Login to SAP BTP Subaccount
```bash
cf login -a https://api.cf.<region>.hana.ondemand.com -o <your-org> -s <your-space>
```

### 3. Deploy MTAR to Cloud Foundry
Prerequisite: Install the Multiapps CF plugin (`cf install-plugin multiapps`).
```bash
cf deploy mta_archives/btp-enterprise-procurement_1.0.0.mtar
```

The deployer will automatically:
1. Provision the **SAP HANA Cloud HDI container** (`btp-enterprise-procurement-db`).
2. Deploy CDS tables, views, and seed data via the DB deployer module.
3. Bind the **SAP BTP XSUAA service** instance (`btp-enterprise-procurement-uaa`).
4. Configure **BTP Destinations** (`S4HANA_CLOUD_DEST`, `SAP_AI_CORE_DEST`).
5. Launch the CAP Node.js microservice (`btp-enterprise-procurement-srv`) and App Router.

---

## 🌐 REST & OData V4 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/odata/v4/procurement/CapExRequests` | `GET` | List all CapEx requests with filtering & sorting |
| `/odata/v4/procurement/CapExRequests` | `POST` | Create a new CapEx proposal with line items |
| `/odata/v4/procurement/CapExRequests(ID={id})/submit` | `POST` | Submit proposal for management review |
| `/odata/v4/procurement/CapExRequests(ID={id})/deptApprove` | `POST` | Approve request at department tier |
| `/odata/v4/procurement/CapExRequests(ID={id})/financeApprove` | `POST` | Approve request at executive finance tier |
| `/odata/v4/procurement/CapExRequests(ID={id})/rejectProposal` | `POST` | Reject proposal with governance rationale |
| `/odata/v4/procurement/CapExRequests(ID={id})/syncWithS4HANA` | `POST` | Release document to S/4HANA Cloud |
| `/odata/v4/procurement/CapExRequests(ID={id})/triggerAIAnalysis` | `POST` | Trigger SAP GenAI Hub risk assessment |
| `/odata/v4/procurement/getExecutiveMetrics()` | `GET` | Retrieve real-time portfolio KPI metrics |
| `/odata/v4/procurement/getDepartmentAnalytics()` | `GET` | Retrieve per-department spend vs budget |
| `/odata/v4/procurement/copilotQuery` | `POST` | Conversational query to the AI Copilot |
| `/odata/v4/procurement/pingDestination` | `POST` | Ping destination endpoint and record latency |
| `/odata/v4/procurement/importCapExCSV` | `POST` | Ingest CSV data into CapEx tables |
| `/api/export-csv` | `GET` | Download full portfolio as a `.csv` file |
| `/api/health` | `GET` | Diagnostic health probe for BTP monitoring |
