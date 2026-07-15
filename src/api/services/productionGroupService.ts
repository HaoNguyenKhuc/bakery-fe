import apiClient from '../axiosClient';
import type { ProductionGroup, ProductionGroupRequest } from '../../types';

const productionGroupService = {
  getAll: (): Promise<ProductionGroup[]> =>
    apiClient.get<ProductionGroup[]>('/api/v1/production-groups'),

  create: (data: ProductionGroupRequest): Promise<ProductionGroup> =>
    apiClient.post<ProductionGroup>('/api/v1/production-groups', data),

  update: (id: string, data: ProductionGroupRequest): Promise<ProductionGroup> =>
    apiClient.put<ProductionGroup>(`/api/v1/production-groups/${id}`, data),

  remove: (id: string): Promise<void> =>
    apiClient.delete(`/api/v1/production-groups/${id}`),
};

export default productionGroupService;
