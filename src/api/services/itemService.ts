import api from '../axiosClient';
import type {
  Item,
  ItemRequest,
  ProductHistory,
  CommandResponse,
} from '../../types';

const itemService = {
  // ── Queries ──────────────────────────────────────

  /** GET /items — All items with search (q), pagination, status, type */
  getAllItems: (params?: { q?: string; search?: string; approvalStatus?: string; itemType?: string; status?: string; page?: number; size?: number }) => {
    const { search, ...rest } = params || {};
    const query = rest.q ?? search;
    return api.get<any>('/api/v1/items', {
      ...rest,
      ...(query ? { q: query.trim() } : {}),
    });
  },

  /** GET /items — Load all items of a type (large page) for client-side group filtering */
  getAllItemsByType: (itemType: string) =>
    api.get<any>('/api/v1/items', { itemType, page: 0, size: 2000 }),

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

  /** DELETE /api/v1/items/bulk — Bulk delete items by IDs */
  bulkDelete: (ids: string[]) =>
    api.delete<import('../../types').BulkDeleteResponse>('/api/v1/items/bulk', { data: ids }),

  /** Restore a soft-deleted item by setting status back to ACTIVE */
  restore: async (id: string) => {
    const item = await itemService.getById(id);
    return api.put<Item>(`/api/v1/items/${id}`, { ...(item as any), status: 'ACTIVE' });
  },

  // ── Approval ─────────────────────────────────────

  /** POST /api/v1/items/{id}/approve */
  approve: (id: string) =>
    api.post<Item>(`/api/v1/items/${id}/approve`),

  /** POST /items/{id}/reject */
  reject: (id: string, reason: string) =>
    api.post<Item>(`/api/v1/items/${id}/reject`, { reason }),

  /** PUT /api/v1/items/{id}/packagings — Upsert toàn bộ danh sách quy cách đóng gói.
   *
   * Body: Array<{ code, name, qtyPerPack, isDefault }>
   * BE filter ra các row có đủ code + name + qtyPerPack trước khi lưu.
   * Gọi sau khi Item đã được tạo/cập nhật thành công.
   */
  updatePackagings: (id: string, data: import('../../types').ItemPackagingRequest[]) =>
    api.put<import('../../types').ItemPackaging[]>(`/api/v1/items/${id}/packagings`, data),
};

export default itemService;
