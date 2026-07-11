import api from '../axiosClient';
import type {
  ProductionTemplate,
  ProductionTemplateUpdateRequest,
  ProductionLotResult,
  LotDeclarationRequest,
  LotCancelRequest,
  ExpiringLot,
  PendingCostLot,
} from '../../types';

const kitchenService = {
  // ── Production Templates ──────────────────────────

  /**
   * GET /phase3/templates
   * List of daily production templates (default qty per product).
   * This represents the target quantity to produce each day.
   */
  getTemplates: () =>
    api.get<ProductionTemplate[]>('/phase3/templates'),

  /**
   * PUT /phase3/templates/{id}
   * Update default qty for a template.
   * (Flow rule 2: template qty minus remaining stock = daily production list)
   */
  updateTemplate: (id: string, data: ProductionTemplateUpdateRequest) =>
    api.put<ProductionTemplate>(`/phase3/templates/${id}`, data),

  // ── Production Lots ───────────────────────────────

  /**
   * POST /phase3/lots
   * Declare a new production lot.
   * Response includes: lotNumber, expiryDate, FIFO costPerUnit, costStatus,
   * and pendingIngredients (ingredients missing a price).
   * Format: LOT-YYYYMMDD-CODE-001
   */
  declareLot: (data: LotDeclarationRequest) =>
    api.post<ProductionLotResult>('/phase3/lots', data),

  /**
   * GET /phase3/lots/expiring?days=N
   * Lots expiring within the next N days.
   * isExpiredToday=true rows should be highlighted red in the UI.
   */
  getExpiringLots: (days = 1) =>
    api.get<ExpiringLot[]>('/phase3/lots/expiring', { days: String(days) }),

  /**
   * GET /phase3/lots/pending-cost
   * Lots where FIFO cost could not be confirmed due to missing ingredient prices.
   * Show warning and link to Cost Price module.
   */
  getPendingCostLots: () =>
    api.get<PendingCostLot[]>('/phase3/lots/pending-cost'),

  /**
   * POST /phase3/lots/{lotNumber}/cancel
   * Record cancelled quantity for a lot (e.g. expired / damaged).
   */
  cancelLot: (lotNumber: string, data: LotCancelRequest) =>
    api.post<void>(`/phase3/lots/${lotNumber}/cancel`, data),
};

export default kitchenService;
