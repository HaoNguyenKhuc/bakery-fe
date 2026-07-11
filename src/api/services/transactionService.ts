import api from '../axiosClient';
import type {
  UnifiedTransactionRequest,
  UnifiedTransactionResponse,
  TransactionListParams,
  TransactionType,
  PageResponse,
} from '../../types';

/**
 * transactionService
 *
 * Unified API cho tất cả phiếu kho:
 *   IMPORT   — Nhập NL từ nhà cung cấp vào Kho Tổng
 *   TRANSFER — Điều chuyển NL giữa các kho (PENDING → READY → ACTIVE, cần 2 lần duyệt)
 *   ADJUSTMENT, EXPORT, RETURN, DISCARD, STOCK_COUNT
 *
 * Base endpoint: /api/v1/transactions
 */
const transactionService = {
  // ── Danh sách & Chi tiết ──────────────────────────

  /**
   * GET /api/v1/transactions
   * Lấy danh sách phiếu theo type + filter.
   *
   * @param params.type    Bắt buộc — loại phiếu (IMPORT | TRANSFER | ...)
   * @param params.status  Mặc định PENDING
   * @param params.branchId Filter theo kho / chi nhánh
   * @param params.page    Trang (0-based), mặc định 0
   * @param params.size    Kích thước trang, mặc định 20
   *
   * @example
   * // Lấy danh sách phiếu nhập đang chờ duyệt
   * const list = await transactionService.list({ type: 'IMPORT', status: 'PENDING' });
   */
  list: (params: TransactionListParams) =>
    api.get<PageResponse<UnifiedTransactionResponse>>(
      '/api/v1/transactions',
      params as Record<string, unknown>,
    ),

  /**
   * GET /api/v1/transactions/{id}
   * Chi tiết một phiếu kho.
   *
   * @param id UUID của phiếu
   */
  getById: (id: string) =>
    api.get<UnifiedTransactionResponse>(`/api/v1/transactions/${id}`),

  // ── Tạo phiếu ────────────────────────────────────

  /**
   * POST /api/v1/transactions
   * Tạo phiếu kho mới (status = PENDING).
   *
   * IMPORT   → Nhập NL từ nhà cung cấp, cần supplierId + lines
   * TRANSFER → Xuất NL sang kho khác, cần fromBranchId + toBranchId + lines
   *
   * @example — Tạo phiếu nhập (API #1)
   * await transactionService.create({
   *   type: 'IMPORT',
   *   supplierId: 'uuid-ncc',
   *   lines: [{ ingredientCode: 'BOT_MI', qty: 50, unitPrice: 12000 }],
   * });
   *
   * @example — Tạo phiếu xuất NL sang Kho Bếp (API #7)
   * await transactionService.create({
   *   type: 'TRANSFER',
   *   fromBranchId: 'uuid-kho-tong',
   *   toBranchId: 'uuid-kho-bep',
   *   lines: [{ ingredientCode: 'BOT_MI', qty: 10 }],
   * });
   */
  create: (data: UnifiedTransactionRequest) =>
    api.post<UnifiedTransactionResponse>('/api/v1/transactions', data),

  // ── Duyệt phiếu ──────────────────────────────────

  /**
   * POST /api/v1/transactions/{id}/approve?type=...
   * Duyệt phiếu — backend tự resolve số bước cần thiết:
   *
   * IMPORT   → 1 bước: PENDING → ACTIVE (tạo inventory lots)
   * TRANSFER → 2 bước:
   *   Lần 1: PENDING → READY   (Cường / Kho Tổng xác nhận chuẩn bị)
   *   Lần 2: READY  → ACTIVE   (Bếp nhận hàng, trừ tồn kho)
   *
   * @param id   UUID phiếu
   * @param type Loại phiếu — bắt buộc để backend route đúng handler
   *
   * @example — Duyệt phiếu nhập (API #2)
   * await transactionService.approve('uuid-phieu', 'IMPORT');
   *
   * @example — Bước 1: PENDING → READY (API #8)
   * await transactionService.approve('uuid-phieu', 'TRANSFER');
   *
   * @example — Bước 2: READY → ACTIVE (API #9)
   * await transactionService.approve('uuid-phieu', 'TRANSFER');
   */
  approve: (id: string, type: TransactionType) =>
    api.post<UnifiedTransactionResponse>(
      `/api/v1/transactions/${id}/approve?type=${type}`,
    ),

  // ── Từ chối phiếu ─────────────────────────────────

  /**
   * POST /api/v1/transactions/{id}/reject?type=...&reason=...
   * Từ chối phiếu (PENDING | READY → REJECTED).
   *
   * @param id     UUID phiếu
   * @param type   Loại phiếu
   * @param reason Lý do từ chối (optional)
   */
  reject: (id: string, type: TransactionType, reason?: string) => {
    const params = new URLSearchParams({ type });
    if (reason) params.append('reason', reason);
    return api.post<Record<string, unknown>>(
      `/api/v1/transactions/${id}/reject?${params.toString()}`,
    );
  },

  // ── Clone phiếu ───────────────────────────────────

  /**
   * POST /api/v1/transactions/{id}/clone?type=...
   * Clone phiếu REJECTED → phiếu PENDING mới.
   * Lines giữ nguyên, qty_approved reset.
   * Dùng khi phiếu bị từ chối cần làm lại.
   *
   * @param id   UUID phiếu cần clone
   * @param type Loại phiếu
   */
  clone: (id: string, type: TransactionType) =>
    api.post<UnifiedTransactionResponse>(
      `/api/v1/transactions/${id}/clone?type=${type}`,
    ),
};

export default transactionService;
