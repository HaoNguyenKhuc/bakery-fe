import { axiosClient } from '../axiosClient';
import api from '../axiosClient';
import type { BatchResult, UploadResult, ExpiringLot } from '../../types';

/**
 * All file uploads use multipart/form-data.
 * Helper to build a FormData with file + optional date.
 */
function buildFormData(file: File, date?: string): FormData {
  const form = new FormData();
  form.append('file', file);
  if (date) form.append('date', date);
  return form;
}

const batchService = {
  // ── File Uploads ──────────────────────────────────

  /**
   * POST /batch/opening-stock/upload
   * Upload initial opening stock Excel file.
   * Format: columns EX_CODE, QUANTITY
   */
  uploadOpeningStock: (file: File, date?: string) =>
    axiosClient.post<UploadResult>('/batch/opening-stock/upload', buildFormData(file, date), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * POST /batch/pos/upload
   * Upload POS revenue file (BaoCaoPOS_DDMMYYYY.xlsx)
   */
  uploadPOS: (file: File, date?: string) =>
    axiosClient.post<UploadResult>('/batch/pos/upload', buildFormData(file, date), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * POST /batch/report/upload
   * Upload staff daily report (BaoCaoNgay_DDMMYYYY.xlsx)
   */
  uploadDailyReport: (file: File, date?: string) =>
    axiosClient.post<UploadResult>('/batch/report/upload', buildFormData(file, date), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * POST /batch/bepxuat/upload
   * Upload kitchen export file (BanhRaNgay_DDMMYYYY.xlsx)
   */
  uploadKitchenExport: (file: File, date?: string) =>
    axiosClient.post<UploadResult>('/batch/bepxuat/upload', buildFormData(file, date), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // ── Results ───────────────────────────────────────

  /**
   * GET /batch/result?date=yyyy-MM-dd
   * 3-tier reconciliation result for a given date.
   */
  getBatchResult: (date: string) =>
    api.get<BatchResult>('/batch/result', { date }),

  /**
   * GET /batch/export?date=yyyy-MM-dd
   * Download reconciliation Excel report for a given date.
   * Returns a Blob for the browser to download.
   */
  exportBatchReport: async (date: string): Promise<Blob> => {
    const response = await axiosClient.get(`/batch/export`, {
      params: { date },
      responseType: 'blob',
    });
    return response as unknown as Blob;
  },

  // ── Shared with Kitchen ───────────────────────────

  /**
   * GET /phase3/lots/expiring?days=N
   * Shared endpoint used by both Kitchen and Bakery modules.
   */
  getExpiringLots: (days = 1) =>
    api.get<ExpiringLot[]>('/phase3/lots/expiring', { days: String(days) }),
};

export default batchService;
