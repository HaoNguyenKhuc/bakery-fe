import api from '../axiosClient';
import type { ActivityLogEntry, ActivityLogParams } from '../../types';

export interface ActivityLogPage {
  content: ActivityLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export const activityLogService = {
  /**
   * GET /api/v1/activity-log
   * Params: page, size (mặc định 50), actorName, action, entityName, entityLabel, from (ISO), to (ISO)
   */
  getLog(params: ActivityLogParams): Promise<ActivityLogPage> {
    return api.get<ActivityLogPage>('/api/v1/activity-log', params as Record<string, unknown>);
  },
};
