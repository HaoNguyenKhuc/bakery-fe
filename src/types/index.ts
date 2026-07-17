// ============================================
// Bakery MS — TypeScript Types (v2)
// Aligned with real API contract per BakeryAPI_FE_Guide.txt
// ============================================

// ─────────────────────────────────────────────
// SHARED / BASE
// ─────────────────────────────────────────────

/** Audit fields present on every API entity */
export interface BaseEntity {
  id: string;                  // UUID
  createdBy: string;
  createdAt: string;           // OffsetDateTime as ISO string
  updatedBy: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  entityStatus: EntityStatus;
}

export type EntityStatus = 'ACTIVE' | 'INACTIVE';

/** Generic key-value reference returned by backend for FK fields */
export interface ReferenceValue {
  key: string;   // e.g. code
  value: string; // e.g. name
}

// ─────────────────────────────────────────────
// BRANCH (Chi nhánh / Kho)
// GET /admin/branches/active?branchType=...
// ─────────────────────────────────────────────

export type BranchType = 'KHO_TONG' | 'KHO_BEP' | 'STORE';

/** Chi nhánh / kho — response từ GET /admin/branches/active */
export interface Branch extends BaseEntity {
  code: string;        // e.g. "MAIN", "BEP_01"
  name: string;        // e.g. "Kho Tổng", "Kho Bếp 1"
  address: string;
  isMain: boolean;
  isActive: boolean;
  branchType: BranchType;
}

/** Wrapper response từ /admin/branches/active (có phân trang) */
export interface BranchListResponse {
  data: Branch[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}


/** Returned by every /submit/create, /submit/update, /submit/delete endpoint */
export interface CommandResponse {
  commandId: string;           // UUID — used for approve / reject
  status: CommandStatus;
  action: CommandAction;
  entityId: string;            // UUID of the related entity
}

export type CommandStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CommandAction  = 'CREATE' | 'UPDATE' | 'DELETE';

// ─────────────────────────────────────────────
// AUTH (placeholder — API coming next sprint)
// ─────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'STAFF';

/**
 * Vai trò kho của user — đọc từ JSON Login
 * KHO_TONG: Kho Tổng (Cường) — thấy toàn bộ, bấm READY
 * KHO_BEP:  Kho Bếp — chỉ thấy phiếu của branch mình, bấm ACCEPT/REJECT
 * STORE:    Cửa hàng
 * BEP_TRUONG: Bếp trưởng — có thể duyệt sản xuất gấp
 */
export type WarehouseRole = 'KHO_TONG' | 'KHO_BEP' | 'STORE' | 'BEP_TRUONG';

/**
 * 4 Role ảo dùng để demo phân quyền menu
 * SUPER_ADMIN : Thấy Kho Tổng + Kho Bếp + Cửa Hàng
 * ADMIN_KHO   : Chỉ thấy Kho Tổng
 * ADMIN_BEP   : Chỉ thấy Kho Bếp
 * NV_CUA_HANG : Chỉ thấy Cửa Hàng
 */
export type MockRole = 'SUPER_ADMIN' | 'ADMIN_KHO' | 'ADMIN_BEP' | 'NV_CUA_HANG';

/**
 * Quyền per-screen từ JSON Login
 * FE đọc mảng này để quyết định hiện/ẩn từng button
 */
export interface ScreenPermission {
  screen: string;        // 'GOODS_TRANSFER' | 'PRODUCT_ORDER' | 'INVENTORY_ADJUSTMENT' | ...
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_approve: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  permissions: string[];
  /** Vai trò kho — phân biệt Kho Tổng / Kho Bếp / Bếp Trưởng */
  warehouse_role?: WarehouseRole;
  /** Mã chi nhánh/kho bếp — dùng để filter data scope */
  branch_code?: string;
  /** Quyền per-screen đọc từ JSON Login */
  screen_permissions?: ScreenPermission[];
  /** Role ảo dùng để demo phân quyền menu — chỉ dùng trong dev/mock mode */
  mockRole?: MockRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;           // seconds
}

// ─────────────────────────────────────────────
// ITEM GROUP
// ─────────────────────────────────────────────

export interface ItemGroup {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface ItemGroupRequest {
  code: string;
  name: string;
  sortOrder: number;
}

// ─────────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────────

export type ProductType = 'STANDARD' | 'SHEET_CAKE';
export type ProductUnit  = 'PCS' | 'KG';

export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type ItemType = 'INGREDIENT' | 'SEMI_PRODUCT' | 'PRODUCT';

export interface Item extends BaseEntity {
  code: string;
  name: string;
  itemType: ItemType;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: ApprovalStatus;
  rejectedReason: string | null;

