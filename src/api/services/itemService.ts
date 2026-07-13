import api from '../axiosClient';
import type {
  Item,
  ItemRequest,
  ProductHistory,
  CommandResponse,
} from '../../types';

const itemService = {
  // ── Queries ──────────────────────────────────────

  /** GET /items — All items with search/pagination/status/type */
  getAllItems: (params?: { search?: string; approvalStatus?: string; itemType?: string; page?: number; size?: number }) =>
    api.get<any>('/api/v1/items', params),

  /** GET /items/all — All items without pagination (useful for dropdowns) */
  getAllItemsUnpaginated: (params?: { itemType?: string }) =>
    api.get<Item[]>('/api/v1/items/all', params),

  /** GET /items/{id} — Single item */
  getById: (id: string) => api.get<Item>(`/api/v1/items/${id}`),

  /** GET /items/{id}/history — Change history */
  getHistory: (id: string) => api.get<ProductHistory[]>(`/api/v1/items/${id}/history`),

  // ── Commands ─────────────────────────────────────

  /** POST /api/v1/items — Create new item */
  submitCreate: (data: ItemRequest) =>
    api.post<Item>('/api/v1/items', data),

  /** PUT /api/v1/items/{id} — Update item */
  submitUpdate: (id: string, data: ItemRequest) =>
    api.put<Item>(`/api/v1/items/${id}`, data),

  /** DELETE /items/{id} — Delete item */
  submitDelete: (id: string) =>
    api.delete<CommandResponse>(`/api/v1/items/${id}`),

  // ── Approval ─────────────────────────────────────

  /** POST /api/v1/items/{id}/approve */
  approve: (id: string) =>
    api.post<Item>(`/api/v1/items/${id}/approve`),

  /** POST /items/{id}/reject */
  reject: (id: string, reason: string) =>
    api.post<Item>(`/api/v1/items/${id}/reject`, { reason }),
};

export default itemService;
