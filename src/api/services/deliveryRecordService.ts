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
   * Lấy danh sách giao nhận trong ngày.
   * @param date Ngày dạng YYYY-MM-DD
   */
  getList: (date: string) =>
    axiosClient.get<DeliveryRecordResponse[], DeliveryRecordResponse[]>(`/api/v1/delivery-records`, {
      params: { date },
    }),
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
