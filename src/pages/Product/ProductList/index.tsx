import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Modal, Alert,
  message, Tooltip, Popover, Checkbox,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  CheckOutlined, SyncOutlined, DollarOutlined,
  DeleteOutlined, FileExcelOutlined, CalculatorOutlined,
  UndoOutlined, PictureOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { itemService, itemGroupService, recipeService } from '../../../api/services';
import type { Item, ItemType, ItemGroup, RecipeApplyAllResponse } from '../../../types';
import { useAuthStore } from '../../../store/authStore';
import { CostCalculationModal } from './CostCalculationModal';
import { ItemUsageModal } from './ItemUsageModal';

const { Title, Text } = Typography;

const PAGE_SIZE = 20;

export interface ColumnConfig {
  key: string;
  label: string;
}

export const ALL_TABLE_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Tên hàng hoá' },
  { key: 'itemType', label: 'Loại hàng hoá' },
  { key: 'itemGroup', label: 'Nhóm mặt hàng' },
  { key: 'supplier', label: 'Nhà cung cấp' },
  { key: 'unit', label: 'Đơn vị tính' },
  { key: 'importUnit', label: 'Đơn vị nhập' },
  { key: 'conversion', label: 'Quy đổi đóng gói' },
  { key: 'importPrice', label: 'Giá nhập' },
  { key: 'unitCost', label: 'Giá vốn / Giá lẻ' },
  { key: 'sellingPrice', label: 'Giá bán' },
  { key: 'shelfDays', label: 'Hạn sử dụng' },
  { key: 'splittable', label: 'Xuất lẻ' },
  { key: 'minStockQuantity', label: 'Ngưỡng tồn kho' },
  { key: 'restockQuantity', label: 'Mức nhập thêm' },
  { key: 'recipe', label: 'Công thức' },
  { key: 'approvalStatus', label: 'Trạng thái duyệt' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toArray = <T,>(raw: any): T[] => {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw.content)) return raw.content as T[];
  if (raw && Array.isArray(raw.data)) return raw.data as T[];
  return [];
};

const getTotal = (raw: any): number => raw?.totalElements ?? raw?.total ?? 0;
const getTotalPages = (raw: any): number => raw?.totalPages ?? 1;

const defPkg = (i: Item) => {
  const pkgs = i.packagings ?? [];
  return pkgs.find(p => p.isDefault) ?? pkgs[0] ?? null;
};

type TabKey = ItemType | 'DELETED';

const ITEM_TYPE_LABELS: Record<ItemType, { label: string; emoji: string; color: string }> = {
  PRODUCT: { label: 'Sản Phẩm', emoji: '🍰', color: '#16a34a' },
  SEMI_PRODUCT: { label: 'Bán Thành Phẩm', emoji: '🧁', color: '#7c3aed' },
  INGREDIENT: { label: 'Nguyên Liệu', emoji: '🥛', color: '#0369a1' },
};

export const DEFAULT_VISIBLE_COLUMNS: Record<TabKey, string[]> = {
  PRODUCT: [
    'itemGroup',
    'name',
    'unit',
    'unitCost',
    'sellingPrice',
    'shelfDays',
    'splittable',
    'recipe',
    'approvalStatus',
  ],
  SEMI_PRODUCT: [
    'name',
    'unit',
    'unitCost',
    'splittable',
    'minStockQuantity',
    'restockQuantity',
    'recipe',
    'approvalStatus',
  ],
  INGREDIENT: [
    'name',
    'supplier',
    'unit',
    'importUnit',
    'conversion',
    'importPrice',
    'unitCost',
    'splittable',
    'minStockQuantity',
    'restockQuantity',
    'approvalStatus',
  ],
  DELETED: [
    'itemType',
    'name',
    'unit',
    'unitCost',
    'approvalStatus',
  ],
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT: { color: '#475569', bg: '#f1f5f9', label: 'Draft' },
  PENDING_APPROVAL: { color: '#92400e', bg: '#fef3c7', label: 'Pending' },
  PENDING: { color: '#92400e', bg: '#fef3c7', label: 'Pending' },
  APPROVED: { color: '#065f46', bg: '#d1fae5', label: 'Approved' },
  REJECTED: { color: '#991b1b', bg: '#fee2e2', label: 'Rejected' },
};

const STATUS_FILTERS = [
  { key: 'DRAFT', label: 'Draft', color: '#475569', bg: '#f1f5f9' },
  { key: 'PENDING_APPROVAL', label: 'Pending', color: '#92400e', bg: '#fef3c7' },
  { key: 'APPROVED', label: 'Approved', color: '#065f46', bg: '#d1fae5' },
  { key: 'REJECTED', label: 'Rejected', color: '#991b1b', bg: '#fee2e2' },
];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { color: '#475569', bg: '#f1f5f9', label: status };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
};

const ProductImage: React.FC<{ src?: string | null; size?: number; alt?: string }> = ({ src, size = 64, alt = '' }) => {
  const [imgError, setImgError] = React.useState(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

  React.useEffect(() => {
    setImgError(false);
  }, [src]);

  if (!src || imgError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#94a3b8',
          gap: 2,
        }}
      >
        <PictureOutlined style={{ fontSize: size > 40 ? 20 : 14, color: '#94a3b8' }} />
        {size >= 60 && (
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, lineHeight: 1 }}>
            No image
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={`${apiBase}${src}`}
      alt={alt}
      onError={() => setImgError(true)}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: 6,
        flexShrink: 0,
        border: '1px solid #e2e8f0',
      }}
    />
  );
};

// ─── Sorter Helpers ───────────────────────────────────────────────────────────

const compareText = (a?: string | null, b?: string | null) => {
  return (a ?? '').localeCompare(b ?? '', 'vi', { sensitivity: 'base' });
};

const compareNumber = (a?: number | null, b?: number | null) => {
  const numA = a ?? -Infinity;
  const numB = b ?? -Infinity;
  return numA - numB;
};

const getSupplierName = (record: Item): string => {
  const sup = record.defaultSupplier;
  return (sup as any)?.name || (sup as any)?.value || (typeof sup === 'string' ? sup : '') || '';
};

const getRecipeScore = (record: Item): number => {
  const recipe = record.recipe || (record as any).activeRecipe;
  if (!recipe) return 0;
  if ((recipe as any).active === false) return 1;
  return 2;
};

