import api from '../axiosClient';
import type { ProductMapping, ProductMappingRequest } from '../../types';

/**
 * productMappingService
 *
 * Quản lý ánh xạ sản phẩm nội bộ ↔ mã POS (product-mapping-controller):
 *
 *   GET    /api/v1/product-mappings/all   — Tất cả mappings (không phân trang)
 *   POST   /api/v1/product-mappings       — Tạo mapping mới
 *   PUT    /api/v1/product-mappings/{id}  — Cập nhật mapping
 *   DELETE /api/v1/product-mappings/{id}  — Xoá mapping
 *
 * Mỗi mapping liên kết:
 *   item.code (IN_CODE) ↔ exCode (EX_CODE từ máy POS)
 *
 * @see dev-ui.html: pageProductMapping(), savePM(), deletePM(), editPM()
 */
const productMappingService = {
  /**
   * Lấy toàn bộ danh sách product mappings (không phân trang).
   * Dùng để hiển thị bảng và filter theo Item Group.
   */
  getAll: (): Promise<ProductMapping[]> =>
    api.get<ProductMapping[]>('/api/v1/product-mappings/all'),

  /**
   * Tạo một mapping mới giữa sản phẩm nội bộ và mã POS.
   * @param data ProductMappingRequest — itemId + exCode (bắt buộc), sellingPrice + note (tuỳ chọn)
   */
  create: (data: ProductMappingRequest): Promise<ProductMapping> =>
    api.post<ProductMapping>('/api/v1/product-mappings', data),

  /**
   * Cập nhật một mapping hiện có.
   * @param id   UUID của mapping
   * @param data ProductMappingRequest
   */
  update: (id: string, data: ProductMappingRequest): Promise<ProductMapping> =>
    api.put<ProductMapping>(`/api/v1/product-mappings/${id}`, data),

  /**
   * Xoá một mapping.
   * @param id UUID của mapping
   */
  remove: (id: string): Promise<void> =>
    api.delete<void>(`/api/v1/product-mappings/${id}`),
};

export default productMappingService;
