// ── Delivery Record Types ──────────────────────────────────────────────────────

export type DeliveryStatus = 'READY' | 'CONFIRMED' | 'DISCREPANCY';

export interface DeliveryRecordResponse {
  id: string;
  productCode?: string;           // Mã sản phẩm (dùng để merge với daily report)
  productName?: string;           // Tên sản phẩm
  plannedQty?: number;            // Số lượng kế hoạch
  qtyProduced: number;
  qtyReceived: number;
  discrepancy: number;
  deliveryStatus: DeliveryStatus;
  confirmedAt?: string;           // ISO datetime
  confirmedBy?: string;
  note?: string;
  /** EX_CODE được gán từ product_mapping khi shop xác nhận giao nhận */
  assignedExCode?: string;
}

/** Flatten từ ProductionRequestLineResponse cho màn hình Giao nhận */
export interface DeliveryItem {
  lineId: string;
  requestCode: string;
  productName: string;
  productCode: string;
  plannedQty: number;
  deliveryRecord: DeliveryRecordResponse;
}
