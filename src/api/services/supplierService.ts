import api from '../axiosClient';
import type { Supplier, SupplierRequest } from '../../types';

/**
 * supplierService
 *
 * Quản lý nhà cung cấp (supplier-controller):
 *
 *   GET    /api/v1/suppliers/all       — Tất cả nhà cung cấp (không phân trang)
 *   POST   /api/v1/suppliers           — Tạo nhà cung cấp mới
 *   PUT    /api/v1/suppliers/{id}      — Cập nhật nhà cung cấp
 *   POST   /api/v1/suppliers/{id}/approve — Phê duyệt nhà cung cấp
 *
 * @see dev-ui.html: pageSuppliers(), saveSup(), approveSup()
 */
const supplierService = {
  /**
   * Lấy toàn bộ danh sách nhà cung cấp (không phân trang).
   * Dùng để load dropdown và hiển thị bảng danh sách.
   */
  getAll: (): Promise<Supplier[]> =>
    api.get<Supplier[]>('/api/v1/suppliers/all'),

  /**
   * Tạo nhà cung cấp mới.
   * @param data SupplierRequest — code, name (bắt buộc) + phone, email, address (tuỳ chọn)
   */
  create: (data: SupplierRequest): Promise<Supplier> =>
    api.post<Supplier>('/api/v1/suppliers', data),

  /**
   * Cập nhật thông tin nhà cung cấp.
   * @param id   UUID nhà cung cấp
   * @param data SupplierRequest
   */
  update: (id: string, data: SupplierRequest): Promise<Supplier> =>
    api.put<Supplier>(`/api/v1/suppliers/${id}`, data),

  /**
   * Phê duyệt nhà cung cấp (chuyển DRAFT/PENDING_APPROVAL → APPROVED).
   * @param id UUID nhà cung cấp
   */
  approve: (id: string): Promise<Supplier> =>
    api.post<Supplier>(`/api/v1/suppliers/${id}/approve`),
};

export default supplierService;
