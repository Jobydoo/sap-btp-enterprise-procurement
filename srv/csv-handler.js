const crypto = require('crypto');

/**
 * Enterprise CSV Bulk Import & Export Processor - Spécialisé BTP Maroc
 * Conforme RFC 4180 avec détection automatique virgule/point-virgule et devise MAD
 */
class CSVHandler {
    /**
     * Parse les lignes brutes CSV en tableau d'objets
     */
    static parseCSV(csvText) {
        if (!csvText || typeof csvText !== 'string') return [];

        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return [];

        const headerLine = lines[0];
        const delimiter = headerLine.includes(';') ? ';' : ',';

        const parseLine = (text) => {
            const values = [];
            let inQuotes = false;
            let current = '';

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    if (inQuotes && text[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            return values;
        };

        const headers = parseLine(headerLine).map(h => h.replace(/^["']|["']$/g, '').trim());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx].replace(/^["']|["']$/g, '').trim();
                });
                rows.push(row);
            }
        }

        return rows;
    }

    /**
     * Traite les lignes CSV et insère les demandes et postes BTP en base de données
     */
    static async importRequests(tx, cds, csvText) {
        const rows = this.parseCSV(csvText);
        if (!rows.length) {
            return {
                success: false,
                importedCount: 0,
                errors: ['Le fichier CSV est vide ou non conforme. En-tête et au moins une ligne requises.'],
                message: 'Aucun enregistrement valide trouvé dans le CSV.'
            };
        }

        const { CapExRequests, CapExItems, CostCenters, Vendors } = cds.entities('sap.btp.procurement');
        const costCenters = await tx.run(SELECT.from(CostCenters));
        const vendors = await tx.run(SELECT.from(Vendors));

        const defaultCC = costCenters[0]?.ID || null;
        const defaultVendor = vendors[0]?.ID || null;

        const errors = [];
        let importedCount = 0;
        const requestGroups = new Map();

        rows.forEach((row, idx) => {
            const rowNum = idx + 2;
            const title = row.title || row.Title;
            const department = row.department || row.Department;
            const requestedBy = row.requestedBy || row.RequestedBy || 'youssef.benjelloun@btp-maroc.ma';
            const priority = (row.priority || row.Priority || 'MEDIUM').toUpperCase();
            const justification = row.businessJustification || row.Justification || 'Importation lot BTP via fichier CSV';

            const description = row.materialDescription || row.Description || row.ItemDescription;
            const category = row.category || row.Category || 'Hardware';
            const quantity = parseFloat(row.quantity || row.Quantity || 1);
            const unitPrice = parseFloat(row.unitPrice || row.UnitPrice || 0);

            if (!title) {
                errors.push(`Ligne ${rowNum} : Champ 'title' (titre) obligatoire manquant.`);
                return;
            }
            if (!department) {
                errors.push(`Ligne ${rowNum} : Champ 'department' (direction/chantier) obligatoire manquant.`);
                return;
            }
            if (!description || isNaN(quantity) || isNaN(unitPrice)) {
                errors.push(`Ligne ${rowNum} : Détails du poste invalides (description, quantité ou prix unitaire).`);
                return;
            }

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

        for (const [key, group] of requestGroups.entries()) {
            try {
                const requestId = crypto.randomUUID();
                const totalAmount = group.items.reduce((sum, it) => sum + it.lineTotal, 0);

                const reqEntity = {
                    ID: requestId,
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
                    isExternalSynced: false
                };

                await tx.run(INSERT.into(CapExRequests).entries(reqEntity));

                const itemEntities = group.items.map((it, idx) => ({
                    ID: crypto.randomUUID(),
                    request_ID: requestId,
                    itemNumber: (idx + 1) * 10,
                    materialDescription: it.materialDescription,
                    category: it.category,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    lineTotal: it.lineTotal,
                    unitOfMeasure: 'U',
                    targetVendor_ID: defaultVendor,
                    costCenter_ID: defaultCC,
                    deliveryDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
                    isBenchmarkExceeded: false,
                    benchmarkDeviation: 0.00
                }));

                await tx.run(INSERT.into(CapExItems).entries(itemEntities));
                importedCount++;
            } catch (err) {
                errors.push(`Échec d'insertion de la demande '${group.title}' : ${err.message}`);
            }
        }

        return {
            success: importedCount > 0,
            importedCount,
            errors,
            message: `Traitement terminé avec succès. ${importedCount} demande(s) de chantier créées.`
        };
    }

    /**
     * Exporte l'ensemble des demandes et postes BTP vers une chaîne CSV au format RFC 4180
     */
    static exportToCSV(requests = [], items = []) {
        const itemMap = new Map();
        items.forEach(it => {
            const reqId = it.request_ID;
            if (!itemMap.has(reqId)) itemMap.set(reqId, []);
            itemMap.get(reqId).push(it);
        });

        const headers = [
            'RequestID',
            'Title',
            'Department',
            'RequestedBy',
            'Status',
            'Priority',
            'TotalAmount',
            'Currency',
            'RiskScore',
            'RiskLevel',
            'S4PrNumber',
            'ItemNumber',
            'MaterialDescription',
            'Category',
            'Quantity',
            'UnitPrice',
            'LineTotal'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = [headers.join(',')];

        requests.forEach(req => {
            const reqItems = itemMap.get(req.ID) || [{}];
            reqItems.forEach(it => {
                rows.push([
                    escapeCSV(req.ID),
                    escapeCSV(req.title),
                    escapeCSV(req.department),
                    escapeCSV(req.requestedBy),
                    escapeCSV(req.status),
                    escapeCSV(req.priority),
                    req.totalAmount || 0,
                    escapeCSV(req.currency || 'MAD'),
                    req.riskScore || 0,
                    escapeCSV(req.riskLevel || 'LOW'),
                    escapeCSV(req.s4PrNumber || ''),
                    it.itemNumber || '',
                    escapeCSV(it.materialDescription || ''),
                    escapeCSV(it.category || ''),
                    it.quantity || '',
                    it.unitPrice || '',
                    it.lineTotal || ''
                ].join(','));
            });
        });

        return rows.join('\r\n');
    }
}

module.exports = CSVHandler;
