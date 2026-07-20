// ── POS Daily Sale Types ───────────────────────────────────────────────────────

export interface PosDailySale {
  id: string;
  saleDate: string;        // YYYY-MM-DD
  exCode: string;          // Mã từ hệ thống POS
  itemName?: string;       // Nullable — chưa mapping sang item hệ thống
  qtyBan: number;          // Số lượng đã bán
  note?: string;
}

export interface UploadResult {
  successCount: number;
  errorCount: number;
  errors?: string[];
}
