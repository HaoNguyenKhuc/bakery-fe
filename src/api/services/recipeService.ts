import api from '../axiosClient';
import type { Recipe, RecipeRequest, RecipeUpdateRequest } from '../../types';

const recipeService = {
  // ── Queries ──────────────────────────────────────

  getByProduct: (productId: string) =>
    api.get<any>('/api/v1/recipes', { productId }),

  getBySemiProduct: (semiProductId: string) =>
    api.get<any>('/api/v1/recipes', { semiProductId }),

  getAll: () => api.get<any>('/api/v1/recipes'),

  getById: (id: string) => api.get<Recipe>(`/api/v1/recipes/${id}`),

  // ── Commands ─────────────────────────────────────

  create: (data: RecipeRequest) => api.post<Recipe>('/api/v1/recipes', data),

  update: (id: string, data: RecipeUpdateRequest) =>
    api.put<Recipe>(`/api/v1/recipes/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/recipes/${id}`),

  approve: (id: string) => api.post(`/api/v1/recipes/${id}/approve`),

  reject: (id: string) => api.post(`/api/v1/recipes/${id}/reject`),

  activate: (id: string) => api.post(`/api/v1/recipes/${id}/activate`),

  clone: (id: string) => api.post<Recipe>(`/api/v1/recipes/${id}/clone`),
};

export default recipeService;
