import api from '../axiosClient';
import type {
  ProductionPlan,
  PlanLineAdjustRequest,
  ProductionRequest,
  ProductionRequestListParams,
  StartProductionRequest,
  CompleteProductionRequest,
  SheetCakeOrder,
  SheetCakeAddonRequest,
  LockProductionRequest,
} from '../../types';

/**
 * productionService
 *
 * Quản lý toàn bộ vòng đời sản xuất:
 *
 * [BUỔI TỐI] Kế hoạch sản xuất ngày mai:
 *   API #3 — Sinh kế hoạch (generate)
 *   API #4 — Xem kế hoạch
 *   API #5 — Điều chỉnh từng dòng
 *   API #6 — Duyệt kế hoạch → sinh ProductionRequests
 *
 * [TRONG NGÀY] Bếp sản xuất:
 *   API #10 — Xem danh sách lệnh sản xuất
 *   API #11 — Bắt đầu làm từng mẻ
 *   API #12 — Hoàn thành, nhập qty thực tế
 *
 * [NẾU CÓ ĐƠN BÁNH KEM]:
 *   API #13 — Xem đơn cần review
 *   API #14 — Thêm topping đặc thù
 *   API #15 — Lock vào sản xuất
 */
const productionService = {
  // ── KẾ HOẠCH SẢN XUẤT ────────────────────────────

  getPlanByDate: (date: string) =>
    api.get<ProductionPlan>(`/api/v1/production/plans/by-date?date=${date}`),

  generatePlan: (date: string) =>
    api.post<ProductionPlan>(`/api/v1/production/plans/generate?date=${date}`),

  getPlan: (id: string) =>
    api.get<ProductionPlan>(`/api/v1/production/plans/${id}`),

  adjustPlanLine: (id: string, lines: { lineId: string; adjustedQty: number }[]) =>
    api.put<ProductionPlan>(`/api/v1/production/plans/${id}/adjust`, { lines }),

  approvePlan: (id: string) =>
    api.post<ProductionPlan>(`/api/v1/production/plans/${id}/approve`),

  rejectPlan: (id: string, reason: string) =>
    api.post<ProductionPlan>(
      `/api/v1/production/plans/${id}/reject?reason=${encodeURIComponent(reason)}`,
    ),

  regeneratePlan: (id: string) =>
    api.post<ProductionPlan>(`/api/v1/production/plans/${id}/regenerate`),

  generateRequestsFromPlan: (id: string) =>
    api.post<{ requestsCreated: number }>(`/api/v1/production/plans/${id}/generate-requests`),

  // ── LỆNH SẢN XUẤT (TRONG NGÀY) ───────────────────

  /**
   * GET /admin/production/requests?date=...&status=...&requestType=...
   * Bếp xem danh sách lệnh sản xuất trong ngày (API #10).
   *
   * @param params.date        Lọc theo ngày (yyyy-MM-dd)
   * @param params.status      Lọc theo trạng thái
   * @param params.requestType Lọc theo loại: PLAN | URGENT | CUSTOMER_ORDER
   *
   * @example
   * // Xem tất cả lệnh hôm nay
   * const requests = await productionService.listRequests({ date: '2026-07-08' });
   *
   * @example
   * // Xem lệnh đang trong sản xuất
   * const inProd = await productionService.listRequests({ status: 'IN_PRODUCTION' });
   */
  listRequests: (params: ProductionRequestListParams) =>
    api.get<ProductionRequest[]>(
      '/admin/production/requests',
      params as Record<string, unknown>,
    ),

  /**
   * POST /admin/production/requests/{id}/start
   * Bắt đầu sản xuất mẻ bánh (API #11).
   * Chuyển status: APPROVED → IN_PRODUCTION.
   *
   * @param id   UUID lệnh sản xuất
   * @param data Ghi chú thêm (optional)
   *
   * @example
   * await productionService.startRequest('req-uuid', { note: 'Bắt đầu lúc 6h sáng' });
   */
  startRequest: (id: string, data?: StartProductionRequest) =>
    api.post<ProductionRequest>(
      `/admin/production/requests/${id}/start`,
      data ?? {},
    ),

  /**
   * POST /admin/production/requests/{id}/complete
   * Hoàn thành sản xuất — nhập số lượng thực tế (API #12).
   * Chuyển status: IN_PRODUCTION → COMPLETED.
   *
   * Backend sẽ:
   *   - Lưu actualQty
   *   - Tính FIFO cost cho lô sản xuất
   *   - Cập nhật tồn kho thành phẩm
   *
   * @param id   UUID lệnh sản xuất
   * @param data Số lượng thực tế + ghi chú
   *
   * @example
   * await productionService.completeRequest('req-uuid', {
   *   actualQty: 95,
   *   note: 'Hao hụt 5 cái do bể',
   * });
   */
  completeRequest: (id: string, data: CompleteProductionRequest) =>
    api.post<ProductionRequest>(
      `/admin/production/requests/${id}/complete`,
      data,
    ),

  // ── ĐƠN BÁNH KEM (SHEET CAKE) ────────────────────

  /**
   * GET /admin/production/sheet-cake/pending?deliveryDate=yyyy-MM-dd
   * Xem danh sách đơn bánh kem cần review trước khi sản xuất (API #13).
   *
   * Đơn có thể cần bổ sung topping đặc thù hoặc lock vào kế hoạch.
   *
   * @param deliveryDate Ngày giao bánh cần xem đơn
   *
   * @example
   * const orders = await productionService.getPendingSheetCakes('2026-07-09');
   */
  getPendingSheetCakes: (deliveryDate: string) =>
    api.get<SheetCakeOrder[]>(
      '/admin/production/sheet-cake/pending',
      { deliveryDate },
    ),

  /**
   * POST /admin/production/sheet-cake/lines/{lineId}/addons
   * Thêm topping / nguyên liệu add-on đặc thù cho một dòng bánh kem (API #14).
   *
   * Dùng khi khách yêu cầu topping ngoài công thức gốc
   * (vd: thêm dâu tây, chocolate riêng).
   *
   * @param lineId UUID dòng bánh kem
   * @param data   Thông tin add-on: ingredientId, qty, unit, note
   *
   * @example
   * await productionService.addSheetCakeAddon('line-uuid', {
   *   ingredientId: 'uuid-dau-tay',
   *   qty: 200,
   *   unit: 'g',
   *   note: 'Khách yêu cầu thêm dâu tây tươi',
   * });
   */
  addSheetCakeAddon: (lineId: string, data: SheetCakeAddonRequest) =>
    api.post<SheetCakeOrder>(
      `/admin/production/sheet-cake/lines/${lineId}/addons`,
      data,
    ),

  /**
   * POST /admin/production/sheet-cake/orders/{id}/lock-production
   * Lock đơn bánh kem vào sản xuất (API #15).
   * Chuyển status: CONFIRMED → IN_PRODUCTION.
   *
   * Sau khi lock, đơn sẽ xuất hiện trong danh sách lệnh sản xuất
   * và không thể chỉnh sửa add-on nữa.
   *
   * @param id   UUID đơn bánh kem
   * @param data Ghi chú (optional)
   *
   * @example
   * await productionService.lockSheetCakeOrder('order-uuid', {
   *   note: 'Đã confirm với khách, bắt đầu làm',
   * });
   */
  lockSheetCakeOrder: (id: string, data?: LockProductionRequest) =>
    api.post<SheetCakeOrder>(
      `/admin/production/sheet-cake/orders/${id}/lock-production`,
      data ?? {},
    ),
};

export default productionService;
