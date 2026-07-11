import api from '../axiosClient';
import type { Recipe, RecipeRequest, RecipeUpdateRequest } from '../../types';

const recipeService = {
  // ── Queries ──────────────────────────────────────

  /**
   * GET /master/recipes?productId={id}&activeOnly=false
   * All recipe versions for a product.
   * Pass activeOnly=true (default) or false for version history.
   */
  getByProduct: (productId: string, activeOnly = true) =>
    api.get<Recipe[]>('/master/recipes', {
      productId,
      activeOnly: String(activeOnly),
    }),

  /** GET /master/recipes/{id} — Single recipe detail */
  getById: (id: string) => api.get<Recipe>(`/master/recipes/${id}`),

  // ── Commands ─────────────────────────────────────

  /**
   * POST /master/recipes
   * Create a new recipe version — automatically deactivates the old active version
   * for the same product.
   */
  create: (data: RecipeRequest) => api.post<Recipe>('/master/recipes', data),

  /**
   * PUT /master/recipes/{id}
   * Update note, effectiveDate, or isActive flag.
   */
  update: (id: string, data: RecipeUpdateRequest) =>
    api.put<Recipe>(`/master/recipes/${id}`, data),
};

export default recipeService;
