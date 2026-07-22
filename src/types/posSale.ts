// ── POS Daily Sale Types ───────────────────────────────────────────────────────

export interface PosDailySale {
  id: string;
  saleDate: string;        // YYYY-MM-DD
  exCode: string;          // Mã từ hệ thống POS
  itemName?: string;       // Nullable — chưa mapping sang item hệ thống
  qtySold: number;         // Số lượng đã bán
  unitPrice?: number;      // Đơn giá
  totalAmount?: number;    // Tổng tiền (Doanh thu)
  note?: string;
}

export interface UploadResult {
  successCount: number;
  errorCount: number;
  errors?: string[];
}
