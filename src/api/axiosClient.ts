import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { message } from 'antd';

// --- Configuration ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/';
const REQUEST_TIMEOUT = 15_000; // 15 seconds

// --- Create Axios Instance ---

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: REQUEST_TIMEOUT,
});

// --- Refresh Token Queue ---
// Prevents multiple refresh token calls when several requests fail with 401 simultaneously

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// --- Request Interceptor ---

axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, isTokenExpired } = useAuthStore.getState();

    // Skip auth header for refresh token endpoint
    const isRefreshRequest = config.url?.includes('/auth/refresh');

    if (accessToken && !isRefreshRequest) {
      // Warn in console if token is about to expire (for debugging)
      if (isTokenExpired()) {
        console.warn('[Axios] Access token is expired or about to expire.');
      }
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor ---

axiosClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    // Auto-unwrap envelope: { data: [...], success: true, message: "..." }
    // Only unwrap when the body is a plain object with a 'data' key AND
    // at least one envelope indicator ('success' or 'message').
    if (
      body !== null &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      'data' in body &&
      ('success' in body || 'message' in body)
    ) {
      return body.data;
    }
    return body;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) return Promise.reject(error);

    // --- Handle 401: Attempt Token Refresh ---
    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken: storedRefreshToken, logout } = useAuthStore.getState();

      // If no refresh token available, logout immediately
      if (!storedRefreshToken) {
        message.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // If already refreshing, queue this request to retry after refresh completes
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosClient(originalRequest);
        });
      }

      // Start refreshing
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint directly with axios (not axiosClient to avoid interceptor loop)
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const { accessToken: newToken, expiresIn } = response.data;

        // Update store with new token
        useAuthStore.getState().setAccessToken(newToken, expiresIn);

        // Process all queued requests with new token
        processQueue(null, newToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — logout user
        processQueue(refreshError, null);
        message.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // --- Handle Other HTTP Errors ---
    if (error.response) {
      const { status, data } = error.response as { status: number; data?: { message?: string } };

      switch (status) {
        case 400:
          message.error(data?.message || 'Dữ liệu không hợp lệ.');
          break;
        case 403:
          message.error('Bạn không có quyền thực hiện thao tác này.');
          break;
        case 404:
          message.error(data?.message || 'Không tìm thấy dữ liệu yêu cầu.');
          break;
        case 409:
          message.error(data?.message || 'Dữ liệu bị trùng lặp.');
          break;
        case 422:
          message.error(data?.message || 'Dữ liệu đầu vào không đúng định dạng.');
          break;
        case 429:
          message.error('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
          break;
        default:
          if (status >= 500) {
            message.error('Lỗi máy chủ. Vui lòng thử lại sau.');
          } else {
            message.error(data?.message || 'Đã xảy ra lỗi, vui lòng thử lại.');
          }
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('Yêu cầu hết thời gian chờ. Vui lòng thử lại.');
    } else if (error.request) {
      message.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
    } else {
      message.error('Đã xảy ra lỗi không xác định.');
    }

    return Promise.reject(error);
  }
);

// --- Typed Helper Methods ---

/**
 * Typed GET request
 * @example const products = await api.get<Product[]>('/products');
 */
const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    axiosClient.get<T, T>(url, { params }),

  post: <T>(url: string, data?: unknown) =>
    axiosClient.post<T, T>(url, data),

  put: <T>(url: string, data?: unknown) =>
    axiosClient.put<T, T>(url, data),

  patch: <T>(url: string, data?: unknown) =>
    axiosClient.patch<T, T>(url, data),

  delete: <T>(url: string) =>
    axiosClient.delete<T, T>(url),
};

export { axiosClient };
export default api;
