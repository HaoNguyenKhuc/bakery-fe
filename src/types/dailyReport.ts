// ── Daily Report Types ─────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  reportDate: string;             // YYYY-MM-DD
  status: 'DRAFT' | 'FINALIZED';
  finalizedBy?: string;
  finalizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Một dòng trong báo cáo ngày — tổng hợp per-item.
 * Source: GET /api/v1/daily-reports/{id}/lines
 */
export interface DailyReportLine {
  id: string;

  // Item info — backend có thể trả về nested object hoặc flat fields
  item?: { key?: string; code?: string; name: string };
  itemId?: string;
  itemCode?: string;
  itemName?: string;

  // ── Sản xuất ─────────────────────────────────────────────────────────────────
  /** Tồn kho shop đầu ngày (từ stock_lot.qty_remaining) */
  qtyRemainingOpening?: number;
  /** Bánh Bếp làm ra hôm nay (production_request_line.qty_actual) */
  qtyProduced?: number;
  /** Bánh shop thực nhận từ bếp (delivery_record xác nhận) */
  qtyReceived?: number;
  /** Chênh lệch bếp = qtyProduced − qtyReceived */
  discrepancyKitchen?: number;

  // ── Bán ──────────────────────────────────────────────────────────────────────
  /** Bánh bán POS (từ pos_daily_sale) */
  qtySoldPos?: number;
  /** Bánh bán thực tế = (opening + received) − tồn − hủy */
  qtySoldImplied?: number;
  /** Chênh lệch POS = qtySoldPos − qtySoldImplied */
  discrepancyPos?: number;

  // ── Hủy ──────────────────────────────────────────────────────────────────────
  /** Hủy dự kiến (tính từ expiry config) */
  qtySystemCancel?: number;
  /** Hủy thực tế (NV xác nhận qua cancel_record) */
  qtyCancelled?: number;
  /** Chênh lệch hủy = qtyCancelled − qtySystemCancel */
  discrepancyCancel?: number;

  // ── Còn lại ──────────────────────────────────────────────────────────────────
  /** Còn lại hệ thống = opening + received − soldPos − systemCancel */
  qtySystemRemaining?: number;
  /** Còn lại NV nhập thực tế */
  qtyRemainingActual?: number;
  /** Chênh lệch còn lại = qtyRemainingActual − qtySystemRemaining */
  discrepancyRemaining?: number;

  note?: string;
}

export interface UpdateRemainingParams {
  itemId: string;
  qtyRemainingActual: number;
  note?: string;
}
