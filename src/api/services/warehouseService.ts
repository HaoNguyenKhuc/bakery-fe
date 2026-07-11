import api from '../axiosClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export interface Warehouse {
  id: string;
  code: string;          // VD: "MAIN", "BEP_01", "SHOP_01"
  name: string;          // VD: "Kho Tổng", "Kho Bếp", "Cửa Hàng"
  type: string;          // Deprecated, use warehouseType
  warehouseType: string; // VD: "MAIN" | "KITCHEN" | "SHOP"
  status: WarehouseStatus;
  address?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * warehouseService
 *
 * Base endpoint: GET /api/v1/warehouses
 * Trả về danh sách tất cả warehouse trong hệ thống.
 * Dùng để lấy `warehouse.code` cho các API khác (inventory-requests, v.v.)
 */
const warehouseService = {
  /**
   * GET /api/v1/warehouses
   * Lấy danh sách tất cả kho đang hoạt động.
   *
   * Response: Warehouse[] (array trực tiếp hoặc wrapped trong { data: [...] })
   * → Interceptor sẽ tự unwrap nếu backend trả về envelope.
   */
  getAll: () =>
    api.get<Warehouse[]>('/api/v1/warehouses'),
};

export default warehouseService;
