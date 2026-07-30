// ── Unit Types ─────────────────────────────────────────────────────────────────

export interface Unit {
  code: string;   // PK — ví dụ "KG", "G", "CAI", "LY"
  name: string;   // Tên hiển thị — "Kilogram", "Gram", "Cái", "Ly"
  note?: string;
}

/**
 * Tỉ lệ quy đổi giữa 2 đơn vị.
 * 1 fromUnit = factor × toUnit
 * Ví dụ: fromUnit=G, toUnit=KG, factor=0.001 → 1G = 0.001KG
 */
export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  note?: string;
  example?: string;  // computed bởi backend: "1 G = 0.001 KG"
}

export interface CreateUnitRequest {
  code: string;
  name: string;
  note?: string;
}

export interface UpdateUnitRequest {
  name?: string;
  note?: string;
}

export interface CreateConversionRequest {
  fromUnit: string;
  toUnit: string;
  factor: number;
  note?: string;
}

export interface UpdateConversionRequest {
  factor?: number;
  note?: string;
}
