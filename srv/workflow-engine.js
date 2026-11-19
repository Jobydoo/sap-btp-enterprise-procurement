const crypto = require('crypto');

/**
 * Enterprise State Machine & Audit Trail Engine for CapEx Requests
 * Following SAP BTP Clean Core Workflow Standards
 */
class WorkflowEngine {
    constructor(entities) {
        this.entities = entities;
    }

    static VALID_TRANSITIONS = {
        'DRAFT': ['SUBMITTED'],
        'SUBMITTED': ['DEPT_APPROVED', 'REJECTED'],
        'DEPT_APPROVED': ['FINANCE_APPROVED', 'REJECTED'],
        'FINANCE_APPROVED': ['ORDER_CREATED'],
        'REJECTED': ['SUBMITTED', 'DRAFT'], // allow rework & resubmission
        'ORDER_CREATED': []
    };

    /**
     * Validate whether a state transition is permitted
     */
    static canTransition(currentStatus, nextStatus) {
        const allowed = this.VALID_TRANSITIONS[currentStatus] || [];
        return allowed.includes(nextStatus);
    }

    /**
     * Record an immutable audit log entry in SAP BTP format
     */
    async logAuditEvent(tx, { recordId, action, performedBy, userRole, previousStatus, newStatus, comments, ipAddress }) {
        const { AuditLogs } = this.entities;
        const auditEntry = {
            ID: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            recordId,
            entityName: 'CapExRequests',
            action,
            performedBy: performedBy || 'system.btp.worker',
            userRole: userRole || 'ProcurementAdmin',
            previousStatus: previousStatus || '',
            newStatus: newStatus || '',
            comments: comments || `Action ${action} executed successfully.`,
            ipAddress: ipAddress || '127.0.0.1'
        };

        if (AuditLogs) {
            await tx.run(INSERT.into(AuditLogs).entries(auditEntry));
        }
        return auditEntry;
    }

    /**
     * Recalculate Department Budget Commitment when CapEx status changes
     */
    async updateBudgetCommitment(tx, department, fiscalYear = 2026) {
        const { Budgets, CapExRequests } = this.entities;
        if (!Budgets || !CapExRequests) return;
        
        // Sum committed CapEx for this department (SUBMITTED, DEPT_APPROVED, FINANCE_APPROVED, ORDER_CREATED)
        const activeRequests = await tx.run(
            SELECT.from(CapExRequests).where({
                department,
                status: { in: ['SUBMITTED', 'DEPT_APPROVED', 'FINANCE_APPROVED', 'ORDER_CREATED'] }
            })
        );

        const totalCommitted = activeRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

        const budget = await tx.run(SELECT.one.from(Budgets).where({ department, fiscalYear }));
        if (budget) {
            const totalBudget = parseFloat(budget.totalBudget) || 1;
            const spent = parseFloat(budget.spentAmount) || 0;
            const remaining = totalBudget - (totalCommitted + spent);
            const utilization = Math.min(100, Math.round(((totalCommitted + spent) / totalBudget) * 10000) / 100);

            await tx.run(
                UPDATE(Budgets)
                    .set({
                        committedAmount: totalCommitted,
                        remainingBudget: remaining,
                        utilizationPercent: utilization
                    })
                    .where({ department, fiscalYear })
            );
        }
    }
}

module.exports = WorkflowEngine;