const getIngredientImportPrice = (record: Item): number | null => {
  const pkg = defPkg(record);
  const cost = record.unitCost ?? record.lastPrice;
  if (!pkg || cost == null) return null;
  return Number(cost) * Number(pkg.qtyPerPack);
};

/** Làm tròn giá về bội số của 1000đ gần nhất */
const roundPrice = (val: number): number => Math.round(val / 1000) * 1000;

const fmtPrice = (val: number | string | null | undefined): string => {
  if (val == null || val === '') return '—';
  return roundPrice(Number(val)).toLocaleString('vi-VN') + ' đ';
};

/**
 * Định dạng giá chính xác (dùng cho Giá nhập, Giá lẻ): không làm tròn bội số 1000đ,
 * chỉ làm tròn sau 4 chữ số thập phân sau dấu chấm.
 * Ví dụ: 0.005 -> "0,005 đ", 12500.5 -> "12.500,5 đ", 15000 -> "15.000 đ"
 */
const fmtExactPrice = (val: number | string | null | undefined): string => {
  if (val == null || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return '—';
  const rounded = Math.round(num * 10000) / 10000;
  return (
    rounded.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }) + ' đ'
  );
};
const fmtRetailPrice = fmtExactPrice;

// ─── Main Component ────────────────────────────────────────────────────────────

