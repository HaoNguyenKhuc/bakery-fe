import api from '../axiosClient';
import type { ProdAdjustment } from '../../types';

/**
 * prodAdjustmentService
 *
 * Quản lý điều chỉnh sản xuất (prod-adjustment-controller):
 *
 *   GET /api/v1/production-adjustments   — Danh sách điều chỉnh SX (có filter)
 *
 * Điều chỉnh SX xảy ra khi số lượng thực tế sản xuất lệch so với kế hoạch,
 * do nguyên liệu biến động (INGREDIENT_VARIANCE) hoặc hao hụt sản xuất (PRODUCTION_WASTAGE).
 *
 * @see dev-ui.html: pageProdAdjustments()
 *
 * ⚠️ NOTE: Endpoint này chưa được xác nhận từ BE — đây là stub dựa trên
 *    completeLine() trong productionRequestService (adjustmentType field).
 *    Cần xác nhận với BE team endpoint chính xác.
 */
const prodAdjustmentService = {
  /**
   * Lấy danh sách các điều chỉnh sản xuất.
   *
   * @param params.productionDate   Lọc theo ngày sản xuất (yyyy-MM-dd, optional)
   * @param params.adjustmentType   Lọc theo loại: 'INGREDIENT_VARIANCE' | 'PRODUCTION_WASTAGE' (optional)
   * @param params.page             Trang (0-based, default 0)
   * @param params.size             Kích thước trang (default 20)
   *
   * @example
   * const adjustments = await prodAdjustmentService.getList({
   *   productionDate: '2026-07-22',
   *   adjustmentType: 'PRODUCTION_WASTAGE',
   * });
   */
  getList: (params?: {
    productionDate?: string;
    adjustmentType?: 'INGREDIENT_VARIANCE' | 'PRODUCTION_WASTAGE';
    page?: number;
    size?: number;
  }): Promise<ProdAdjustment[]> =>
    api.get<ProdAdjustment[]>(
      '/api/v1/production-adjustments',
      params as Record<string, unknown> | undefined,
    ),
};

export default prodAdjustmentService;
