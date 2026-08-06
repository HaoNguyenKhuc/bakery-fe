import { axiosClient } from '../axiosClient';
import type { DailyReport, DailyReportLine } from '../../types/dailyReport';

/**
 * dailyReportService
 *
 *   POST /api/v1/daily-reports/init?reportDate=          — Khởi tạo (idempotent)
 *   GET  /api/v1/daily-reports/by-date?reportDate=       — Lấy báo cáo theo ngày
 *   GET  /api/v1/daily-reports/{id}/lines                — Danh sách dòng (per-item)
 *   POST /api/v1/daily-reports/{id}/finalize             — Chốt báo cáo
 */
const dailyReportService = {
  /**
   * Khởi tạo báo cáo ngày — idempotent.
   * Cũng dùng để refresh cancel_record (qty_opening, qty_received).
   */
  init: (reportDate: string) =>
    axiosClient.post<DailyReport, DailyReport>(
      '/api/v1/daily-reports/init',
      null,
      { params: { reportDate } },
    ),

  /**
   * Lấy báo cáo theo ngày (không tạo mới nếu chưa có).
   */
  getByDate: (reportDate: string) =>
    axiosClient.get<DailyReport, DailyReport>(
      '/api/v1/daily-reports/by-date',
      { params: { reportDate } },
    ),

  /**
   * Lấy danh sách các dòng của báo cáo (per-item, đủ 13 cột).
   */
  getLines: (id: string) =>
    axiosClient.get<DailyReportLine[], DailyReportLine[]>(
      `/api/v1/daily-reports/${id}/lines`,
    ),

  /**
   * Chốt báo cáo — không thể sửa sau khi finalize.
   */
  finalize: (id: string) =>
    axiosClient.post<DailyReport, DailyReport>(
      `/api/v1/daily-reports/${id}/finalize`,
      null,
    ),
};

export default dailyReportService;
