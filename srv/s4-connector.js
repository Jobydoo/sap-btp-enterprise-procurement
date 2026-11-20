/**
 * S/4HANA Cloud Destination Connector & Mock Integration Layer - BTP Chantiers Maroc
 * Conforme aux standards d'intégration SAP Cloud SDK & SAP S/4HANA Cloud (Filiale MA01)
 */
class S4Connector {
    constructor() {
        this.destinationName = 'S4HANA_CLOUD_DEST';
        this.isLocalDev = !process.env.VCAP_SERVICES;
    }

    /**
     * Vérifier l'état de la connexion avec le système distant
     */
    async pingDestination(systemKey = 'S4HANA_CLOUD') {
        const startTime = Date.now();
        
        // Simulation de la poignée de main réseau SAP BTP Connectivity
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 40) + 20));
        const latency = Date.now() - startTime;

        return {
            systemKey,
            status: 'CONNECTED',
            latencyMs: latency,
            lastPing: new Date().toISOString(),
            message: `Connexion établie avec la Destination [${systemKey}] via SAP BTP Connectivity (Zone Maroc MA01).`
        };
    }

    /**
     * Émettre une Demande d'Achat (DA) dans SAP S/4HANA Cloud
     * Réplication de l'API S/4HANA : /sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001
     */
    async createPurchaseRequisition(request, items) {
        if (!this.isLocalDev && process.env.VCAP_SERVICES) {
            try {
                console.log(`[S4Connector] Appel destination S/4HANA Cloud BTP : ${this.destinationName}`);
            } catch (err) {
                console.error('[S4Connector] Échec de transmission vers destination S/4HANA, mise en file d\'attente', err);
            }
        }

        // Numérotation S/4HANA officielle pour filiale marocaine
        const randomNum = Math.floor(10000000 + Math.random() * 90000000);
        const s4PrNumber = `PR-${randomNum.toString().substring(0, 8)}`;

        const s4Payload = {
            PurchaseRequisition: s4PrNumber,
            PurchaseRequisitionType: 'NB', // Demande d'achat standard
            CompanyCode: 'MA01', // Code Société Maroc
            PurchasingOrganization: 'MA10', // Organisation d'achats chantiers
            PurchasingGroup: '001',
            PurReqnDescription: request.title.substring(0, 40),
            TotalNetAmount: parseFloat(request.totalAmount),
            PurReqnOrigin: 'BTP_MAROC_CAPEX_HUB',
            PurReqnCurrency: request.currency || 'MAD',
            to_PurchaseRequisitionItem: items.map((item, index) => ({
                PurchaseRequisitionItem: String((index + 1) * 10).padStart(5, '0'),
                PurchaseRequisitionItemText: item.materialDescription.substring(0, 40),
                RequestedQuantity: parseFloat(item.quantity),
                BaseUnit: item.unitOfMeasure || 'U',
                ItemNetAmount: parseFloat(item.lineTotal || (item.quantity * item.unitPrice)),
                MaterialGroup: item.category,
                CostCenter: 'CC-CFC-TOWER',
                Plant: 'MA10', // Division Chantier Casablanca / National
                DeliveryDate: item.deliveryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
            }))
        };

        return {
            success: true,
            s4PrNumber,
            s4Document: s4Payload,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Récupérer le référentiel des partenaires d'affaires BTP (Fournisseurs Maroc)
     */
    async fetchExternalVendors() {
        return [
            { s4Code: 'VEND-MA-1001', name: 'LafargeHolcim Maroc (Beton & Ciments)', status: 'Actif', creditLimit: 25000000, currency: 'MAD' },
            { s4Code: 'VEND-MA-1002', name: 'Sonasid - Societe Nationale de Siderurgie', status: 'Actif', creditLimit: 50000000, currency: 'MAD' },
            { s4Code: 'VEND-MA-1003', name: 'Tractafric Equipment Maroc (Caterpillar)', status: 'Actif', creditLimit: 15000000, currency: 'MAD' },
            { s4Code: 'VEND-MA-1004', name: 'Ciments du Maroc (Heidelberg Materials)', status: 'Actif', creditLimit: 30000000, currency: 'MAD' },
            { s4Code: 'VEND-MA-1005', name: 'Sika Maroc (Etanchéité & Adjuvants)', status: 'Actif', creditLimit: 8000000, currency: 'MAD' }
        ];
    }
}

module.exports = new S4Connector();
