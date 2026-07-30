import api from '../axiosClient';
import type {
  Unit, UnitConversion,
  CreateUnitRequest, UpdateUnitRequest,
  CreateConversionRequest, UpdateConversionRequest,
} from '../../types/unit';

/**
 * unitService
 *
 *   GET    /api/v1/units                          — Danh sách đơn vị
 *   POST   /api/v1/units                          — Thêm đơn vị
 *   PUT    /api/v1/units/{code}                   — Sửa đơn vị
 *   DELETE /api/v1/units/{code}                   — Xóa đơn vị
 *
 *   GET    /api/v1/units/conversions              — Danh sách tỉ lệ
 *   POST   /api/v1/units/conversions              — Thêm tỉ lệ
 *   PUT    /api/v1/units/conversions/{from}/{to}  — Sửa tỉ lệ
 *   DELETE /api/v1/units/conversions/{from}/{to}  — Xóa tỉ lệ
 */
const unitService = {
  // ── Units ──────────────────────────────────────────────────────────────────

  getAll: () =>
    api.get<Unit[]>('/api/v1/units'),

  create: (data: CreateUnitRequest) =>
    api.post<Unit>('/api/v1/units', data),

  update: (code: string, data: UpdateUnitRequest) =>
    api.put<Unit>(`/api/v1/units/${code}`, data),

  delete: (code: string) =>
    api.delete<void>(`/api/v1/units/${code}`),

  // ── Conversions ────────────────────────────────────────────────────────────

  getConversions: () =>
    api.get<UnitConversion[]>('/api/v1/units/conversions'),

  createConversion: (data: CreateConversionRequest) =>
    api.post<UnitConversion>('/api/v1/units/conversions', data),

  updateConversion: (fromUnit: string, toUnit: string, data: UpdateConversionRequest) =>
    api.put<UnitConversion>(`/api/v1/units/conversions/${fromUnit}/${toUnit}`, data),

  deleteConversion: (fromUnit: string, toUnit: string) =>
    api.delete<void>(`/api/v1/units/conversions/${fromUnit}/${toUnit}`),
};

export default unitService;
