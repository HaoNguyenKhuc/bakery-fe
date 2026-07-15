import api from '../axiosClient';
import type { ItemGroup, ItemGroupRequest } from '../../types';

const itemGroupService = {
  getAll: () => api.get<any>('/api/v1/item-groups'),
  create: (data: ItemGroupRequest) => api.post<ItemGroup>('/api/v1/item-groups', data),
  delete: (id: string) => api.delete(`/api/v1/item-groups/${id}`),
};

export default itemGroupService;
