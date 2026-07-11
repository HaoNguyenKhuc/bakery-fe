import { create } from 'zustand';
import warehouseService from '../api/services/warehouseService';
import type { Warehouse } from '../api/services/warehouseService';

// ─── State Interface ──────────────────────────────────────────────────────────

interface WarehouseState {
  warehouses: Warehouse[];
  loading: boolean;
  error: string | null;

  /** Fetch all warehouses and populate the store */
  fetchWarehouses: () => Promise<void>;

  // ── Selectors ──────────────────────────────────────────────────────────────

  /** Lấy warehouse đầu tiên có type = KHO_TONG */
  getKhoTong: () => Warehouse | undefined;

  /** Lấy tất cả warehouse có type = KHO_BEP */
  getKhoBep: () => Warehouse[];

  /** Lấy tất cả warehouse có type = STORE / SHOP */
  getStores: () => Warehouse[];

  /** Lấy warehouse theo code (VD: "MAIN", "BEP_01") */
  getByCode: (code: string) => Warehouse | undefined;

  /** Lấy warehouse theo type */
  getByType: (type: string) => Warehouse[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWarehouseStore = create<WarehouseState>()((set, get) => ({
  warehouses: [],
  loading: false,
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  fetchWarehouses: async () => {
    // Avoid double-fetching if already loaded
    if (get().warehouses.length > 0 && !get().error) return;

    set({ loading: true, error: null });
    try {
      const data = await warehouseService.getAll();
      // Handle Spring Page response ({ content: [...] }) or direct array
      const warehouses = Array.isArray(data) ? data : ((data as any)?.content ?? (data as any)?.data ?? []);
      set({ warehouses, loading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Không thể tải danh sách kho.',
        loading: false,
      });
    }
  },

  // ── Selectors ──────────────────────────────────────────────────────────────

  getKhoTong: () => {
    return get().warehouses.find(
      (w) => w.warehouseType === 'MAIN' && w.status === 'ACTIVE'
    );
  },

  getKhoBep: () => {
    return get().warehouses.filter(
      (w) => w.warehouseType === 'KITCHEN' && w.status === 'ACTIVE'
    );
  },

  getStores: () => {
    return get().warehouses.filter(
      (w) => w.warehouseType === 'SHOP' && w.status === 'ACTIVE'
    );
  },

  getByCode: (code) => {
    return get().warehouses.find((w) => w.code === code);
  },

  getByType: (type) => {
    return get().warehouses.filter((w) => w.warehouseType === type || w.type === type);
  },
}));

// ─── Typed Selectors (for optimized re-renders) ───────────────────────────────

export const selectWarehouses     = (s: WarehouseState) => s.warehouses;
export const selectWarehouseLoading = (s: WarehouseState) => s.loading;
export const selectKhoTong        = (s: WarehouseState) => s.getKhoTong();
export const selectKhoBep         = (s: WarehouseState) => s.getKhoBep();
export const selectStores         = (s: WarehouseState) => s.getStores();
