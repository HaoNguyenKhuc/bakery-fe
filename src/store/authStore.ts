import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserRole, WarehouseRole, ScreenPermission, LoginResponse, PermissionMap } from '../types';

// --- Permission Constants (legacy — kept for backward compat) ---

/** All available permission strings in the system */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',

  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',

  RECIPE_VIEW: 'recipe:view',
  RECIPE_CREATE: 'recipe:create',
  RECIPE_EDIT: 'recipe:edit',
  RECIPE_DELETE: 'recipe:delete',

  WAREHOUSE_VIEW: 'warehouse:view',
  WAREHOUSE_IMPORT: 'warehouse:import',
  WAREHOUSE_EXPORT: 'warehouse:export',

  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

/** Default permissions per role (legacy) */
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.RECIPE_VIEW, PERMISSIONS.RECIPE_CREATE, PERMISSIONS.RECIPE_EDIT,
    PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.WAREHOUSE_IMPORT, PERMISSIONS.WAREHOUSE_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
  ],
};

// --- Store Interface ---

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  tokenExpiresAt: number | null; // unix timestamp in ms

  // Real API fields (from LoginResponse)
  roleCode: string | null;       // "SUPER_ADMIN" | "KITCHEN" | ...
  roleId: string | null;         // UUID của role
  permissionMap: PermissionMap;  // null = SUPER_ADMIN (show all)

  // Actions
  setAuth: (data: LoginResponse, expiresIn?: number) => void;
  setAccessToken: (accessToken: string, expiresIn: number) => void;
  setPermissionMap: (map: PermissionMap) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;

  // Selectors / Helpers (legacy)
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: UserRole) => boolean;
  isTokenExpired: () => boolean;
  getDefaultPermissions: (role: UserRole) => string[];

  // Per-screen permission helpers (Màn hình 1 & 2)
  /** Lấy đối tượng quyền của 1 màn hình cụ thể từ screen_permissions */
  getScreenPermission: (screen: string) => ScreenPermission | null;
  /** Kiểm tra 1 action cụ thể trên 1 màn hình — ADMIN luôn true */
  canOnScreen: (screen: string, action: 'view' | 'create' | 'update' | 'approve') => boolean;
  /** Kiểm tra warehouse_role của user */
  isWarehouseRole: (role: WarehouseRole) => boolean;
  /** Kiểm tra user có phải ADMIN không */
  isAdmin: () => boolean;

  // New role-based helpers
  /** Kiểm tra user có phải SUPER_ADMIN (bỏ qua toàn bộ phân quyền) */
  isSuperAdmin: () => boolean;
  /**
   * Kiểm tra user có quyền VIEW màn hình screenCode không.
   * - permissionMap === null (SUPER_ADMIN) → true
   * - permissionMap[screenCode]?.includes('VIEW') → true
   * - Ngược lại → false
   */
  canViewScreen: (screenCode: string) => boolean;
  /**
   * Kiểm tra user có quyền action cụ thể trên màn hình screenCode không.
   * - permissionMap === null (SUPER_ADMIN) → true
   * - permissionMap[screenCode]?.includes(action) → true
   * - Ngược lại → false
   */
  canDoOnScreen: (screenCode: string, action: string) => boolean;
}

/** Mặc định token hết hạn sau 1 giờ (backend không trả expiresIn) */
const DEFAULT_EXPIRES_IN = 3600;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      tokenExpiresAt: null,
      roleCode: null,
      roleId: null,
      permissionMap: null,

      // --- Actions ---

      /**
       * Gọi sau khi login thành công.
       * Nhận LoginResponse từ /api/v1/auth/login và lưu vào store.
       * expiresIn mặc định 3600s (1 giờ) vì backend không trả về field này.
       */
      setAuth: (data: LoginResponse, expiresIn = DEFAULT_EXPIRES_IN) => {
        const expiresAt = Date.now() + expiresIn * 1000;
        // Build backward-compat User object
        const user: User = {
          id: data.userId,
          username: data.username,
          fullName: data.fullName,
          role: data.roleCode === 'SUPER_ADMIN' ? 'ADMIN' : 'STAFF',
          permissions: data.roleCode === 'SUPER_ADMIN' ? ['*'] : [],
        };
        set({
          user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
          tokenExpiresAt: expiresAt,
          roleCode: data.roleCode,
          roleId: data.roleId,
          // permissionMap sẽ được set riêng bởi loadAndApplySidebarPermissions
        });
      },

      setAccessToken: (accessToken, expiresIn) => {
        const expiresAt = Date.now() + expiresIn * 1000;
        set({ accessToken, tokenExpiresAt: expiresAt });
      },

      /** Lưu permission map sau khi fetch từ /api/v1/user-roles/{id}/permissions */
      setPermissionMap: (map: PermissionMap) => {
        set({ permissionMap: map });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          tokenExpiresAt: null,
          roleCode: null,
          roleId: null,
          permissionMap: null,
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      // --- Legacy Helpers ---

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        return user.permissions.includes(permission);
      },

      hasAnyPermission: (permissions) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        return permissions.some((p) => user.permissions.includes(p));
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      isTokenExpired: () => {
        const { tokenExpiresAt } = get();
        if (!tokenExpiresAt) return true;
        // Consider expired 30 seconds before actual expiry for safety margin
        return Date.now() >= tokenExpiresAt - 30_000;
      },

      getDefaultPermissions: (role) => {
        return DEFAULT_ROLE_PERMISSIONS[role] || [];
      },

      // ── Per-screen permission helpers ──────────────────────────────────────

      getScreenPermission: (screen) => {
        const { user } = get();
        if (!user?.screen_permissions) return null;
        return user.screen_permissions.find((p) => p.screen === screen) ?? null;
      },

      canOnScreen: (screen, action) => {
        const { user } = get();
        if (!user) return false;
        // ADMIN luôn có toàn quyền
        if (user.role === 'ADMIN') return true;
        const perm = get().getScreenPermission(screen);
        if (!perm) return false;
        const map: Record<typeof action, boolean> = {
          view:    perm.can_view,
          create:  perm.can_create,
          update:  perm.can_update,
          approve: perm.can_approve,
        };
        return map[action] ?? false;
      },

      isWarehouseRole: (role) => {
        const { user } = get();
        return user?.warehouse_role === role;
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === 'ADMIN';
      },

      // ── New Role-based Helpers ─────────────────────────────────────────────

      isSuperAdmin: () => {
        const { roleCode } = get();
        return roleCode?.toUpperCase() === 'SUPER_ADMIN';
      },

      canViewScreen: (screenCode: string) => {
        const { permissionMap } = get();
        if (permissionMap === null) return true; // SUPER_ADMIN: xem tất cả
        return permissionMap[screenCode]?.includes('VIEW') ?? false;
      },

      canDoOnScreen: (screenCode: string, action: string) => {
        const { permissionMap } = get();
        if (permissionMap === null) return true; // SUPER_ADMIN: làm tất cả
        return permissionMap[screenCode]?.includes(action as never) ?? false;
      },
    }),
    {
      name: 'bakery-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist essential data, not functions
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        tokenExpiresAt: state.tokenExpiresAt,
        roleCode: state.roleCode,
        roleId: state.roleId,
        permissionMap: state.permissionMap,
      }),
    }
  )
);
