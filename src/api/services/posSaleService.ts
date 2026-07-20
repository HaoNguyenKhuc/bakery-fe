import api from '../axiosClient';
import { axiosClient } from '../axiosClient';
import type { PosDailySale, UploadResult } from '../../types/posSale';

/**
 * posSaleService
 *
 * Quản lý dữ liệu doanh số POS (pos-daily-sale-controller):
 *
 *   GET  /api/v1/pos-sales?saleDate=YYYY-MM-DD  — Lấy dữ liệu POS theo ngày
 *   POST /api/v1/pos-sales/upload?saleDate=...  — Upload file Excel POS
 */
const posSaleService = {
  /**
   * Lấy danh sách dữ liệu POS theo ngày bán.
   * @param saleDate Ngày bán (format: YYYY-MM-DD)
   */
  getBySaleDate: (saleDate: string) =>
    api.get<PosDailySale[]>('/api/v1/pos-sales', { saleDate }),

  /**
   * Upload file Excel doanh số POS.
   * @param saleDate Ngày bán (format: YYYY-MM-DD)
   * @param file     File Excel (.xlsx)
   */
  upload: (saleDate: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<UploadResult, UploadResult>(
      `/api/v1/pos-sales/upload?saleDate=${saleDate}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
  },
};

export default posSaleService;
