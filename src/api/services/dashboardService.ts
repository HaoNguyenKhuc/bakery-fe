import api from '../axiosClient';
import type { HealthStatus, BatchResult } from '../../types';

const dashboardService = {
  /**
   * GET /health
   * Check server health — returns { status: 'UP' | 'DOWN' }
   */
  getHealth: () => api.get<HealthStatus>('/health'),

  /**
   * GET /batch/result?date=yyyy-MM-dd
   * Get today's batch reconciliation result
   */
  getBatchResult: (date: string) =>
    api.get<BatchResult>('/batch/result', { date }),
};

export default dashboardService;