  // Specific to Ingredient
  ingredientType?: string;
  defaultSupplier?: string | null; // or ReferenceValue
  lastPrice?: number;
  lastPriceDate?: string;

  // Specific to Product
  productType?: ProductType | null;
  productCategory?: string | null;
  sellingPrice?: number | null;

  // Item Group (only for PRODUCT)
  itemGroup?: ReferenceValue | null;
  activeRecipe?: Recipe | null;
  recipe?: RecipeRequest | null;
}

export interface ItemRequest {
  code: string;
  name: string;
  itemType: ItemType;
  unit: string;
  itemGroupId?: string | null;
  splittable?: boolean;
  unitSize?: number | null;

  // Ingredient fields
  ingredientType?: string;
  defaultSupplier?: string | null;

  // Product fields
  productType?: ProductType;
  productCategory?: string;
  sellingPrice?: number;

  recipe?: RecipeRequest;
}

export type Product = Item;
export type ProductRequest = ItemRequest;

// Pending / rejected command rows
export interface ProductCommand {
  commandId: string;
  action: CommandAction;
  status: CommandStatus;
  entityId: string;
  payload: ProductRequest;
  submittedAt: string;
  submittedBy: string;
  rejectedReason?: string;
}

// History item
export interface ProductHistory extends BaseEntity {
  action: CommandAction;
  payload: Partial<ProductRequest>;
}

// ─────────────────────────────────────────────
// RECIPE
// ─────────────────────────────────────────────

export interface RecipeLine {
  id: string;
  item?: Item | null;
  quantity: number;
  unit: string;
  sortOrder?: number;
}

export interface Recipe {
  id: string;
  version: number;
  active: boolean;
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  note?: string;
  product?: Item | null;
  semiProduct?: Item | null;
  lines: RecipeLine[];
}

/** POST /master/recipes or Nested inside ProductRequest.recipe */
export interface RecipeRequest {
  productId?: string;
  semiProductId?: string;
  note?: string;
  lines: RecipeLineRequest[];
}

export interface RecipeLineRequest {
  itemId: string;
  quantity: number;
  unit: string;
  sortOrder?: number;
}

/** PUT /master/recipes/{id} */
export interface RecipeUpdateRequest {
  productId?: string;
  semiProductId?: string;
  note?: string;
  effectiveDate?: string;
  isActive?: boolean;
  lines?: RecipeLineRequest[];
}

// ─────────────────────────────────────────────
// PRODUCT PRICE
// ─────────────────────────────────────────────

export interface ProductPrice extends BaseEntity {
  productId: string;
  productCode: string;
  productName: string;
  price: number;               // VND
  version: number;
  effectiveDate: string;
  note?: string;
}

export interface ProductPriceRequest {
  productId: string;
  price: number;
  effectiveDate: string;
  note?: string;
}

export interface ProductPriceCommand {
  commandId: string;
  action: CommandAction;
  status: CommandStatus;
  entityId: string;
  payload: ProductPriceRequest;
  submittedAt: string;
  submittedBy: string;
}

// ─────────────────────────────────────────────
// INGREDIENT PRICE
// ─────────────────────────────────────────────

export interface IngredientPrice extends BaseEntity {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  pricePerKg: number;          // VND
  version: number;
  effectiveDate: string;
  note?: string;
}

export interface IngredientPriceRequest {
  ingredientId: string;
  pricePerKg: number;
  effectiveDate: string;
  note?: string;
}

export interface IngredientPriceCommand {
  commandId: string;
  action: CommandAction;
  status: CommandStatus;
  entityId: string;
  payload: IngredientPriceRequest;
  submittedAt: string;
  submittedBy: string;
}

// ─────────────────────────────────────────────
// KITCHEN WAREHOUSE — PRODUCTION TEMPLATES
// ─────────────────────────────────────────────

export interface ProductionTemplate {
  id: string;
  productCode: string;
  productName: string;
  defaultQty: number;
  unit: ProductUnit;
}

export interface ProductionTemplateUpdateRequest {
  defaultQty: number;
}

// ─────────────────────────────────────────────
// KITCHEN WAREHOUSE — PRODUCTION LOTS
// ─────────────────────────────────────────────

export type LotCostStatus = 'CONFIRMED' | 'PENDING';

/** Response from POST /phase3/lots */
export interface ProductionLotResult {
  lotNumber: string;            // LOT-YYYYMMDD-CODE-001
  productCode: string;
  qtyProduced: number;
  productionDate: string;
  expiryDate: string;
  costPerUnit: number;
  costStatus: LotCostStatus;
  hasPending: boolean;
  pendingIngredients: string[];
}

/** GET /phase3/lots/expiring */
export interface ExpiringLot {
  lotNumber: string;
  productCode: string;
  productName: string;
  qtyProduced: number;
  qtyRemaining: number;
  productionDate: string;
  expiryDate: string;
  isExpiredToday: boolean;
  costPerUnit: number;
}

/** GET /phase3/lots/pending-cost — same shape as ExpiringLot but without expiry urgency */
export interface PendingCostLot {
  lotNumber: string;
  productCode: string;
  productName: string;
  qtyProduced: number;
  qtyRemaining: number;
  productionDate: string;
  expiryDate: string;
  costPerUnit: number;
  pendingIngredients: string[];
}

/** POST /phase3/lots */
export interface LotDeclarationRequest {
  productCode: string;
  qtyProduced: number;
  productionDate?: string;     // Default today
}

/** POST /phase3/lots/{lotNumber}/cancel */
export interface LotCancelRequest {
  qtyCancelled: number;
}

// ─────────────────────────────────────────────
// BAKERY WAREHOUSE — BATCH / DAILY OPS
// ─────────────────────────────────────────────

export interface BatchResult {
  date: string;
  totalProducts: number;
  okCount: number;
  overCount: number;
  underCount: number;
  discrepancyCount: number;
  batchRunId: string;
  completedAt: string;
}

/** Generic upload response (same shape for all 4 upload endpoints) */
export interface UploadResult {
  success: boolean;
  processedRows: number;
  errorRows: number;
  errors?: string[];
  date: string;
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

export interface HealthStatus {
  status: 'UP' | 'DOWN';
}

// ─────────────────────────────────────────────
// SETTINGS / ROLES (placeholder — next sprint)
// ─────────────────────────────────────────────

export interface UserRoleRow {
  key: string;
  roleCode: string;
  roleName: string;
  description: string;
  status: 'Active' | 'Pending' | 'Rejected';
}

export interface UserProfileRow {
  key: string;
  globalUserId: string;
  identityId: string;
  userEmail: string;
  profileName: string;
  userRole: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
}

// ─────────────────────────────────────────────
// WAREHOUSE — KHO TỔNG / KHO BẾP / CỬA HÀNG
// ─────────────────────────────────────────────

export type WarehouseType = 'MAIN' | 'KITCHEN' | 'STORE';
export type ReceiptType   = 'IMPORT' | 'EXPORT';
export type ReceiptStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

/** Một dòng nguyên liệu trong kho */
export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  category: string;            // Nhóm nguyên liệu
  unit: string;                // KG, Lít, Cái...
  quantity: number;
  minStock: number;            // Mức cảnh báo tồn kho thấp
  warehouse: WarehouseType;
  updatedAt: string;
}

/** Phiếu nhập / xuất kho */
export interface WarehouseReceipt extends BaseEntity {
  receiptCode: string;          // NHAP-20260701-001 / XUAT-20260701-001
  receiptType: ReceiptType;
  fromWarehouse: WarehouseType | null;  // null khi nhập từ NCC
  toWarehouse: WarehouseType | null;    // null khi xuất trả NCC
  note?: string;
  status: ReceiptStatus;
  lines: WarehouseReceiptLine[];
}

export interface WarehouseReceiptLine {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  note?: string;
}

export interface ReceiptRequest {
  receiptType: ReceiptType;
  fromWarehouse?: WarehouseType;
  toWarehouse?: WarehouseType;
  note?: string;
  lines: WarehouseReceiptLineRequest[];
}

export interface WarehouseReceiptLineRequest {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  note?: string;
}

/** Phiếu chờ duyệt / bị từ chối */
export interface WarehouseReceiptCommand {
  commandId: string;
  action: CommandAction;
  status: CommandStatus;
  entityId: string;
  payload: ReceiptRequest;
  submittedAt: string;
  submittedBy: string;
  rejectedReason?: string;
}

// ─────────────────────────────────────────────
// CỬA HÀNG — HIỂN THỊ SỐ LƯỢNG BÁNH
// ─────────────────────────────────────────────

export interface StoreItem {
  id: string;
  productCode: string;
  productName: string;
  unit: ProductUnit;
  quantityInStore: number;
  lastUpdated: string;
}

// ─────────────────────────────────────────────
// ĐƠN HÀNG — YÊU CẦU THÊM BÁNH
// ─────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CakeOrderLine {
  productCode: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  note?: string;
}

export interface CakeOrder {
  orderId: string;
  orderCode: string;           // ORD-20260701-001
  requestedBy: string;         // username
  requestedAt: string;
  status: OrderStatus;
  note?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  lines: CakeOrderLine[];
}

export interface CakeOrderCommand {
  commandId: string;
  action: CommandAction;
  status: CommandStatus;
  entityId: string;
  payload: OrderRequest;
  submittedAt: string;
  submittedBy: string;
  rejectedReason?: string;
}

export interface OrderRequest {
  note?: string;
  lines: CakeOrderLineRequest[];
}

export interface CakeOrderLineRequest {
  productCode: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  note?: string;
}

// ─────────────────────────────────────────────
// GOODS TRANSFER — LUÂN CHUYỂN KHO (Màn hình 1)
// ─────────────────────────────────────────────

/**
 * Trạng thái phiếu luân chuyển kho theo luồng 3-bên:
 * PENDING   → Kho Tổng gom phiếu tối hôm trước, chưa chuẩn bị hàng
 * READY     → Kho Tổng bấm "Chuẩn bị hàng xong", chờ Kho Bếp xác nhận
 * COMPLETED → Kho Bếp ACCEPT, phiếu thành công (lịch sử)
 * REJECTED  → Kho Bếp REJECT kèm lý do
 */
export type GoodsTransferStatus = 'PENDING' | 'READY' | 'COMPLETED' | 'REJECTED';

/** Một dòng nguyên liệu trong phiếu luân chuyển */
export interface GoodsTransferLine {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  note?: string;
}

/** Phiếu luân chuyển kho (phiếu giao nhận 3-bên) */
export interface GoodsTransferSlip {
  slipId: string;
  slipCode: string;             // XUAT-20260701-001
  status: GoodsTransferStatus;
  fromWarehouse: WarehouseType;
  toWarehouse: WarehouseType;
  toBranchCode?: string;        // branch_code của Kho Bếp nhận hàng
  lines: GoodsTransferLine[];
  note?: string;
  createdBy: string;
  createdAt: string;
  readyAt?: string;             // Kho Tổng bấm READY lúc nào
  readyBy?: string;
  completedAt?: string;
  completedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
}

export interface GoodsTransferRequest {
  fromWarehouse: WarehouseType;
  toWarehouse: WarehouseType;
  toBranchCode?: string;
  note?: string;
  lines: GoodsTransferLine[];
}

// ─────────────────────────────────────────────
// INVENTORY ADJUSTMENT — PHIẾU THẤT THOÁT
// ─────────────────────────────────────────────

export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AdjustmentType   = 'LOSS' | 'DAMAGE' | 'EXPIRED' | 'OTHER';

export interface InventoryAdjustmentLine {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  lostQuantity: number;
  note?: string;
}

export interface InventoryAdjustment {
  adjustmentId: string;
  adjustmentCode: string;       // ADJ-20260701-001
  adjustmentType: AdjustmentType;
  warehouseCode: WarehouseType;
  branchCode?: string;
  status: AdjustmentStatus;
  lines: InventoryAdjustmentLine[];
  reason: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
}

export interface InventoryAdjustmentRequest {
  adjustmentType: AdjustmentType;
  warehouseCode: WarehouseType;
  reason: string;
  note?: string;
  lines: InventoryAdjustmentLine[];
}

// ─────────────────────────────────────────────
// PRODUCT ORDER — QUẢN LÝ ĐƠN HÀNG (Màn hình 2)
// ─────────────────────────────────────────────

export type CakeType = 'SHEET_CAKE' | 'BENTO' | 'BANH_KEM_CHUAN';

export type ProductOrderStatus =
  | 'PENDING'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'DEPOSIT' | 'PAID';

/**
 * Dòng nguyên liệu tùy chỉnh trong đơn hàng SHEET_CAKE.
 * Bếp trưởng có thể chỉnh sửa số lượng so với công thức gốc.
 */
export interface CustomRecipeLine {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  /** Số lượng từ công thức gốc */
  baseQuantity: number;
  /** Số lượng thực tế sau khi bếp trưởng điều chỉnh */
  actualQuantity: number;
  /** Đánh dấu dòng đã bị chỉnh sửa */
  isModified?: boolean;
  note?: string;
}

/** Đơn hàng bánh custom / phát sinh */
export interface ProductOrder {
  orderId: string;
  orderCode: string;            // ORD-20260705-001
  cakeType: CakeType;
  status: ProductOrderStatus;
  paymentStatus: PaymentStatus;
  depositAmount?: number;       // Số tiền cọc (VND)
  /** Ngày giao bánh yêu cầu */
  deliveryDate: string;         // yyyy-MM-dd
  customerName?: string;
  customerPhone?: string;
  /** Mô tả chi tiết (dành cho SHEET_CAKE) */
  designDescription?: string;
  /** Định lượng tùy chỉnh của bếp trưởng */
  customRecipeLines?: CustomRecipeLine[];
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ProductOrderRequest {
  cakeType: CakeType;
  deliveryDate: string;
  customerName?: string;
  customerPhone?: string;
  designDescription?: string;
  depositAmount?: number;
  note?: string;
}

export interface CustomRecipeUpdateRequest {
  orderId: string;
  lines: {
    ingredientCode: string;
    actualQuantity: number;
    note?: string;
  }[];
}

/** Lệnh sản xuất gấp (phát sinh trong ngày) */
export interface UrgentProductionRequest {
  orderId?: string;             // Liên kết đơn hàng nếu có
  productCode: string;
  quantityNeeded: number;
  reason: string;
  note?: string;
}

export interface UrgentProduction {
  urgentId: string;
  urgentCode: string;
  productCode: string;
  productName: string;
  quantityNeeded: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ─────────────────────────────────────────────
// GENERIC PAGINATION
// ─────────────────────────────────────────────

/** Spring Page wrapper trả về từ các endpoint có phân trang */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;           // page index (0-based)
}

// ─────────────────────────────────────────────
// UNIFIED TRANSACTIONS  (POST /api/v1/transactions)
// Covers: IMPORT | TRANSFER | ADJUSTMENT | EXPORT | RETURN | DISCARD | STOCK_COUNT
// ─────────────────────────────────────────────

export type TransactionType =
  | 'PURCHASE'
  | 'IMPORT'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'EXPORT'
  | 'RETURN'
  | 'DISCARD'
  | 'STOCK_COUNT';

export type TransactionStatus = 'PENDING' | 'READY' | 'ACTIVE' | 'REJECTED';

/** Một dòng nguyên liệu trong phiếu kho */
export interface UnifiedTransactionLine {
  ingredientId?: string;       // UUID — XOR với ingredientCode
  ingredientCode?: string;     // String code — XOR với ingredientId
  qty: number;                 // Số lượng yêu cầu
  unitPrice?: number;          // Giá đơn vị (chỉ dùng cho IMPORT)
  note?: string;
}

/** POST /api/v1/transactions — body request */
export interface UnifiedTransactionRequest {
  type: TransactionType;
  fromBranchId?: string;       // TRANSFER: kho nguồn (UUID)
  toBranchId?: string;         // TRANSFER: kho đích (UUID)
  supplierId?: string;         // IMPORT: nhà cung cấp (UUID)
  note?: string;
  lines: UnifiedTransactionLine[];
}

/** POST /api/v1/inventory-requests (PURCHASE) */
export interface PurchaseRequestLine {
  itemId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  sortOrder: number;
  note?: string | null;
}

export interface PurchaseRequest {
  requestType: 'PURCHASE';
  requestDate: string;
  expectedDeliveryDate: string;
  targetWarehouseId: string;
  supplierId: string;
  note?: string;
  lines: PurchaseRequestLine[];
}

/** POST /api/v1/inventory-requests (TRANSFER) */
export interface TransferRequestLine {
  itemId: string;
  quantity: number;
  unit: string;
  note?: string | null;
}

export interface TransferRequest {
  requestType: 'TRANSFER';
  requestDate: string;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  note?: string;
  lines: TransferRequestLine[];
}

export interface AdjustRequestLine {
  itemId: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  note?: string;
}

export interface AdjustRequest {
  requestType: 'ADJUSTMENT';
  requestDate: string;
  targetWarehouseId: string;
  note?: string;
  lines: AdjustRequestLine[];
}

export type InventoryRequestPayload = PurchaseRequest | TransferRequest | AdjustRequest;

export interface RejectRequestPayload {
  reason: string;
  type: string;
  transactionDate: string;
  toBranchId?: string;
  supplierId?: string;
  transactionReason?: string;
  totalAmount: number;
  paymentStatus: string;
  note?: string;
  lines: Array<{
    itemId: string;
    itemType: string;
    qtyRequested: number;
    unit: string;
    unitPrice: number;
    note?: string;
  }>;
}

/** Dòng nguyên liệu trong response */
export interface UnifiedTransactionLineResponse {
  id: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  qty: number;
  qtyApproved?: number;        // Số lượng thực tế sau duyệt
  unitPrice?: number;
  totalPrice?: number;
}

/** Response từ POST/GET /api/v1/transactions */
export interface UnifiedTransactionResponse {
  id: string;                  // UUID
  code: string;                // e.g. IMP-20260701-001
  requestType: TransactionType;
  status: TransactionStatus;
  sourceWarehouse?: { key: string; name: string } | null;
  targetWarehouse?: { key: string; name: string } | null;
  supplier?: { key: string; name: string } | null;
  note?: string;
  lines: UnifiedTransactionLineResponse[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectedReason?: string;
}

/** Query params cho GET /api/v1/transactions */
export interface TransactionListParams {
  type: TransactionType;
  status?: TransactionStatus;
  branchId?: string;
  page?: number;
  size?: number;
}

// ─────────────────────────────────────────────
// INVENTORY LOTS  (GET /api/v1/inventory/lots)
// ─────────────────────────────────────────────

export interface InventoryLot {
  id: string;
  lotNumber: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  branchId: string;
  branchName: string;
  qty: number;
  qtyRemaining: number;
  unitPrice: number;
  expiryDate?: string;         // yyyy-MM-dd
  receivedDate: string;        // yyyy-MM-dd
  createdAt: string;
}

export interface StockLotSummary {
  item: {
    key: string;
    name: string;
  };
  warehouse: {
    key: string;
    name: string;
  };
  totalQtyRemaining: number;
}

export interface StockLotDetail {
  id: string;
  status: string;
  item: {
    key: string;
    name: string;
  };
  warehouse: {
    key: string;
    name: string;
  };
  supplier?: {
    key: string;
    name: string;
  } | null;
  qtyInitial: number;
  qtyRemaining: number;
  unitCost: number;
  receivedDate: string;
  expiryDate?: string | null;
  createdAt: string;
}

export interface InventoryStockResponse {
  branchId: string;
  branchName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: 'INGREDIENT' | 'PRODUCT';
  totalQtyAvailable: number;
  activeLotCount: number;
  earliestExpiryDate?: string;
  unit?: string; // Tạm thêm để hiển thị nếu cần
}

export interface InventoryFilter {
  branchId?: string;
  itemId?: string;
  itemType?: 'INGREDIENT' | 'PRODUCT';
  page?: number;
  size?: number;
}

/** Query params cho GET /api/v1/inventory/lots */
export interface InventoryLotParams {
  branchId?: string;
  ingredientId?: string;
  page?: number;
  size?: number;
}

// ─────────────────────────────────────────────
// PRODUCTION PLAN  (API 3-6)
// POST /admin/production/plan/generate
// GET  /admin/production/plans/{id}
// PUT  /admin/production/plans/{id}/lines/{lineId}
// POST /admin/production/plans/{id}/approve
// ─────────────────────────────────────────────

export type PlanStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

/** Một dòng sản phẩm trong kế hoạch sản xuất */
export interface ProductionPlanLine {
  id: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  item?: any;
  productId?: string;
  productCode?: string;
  productName?: string;
  unit: string;
  suggestedQty?: number;
  plannedQty?: number;          // Số lượng kế hoạch
  adjustedQty?: number;        // Sau khi điều chỉnh thủ công
  note?: string;
  group?: any;
}

/** Kế hoạch sản xuất ngày */
export interface ProductionPlan {
  id: string;
  planDate?: string;
  targetDate?: string;          // yyyy-MM-dd
  dayType?: string;
  approvalStatus?: string;
  status?: string; // PlanStatus
  lines: ProductionPlanLine[];
  note?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

/** PUT /admin/production/plans/{id}/lines/{lineId} — body */
export interface PlanLineAdjustRequest {
  plannedQty: number;
  note?: string;
}

// ─────────────────────────────────────────────
// PRODUCTION REQUESTS  (API 10-12)
// GET  /admin/production/requests?date=...
// POST /admin/production/requests/{id}/start
// POST /admin/production/requests/{id}/complete
// ─────────────────────────────────────────────

export type ProductionRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type ProductionRequestType = 'PLAN' | 'URGENT' | 'CUSTOMER_ORDER';

/** Lệnh sản xuất (được sinh ra sau khi duyệt kế hoạch) */
export interface ProductionRequest {
  id: string;
  requestCode: string;         // e.g. REQ-20260701-001
  requestType: ProductionRequestType;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  plannedQty: number;
  actualQty?: number;          // Điền sau khi hoàn thành
  targetDate: string;          // yyyy-MM-dd
  status: ProductionRequestStatus;
  note?: string;
  planId?: string;             // Liên kết ProductionPlan nếu type=PLAN
  startedAt?: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
}

/** Query params cho GET /admin/production/requests */
export interface ProductionRequestListParams {
  date?: string;               // yyyy-MM-dd
  status?: ProductionRequestStatus;
  requestType?: ProductionRequestType;
}

/** POST /admin/production/requests/{id}/start — body */
export interface StartProductionRequest {
  note?: string;
}

/** POST /admin/production/requests/{id}/complete — body */
export interface CompleteProductionRequest {
  actualQty: number;
  note?: string;
}

// ─────────────────────────────────────────────
// SHEET CAKE ORDERS  (API 13-15)
// GET  /admin/production/sheet-cake/pending?deliveryDate=...
// POST /admin/production/sheet-cake/lines/{lineId}/addons
// POST /admin/production/sheet-cake/orders/{id}/lock-production
// ─────────────────────────────────────────────

/** Topping / nguyên liệu add-on đặc thù cho đơn bánh kem */
export interface SheetCakeAddon {
  id?: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  qty: number;
  unit: string;
  note?: string;
}

/** Dòng sản phẩm trong đơn bánh kem */
export interface SheetCakeLine {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  qty: number;
  unit: string;
  designDescription?: string;
  addons: SheetCakeAddon[];
}

/** Đơn bánh kem (customer order loại SHEET_CAKE) */
export interface SheetCakeOrder {
  id: string;
  orderCode: string;
  customerName?: string;
  customerPhone?: string;
  deliveryDate: string;        // yyyy-MM-dd
  status: string;
  paymentStatus: PaymentStatus;
  depositAmount?: number;
  note?: string;
  lines: SheetCakeLine[];
  createdBy: string;
  createdAt: string;
}

/** POST /admin/production/sheet-cake/lines/{lineId}/addons — body */
export interface SheetCakeAddonRequest {
  ingredientId: string;
  qty: number;
  unit?: string;
  note?: string;
}

/** POST /admin/production/sheet-cake/orders/{id}/lock-production — body */
export interface LockProductionRequest {
  note?: string;
}

// ─────────────────────────────────────────────
// RECONCILIATION  (API 17)
// GET /api/v1/reconciliation/...
// ─────────────────────────────────────────────

export type ReconciliationItemStatus = 'OK' | 'OVER' | 'UNDER';

/** Một dòng đối chiếu theo sản phẩm */
export interface ReconciliationItem {
  productCode: string;
  productName: string;
  unit: string;
  qtyProduced: number;         // Bếp giao (nguồn 1)
  qtySold: number;             // POS bán (nguồn 2)
  qtyCancelled: number;        // Shop báo hủy (nguồn 3)
  qtyRemaining: number;        // Tồn cuối ngày
  discrepancy: number;         // Chênh lệch
  status: ReconciliationItemStatus;
}

/** Kết quả đối chiếu ngày */
export interface ReconciliationSummary {
  date: string;
  branchId?: string;
  branchName?: string;
  totalItems: number;
  okCount: number;
  overCount: number;
  underCount: number;
  items: ReconciliationItem[];
}

/** Query params cho GET /api/v1/reconciliation */
export interface ReconciliationParams {
  date: string;                // yyyy-MM-dd (bắt buộc)
  branchId?: string;
}

// ─────────────────────────────────────────────
// PRODUCTION GROUPS
// GET|POST  /api/v1/production-groups
// PUT|DELETE /api/v1/production-groups/:id
// ─────────────────────────────────────────────

export type ProductionGroupType = 'FREE_GROUP' | 'BATCH_FORMULA';

export interface ProductionGroupItem {
  itemId?: string;
  item?: { key: string; name: string };
  gramsPerUnit?: number | null;
  sortOrder: number;
}

export interface ProductionGroup {
  id: string;
  code: string;
  name: string;
  groupType: ProductionGroupType;
  itemGroup?: { key: string; name: string } | null;
  targetWeekday?: number | null;
  targetWeekend?: number | null;
  thresholdPercent?: number | null;
  batchWeightGrams?: number | null;
  note?: string | null;
  items: ProductionGroupItem[];
}

export interface ProductionGroupRequest {
  code: string;
  name: string;
  groupType: ProductionGroupType;
  itemGroupId?: string | null;
  targetWeekday?: number | null;
  targetWeekend?: number | null;
  thresholdPercent?: number | null;
  batchWeightGrams?: number | null;
  note?: string | null;
  items: { itemId: string; gramsPerUnit?: number | null; sortOrder: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLD RULES
// ─────────────────────────────────────────────────────────────────────────────

export type ThresholdRuleDayType = 'WEEKDAY' | 'WEEKEND';
export type ThresholdConditionType = 'COUNT' | 'PERCENT';
export type ThresholdActionType = 'PRODUCE_MORE' | 'FILL_TO_TARGET';

export interface ThresholdRule {
  dayType: ThresholdRuleDayType;
  sortOrder: number;
  conditionType: ThresholdConditionType;
  conditionValue: number | null;
  actionType: ThresholdActionType;
  actionValue: number | null;
}

export interface ThresholdRuleUpdateRequest {
  rules: ThresholdRule[];
}

// ─────────────────────────────────────────────
// PRODUCTION REQUEST (production-request-controller)
// GET    /api/v1/production-requests
// POST   /api/v1/production-requests
// GET    /api/v1/production-requests/{id}
// PUT    /api/v1/production-requests/{id}
// DELETE /api/v1/production-requests/{id}
// POST   /api/v1/production-requests/{id}/approve
// POST   /api/v1/production-requests/{id}/reject
// GET    /api/v1/production-requests/all
// POST   /api/v1/production-requests/{id}/lines/{lineId}/complete
// POST   /api/v1/production-requests/{id}/lines/complete-batch
// ─────────────────────────────────────────────

export type ProductionType = 'DAILY' | 'ORDER';

/** ReferenceValue — dạng { key, name } trả về từ nhiều endpoint */
export interface ReferenceValue {
  key: string;
  name: string;
}

/** Delivery Record cho 1 dòng sản xuất */
export interface DeliveryRecordDetail {
  id: string;
  qtyProduced: number;
  qtyReceived: number;
  discrepancy: number;
  deliveryStatus: string;
  confirmedAt?: string;
  confirmedBy?: string;
  note?: string;
}

/** Dòng sản xuất — từ ProductionRequestLineResponse */
export interface ProductionRequestLineDetail {
  id: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
  product: ReferenceValue;
  recipe?: ReferenceValue;
  plannedQty: number;
  lineStatus: string;
  sortOrder: number;
  note?: string;
  deliveryRecord?: DeliveryRecordDetail;
}

/** Lệnh sản xuất đầy đủ — từ ProductionRequestResponse */
export interface ProductionRequestDetail {
  id: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
  code: string;
  productionType: ProductionType;
  productionDate: string;          // yyyy-MM-dd
  note?: string;
  lines: ProductionRequestLineDetail[];
}

/** Wrapper phân trang từ /api/v1/production-requests */
export interface ProductionRequestPageResponse {
  content: ProductionRequestDetail[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ── Request Bodies ────────────────────────────

/** Một dòng trong form tạo/sửa lệnh sản xuất */
export interface ProductionRequestLineInput {
  productId: string;
  recipeId?: string;
  plannedQty: number;
  sortOrder?: number;
  note?: string;
}

/** Body cho POST/PUT /api/v1/production-requests */
export interface ProductionRequestInput {
  productionType: ProductionType;
  productionDate: string;          // yyyy-MM-dd
  note?: string;
  lines: ProductionRequestLineInput[];
}

/** Body cho POST .../lines/complete-batch */
export interface CompleteLineRequest {
  lineId: string;
  qtyProduced: number;
  adjustmentType?: 'INGREDIENT_VARIANCE' | 'PRODUCTION_WASTAGE';
  reason?: string;
  note?: string;
}

