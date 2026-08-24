import api from '../axiosClient';
import type {
  Recipe,
  RecipeRequest,
  RecipeUpdateRequest,
  RecipeCostCalculation,
} from '../../types';

const recipeService = {
  // ── Queries ──────────────────────────────────────

  getByProduct: (productId: string) =>
    api.get<any>('/api/v1/recipes', { productId }),

  getBySemiProduct: (semiProductId: string) =>
    api.get<any>('/api/v1/recipes', { semiProductId }),

  getAll: () => api.get<any>('/api/v1/recipes'),

  getById: (id: string) => api.get<Recipe>(`/api/v1/recipes/${id}`),

  /** GET /api/v1/recipes/cost/{itemId} — Calculate recipe cost breakdown */
  calculateCost: (itemId: string) =>
    api.get<RecipeCostCalculation>(`/api/v1/recipes/cost/${itemId}`),

  /** GET /api/v1/recipes/usage/{itemId} — List products/BTPs that use this item in active recipes */
  getUsageByItem: (itemId: string) =>
    api.get<any[]>(`/api/v1/recipes/usage/${itemId}`),

  /** GET /api/v1/recipes/unit-issues — List recipe lines with unit mismatch (no conversion found) */
  getUnitIssues: () =>
    api.get<any[]>('/api/v1/recipes/unit-issues'),

  // ── Commands ─────────────────────────────────────

  create: (data: RecipeRequest) => api.post<Recipe>('/api/v1/recipes', data),

  update: (id: string, data: RecipeUpdateRequest) =>
    api.put<Recipe>(`/api/v1/recipes/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/recipes/${id}`),

  approve: (id: string) => api.post(`/api/v1/recipes/${id}/approve`),

  reject: (id: string) => api.post(`/api/v1/recipes/${id}/reject`),

  activate: (id: string) => api.post(`/api/v1/recipes/${id}/activate`),

  clone: (id: string) => api.post<Recipe>(`/api/v1/recipes/${id}/clone`),

  /** POST /api/v1/recipes/cost/{itemId}/apply — Apply calculated unit cost to item */
  applyCost: (itemId: string) =>
    api.post<{ totalCostPerUnit: number }>(`/api/v1/recipes/cost/${itemId}/apply`),

  /** POST /api/v1/recipes/cost/apply-all — Recalculate and apply cost to all items */
  applyCostAll: () =>
    api.post<import('../../types').RecipeApplyAllResponse>('/api/v1/recipes/cost/apply-all'),

  /** POST /api/v1/recipes/yield/auto-fill — Auto-fill yieldQuantity for all active recipes missing it */
  autoFillYield: () =>
    api.post<any>('/api/v1/recipes/yield/auto-fill'),
};

export default recipeService;
