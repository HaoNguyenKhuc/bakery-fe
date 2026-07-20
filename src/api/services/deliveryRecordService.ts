import { axiosClient } from '../axiosClient';
import type { DeliveryRecordResponse } from '../../types/deliveryRecord';

/**
 * deliveryRecordService
 *
 * Quản lý giao nhận bếp → shop (delivery-record-controller):
 *
 *   POST /api/v1/delivery-records/{id}/confirm  — Shop xác nhận số lượng đã nhận
 */
const deliveryRecordService = {
  /**
   * Shop xác nhận số lượng đã nhận từ bếp.
   * @param id          UUID của delivery record (từ ProductionRequestLine.deliveryRecord.id)
   * @param qtyReceived Số lượng thực tế shop nhận được
   * @param note        Ghi chú (tuỳ chọn)
   */
  confirm: (id: string, qtyReceived: number, note?: string) =>
    axiosClient.post<DeliveryRecordResponse, DeliveryRecordResponse>(
      `/api/v1/delivery-records/${id}/confirm`,
      null,
      { params: { qtyReceived, ...(note ? { note } : {}) } },
    ),
};

export default deliveryRecordService;
