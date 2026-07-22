import api from '../axiosClient';
import type {
  InventoryLot,
  InventoryLotParams,
  ReconciliationSummary,
  ReconciliationParams,
  PageResponse,
  UnifiedTransactionResponse,
} from '../../types';

/**
 * inventoryService
 *
 * [CUỐI NGÀY] Kiểm tra tồn kho & đối chiếu:
 *
 *   API #16 — GET /api/v1/inventory/lots?branchId=...
 *             Xem tồn kho thực tế theo lô (FIFO)
 *
 *   API #17 — GET /api/v1/reconciliation/...
 *             3-way đối chiếu: Bếp giao → POS bán → Shop báo cáo hủy
 */
const inventoryService = {
  // ── TỒN KHO THEO LÔ ─────────────────────────────

  /**
   * GET /api/v1/inventory/lots
   * Xem tồn kho nguyên liệu thực tế theo lot FIFO (API #16).
   *
   * Mỗi lot tương ứng 1 lần nhập hàng (từ phiếu IMPORT được duyệt).
   * FIFO: lot nào nhập trước → xuất trước.
   *
   * @param params.branchId    Lọc theo chi nhánh / kho (optional)
   * @param params.ingredientId Lọc theo nguyên liệu cụ thể (optional)
   * @param params.page        Trang (0-based)
   * @param params.size        Kích thước trang
   *
   * @example
   * // Xem tất cả tồn kho của Kho Tổng
   * const lots = await inventoryService.getLots({ branchId: 'uuid-kho-tong' });
   *
   * @example
   * // Xem tồn bột mì của Kho Bếp
   * const botMi = await inventoryService.getLots({
   *   branchId: 'uuid-kho-bep',
   *   ingredientId: 'uuid-bot-mi',
   * });
   */
  getLots: (params?: InventoryLotParams) =>
    api.get<PageResponse<InventoryLot>>(
      '/api/v1/inventory/lots',
      params as Record<string, unknown> | undefined,
    ),

  /**
   * GET /api/v1/inventory/lots/{lotId}
   * Chi tiết một lô tồn kho.
   *
   * @param lotId UUID của lot
   */
  getLotById: (lotId: string) =>
    api.get<InventoryLot>(`/api/v1/inventory/lots/${lotId}`),

  /**
   * GET /api/v1/inventory/active
   * Lấy danh sách tồn kho đang active (gộp theo item thay vì từng lô).
   *
   * @param params InventoryFilter bao gồm branchId, itemId, page, size...
   */
  getActive: (params?: import('../../types').InventoryFilter) =>
    api.get<PageResponse<import('../../types').InventoryStockResponse>>(
      '/api/v1/inventory/active',
      params as Record<string, unknown> | undefined,
    ),

  getStockSummary: (warehouseCode: string) =>
    api.get<import('../../types').StockLotSummary[]>('/api/v1/stock-lots/summary', { warehouseCode }),

  getStockLotsByItem: (itemCode: string, warehouseCode?: string) => {
    const params: Record<string, string> = { 'item.code': itemCode };
    if (warehouseCode) {
      params['warehouse.code'] = warehouseCode;
    }
    return api.get<PageResponse<import('../../types').StockLotDetail>>('/api/v1/stock-lots', params);
  },

  // ── INVENTORY REQUESTS (PHIẾU NHẬP / XUẤT) ───────────────────

  getRequests: (params: { warehouseCode?: string, approvalStatus?: string, size?: number, page?: number }) => {
    const qs = new URLSearchParams();
    if (params.size) qs.set('size', String(params.size));
    if (params.page) qs.set('page', String(params.page));
    
    if (params.warehouseCode) {
      qs.set('warehouseCode', params.warehouseCode);
      if (params.approvalStatus) qs.set('approvalStatus', params.approvalStatus);
      return api.get<UnifiedTransactionResponse[]>(`/api/v1/inventory-requests/by-warehouse?${qs.toString()}`);
    } else {
      if (params.approvalStatus) qs.set('approvalStatus', params.approvalStatus); // try to pass it anyway
      return api.get<UnifiedTransactionResponse[]>(`/api/v1/inventory-requests?${qs.toString()}`);
    }
  },
  createRequest: (data: import('../../types').InventoryRequestPayload) =>
    api.post<UnifiedTransactionResponse>('/api/v1/inventory-requests', data),

  approveRequest: (requestId: string) =>
    api.post<UnifiedTransactionResponse>(`/api/v1/inventory-requests/${requestId}/approve`),

  rejectRequest: (requestId: string, payload: import('../../types').RejectRequestPayload) =>
    api.post<Record<string, unknown>>(`/api/v1/inventory-requests/${requestId}/reject`, payload),

  // ── ĐỐI CHIẾU CUỐI NGÀY ─────────────────────────

  /**
   * GET /api/v1/reconciliation/summary?date=...&branchId=...
   * 3-way đối chiếu cuối ngày (API #17).
   *
   * Nguồn 1: Bếp giao (ProductionRequest hoàn thành → actualQty)
   * Nguồn 2: POS bán   (dữ liệu máy tính tiền)
   * Nguồn 3: Shop báo  (nhân viên báo cáo số hủy)
   *
   * Kết quả: từng sản phẩm có status OK | OVER | UNDER
   *   OK    — Số liệu khớp (chênh ≤ tolerance)
   *   OVER  — Tồn kho thực tế nhiều hơn dự kiến
   *   UNDER — Tồn kho thực tế ít hơn dự kiến
   *
   * @param params.date      Ngày đối chiếu (yyyy-MM-dd) — bắt buộc
   * @param params.branchId  Cửa hàng / chi nhánh cần đối chiếu
   *
   * @example
   * const summary = await inventoryService.getReconciliation({
   *   date: '2026-07-08',
   *   branchId: 'uuid-cua-hang-1',
   * });
   *
   * // Highlight các dòng không khớp
   * summary.items
   *   .filter(item => item.status !== 'OK')
   *   .forEach(item => console.warn(`${item.productCode}: ${item.discrepancy}`));
   */
  getReconciliation: (params: ReconciliationParams) =>
    api.get<ReconciliationSummary>(
      '/api/v1/reconciliation/summary',
      params as Record<string, unknown>,
    ),

  /**
   * GET /api/v1/reconciliation/shop-report?date=...&branchId=...
   * Xem báo cáo hủy đã submit bởi nhân viên shop (Nguồn 3).
   *
   * @param date      Ngày báo cáo (yyyy-MM-dd)
   * @param branchId  Chi nhánh (optional)
   */
  getShopReports: (date: string, branchId?: string) =>
    api.get('/api/v1/reconciliation/shop-report', {
      date,
      ...(branchId ? { branchId } : {}),
    }),

  /**
   * GET /api/v1/reconciliation/pos-import?date=...&branchId=...
   * Xem dữ liệu POS đã upload theo ngày (Nguồn 2).
   *
   * @param date      Ngày dữ liệu POS (yyyy-MM-dd)
   * @param branchId  Chi nhánh (optional)
   */
  getPosData: (date: string, branchId?: string) =>
    api.get('/api/v1/reconciliation/pos-import', {
      date,
      ...(branchId ? { branchId } : {}),
    }),
};

export default inventoryService;