const ProductList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());

  // ── URL & Navigation State ─────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const rawTab = searchParams.get('tab');
  const activeTab: TabKey = (rawTab === 'SEMI_PRODUCT' || rawTab === 'INGREDIENT' || rawTab === 'DELETED') ? rawTab : 'PRODUCT';
  const activeGroupCode = searchParams.get('group') || null;
  const statusFilter = searchParams.get('status') || null;
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 0 : rawPage - 1;

  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 500);

  // Sync debouncedSearch to URL query param
  React.useEffect(() => {
    const currentQ = searchParams.get('q') || '';
    if (debouncedSearch.trim() !== currentQ) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch.trim()) {
          next.set('q', debouncedSearch.trim());
        } else {
          next.delete('q');
        }
        next.delete('page');
        return next;
      }, { replace: true });
    }
  }, [debouncedSearch]);

  // Keep search input synced if q changes in URL externally (e.g. browser back/forward)
  React.useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== search) {
      setSearch(urlQ);
    }
  }, [searchParams.get('q')]);
  const [costModalItem, setCostModalItem] = useState<Item | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Item[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recalcResult, setRecalcResult] = useState<RecipeApplyAllResponse | null>(null);
  const [usageItem, setUsageItem] = useState<Item | null>(null);

  // ── Column Visibility State (⚙ Cấu hình cột hiển thị theo từng Tab) ────────
  const [visibleColumnsByTab, setVisibleColumnsByTab] = useState<Record<TabKey, string[]>>(() => {
    try {
      const saved = localStorage.getItem('product_table_visible_columns_by_tab');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            PRODUCT: Array.isArray(parsed.PRODUCT) ? parsed.PRODUCT : DEFAULT_VISIBLE_COLUMNS.PRODUCT,
            SEMI_PRODUCT: Array.isArray(parsed.SEMI_PRODUCT) ? parsed.SEMI_PRODUCT : DEFAULT_VISIBLE_COLUMNS.SEMI_PRODUCT,
            INGREDIENT: Array.isArray(parsed.INGREDIENT) ? parsed.INGREDIENT : DEFAULT_VISIBLE_COLUMNS.INGREDIENT,
            DELETED: Array.isArray(parsed.DELETED) ? parsed.DELETED : DEFAULT_VISIBLE_COLUMNS.DELETED,
          };
        }
      }
    } catch { }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const currentVisibleColumns = visibleColumnsByTab[activeTab] || DEFAULT_VISIBLE_COLUMNS[activeTab] || [];

  const handleUpdateVisibleColumns = (cols: string[]) => {
    const updated = {
      ...visibleColumnsByTab,
      [activeTab]: cols,
    };
    setVisibleColumnsByTab(updated);
    try {
      localStorage.setItem('product_table_visible_columns_by_tab', JSON.stringify(updated));
    } catch { }
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  // Item groups for sub-tabs (only shown for PRODUCT)
  const { data: groupsRaw } = useQuery({
    queryKey: ['itemGroups'],
    queryFn: () => itemGroupService.getAll(),
    staleTime: 60_000,
  });
  const itemGroups: ItemGroup[] = toArray<ItemGroup>(groupsRaw);

  // When a specific group is selected → load all items of type then filter client-side
  const isGroupFiltered = activeTab === 'PRODUCT' && activeGroupCode !== null;
  const isDeleted = activeTab === 'DELETED';

  const {
    data: pagedData,
    isLoading: pagedLoading,
    isError: pagedError,
    refetch: refetchPaged,
  } = useQuery({
    queryKey: ['items-paged', activeTab, debouncedSearch, page, statusFilter],
    queryFn: () => {
      if (isDeleted) {
        return itemService.getAllItems({
          status: 'INACTIVE',
          q: debouncedSearch.trim() || undefined,
          approvalStatus: statusFilter ?? undefined,
          page,
          size: PAGE_SIZE,
        });
      }
      return itemService.getAllItems({
        itemType: activeTab,
        q: debouncedSearch.trim() || undefined,
        approvalStatus: statusFilter ?? undefined,
        status: 'ACTIVE',
        page,
        size: PAGE_SIZE,
      });
    },
    enabled: !isGroupFiltered,
    placeholderData: keepPreviousData,
  });

  const {
    data: allTypeData,
    isLoading: allTypeLoading,
    isError: allTypeError,
    refetch: refetchAllType,
  } = useQuery({
    queryKey: ['items-all-type', activeTab],
    queryFn: () => itemService.getAllItemsByType(activeTab),
    enabled: isGroupFiltered,
    staleTime: 30_000,
  });

  // Derive display items
  let displayItems: Item[] = [];
  let totalItems = 0;
  let totalPages = 1;
  let isLoading: boolean = false;
  let isError: boolean = false;

  if (isGroupFiltered) {
    const all = toArray<Item>(allTypeData);
    // filter by group code
    const filtered = all.filter(i => i.itemGroup?.key === activeGroupCode);
    // apply search client-side
    const q = debouncedSearch.toLowerCase();
    let result = q
      ? filtered.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
      : filtered;
    // apply status filter client-side
    if (statusFilter) {
      result = result.filter(i => i.approvalStatus === statusFilter);
    }
    displayItems = result;
    totalItems = displayItems.length;
    isLoading = allTypeLoading;
    isError = allTypeError;
  } else {
    displayItems = toArray<Item>(pagedData);
    totalItems = getTotal(pagedData);
    totalPages = getTotalPages(pagedData);
    isLoading = pagedLoading;
    isError = pagedError;
  }

  const isIngredient = activeTab === 'INGREDIENT';
  const showGroupColumn = activeTab === 'PRODUCT' && activeGroupCode === null;
  const isPendingFilter = statusFilter === 'PENDING_APPROVAL' || statusFilter === 'PENDING';

  // ── Mutations ──────────────────────────────────────────────────────────────

  const approveMut = useMutation({
    mutationFn: (id: string) => itemService.approve(id),
    onSuccess: () => {
      message.success('Đã approve thành công!');
      queryClient.invalidateQueries({ queryKey: ['items-paged'] });
      queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
    },
    onError: () => message.error('Approve thất bại. Vui lòng thử lại.'),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => itemService.restore(id),
    onSuccess: () => {
      message.success('Đã khôi phục sản phẩm thành công!');
      queryClient.invalidateQueries({ queryKey: ['items-paged'] });
      queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
    },
    onError: (err: any) => {
      message.error(err?.message || 'Khôi phục sản phẩm thất bại.');
    },
  });

  const recalcAllMut = useMutation({
    mutationFn: () => recipeService.applyCostAll(),
    onSuccess: (res) => {
      setRecalcResult(res);
      message.success(`Đã cập nhật giá vốn cho ${res.updated} sản phẩm!`);
      queryClient.invalidateQueries({ queryKey: ['items-paged'] });
      queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
    },
    onError: (err: any) => {
      message.error(err?.message || 'Tính lại giá vốn thất bại.');
    },
  });

  const handleRecalcAll = () => {
    Modal.confirm({
      title: 'Tính lại giá vốn tất cả',
      icon: <CalculatorOutlined style={{ color: '#0ea5e9' }} />,
      content: 'Hệ thống sẽ tính lại giá vốn cho toàn bộ Sản Phẩm và Bán Thành Phẩm dựa trên công thức hiện tại. Bạn có chắc chắn muốn thực hiện?',
      okText: 'Bắt đầu tính',
      cancelText: 'Hủy',
      onOk: () => recalcAllMut.mutateAsync(),
    });
  };

  const handleApprove = (item: Item) => {
    Modal.confirm({
      title: 'Xác nhận Approve',
      content: `Phê duyệt "${item.name}"?`,
      okText: 'Approve',
      cancelText: 'Hủy',
      onOk: () => approveMut.mutate(item.id),
    });
  };

  const handleBulkApprove = () => {
    if (selectedRows.length === 0 && selectedRowKeys.length === 0) return;

    // Lọc các item có trạng thái cần duyệt (DRAFT, PENDING_APPROVAL, PENDING)
    const approvableRows = selectedRows.filter((r) =>
      ['DRAFT', 'PENDING_APPROVAL', 'PENDING'].includes(r.approvalStatus)
    );

    if (approvableRows.length === 0) {
      message.info('Tất cả sản phẩm đã chọn đều đã được phê duyệt trước đó!');
      return;
    }

    const codeList = approvableRows.map((r) => r.code).filter(Boolean);
    const codeSummary =
      codeList.length <= 5
        ? codeList.join(', ')
        : `${codeList.slice(0, 5).join(', ')}... (+${codeList.length - 5} mã khác)`;

    const totalSelected = selectedRowKeys.length || selectedRows.length;
    const skippedCount = totalSelected - approvableRows.length;

    Modal.confirm({
      title: 'Xác nhận phê duyệt hàng loạt',
      icon: <CheckOutlined style={{ color: '#16a34a' }} />,
      content: (
        <div>
          <p>
            Bạn có chắc chắn muốn phê duyệt <strong>{approvableRows.length}</strong> sản phẩm đã chọn?
          </p>
          <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
            Mã: {codeSummary}
          </p>
          {skippedCount > 0 && (
            <p style={{ color: '#d97706', fontSize: 12, margin: '6px 0 0' }}>
              * Bỏ qua {skippedCount} sản phẩm đã được phê duyệt trước đó.
            </p>
          )}
        </div>
      ),
      okText: `Duyệt (${approvableRows.length})`,
      okButtonProps: { style: { background: '#16a34a', borderColor: '#16a34a' } },
      cancelText: 'Hủy',
      onOk: async () => {
        setIsBulkApproving(true);
        try {
          const ids = approvableRows.map((item) => item.id);
          const res = await itemService.bulkApprove(ids);

          if (res.fulfilled > 0) {
            message.success(
              `Đã phê duyệt thành công ${res.fulfilled}/${res.total} sản phẩm!`
            );
          }
          if (res.rejected > 0) {
            message.warning(
              `Có ${res.rejected} sản phẩm phê duyệt thất bại.`
            );
          }

          setSelectedRowKeys([]);
          setSelectedRows([]);
          queryClient.invalidateQueries({ queryKey: ['items-paged'] });
          queryClient.invalidateQueries({ queryKey: ['items-all-type'] });

          if (isGroupFiltered) {
            refetchAllType();
          } else {
            refetchPaged();
          }
        } catch (err: any) {
          message.error(err?.message || 'Lỗi khi thực hiện phê duyệt hàng loạt.');
        } finally {
          setIsBulkApproving(false);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0 && selectedRowKeys.length === 0) return;
    const codeList = selectedRows.map(r => r.code).filter(Boolean);
    const codeSummary = codeList.length <= 5
      ? codeList.join(', ')
      : `${codeList.slice(0, 5).join(', ')}... (+${codeList.length - 5} mã khác)`;

    Modal.confirm({
      title: 'Xác nhận xóa hàng loạt',
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length || selectedRows.length} sản phẩm đã chọn? (Mã: ${codeSummary})`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setIsBulkDeleting(true);
        try {
          const ids = (selectedRowKeys as string[]).length > 0
            ? (selectedRowKeys as string[])
            : selectedRows.map(item => item.id);
          if (!ids || ids.length === 0) return;
          const res = await itemService.bulkDelete(ids);
          const deletedCount = (res as any)?.deleted ?? ids.length;
          message.success(`Đã xóa thành công ${deletedCount} sản phẩm!`);
          setSelectedRowKeys([]);
          setSelectedRows([]);
          queryClient.invalidateQueries({ queryKey: ['items-paged'] });
          queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
          // Gọi refetch trực tiếp để buộc load data mới, tránh bị cache cũ stale
          if (isGroupFiltered) {
            refetchAllType();
          } else {
            refetchPaged();
          }
        } catch (err: any) {
          message.error(err?.message || 'Lỗi khi thực hiện xóa hàng loạt.');
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Tải toàn bộ dữ liệu của tab hiện tại
      const rawData = isDeleted
        ? await itemService.getAllItems({ status: 'INACTIVE', page: 0, size: 2000 })
        : await itemService.getAllItemsByType(activeTab as string);
      const items: Item[] = toArray<Item>(rawData);

      if (!items || items.length === 0) {
        message.warning('Không có dữ liệu trong tab này để xuất!');
        return;
      }

      // Format dữ liệu theo từng tab
      const exportRows = items.map((item, index) => {
        const groupName = item.itemGroup?.name || item.itemGroup?.value || '';
        const recipeInfo = item.recipe || (item as any).activeRecipe;
        const recipeText = recipeInfo
          ? (recipeInfo.active ? 'Có (Hoạt động)' : 'Có (Chưa kích hoạt)')
          : 'Chưa có';
        const cost = item.unitCost ?? (item as any).lastPrice ?? '';
        const costRounded = cost !== '' ? roundPrice(Number(cost)) : '';
        const costExact = cost !== '' ? Math.round(Number(cost) * 10000) / 10000 : '';

        if (activeTab === 'PRODUCT') {
          return {
            'STT': index + 1,
            'Nhóm': groupName,
            'Mã': item.code,
            'Tên sản phẩm': item.name,
            'Đơn vị': item.unit,
            'Giá vốn (VNĐ)': costRounded,
            'Giá bán (VNĐ)': item.sellingPrice ? Number(item.sellingPrice) : '',
            'Công thức': recipeText,
            'Trạng thái': item.approvalStatus,
          };
        } else if (activeTab === 'SEMI_PRODUCT') {
          return {
            'STT': index + 1,
            'Mã': item.code,
            'Tên bán thành phẩm': item.name,
            'Đơn vị': item.unit,
            'Giá vốn (VNĐ)': costRounded,
            'Công thức': recipeText,
            'Trạng thái': item.approvalStatus,
          };
        } else if (activeTab === 'INGREDIENT') {
          const supplierName = (item.defaultSupplier as any)?.name
            || (item.defaultSupplier as any)?.value
            || item.defaultSupplier
            || '';
          const pkg = defPkg(item);
          const giaNhapExact = (pkg && cost !== '')
            ? Math.round(Number(cost) * Number(pkg.qtyPerPack) * 10000) / 10000
            : '';
          return {
            'STT': index + 1,
            'Mã': item.code,
            'Tên nguyên liệu': item.name,
            'Nhà cung cấp': supplierName,
            'Đơn vị tính': item.unit,
            'Đơn vị nhập': pkg?.name || '',
            'Giá nhập (VNĐ)': giaNhapExact,
            'Giá lẻ (VNĐ)': costExact,
            'Trạng thái': item.approvalStatus,
          };
        } else {
          return {
            'STT': index + 1,
            'Loại': item.itemType,
            'Mã': item.code,
            'Tên': item.name,
            'Đơn vị': item.unit,
            'Giá vốn / Giá lẻ (VNĐ)': item.itemType === 'INGREDIENT' ? costExact : costRounded,
            'Trạng thái': item.status,
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();

      const tabLabel = isDeleted ? 'Da_Xoa' : (ITEM_TYPE_LABELS[activeTab as ItemType]?.label || activeTab);
      const cleanFileName = activeTab === 'PRODUCT'
        ? 'San_Pham'
        : activeTab === 'SEMI_PRODUCT'
          ? 'Ban_Thanh_Pham'
          : activeTab === 'INGREDIENT'
            ? 'Nguyen_Lieu'
            : 'Da_Xoa';

      XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel);
      XLSX.writeFile(workbook, `${cleanFileName}.xlsx`);
      message.success(`Đã xuất file ${cleanFileName}.xlsx thành công!`);
    } catch (err: any) {
      message.error('Xuất file thất bại: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  // ── Switching & Navigation ─────────────────────────────────────────────────

  const switchTab = (tab: TabKey) => {
    setSearchParams(() => {
      const next = new URLSearchParams();
      if (tab !== 'PRODUCT') {
        next.set('tab', tab);
      }
      return next;
    });
    setSearch('');
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const switchGroup = (code: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (code) {
        next.set('group', code);
      } else {
        next.delete('group');
      }
      next.delete('page');
      return next;
    });
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const handleStatusFilterChange = (key: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = next.get('status');
      if (!key || current === key) {
        next.delete('status');
      } else {
        next.set('status', key);
      }
      next.delete('page');
      return next;
    });
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newPage > 0) {
        next.set('page', String(newPage + 1));
      } else {
        next.delete('page');
      }
      return next;
    });
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const goToEdit = (itemId: string | number) => {
    navigate(`/products/edit/${itemId}`, {
      state: { from: `${location.pathname}${location.search}` }
    });
  };

  const handleRefresh = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
    if (isGroupFiltered) {
      refetchAllType();
    } else {
      refetchPaged();
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const ingredientColumns: ColumnsType<Item> = [
    {
      title: 'Tên nguyên liệu',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: (a, b) => compareText(a.name, b.name),
      render: (v: string, record: Item) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => goToEdit(record.id)}>
            <ProductImage src={record.imageUrl} size={48} alt={v} />
            <Text ellipsis={{ tooltip: v }} style={{ color: '#1d4ed8', maxWidth: 160, fontWeight: 500 }}>{v}</Text>
          </div>
        );
      },
    },
    {
      title: 'Nhà cung cấp',
      key: 'supplier',
      width: 140,
      sorter: (a, b) => compareText(getSupplierName(a), getSupplierName(b)),
      render: (_: unknown, record: Item) => {
        const sup = record.defaultSupplier;
        const supName = (sup as any)?.name || (sup as any)?.value || (typeof sup === 'string' ? sup : null);
        return supName ? <Text style={{ color: '#0f172a' }}>{supName}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Đơn vị tính</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>KG / CAI / L…</div>
        </div>
      ),
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      sorter: (a, b) => compareText(a.unit, b.unit),
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Đơn vị nhập</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>thùng / bao…</div>
        </div>
      ),
      key: 'importUnit',
      width: 100,
      align: 'center',
      sorter: (a, b) => compareText(defPkg(a)?.name, defPkg(b)?.name),
      render: (_: unknown, record: Item) => {
        const pkg = defPkg(record);
        return pkg?.name ? <Text style={{ color: '#0f172a' }}>{pkg.name}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Quy đổi</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>1 đvị nhập = ? đvị tính</div>
        </div>
      ),
      key: 'conversion',
      width: 140,
      align: 'center',
      sorter: (a, b) => compareNumber(defPkg(a)?.qtyPerPack, defPkg(b)?.qtyPerPack),
      render: (_: unknown, record: Item) => {
        const pkg = defPkg(record);
        if (!pkg) return <Text type="secondary">—</Text>;
        return (
          <span style={{ fontSize: 12, color: '#374151' }}>
            1 {pkg.name} = <strong>{Number(pkg.qtyPerPack).toLocaleString('vi-VN')}</strong> {record.unit}
          </span>
        );
      },
    },
    {
      title: (
        <div style={{ textAlign: 'right' }}>
          <div>Giá nhập</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>đ / đvị nhập</div>
        </div>
      ),
      key: 'importPrice',
      width: 120,
      align: 'right' as const,
      sorter: (a, b) => compareNumber(getIngredientImportPrice(a), getIngredientImportPrice(b)),
      render: (_: unknown, record: Item) => {
        const pkg = defPkg(record);
        const cost = record.unitCost ?? record.lastPrice;
        if (!pkg || cost == null) return <Text type="secondary">—</Text>;
        const giaNhap = Number(cost) * Number(pkg.qtyPerPack);
        return (
          <Text style={{ fontWeight: 500, color: '#0f172a' }}>
            {fmtExactPrice(giaNhap)}
          </Text>
        );
      },
    },
    {
      title: (
        <div style={{ textAlign: 'right' }}>
          <div>Giá lẻ</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>đ / đvị tính</div>
        </div>
      ),
      key: 'unitCost',
      width: 120,
      align: 'right' as const,
      sorter: (a, b) => compareNumber(a.unitCost ?? a.lastPrice, b.unitCost ?? b.lastPrice),
      render: (_: unknown, record: Item) => {
        const cost = record.unitCost ?? record.lastPrice;
        if (cost == null) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ fontWeight: 500, color: '#0f172a' }}>
            {fmtRetailPrice(cost)}
          </Text>
        );
      },
    },
    {
      title: 'Xuất lẻ',
      dataIndex: 'splittable',
      key: 'splittable',
      width: 90,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => (a.splittable === b.splittable ? 0 : a.splittable ? -1 : 1),
      render: (v?: boolean) => (
        v ? <Tag color="green">Có</Tag> : <Tag color="default">Không</Tag>
      ),
    },
    {
      title: 'Ngưỡng tồn',
      dataIndex: 'minStockQuantity',
      key: 'minStockQuantity',
      width: 110,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.minStockQuantity, b.minStockQuantity),
      render: (v: number | null | undefined, record: Item) => {
        if (v == null) return <Text type="secondary">—</Text>;
        return (
          <span>
            <strong>{Number(v).toLocaleString('vi-VN')}</strong> <Text type="secondary" style={{ fontSize: 11 }}>{record.unit}</Text>
          </span>
        );
      },
    },
    {
      title: 'Mức nhập',
      dataIndex: 'restockQuantity',
      key: 'restockQuantity',
      width: 110,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.restockQuantity, b.restockQuantity),
      render: (v: number | null | undefined, record: Item) => {
        if (v == null) return <Text type="secondary">—</Text>;
        return (
          <span>
            <strong>{Number(v).toLocaleString('vi-VN')}</strong> <Text type="secondary" style={{ fontSize: 11 }}>{record.unit}</Text>
          </span>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareText(a.approvalStatus, b.approvalStatus),
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      align: 'right',
      render: (_: unknown, record: Item) => {
        const canApprove = record.approvalStatus === 'DRAFT'
          || record.approvalStatus === 'PENDING_APPROVAL'
          || record.approvalStatus === 'PENDING';

        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => goToEdit(record.id)}
            >
              Sửa
            </Button>
            <Tooltip title="Xem sản phẩm đang dùng NL này">
              <Button
                size="small"
                icon={<span>🔍</span>}
                onClick={() => setUsageItem(record)}
              />
            </Tooltip>
            {canApprove && (
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                loading={approveMut.isPending && approveMut.variables === record.id}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const productColumns: ColumnsType<Item> = [
    {
      title: 'Nhóm',
      key: 'itemGroup',
      width: 140,
      sorter: (a: Item, b: Item) => compareText(a.itemGroup?.name || a.itemGroup?.value, b.itemGroup?.name || b.itemGroup?.value),
      render: (_: unknown, record: Item) => {
        const groupName = record.itemGroup?.name || record.itemGroup?.value;
        return groupName
          ? <Text style={{ color: '#2563eb', fontWeight: 500 }}>{groupName}</Text>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: (a, b) => compareText(a.name, b.name),
      render: (v: string, record: Item) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => goToEdit(record.id)}>
            <ProductImage src={record.imageUrl} size={48} alt={v} />
            <Text ellipsis={{ tooltip: v }} style={{ color: '#1d4ed8', maxWidth: 160, fontWeight: 500 }}>{v}</Text>
          </div>
        );
      },
    },
    {
      title: 'Đơn vị tính',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      sorter: (a, b) => compareText(a.unit, b.unit),
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: (
        <div style={{ textAlign: 'right' }}>
          <div>Giá vốn</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>đ / đvt</div>
        </div>
      ),
      key: 'unitCost',
      width: 120,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.unitCost ?? a.lastPrice, b.unitCost ?? b.lastPrice),
      render: (_: unknown, record: any) => {
        const val = record.unitCost ?? record.lastPrice;
        if (val == null) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ fontWeight: 500, color: '#b45309' }}>
            {fmtPrice(val)}
          </Text>
        );
      },
    },
    {
      title: (
        <div style={{ textAlign: 'right' }}>
          <div>Giá bán</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>đ / đvt</div>
        </div>
      ),
      key: 'sellingPrice',
      width: 120,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.sellingPrice, b.sellingPrice),
      render: (_: unknown, record: any) => {
        if (record.sellingPrice == null) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ fontWeight: 500, color: '#16a34a' }}>
            {fmtPrice(record.sellingPrice)}
          </Text>
        );
      },
    },
    {
      title: 'Hạn SD',
      dataIndex: 'shelfDays',
      key: 'shelfDays',
      width: 100,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.shelfDays, b.shelfDays),
      render: (v?: number | null) => {
        if (v === undefined || v === null) return <Text type="secondary">—</Text>;
        if (v === 0) return <Tag color="orange">Trong ngày</Tag>;
        return <Text>{v} ngày</Text>;
      },
    },
    {
      title: 'Xuất lẻ',
      dataIndex: 'splittable',
      key: 'splittable',
      width: 90,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => (a.splittable === b.splittable ? 0 : a.splittable ? -1 : 1),
      render: (v?: boolean) => (
        v ? <Tag color="green">Có</Tag> : <Tag color="default">Không</Tag>
      ),
    },
    {
      title: 'Công thức',
      key: 'recipe',
      width: 100,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareNumber(getRecipeScore(a), getRecipeScore(b)),
      render: (_: unknown, record: Item) => {
        const recipe = record.recipe || (record as any).activeRecipe;
        if (!recipe) {
          return (
            <Tooltip title="Chưa có công thức">
              <span style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, cursor: 'default' }}>
                ✗
              </span>
            </Tooltip>
          );
        }
        if ((recipe as any).active === false) {
          return (
            <Tooltip title="Có công thức nhưng chưa kích hoạt">
              <span style={{ color: '#d97706', fontSize: 15, fontWeight: 700, cursor: 'default' }}>
                ⚠
              </span>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="Công thức đang hoạt động">
            <span style={{ color: '#16a34a', fontSize: 16, fontWeight: 700, cursor: 'default' }}>
              ✓
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareText(a.approvalStatus, b.approvalStatus),
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      align: 'right',
      render: (_: unknown, record: Item) => {
        const canApprove = record.approvalStatus === 'DRAFT'
          || record.approvalStatus === 'PENDING_APPROVAL'
          || record.approvalStatus === 'PENDING';
        const isApproved = record.approvalStatus === 'APPROVED';

        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => goToEdit(record.id)}
            >
              Sửa
            </Button>
            {isApproved && (
              <Tooltip title="Tính giá cost">
                <Button
                  size="small"
                  icon={<DollarOutlined />}
                  style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }}
                  onClick={() => setCostModalItem(record)}
                />
              </Tooltip>
            )}
            {canApprove && (
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                loading={approveMut.isPending && approveMut.variables === record.id}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const semiProductColumns: ColumnsType<Item> = [
    {
      title: 'Tên bán thành phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: (a, b) => compareText(a.name, b.name),
      render: (v: string, record: Item) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => goToEdit(record.id)}>
            <ProductImage src={record.imageUrl} size={48} alt={v} />
            <Text ellipsis={{ tooltip: v }} style={{ color: '#1d4ed8', maxWidth: 160, fontWeight: 500 }}>{v}</Text>
          </div>
        );
      },
    },
    {
      title: 'Đơn vị tính',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      sorter: (a, b) => compareText(a.unit, b.unit),
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: (
        <div style={{ textAlign: 'right' }}>
          <div>Giá vốn</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>đ / đvt</div>
        </div>
      ),
      key: 'unitCost',
      width: 120,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.unitCost ?? a.lastPrice, b.unitCost ?? b.lastPrice),
      render: (_: unknown, record: any) => {
        const val = record.unitCost ?? record.lastPrice;
        if (val == null) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ fontWeight: 500, color: '#b45309' }}>
            {fmtPrice(val)}
          </Text>
        );
      },
    },
    {
      title: 'Xuất lẻ',
      dataIndex: 'splittable',
      key: 'splittable',
      width: 90,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => (a.splittable === b.splittable ? 0 : a.splittable ? -1 : 1),
      render: (v?: boolean) => (
        v ? <Tag color="green">Có</Tag> : <Tag color="default">Không</Tag>
      ),
    },
    {
      title: 'Ngưỡng tồn',
      dataIndex: 'minStockQuantity',
      key: 'minStockQuantity',
      width: 110,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.minStockQuantity, b.minStockQuantity),
      render: (v: number | null | undefined, record: Item) => {
        if (v == null) return <Text type="secondary">—</Text>;
        return (
          <span>
            <strong>{Number(v).toLocaleString('vi-VN')}</strong> <Text type="secondary" style={{ fontSize: 11 }}>{record.unit}</Text>
          </span>
        );
      },
    },
    {
      title: 'Mức nhập',
      dataIndex: 'restockQuantity',
      key: 'restockQuantity',
      width: 110,
      align: 'right' as const,
      sorter: (a: Item, b: Item) => compareNumber(a.restockQuantity, b.restockQuantity),
      render: (v: number | null | undefined, record: Item) => {
        if (v == null) return <Text type="secondary">—</Text>;
        return (
          <span>
            <strong>{Number(v).toLocaleString('vi-VN')}</strong> <Text type="secondary" style={{ fontSize: 11 }}>{record.unit}</Text>
          </span>
        );
      },
    },
    {
      title: 'Công thức',
      key: 'recipe',
      width: 100,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareNumber(getRecipeScore(a), getRecipeScore(b)),
      render: (_: unknown, record: Item) => {
        const recipe = record.recipe || (record as any).activeRecipe;
        if (!recipe) {
          return (
            <Tooltip title="Chưa có công thức">
              <span style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, cursor: 'default' }}>
                ✗
              </span>
            </Tooltip>
          );
        }
        if ((recipe as any).active === false) {
          return (
            <Tooltip title="Có công thức nhưng chưa kích hoạt">
              <span style={{ color: '#d97706', fontSize: 15, fontWeight: 700, cursor: 'default' }}>
                ⚠
              </span>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="Công thức đang hoạt động">
            <span style={{ color: '#16a34a', fontSize: 16, fontWeight: 700, cursor: 'default' }}>
              ✓
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareText(a.approvalStatus, b.approvalStatus),
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      align: 'right',
      render: (_: unknown, record: Item) => {
        const canApprove = record.approvalStatus === 'DRAFT'
          || record.approvalStatus === 'PENDING_APPROVAL'
          || record.approvalStatus === 'PENDING';
        const isApproved = record.approvalStatus === 'APPROVED';

        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => goToEdit(record.id)}
            >
              Sửa
            </Button>
            {isApproved && (
              <Tooltip title="Tính giá cost">
                <Button
                  size="small"
                  icon={<DollarOutlined />}
                  style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }}
                  onClick={() => setCostModalItem(record)}
                />
              </Tooltip>
            )}
            <Tooltip title="Xem SP đang dùng BTP này">
              <Button
                size="small"
                icon={<span>🔍</span>}
                onClick={() => setUsageItem(record)}
              />
            </Tooltip>
            {canApprove && (
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                loading={approveMut.isPending && approveMut.variables === record.id}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const deletedColumns: ColumnsType<Item> = [
    {
      title: 'Loại',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 140,
      sorter: (a, b) => compareText(a.itemType, b.itemType),
      render: (v: ItemType) => {
        const info = ITEM_TYPE_LABELS[v];
        return info ? <Tag color={info.color}>{info.emoji} {info.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => compareText(a.name, b.name),
      render: (v: string, record: Item) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProductImage src={record.imageUrl} size={36} alt={v} />
            <Text style={{ color: '#475569', fontWeight: 500 }}>{v}</Text>
          </div>
        );
      },
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      sorter: (a, b) => compareText(a.unit, b.unit),
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: 'Giá vốn / Giá lẻ',
      key: 'unitCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => compareNumber(a.unitCost ?? a.lastPrice, b.unitCost ?? b.lastPrice),
      render: (_: unknown, record: Item) => {
        const val = record.unitCost ?? record.lastPrice;
        return record.itemType === 'INGREDIENT' ? fmtRetailPrice(val) : fmtPrice(val);
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      align: 'center' as const,
      sorter: (a: Item, b: Item) => compareText(a.approvalStatus, b.approvalStatus),
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 130,
      fixed: 'right' as const,
      align: 'right',
      render: (_: unknown, record: Item) => (
        <Button
          size="small"
          type="primary"
          icon={<UndoOutlined />}
          style={{ background: '#16a34a', borderColor: '#16a34a' }}
          loading={restoreMut.isPending && restoreMut.variables === record.id}
          onClick={() => {
            Modal.confirm({
              title: 'Khôi phục sản phẩm',
              content: `Khôi phục mặt hàng "${record.name}" về trạng thái hoạt động?`,
              okText: 'Khôi phục',
              cancelText: 'Hủy',
              onOk: () => restoreMut.mutate(record.id),
            });
          }}
        >
          Khôi phục
        </Button>
      ),
    },
  ];

  const columns = isDeleted
    ? deletedColumns
    : activeTab === 'INGREDIENT'
      ? ingredientColumns
      : activeTab === 'SEMI_PRODUCT'
        ? semiProductColumns
        : productColumns;

  const visibleTableColumns = React.useMemo(() => {
    return columns.filter((col) => {
      if (!col.key || col.key === 'action') return true;
      return currentVisibleColumns.includes(col.key as string);
    });
  }, [columns, currentVisibleColumns]);

  const currentTabColumnOptions = React.useMemo(() => {
    return columns
      .filter((c) => c.key && c.key !== 'action')
      .map((c) => {
        const found = ALL_TABLE_COLUMNS.find((ac) => ac.key === c.key);
        const titleText = typeof c.title === 'string' ? c.title : undefined;
        return {
          key: c.key as string,
          label: found?.label || titleText || (c.key as string),
        };
      });
  }, [columns]);

  // ── Pagination info ────────────────────────────────────────────────────────

  const fromItem = isGroupFiltered ? 1 : page * PAGE_SIZE + 1;
  const toItem = isGroupFiltered ? totalItems : Math.min((page + 1) * PAGE_SIZE, totalItems);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Danh sách sản phẩm</Title>
          <Text type="secondary">Quản lý hàng hoá, bán thành phẩm và nguyên liệu</Text>
        </div>
        <Space style={{ flexWrap: 'wrap' }}>
          <Button
            icon={<CalculatorOutlined />}
            style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }}
            loading={recalcAllMut.isPending}
            onClick={handleRecalcAll}
          >
            Tính lại giá vốn tất cả
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleRefresh} loading={isLoading}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/create', { state: { from: `${location.pathname}${location.search}` } })}>
            Tạo mới
          </Button>
        </Space>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 0 16px' }}>

        {/* ── ItemType Tabs ── */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          padding: '0 20px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          alignItems: 'center',
        }}>
          {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map(type => {
            const { label, emoji, color } = ITEM_TYPE_LABELS[type];
            const active = activeTab === type;
            return (
              <div
                key={type}
                onClick={() => switchTab(type)}
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  color: active ? color : '#64748b',
                  borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                  marginBottom: -2,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {emoji} {label}
              </div>
            );
          })}

          {/* ── Deleted Tab (Right-aligned) ── */}
          <div
            key="DELETED"
            onClick={() => switchTab('DELETED')}
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              color: activeTab === 'DELETED' ? '#ef4444' : '#94a3b8',
              borderBottom: activeTab === 'DELETED' ? '2px solid #ef4444' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            🗑 Đã xóa
          </div>
        </div>

        {/* ── ItemGroup Sub-Tabs (only for PRODUCT) ── */}
        {activeTab === 'PRODUCT' && itemGroups.length > 0 && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 20px', flexWrap: 'wrap' }}>
            {[{ code: null, name: 'Tất cả' } as { code: string | null; name: string }, ...itemGroups].map(g => {
              const active = activeGroupCode === g.code;
              return (
                <div
                  key={g.code ?? '__all__'}
                  onClick={() => switchGroup(g.code)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? '#2563eb' : '#475569',
                    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'all 0.15s',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.name}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 20px 12px', flexWrap: 'wrap' }}>
          {/* Left: Search & status filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <Input
              placeholder="Tìm tên / code..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
              allowClear
              style={{ width: '100%', maxWidth: 240 }}
            />
            {/* Status filter pills (hide in deleted tab) */}
            {!isDeleted && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map(({ key, label, color, bg }) => {
                  const active = statusFilter === key;
                  return (
                    <span
                      key={key}
                      onClick={() => handleStatusFilterChange(key)}
                      style={{
                        padding: '3px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: active ? '#fff' : color,
                        background: active ? color : bg,
                        border: `1px solid ${color}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
                {statusFilter && (
                  <span
                    onClick={() => handleStatusFilterChange(null)}
                    style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12,
                      cursor: 'pointer', color: '#64748b', background: '#f1f5f9',
                      border: '1px solid #cbd5e1', fontWeight: 500,
                    }}
                  >
                    ✕ Xóa lọc
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Export & Delete buttons */}
          <Space>
            <Popover
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>Cột hiển thị</span>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => handleUpdateVisibleColumns(ALL_TABLE_COLUMNS.map((c) => c.key))}
                  >
                    Hiện tất cả
                  </Button>
                </div>
              }
              trigger="click"
              placement="bottomRight"
              content={
                <div style={{ maxWidth: 260, maxHeight: 360, overflowY: 'auto' }}>
                  <Checkbox.Group
                    value={currentVisibleColumns}
                    onChange={(vals) => handleUpdateVisibleColumns(vals as string[])}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {currentTabColumnOptions.map((col) => (
                      <Checkbox key={col.key} value={col.key}>
                        {col.label}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              }
            >
              <Button icon={<SettingOutlined />}>Cột hiển thị</Button>
            </Popover>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#16a34a', borderColor: '#16a34a' }}
              loading={isExporting}
              onClick={handleExport}
            >
              Xuất Excel
            </Button>
            {!isDeleted && (
              <>
                {isPendingFilter && (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                    disabled={selectedRowKeys.length === 0}
                    loading={isBulkApproving}
                    onClick={handleBulkApprove}
                  >
                    Duyệt {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                  </Button>
                )}
                <Button
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  disabled={selectedRowKeys.length === 0}
                  loading={isBulkDeleting}
                  onClick={handleBulkDelete}
                >
                  Xóa {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* ── Error ── */}
        {isError && (
          <Alert
            type="error"
            showIcon
            message="Không tải được danh sách. Kiểm tra kết nối backend."
            style={{ margin: '0 20px 12px' }}
            action={<Button size="small" onClick={handleRefresh}>Thử lại</Button>}
          />
        )}

        {/* ── Table ── */}
        <div style={{ padding: '0 20px', overflowX: 'auto' }}>
          <Table<Item>
            {...(!isDeleted ? {
              rowSelection: {
                selectedRowKeys,
                onChange: (keys: React.Key[], rows: Item[]) => {
                  setSelectedRowKeys(keys);
                  setSelectedRows(rows);
                },
              }
            } : {})}
            columns={visibleTableColumns}
            dataSource={displayItems}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={false}
            bordered={false}
            scroll={{ x: 'max-content' }}
            style={{ fontSize: 13 }}
            onRow={(record) => ({
              style: { cursor: 'default' },
              onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; },
              onMouseLeave: (e) => { (e.currentTarget as HTMLElement).style.background = ''; },
            })}
          />
        </div>

        {/* ── Pagination ── */}
        {!isGroupFiltered && totalItems > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, padding: '12px 20px 0', borderTop: '1px solid #f1f5f9', marginTop: 8,
          }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              {fromItem}–{toItem} / {totalItems}
            </Text>
            <Button
              size="small"
              disabled={page === 0}
              onClick={() => handlePageChange(page - 1)}
            >
              ‹
            </Button>
            <Text style={{ fontSize: 13 }}>Trang {page + 1}/{totalPages}</Text>
            <Button
              size="small"
              disabled={page >= totalPages - 1}
              onClick={() => handlePageChange(page + 1)}
            >
              ›
            </Button>
          </div>
        )}

        {/* Group filter: show count */}
        {isGroupFiltered && (
          <div style={{ padding: '12px 20px 0', borderTop: '1px solid #f1f5f9', marginTop: 8, textAlign: 'right' }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>{totalItems} mục</Text>
          </div>
        )}
      </div>

      {/* Cost Calculation Modal */}
      <CostCalculationModal
        open={!!costModalItem}
        itemId={costModalItem?.id ?? null}
        itemName={costModalItem?.name ?? ''}
        onClose={() => setCostModalItem(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['items-paged'] });
          queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
        }}
      />

      {/* ── Recalculate All Costs Summary Modal ── */}
      {recalcResult && (
        <Modal
          open={true}
          title="Kết quả tính lại giá vốn"
          onCancel={() => setRecalcResult(null)}
          footer={[
            <Button key="ok" type="primary" onClick={() => setRecalcResult(null)}>
              Đóng
            </Button>,
          ]}
          width={560}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '16px 0' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{recalcResult.updated}</div>
              <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>Đã cập nhật</div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{recalcResult.skipped}</div>
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>Thiếu giá NL</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>{recalcResult.noRecipe}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Chưa có CT</div>
            </div>
          </div>
          {recalcResult.errors && recalcResult.errors.filter(Boolean).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong style={{ fontSize: 13, color: '#dc2626' }}>
                Danh sách chi tiết ({recalcResult.errors.filter(Boolean).length}):
              </Text>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                padding: '8px 12px', maxHeight: 200, overflowY: 'auto', marginTop: 6,
                fontSize: 12, color: '#991b1b', fontFamily: 'monospace'
              }}>
                {recalcResult.errors.filter(Boolean).map((err, idx) => (
                  <div key={idx} style={{ padding: '3px 0', borderBottom: idx < recalcResult.errors!.length - 1 ? '1px solid #fee2e2' : 'none' }}>
                    • {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Item Usage Modal */}
      <ItemUsageModal
        open={!!usageItem}
        itemId={usageItem?.id ?? null}
        itemName={usageItem?.name ?? ''}
        onClose={() => setUsageItem(null)}
      />
    </div>
  );
};

export default ProductList;
