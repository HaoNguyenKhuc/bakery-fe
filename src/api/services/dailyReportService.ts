import api from '../axiosClient';
import { axiosClient } from '../axiosClient';
import type { DailyReport, DailyReportLine } from '../../types/dailyReport';

/**
 * dailyReportService
 *
 * Quản lý báo cáo ngày (daily-report-controller):
 *
 *   POST /api/v1/daily-reports/init?reportDate=...      — Khởi tạo báo cáo (idempotent)
 *   GET  /api/v1/daily-reports/{id}                     — Chi tiết báo cáo
 *   GET  /api/v1/daily-reports/{id}/lines               — Danh sách dòng báo cáo
 *   POST /api/v1/daily-reports/{id}/remaining           — Nhập "Còn Lại"
 *   POST /api/v1/daily-reports/{id}/finalize            — Chốt báo cáo
 */
const dailyReportService = {
  /**
   * Khởi tạo báo cáo ngày (idempotent — an toàn gọi nhiều lần).
   * Tự động tạo nếu chưa tồn tại, hoặc trả về báo cáo đã có.
   * @param reportDate Ngày báo cáo (format: YYYY-MM-DD)
   */
  init: (reportDate: string) =>
    axiosClient.post<DailyReport, DailyReport>(
      '/api/v1/daily-reports/init',
      null,
      { params: { reportDate } },
    ),

  /**
   * Lấy chi tiết báo cáo theo ID.
   * @param id UUID báo cáo
   */
  getById: (id: string) =>
    api.get<DailyReport>(`/api/v1/daily-reports/${id}`),

  /**
   * Lấy danh sách các dòng của báo cáo.
   * @param id UUID báo cáo
   */
  getLines: (id: string) =>
    api.get<DailyReportLine[]>(`/api/v1/daily-reports/${id}/lines`),

  /**
   * Nhân viên nhập số lượng "Còn Lại" thực tế sau khi đếm.
   * @param id                  UUID báo cáo
   * @param itemId              UUID của dòng báo cáo (DailyReportLine.id)
   * @param qtyRemainingActual  Số lượng còn lại thực tế
   * @param note                Ghi chú (tuỳ chọn)
   */
  updateRemaining: (
    id: string,
    itemId: string,
    qtyRemainingActual: number,
    note?: string,
  ) =>
    axiosClient.post<DailyReportLine, DailyReportLine>(
      `/api/v1/daily-reports/${id}/remaining`,
      null,
      { params: { itemId, qtyRemainingActual, ...(note ? { note } : {}) } },
    ),

  /**
   * Chốt báo cáo — không thể sửa sau khi finalize.
   * @param id UUID báo cáo
   */
  finalize: (id: string) =>
    axiosClient.post<DailyReport, DailyReport>(
      `/api/v1/daily-reports/${id}/finalize`,
      null,
    ),
};

export default dailyReportService;
