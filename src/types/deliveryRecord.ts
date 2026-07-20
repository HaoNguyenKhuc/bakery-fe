// ── Delivery Record Types ──────────────────────────────────────────────────────

export type DeliveryStatus = 'PENDING' | 'CONFIRMED' | 'DISCREPANCY';

export interface DeliveryRecordResponse {
  id: string;
  qtyProduced: number;
  qtyReceived: number;
  discrepancy: number;
  deliveryStatus: DeliveryStatus;
  confirmedAt?: string;           // ISO datetime
  confirmedBy?: string;
  note?: string;
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
