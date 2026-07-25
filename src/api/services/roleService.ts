import api from '../axiosClient';
import type { Role, CreateRoleRequest, Screen, PermissionMap, SavePermissionsRequest } from '../../types';

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export const roleService = {
  /** GET /api/v1/user-roles?size=100 */
  getAll(): Promise<Page<Role>> {
    return api.get<Page<Role>>('/api/v1/user-roles', { size: 100 });
  },

  /** POST /api/v1/user-roles */
  create(body: CreateRoleRequest): Promise<Role> {
    return api.post<Role>('/api/v1/user-roles', body);
  },

  /** PUT /api/v1/user-roles/{id} */
  update(id: string, body: CreateRoleRequest): Promise<Role> {
    return api.put<Role>(`/api/v1/user-roles/${id}`, body);
  },

  /** DELETE /api/v1/user-roles/{id} */
  remove(id: string): Promise<void> {
    return api.delete<void>(`/api/v1/user-roles/${id}`);
  },

  /**
   * GET /api/v1/user-roles/{id}/permissions
   * Response: Record<screenCode, ActionCode[]>
   */
  getPermissions(roleId: string): Promise<PermissionMap> {
    return api.get<PermissionMap>(`/api/v1/user-roles/${roleId}/permissions`);
  },

  /**
   * PUT /api/v1/user-roles/{id}/permissions
   * body: { permissions: [{ screenCode: "ITEMS", actionCode: "VIEW" }, ...] }
   */
  savePermissions(roleId: string, body: SavePermissionsRequest): Promise<void> {
    return api.put<void>(`/api/v1/user-roles/${roleId}/permissions`, body);
  },

  /**
   * GET /api/v1/screens
   * Trả về mảng Screen[] đã sắp xếp theo sortOrder
   */
  getScreens(): Promise<Screen[]> {
    return api.get<Screen[]>('/api/v1/screens');
  },
};
