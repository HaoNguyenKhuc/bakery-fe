export type CancelType = 'EXPIRED' | 'DAMAGED' | 'OTHER';

export interface CancelRecordRow {
  id: string;
  exCode: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  itemGroupCode?: string;
  itemGroupName?: string;         // Loại bánh (nhóm sản phẩm)
  productionDate?: string;        // YYYY-MM-DD
  cancelType: CancelType;
  qtyOpening: number;
  qtyReceived: number;
  qtyCancelExpected: number;
  qtyCancelActual?: number;       // null = chưa xác nhận
  qtySoldPos: number;
  qtyRemaining: number;           // computed: opening + received - cancel - soldPos
  confirmed: boolean;
  note?: string;
}
