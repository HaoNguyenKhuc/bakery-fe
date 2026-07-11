import api from '../axiosClient';
import type {
  ProductPrice,
  ProductPriceRequest,
  ProductPriceCommand,
  IngredientPrice,
  IngredientPriceRequest,
  IngredientPriceCommand,
  CommandResponse,
} from '../../types';

const priceService = {
  // ── Product Prices ────────────────────────────────

  /** GET /admin/product-prices/active — Current active prices for all products */
  getActiveProductPrices: () =>
    api.get<ProductPrice[]>('/admin/product-prices/active'),

  /** GET /admin/product-prices/{id} — Single price record detail */
  getProductPriceById: (id: string) =>
    api.get<ProductPrice>(`/admin/product-prices/${id}`),

  /** GET /admin/product-prices/pending — Product prices awaiting approval */
  getPendingProductPrices: () =>
    api.get<ProductPriceCommand[]>('/admin/product-prices/pending'),

  /**
   * POST /admin/product-prices/submit/create
   * Submit a new price version (immutable — no edit/delete)
   */
  submitProductPrice: (data: ProductPriceRequest) =>
    api.post<CommandResponse>('/admin/product-prices/submit/create', data),

  /** POST /admin/product-prices/approve/{commandId} */
  approveProductPrice: (commandId: string) =>
    api.post<CommandResponse>(`/admin/product-prices/approve/${commandId}`),

  /** POST /admin/product-prices/reject/{commandId} */
  rejectProductPrice: (commandId: string, reason?: string) =>
    api.post<CommandResponse>(`/admin/product-prices/reject/${commandId}`, { reason }),

  // ── Ingredient Prices ─────────────────────────────

  /** GET /admin/ingredient-prices/active — Current active prices for all ingredients */
  getActiveIngredientPrices: () =>
    api.get<IngredientPrice[]>('/admin/ingredient-prices/active'),

  /** GET /admin/ingredient-prices/{id} */
  getIngredientPriceById: (id: string) =>
    api.get<IngredientPrice>(`/admin/ingredient-prices/${id}`),

  /** GET /admin/ingredient-prices/pending */
  getPendingIngredientPrices: () =>
    api.get<IngredientPriceCommand[]>('/admin/ingredient-prices/pending'),

  /**
   * POST /admin/ingredient-prices/submit/create
   * Submit a new ingredient price version
   */
  submitIngredientPrice: (data: IngredientPriceRequest) =>
    api.post<CommandResponse>('/admin/ingredient-prices/submit/create', data),

  /** POST /admin/ingredient-prices/approve/{commandId} */
  approveIngredientPrice: (commandId: string) =>
    api.post<CommandResponse>(`/admin/ingredient-prices/approve/${commandId}`),
};

export default priceService;
