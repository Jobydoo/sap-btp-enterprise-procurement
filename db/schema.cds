namespace sap.btp.procurement;

using { cuid, managed } from '@sap/cds/common';

type Status : String enum {
    DRAFT = 'DRAFT';
    SUBMITTED = 'SUBMITTED';
    DEPT_APPROVED = 'DEPT_APPROVED';
    FINANCE_APPROVED = 'FINANCE_APPROVED';
    REJECTED = 'REJECTED';
    ORDER_CREATED = 'ORDER_CREATED';
}

type Priority : String enum {
    LOW = 'LOW';
    MEDIUM = 'MEDIUM';
    HIGH = 'HIGH';
    CRITICAL = 'CRITICAL';
}

type RiskLevel : String enum {
    LOW = 'LOW';
    MEDIUM = 'MEDIUM';
    HIGH = 'HIGH';
    CRITICAL = 'CRITICAL';
}

type ItemCategory : String enum {
    Hardware = 'Hardware';
    Software = 'Software';
    Facility = 'Facility';
    Machinery = 'Machinery';
    Consulting = 'Consulting';
    CloudServices = 'CloudServices';
}

entity CapExRequests : cuid, managed {
    title               : String(120) not null;
    description         : String(1000);
    department          : String(50) not null;
    requestedBy         : String(80) not null;
    totalAmount         : Decimal(15, 2) default 0.00;
    currency            : String(3) default 'USD';
    priority            : Priority default 'MEDIUM';
    status              : Status default 'DRAFT';
    submissionDate      : Timestamp;
    approvalDate        : Timestamp;
    rejectionReason     : String(500);
    riskScore           : Decimal(5, 2) default 0.00; // 0.00 - 100.00
    riskLevel           : RiskLevel default 'LOW';
    businessJustification: String(2000);
    s4PrNumber          : String(20); // Linked S/4HANA Purchase Requisition Number
    isExternalSynced    : Boolean default false;
    items               : Composition of many CapExItems on items.request = $self;
    auditTrail          : Association to many AuditLogs on auditTrail.recordId = $self.ID;
    aiEvaluations       : Association to many AIAnalysisLog on aiEvaluations.request = $self;
}

entity CapExItems : cuid, managed {
    request             : Association to CapExRequests not null;
    itemNumber          : Integer not null;
    materialDescription : String(200) not null;
    category            : ItemCategory not null;
    quantity            : Decimal(10, 2) not null;
    unitPrice           : Decimal(15, 2) not null;
    lineTotal           : Decimal(15, 2);
    unitOfMeasure       : String(10) default 'EA';
    targetVendor        : Association to Vendors;
    costCenter          : Association to CostCenters;
    deliveryDate        : Date;
    assetClass          : String(20);
    isBenchmarkExceeded : Boolean default false;
    benchmarkDeviation  : Decimal(5, 2) default 0.00; // % deviation from catalog price
}

entity Budgets {
    key department      : String(50);
    key fiscalYear      : Integer;
    totalBudget         : Decimal(15, 2) not null;
    committedAmount     : Decimal(15, 2) default 0.00;
    spentAmount         : Decimal(15, 2) default 0.00;
    remainingBudget     : Decimal(15, 2);
    currency            : String(3) default 'USD';
    utilizationPercent  : Decimal(5, 2) default 0.00;
}

entity Vendors : cuid, managed {
    supplierName        : String(100) not null;
    s4VendorCode        : String(20) not null;
    riskCategory        : RiskLevel default 'LOW';
    rating              : Decimal(3, 2) default 4.50; // out of 5.00
    country             : String(3) default 'US';
    city                : String(50);
    paymentTerms        : String(30) default 'Net 30';
    isActive            : Boolean default true;
    complianceScore     : Decimal(5, 2) default 95.00;
}

entity CostCenters : cuid, managed {
    costCenterCode      : String(20) not null;
    description         : String(100) not null;
    companyCode         : String(10) default '1010';
    department          : String(50) not null;
    managerEmail        : String(80);
    allocatedBudget     : Decimal(15, 2);
    currency            : String(3) default 'USD';
    isActive            : Boolean default true;
}

entity AuditLogs : cuid {
    timestamp           : Timestamp default $now;
    recordId            : UUID;
    entityName          : String(50) default 'CapExRequests';
    action              : String(50) not null; // CREATE, SUBMIT, DEPT_APPROVE, FINANCE_APPROVE, REJECT, SYNC_S4, AI_EVALUATE
    performedBy         : String(80) not null;
    userRole            : String(50);
    previousStatus      : String(30);
    newStatus           : String(30);
    comments            : String(1000);
    ipAddress           : String(45) default '127.0.0.1';
}

entity AIAnalysisLog : cuid {
    request             : Association to CapExRequests;
    analysisTimestamp   : Timestamp default $now;
    riskScore           : Decimal(5, 2);
    riskRating          : RiskLevel;
    executiveSummary    : String(2000);
    recommendation      : String(1000);
    detectedAnomalies   : String(2000); // JSON string or detailed findings
    policyCheckPassed   : Boolean default true;
    suggestedMitigations: String(1500);
    estimatedROI        : String(100);
    paybackPeriodMonths : Integer;
    modelUsed           : String(50) default 'SAP GenAI Hub - GPT-4o Enterprise';
}

entity SystemIntegrations : cuid, managed {
    systemKey           : String(50) not null; // S4HANA_CLOUD, SAP_AI_CORE, EVENT_MESH, CREDENTIAL_STORE
    systemName          : String(100) not null;
    destinationName     : String(60) not null;
    serviceType         : String(40); // REST, ODATA_V4, EVENT_AMQP, CREDSTORE
    endpointUrl         : String(255);
    authType            : String(40) default 'OAuth2SAMLBearerAssertion';
    status              : String(20) default 'CONNECTED'; // CONNECTED, DEGRADED, SIMULATED, ERROR
    lastPing            : Timestamp;
    latencyMs           : Integer default 45;
    totalSyncedRecords  : Integer default 0;
    lastSyncMessage     : String(500);
}
