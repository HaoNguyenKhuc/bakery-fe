import api from '../axiosClient';

const masterService = {
  getIngredients: () => api.get<any>('/api/v1/ingredients'),
  getCodeValues: (groupK: string) => api.get<any>(`/api/v1/code-values?groupK=${groupK}`),
  getSuppliers: () => api.get<any>('/api/v1/suppliers'),
};

export default masterService;
