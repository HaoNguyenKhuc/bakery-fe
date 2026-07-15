import apiClient from '../axiosClient';
import type { ThresholdRule, ThresholdRuleUpdateRequest } from '../../types';

const thresholdRuleService = {
  getRulesByItem: (itemId: string): Promise<ThresholdRule[]> =>
    apiClient.get<ThresholdRule[]>(`/api/v1/items/${itemId}/threshold-rules`),

  updateRules: (itemId: string, data: ThresholdRuleUpdateRequest): Promise<void> =>
    apiClient.put(`/api/v1/items/${itemId}/threshold-rules`, data),
};

export default thresholdRuleService;
