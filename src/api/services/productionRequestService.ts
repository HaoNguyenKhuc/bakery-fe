import api from '../axiosClient';
import { axiosClient } from '../axiosClient';
import type {
  ProductionRequestDetail,
  ProductionRequestPageResponse,
  ProductionRequestInput,
  CompleteLineRequest,
} from '../../types';

/**
 * productionRequestService
 *
 * Quản lý lệnh sản xuất (production-request-controller):
 *
 * CRUD:
 *   GET    /api/v1/production-requests           — Danh sách phân trang
 *   POST   /api/v1/production-requests           — Tạo mới
 *   GET    /api/v1/production-requests/{id}      — Chi tiết
 *   PUT    /api/v1/production-requests/{id}      — Cập nhật
 *   DELETE /api/v1/production-requests/{id}      — Xóa
 *   GET    /api/v1/production-requests/all       — Tất cả (không phân trang)
 *
 * Approval:
 *   POST   /api/v1/production-requests/{id}/approve       — Phê duyệt
 *   POST   /api/v1/production-requests/{id}/reject        — Từ chối
 *
 * Sản xuất:
 *   POST   /api/v1/production-requests/{id}/lines/{lineId}/complete   — Hoàn thành 1 dòng
 *   POST   /api/v1/production-requests/{id}/lines/complete-batch      — Hoàn thành nhiều dòng
 */
const productionRequestService = {
  // ── CRUD ────────────────────────────────────────────────

  /**
   * Danh sách lệnh sản xuất có phân trang.
   * Filter theo: approvalStatus, productionType, productionDate, page, size
   */
  list: (params?: Record<string, unknown>) =>
    api.get<ProductionRequestPageResponse>('/api/v1/production-requests', params),

  /**
   * Lấy tất cả lệnh sản xuất (không phân trang).
   */
  listAll: () =>
    api.get<ProductionRequestDetail[]>('/api/v1/production-requests/all'),

  /**
   * Chi tiết 1 lệnh sản xuất theo ID.
   * @param id UUID lệnh sản xuất
   */
  getById: (id: string) =>
    api.get<ProductionRequestDetail>(`/api/v1/production-requests/${id}`),

  /**
   * Tạo mới lệnh sản xuất.
   * @param data ProductionRequestInput
   */
  create: (data: ProductionRequestInput) =>
    api.post<ProductionRequestDetail>('/api/v1/production-requests', data),

  /**
   * Cập nhật lệnh sản xuất.
   * @param id UUID lệnh sản xuất
   * @param data ProductionRequestInput
   */
  update: (id: string, data: ProductionRequestInput) =>
    api.put<ProductionRequestDetail>(`/api/v1/production-requests/${id}`, data),

  /**
   * Xóa lệnh sản xuất.
   * @param id UUID lệnh sản xuất
   */
  remove: (id: string) =>
    api.delete<void>(`/api/v1/production-requests/${id}`),

  // ── APPROVAL ─────────────────────────────────────────────

  /**
   * Phê duyệt lệnh sản xuất.
   * Chuyển approvalStatus: PENDING_APPROVAL → APPROVED
   * @param id UUID lệnh sản xuất
   */
  approve: (id: string) =>
    api.post<ProductionRequestDetail>(`/api/v1/production-requests/${id}/approve`),

  /**
   * Từ chối lệnh sản xuất.
   * Chuyển approvalStatus: PENDING_APPROVAL → REJECTED
   * @param id     UUID lệnh sản xuất
   * @param reason Lý do từ chối
   */
  reject: (id: string, reason: string) =>
    api.post<ProductionRequestDetail>(
      `/api/v1/production-requests/${id}/reject`,
      { reason },
    ),

  // ── SẢN XUẤT ────────────────────────────────────────────

  /**
   * Hoàn thành 1 dòng sản xuất.
   * POST /api/v1/production-requests/{id}/lines/{lineId}/complete
   *
   * @param id          UUID lệnh sản xuất
   * @param lineId      UUID dòng sản xuất
   * @param qtyProduced Số lượng thực tế sản xuất được
   * @param adjustmentType Loại điều chỉnh (optional)
   * @param reason      Lý do điều chỉnh (optional)
   * @param note        Ghi chú (optional)
   */
  completeLine: (
    id: string,
    lineId: string,
    params: {
      qtyProduced: number;
      adjustmentType?: 'INGREDIENT_VARIANCE' | 'PRODUCTION_WASTAGE';
      reason?: string;
      note?: string;
    },
  ) =>
    axiosClient.post<ProductionRequestDetail, ProductionRequestDetail>(
      `/api/v1/production-requests/${id}/lines/${lineId}/complete`,
      null,
      { params },
    ),

  /**
   * Hoàn thành nhiều dòng sản xuất cùng lúc (batch).
   * POST /api/v1/production-requests/{id}/lines/complete-batch
   *
   * @param id    UUID lệnh sản xuất
   * @param lines Danh sách dòng cần hoàn thành
   */
  completeLines: (id: string, lines: CompleteLineRequest[]) =>
    api.post<ProductionRequestDetail>(
      `/api/v1/production-requests/${id}/lines/complete-batch`,
      lines,
    ),
};

export default productionRequestService;
