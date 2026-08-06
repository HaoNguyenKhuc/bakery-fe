import { axiosClient } from '../axiosClient';
import type { CancelRecordRow } from '../../types/cancelRecord';

const cancelRecordService = {
  /** Lấy danh sách hủy theo ngày */
  getByDate: (date: string) =>
    axiosClient.get<CancelRecordRow[], CancelRecordRow[]>('/api/v1/cancel-records', {
      params: { date },
    }),

  /** NV xác nhận hủy: tick (dùng qtyCancelExpected) hoặc nhập số khác */
  confirm: (id: string, qtyCancelActual?: number, note?: string) =>
    axiosClient.put<CancelRecordRow, CancelRecordRow>(`/api/v1/cancel-records/${id}/confirm`, null, {
      params: {
        ...(qtyCancelActual !== undefined ? { qtyCancelActual } : {}),
        ...(note ? { note } : {}),
      },
    }),

  /** NV thêm hủy vượt (DAMAGED / OTHER) */
  addExtra: (params: {
    date: string;
    exCode: string;
    qtyCancelActual: number;
    cancelType?: string;
    note?: string;
  }) =>
    axiosClient.post<CancelRecordRow, CancelRecordRow>('/api/v1/cancel-records/extra', null, {
      params,
    }),

  /** Xóa hủy vượt */
  remove: (id: string) =>
    axiosClient.delete(`/api/v1/cancel-records/${id}`),
};

export default cancelRecordService;
