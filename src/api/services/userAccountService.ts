import api from '../axiosClient';
import type { UserAccount, CreateUserRequest, UpdateUserRequest } from '../../types';

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export const userAccountService = {
  /** GET /api/v1/user-accounts?size=100 */
  getAll(): Promise<Page<UserAccount>> {
    return api.get<Page<UserAccount>>('/api/v1/user-accounts', { size: 100 });
  },

  /** POST /api/v1/user-accounts */
  create(body: CreateUserRequest): Promise<UserAccount> {
    return api.post<UserAccount>('/api/v1/user-accounts', body);
  },

  /** PUT /api/v1/user-accounts/{id} */
  update(id: string, body: UpdateUserRequest): Promise<UserAccount> {
    return api.put<UserAccount>(`/api/v1/user-accounts/${id}`, body);
  },

  /** DELETE /api/v1/user-accounts/{id} */
  remove(id: string): Promise<void> {
    return api.delete<void>(`/api/v1/user-accounts/${id}`);
  },

  /** POST /api/v1/user-accounts/{id}/change-password */
  changePassword(id: string, newPassword: string): Promise<void> {
    return api.post<void>(`/api/v1/user-accounts/${id}/change-password`, { newPassword });
  },
};
