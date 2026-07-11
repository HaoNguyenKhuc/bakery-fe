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

  /**
   * POST /admin/production/plan/generate?targetDate=yyyy-MM-dd
   * Sinh kế hoạch sản xuất cho ngày mai (API #3).
   *
   * Backend tự tính: template_qty − tồn_kho_hiện_tại = qty cần sản xuất.
   * Kết quả là ProductionPlan với status = DRAFT, chờ review + approve.
   *
   * @param targetDate Ngày sản xuất (yyyy-MM-dd), thường là ngày mai
   *
   * @example
   * const plan = await productionService.generatePlan('2026-07-09');
   */
  generatePlan: (targetDate: string) =>
    api.post<ProductionPlan>(
      `/admin/production/plan/generate?targetDate=${targetDate}`,
    ),

  /**
   * GET /admin/production/plans/{id}
   * Xem chi tiết kế hoạch sản xuất (API #4).
   * Dùng để review và kiểm tra trước khi duyệt.
   *
   * @param id UUID của kế hoạch
   */
  getPlan: (id: string) =>
    api.get<ProductionPlan>(`/admin/production/plans/${id}`),

  /**
   * PUT /admin/production/plans/{id}/lines/{lineId}
   * Điều chỉnh số lượng một dòng trong kế hoạch (API #5).
   *
   * Dùng khi số lượng tự động tính chưa hợp lý,
   * bếp trưởng có thể override từng dòng trước khi duyệt.
   *
   * @param id     UUID kế hoạch
   * @param lineId UUID dòng cần điều chỉnh
   * @param data   Số lượng mới + ghi chú
   *
   * @example
   * await productionService.adjustPlanLine('plan-uuid', 'line-uuid', {
   *   plannedQty: 120,
   *   note: 'Thêm vì đơn hàng phát sinh',
   * });
   */
  adjustPlanLine: (id: string, lineId: string, data: PlanLineAdjustRequest) =>
    api.put<ProductionPlan>(
      `/admin/production/plans/${id}/lines/${lineId}`,
      data,
    ),

  /**
   * POST /admin/production/plans/{id}/approve
   * Duyệt kế hoạch → sinh ProductionRequests (API #6).
   *
   * Sau khi approve:
   *   - Plan status → APPROVED
   *   - Hệ thống tự sinh ProductionRequest cho từng dòng
   *   - Bếp sẽ thấy lệnh trong danh sách /requests
   *
   * @param id UUID kế hoạch
   */
  approvePlan: (id: string) =>
    api.post<ProductionPlan>(`/admin/production/plans/${id}/approve`),

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
