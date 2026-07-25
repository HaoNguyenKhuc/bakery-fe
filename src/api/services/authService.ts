import api from '../axiosClient';
import type { LoginResponse } from '../../types';

/** Mặc định token hết hạn sau 1 giờ (backend không trả expiresIn) */
export const DEFAULT_EXPIRES_IN = 3600;

export const authService = {
  /** POST /api/v1/auth/login */
  login(username: string, password: string): Promise<LoginResponse> {
    return api.post<LoginResponse>('/api/v1/auth/login', { username, password });
  },

  /** POST /api/v1/auth/logout — fire-and-forget, không throw lỗi */
  async logout(): Promise<void> {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Bỏ qua lỗi logout (token có thể đã hết hạn)
    }
  },
};
