import { axiosClient } from '../axiosClient';
import type { Branch, BranchListResponse, BranchType } from '../../types';

/**
 * branchService
 *
 * Quản lý chi nhánh / kho.
 * Base endpoint: /admin/branches
 *
 * Response shape đặc biệt — backend trả về envelope:
 * { data: Branch[], page, size, total, totalPages }
 * (không dùng Spring Page chuẩn)
 */
const branchService = {
  /**
   * GET /admin/branches/active?branchType=...
   * Lấy danh sách chi nhánh đang active theo loại kho.
   *
   * @param branchType  Loại kho: KHO_TONG | KHO_BEP | STORE
   *
   * Response wrapper: { data: Branch[], page, size, total, totalPages }
   * → Dùng .data để lấy mảng Branch[]
   *
   * @example — Lấy tất cả Kho Tổng
   * const res = await branchService.getActive('KHO_TONG');
   * const khoTong = res.data[0]; // Branch chính
   *
   * @example — Lấy danh sách Kho Bếp (có thể nhiều)
   * const res = await branchService.getActive('KHO_BEP');
   * const khoBepList = res.data;
   */
  getActive: (branchType?: BranchType) =>
    axiosClient.get<BranchListResponse, BranchListResponse>('/admin/branches/active', {
      params: branchType ? { branchType } : undefined,
    }),

  /**
   * GET /admin/branches/active?branchType=KHO_TONG
   * Shortcut: lấy Kho Tổng chính (isMain = true).
   * Thường chỉ có 1 kết quả.
   */
  getKhoTong: () =>
    axiosClient.get<BranchListResponse, BranchListResponse>('/admin/branches/active', {
      params: { branchType: 'KHO_TONG' },
    }),

  /**
   * GET /admin/branches/active?branchType=KHO_BEP
   * Lấy danh sách tất cả Kho Bếp đang active.
   * Dùng để hiển thị dropdown chọn kho đích khi tạo phiếu TRANSFER.
   */
  getKhoBep: () =>
    axiosClient.get<BranchListResponse, BranchListResponse>('/admin/branches/active', {
      params: { branchType: 'KHO_BEP' },
    }),

  /**
   * GET /admin/branches/active?branchType=STORE
   * Lấy danh sách tất cả Cửa Hàng đang active.
   */
  getStores: () =>
    axiosClient.get<BranchListResponse, BranchListResponse>('/admin/branches/active', {
      params: { branchType: 'SHOP' },
    }),
};

export default branchService;
