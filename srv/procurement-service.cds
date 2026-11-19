using { sap.btp.procurement as my } from '../db/schema';

service ProcurementService @(path: '/odata/v4/procurement') {

    // Main transactional entities
    entity CapExRequests as projection on my.CapExRequests actions {
        action submit() returns CapExRequests;
        action deptApprove(comments: String) returns CapExRequests;
        action financeApprove(comments: String) returns CapExRequests;
        action rejectProposal(reason: String) returns CapExRequests;
        action syncWithS4HANA() returns CapExRequests;
        action triggerAIAnalysis() returns AIAnalysisLog;
    };

    entity CapExItems as projection on my.CapExItems;
    @readonly entity Budgets as projection on my.Budgets;
    @readonly entity Vendors as projection on my.Vendors;
    @readonly entity CostCenters as projection on my.CostCenters;
    @readonly entity AuditLogs as projection on my.AuditLogs;
    @readonly entity AIAnalysisLog as projection on my.AIAnalysisLog;
    entity SystemIntegrations as projection on my.SystemIntegrations actions {
        action ping() returns SystemIntegrations;
    };

    // Complex Types for Analytics & AI
    type ExecutiveMetrics {
        totalCommittedCapEx    : Decimal(15, 2);
        totalBudgetAllocated   : Decimal(15, 2);
        overallBudgetUtilization: Decimal(5, 2);
        pendingApprovalsCount  : Integer;
        highRiskRequestsCount  : Integer;
        approvedRequestsCount  : Integer;
        s4SyncedCount          : Integer;
        activeIntegrationsCount: Integer;
        currency               : String(3);
    }

    type DepartmentMetric {
        department             : String(50);
        totalAllocated         : Decimal(15, 2);
        totalCommitted         : Decimal(15, 2);
        totalSpent             : Decimal(15, 2);
        utilizationRate        : Decimal(5, 2);
        pendingCount           : Integer;
        approvedCount          : Integer;
    }

    type CopilotResponse {
        reply                  : String(4000);
        riskAssessment         : String(500);
        confidenceScore        : Decimal(3, 2);
        actionRecommended      : String(200);
        anomaliesDetected      : array of String;
        suggestedNextSteps     : array of String;
    }

    type ImportResult {
        success                : Boolean;
        importedCount          : Integer;
        errors                 : array of String;
        message                : String(500);
    }

    // Top-level Analytics, AI Copilot, and Bulk Data APIs
    function getExecutiveMetrics() returns ExecutiveMetrics;
    function getDepartmentAnalytics() returns array of DepartmentMetric;
    action copilotQuery(prompt: String, requestId: UUID) returns CopilotResponse;
    action pingDestination(systemKey: String) returns SystemIntegrations;
    action importCapExCSV(csvContent: String) returns ImportResult;
}
