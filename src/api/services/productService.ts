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

  /** GET /products — All products with search/pagination/status */
  getAllProducts: (params?: { search?: string; approvalStatus?: string; page?: number; size?: number }) =>
    api.get<any>('/api/v1/products', params),

  /** GET /admin/products/{id} — Single product with active recipe */
  getById: (id: string) => api.get<Product>(`/admin/products/${id}`),

  /** GET /admin/products/{id}/history — Change history */
  getHistory: (id: string) => api.get<ProductHistory[]>(`/admin/products/${id}/history`),

  // ── Commands ─────────────────────────────────────

  /** POST /api/v1/products — Create new product */
  submitCreate: (data: ProductRequest) =>
    api.post<Product>('/api/v1/products', data),

  /** POST /admin/products/submit/update/{id} — Submit update for approval */
  submitUpdate: (id: string, data: ProductRequest) =>
    api.post<CommandResponse>(`/admin/products/submit/update/${id}`, data),

  /** POST /admin/products/submit/delete/{id} — Soft delete (goes to pending) */
  submitDelete: (id: string) =>
    api.post<CommandResponse>(`/admin/products/submit/delete/${id}`),

  // ── Approval ─────────────────────────────────────

  /** POST /api/v1/products/{id}/approve */
  approve: (id: string) =>
    api.post<Product>(`/api/v1/products/${id}/approve`),

  /** POST /api/v1/products/{id}/reject */
  reject: (id: string, reason: string) =>
    api.post<Product>(`/api/v1/products/${id}/reject`, { reason }),
};

export default productService;
