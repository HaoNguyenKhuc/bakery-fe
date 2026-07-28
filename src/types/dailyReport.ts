// ── Daily Report Types ─────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  reportDate: string;             // YYYY-MM-DD
  status: 'DRAFT' | 'FINALIZED';
  finalizedBy?: string;           // username người chốt
  finalizedAt?: string;           // ISO timestamp
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyReportLine {
  id: string;
  item: {
    key: string;    // itemCode
    name: string;
  };
  // Kho bếp
  qtyKitchenOpen: number;         // Tồn bếp (tồn tối + làm mới - đã giao)
  qtyProduced: number;            // Bánh Ra Hôm Nay (SX trong ngày)
  qtyDelivered: number;           // Đã Giao Shop
  qtyRemainingActual?: number;    // Còn Lại* — nhân viên nhập thực tế
  note?: string;
  // Báo cáo ngày (full report)
  qtyOpenPrev?: number;           // Tồn hôm qua
  qtyReceivedShop?: number;       // Nhận trong ngày (shop)
  qtyDiscrepancy?: number;        // Lệch SX/Nhận
  qtyExpectedSale?: number;       // Bán dự tính
  qtyActualPOS?: number;          // Bán thực tế (từ POS)
  qtyPOSDiscrepancy?: number;     // Lệch POS
  isCancelItem?: boolean;         // Hủy bánh (shelf_days = 0)

  // ── Cancel-list fields (từ GET /cancel-list) ─────────────────────
  qtyCancelled?: number | null;         // Số NV đã nhập hủy
  discrepancyCancelQty?: number | null; // Lệch hủy = qtyCancelled − qtyRemainingActual
  expiringExCodes?: string[];           // EX_CODE hết hạn cần hủy
  expiringProductionDates?: string[];   // Ngày SX sắp hết hạn
  shelfDays?: number;                   // Hạn sử dụng (ngày)
}

export interface UpdateRemainingParams {
  itemId: string;
  qtyRemainingActual: number;
  note?: string;
}
