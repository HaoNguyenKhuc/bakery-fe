import api from '../axiosClient';
import type {
  Product,
  ProductRequest,
  ProductCommand,
  ProductHistory,
  CommandResponse,
} from '../../types';

const productService = {
  // ── Queries ──────────────────────────────────────

  /** GET /products — All products with search/pagination */
  getAllProducts: (params?: { search?: string; page?: number; size?: number }) =>
    api.get<any>('/api/v1/products', params),

  /** GET /admin/products/{id} — Single product with active recipe */
  getById: (id: string) => api.get<Product>(`/admin/products/${id}`),

  /** GET /admin/products/{id}/history — Change history */
  getHistory: (id: string) => api.get<ProductHistory[]>(`/admin/products/${id}/history`),

  // ── Commands ─────────────────────────────────────

  /** POST /admin/products/submit/create — Submit new product for approval */
  submitCreate: (data: ProductRequest) =>
    api.post<CommandResponse>('/admin/products/submit/create', data),

  /** POST /admin/products/submit/update/{id} — Submit update for approval */
  submitUpdate: (id: string, data: ProductRequest) =>
    api.post<CommandResponse>(`/admin/products/submit/update/${id}`, data),

  /** POST /admin/products/submit/delete/{id} — Soft delete (goes to pending) */
  submitDelete: (id: string) =>
    api.post<CommandResponse>(`/admin/products/submit/delete/${id}`),

  // ── Approval ─────────────────────────────────────

  /** POST /admin/products/approve/{commandId} */
  approve: (commandId: string) =>
    api.post<CommandResponse>(`/admin/products/approve/${commandId}`),

  /** POST /admin/products/reject/{commandId} */
  reject: (commandId: string, reason?: string) =>
    api.post<CommandResponse>(`/admin/products/reject/${commandId}`, { reason }),
};

export default productService;
