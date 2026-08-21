import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Modal, Alert,
  message, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  CheckOutlined, SyncOutlined, DollarOutlined,
  DeleteOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { itemService, itemGroupService } from '../../../api/services';
import type { Item, ItemType, ItemGroup } from '../../../types';
import { useAuthStore } from '../../../store/authStore';
import { CostCalculationModal } from './CostCalculationModal';

const { Title, Text } = Typography;

const PAGE_SIZE = 20;

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

const ITEM_TYPE_LABELS: Record<ItemType, { label: string; emoji: string; color: string }> = {
  PRODUCT:      { label: 'Sản Phẩm',       emoji: '🍰', color: '#16a34a' },
  SEMI_PRODUCT: { label: 'Bán Thành Phẩm', emoji: '🧁', color: '#7c3aed' },
  INGREDIENT:   { label: 'Nguyên Liệu',    emoji: '🥛', color: '#0369a1' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:            { color: '#475569', bg: '#f1f5f9', label: 'Draft' },
  PENDING_APPROVAL: { color: '#92400e', bg: '#fef3c7', label: 'Pending' },
  PENDING:          { color: '#92400e', bg: '#fef3c7', label: 'Pending' },
  APPROVED:         { color: '#065f46', bg: '#d1fae5', label: 'Approved' },
  REJECTED:         { color: '#991b1b', bg: '#fee2e2', label: 'Rejected' },
};

const STATUS_FILTERS = [
  { key: 'DRAFT',            label: 'Draft',    color: '#475569', bg: '#f1f5f9' },
  { key: 'PENDING_APPROVAL', label: 'Pending',  color: '#92400e', bg: '#fef3c7' },
  { key: 'APPROVED',         label: 'Approved', color: '#065f46', bg: '#d1fae5' },
  { key: 'REJECTED',         label: 'Rejected', color: '#991b1b', bg: '#fee2e2' },
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

// ─── Main Component ────────────────────────────────────────────────────────────

const ProductList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeItemType, setActiveItemType] = useState<ItemType>('PRODUCT');
  const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [costModalItem, setCostModalItem] = useState<Item | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Item[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(search, 500);

  // ── Queries ────────────────────────────────────────────────────────────────

  // Item groups for sub-tabs (only shown for PRODUCT)
  const { data: groupsRaw } = useQuery({
    queryKey: ['itemGroups'],
    queryFn: () => itemGroupService.getAll(),
    staleTime: 60_000,
  });
  const itemGroups: ItemGroup[] = toArray<ItemGroup>(groupsRaw);

  // When a specific group is selected → load all items of type then filter client-side
  const isGroupFiltered = activeItemType === 'PRODUCT' && activeGroupCode !== null;

  const {
    data: pagedData,
    isLoading: pagedLoading,
    isError: pagedError,
    refetch: refetchPaged,
  } = useQuery({
    queryKey: ['items-paged', activeItemType, debouncedSearch, page, statusFilter],
    queryFn: () => itemService.getAllItems({
      itemType: activeItemType,
      q: debouncedSearch.trim() || undefined,
      approvalStatus: statusFilter ?? undefined,
      page,
      size: PAGE_SIZE,
    }),
    enabled: !isGroupFiltered,
    placeholderData: keepPreviousData,
  });

  const {
    data: allTypeData,
    isLoading: allTypeLoading,
    isError: allTypeError,
    refetch: refetchAllType,
  } = useQuery({
    queryKey: ['items-all-type', activeItemType],
    queryFn: () => itemService.getAllItemsByType(activeItemType),
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

  const showGroupColumn = activeItemType === 'PRODUCT' && activeGroupCode === null;
  const showRecipeColumn = activeItemType === 'PRODUCT' || activeItemType === 'SEMI_PRODUCT';

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

  const handleApprove = (item: Item) => {
    Modal.confirm({
      title: 'Xác nhận Approve',
      content: `Phê duyệt "${item.name}"?`,
      okText: 'Approve',
      cancelText: 'Hủy',
      onOk: () => approveMut.mutate(item.id),
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return;
    const codeList = selectedRows.map(r => r.code).filter(Boolean);
    const codeSummary = codeList.length <= 5
      ? codeList.join(', ')
      : `${codeList.slice(0, 5).join(', ')}... (+${codeList.length - 5} mã khác)`;

    Modal.confirm({
      title: 'Xác nhận xóa hàng loạt',
      content: `Bạn có chắc chắn muốn xóa ${selectedRows.length} sản phẩm đã chọn? (Mã: ${codeSummary})`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setIsBulkDeleting(true);
        try {
          const results = await Promise.allSettled(
            selectedRows.map(item => itemService.submitDelete(item.id))
          );
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failCount = results.length - successCount;
          if (successCount > 0) {
            message.success(`Đã xóa thành công ${successCount} sản phẩm!`);
          }
          if (failCount > 0) {
            message.error(`${failCount} sản phẩm không thể xóa do có dữ liệu liên kết.`);
          }
          setSelectedRowKeys([]);
          setSelectedRows([]);
          queryClient.invalidateQueries({ queryKey: ['items-paged'] });
          queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
        } catch (err: any) {
          message.error('Lỗi khi thực hiện xóa.');
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
      const rawData = await itemService.getAllItemsByType(activeItemType);
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

        if (activeItemType === 'PRODUCT') {
          return {
            'STT': index + 1,
            'Nhóm': groupName,
            'Mã': item.code,
            'Tên sản phẩm': item.name,
            'Đơn vị': item.unit,
            'Giá vốn (VNĐ)': cost ? Number(cost) : '',
            'Giá bán (VNĐ)': item.sellingPrice ? Number(item.sellingPrice) : '',
            'Công thức': recipeText,
            'Trạng thái': item.approvalStatus,
          };
        } else if (activeItemType === 'SEMI_PRODUCT') {
          return {
            'STT': index + 1,
            'Mã': item.code,
            'Tên bán thành phẩm': item.name,
            'Đơn vị': item.unit,
            'Giá vốn (VNĐ)': cost ? Number(cost) : '',
            'Công thức': recipeText,
            'Trạng thái': item.approvalStatus,
          };
        } else {
          const supplierName = (item.defaultSupplier as any)?.name
            || (item.defaultSupplier as any)?.value
            || item.defaultSupplier
            || '';
          return {
            'STT': index + 1,
            'Mã': item.code,
            'Tên nguyên liệu': item.name,
            'Nhà cung cấp': supplierName,
            'Đơn vị': item.unit,
            'Giá vốn / Giá nhập (VNĐ)': cost ? Number(cost) : '',
            'Trạng thái': item.approvalStatus,
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();

      const tabLabel = ITEM_TYPE_LABELS[activeItemType]?.label || activeItemType;
      const cleanFileName = activeItemType === 'PRODUCT'
        ? 'San_Pham'
        : activeItemType === 'SEMI_PRODUCT'
        ? 'Ban_Thanh_Pham'
        : 'Nguyen_Lieu';

      XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel);
      XLSX.writeFile(workbook, `${cleanFileName}.xlsx`);
      message.success(`Đã xuất file ${cleanFileName}.xlsx thành công!`);
    } catch (err: any) {
      message.error('Xuất file thất bại: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  // ── Switching ──────────────────────────────────────────────────────────────

  const switchItemType = (type: ItemType) => {
    setActiveItemType(type);
    setActiveGroupCode(null);
    setStatusFilter(null);
    setPage(0);
    setSearch('');
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const switchGroup = (code: string | null) => {
    setActiveGroupCode(code);
    setPage(0);
    setSelectedRowKeys([]);
    setSelectedRows([]);
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

  const columns: ColumnsType<Item> = [
    ...(showGroupColumn ? [{
      title: 'Nhóm',
      key: 'itemGroup',
      width: 140,
      responsive: ['md' as const],
      render: (_: unknown, record: Item) => {
        const groupName = record.itemGroup?.name || record.itemGroup?.value;
        return groupName
          ? <Text style={{ color: '#2563eb', fontWeight: 500 }}>{groupName}</Text>
          : <Text type="secondary">—</Text>;
      },
    }] : []),
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: Item) => (
        <Text
          style={{ cursor: 'pointer', color: '#1d4ed8' }}
          onClick={() => navigate(`/products/edit/${record.id}`)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      responsive: ['sm' as const],
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    ...(isSuperAdmin ? [{
      title: 'Giá vốn',
      key: 'unitCost',
      width: 130,
      align: 'right' as const,
      responsive: ['md' as const],
      render: (_: unknown, record: any) => {
        const val = record.unitCost ?? record.lastPrice;
        if (val == null) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ fontWeight: 500, color: '#b45309' }}>
            {Number(val).toLocaleString('vi-VN')} đ
          </Text>
        );
      },
    }] : []),
    ...(showRecipeColumn ? [{
      title: 'Công thức',
      key: 'recipe',
      width: 100,
      align: 'center' as const,
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
    }] : []),
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 200,
      align: 'right',
      render: (_: unknown, record: Item) => {
        const canApprove = record.approvalStatus === 'DRAFT'
          || record.approvalStatus === 'PENDING_APPROVAL'
          || record.approvalStatus === 'PENDING';
        const isProductOrSemi = activeItemType === 'PRODUCT' || activeItemType === 'SEMI_PRODUCT';
        const isApproved = record.approvalStatus === 'APPROVED';

        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/edit/${record.id}`)}
            >
              Sửa
            </Button>
            {isProductOrSemi && isApproved && (
              <Button
                size="small"
                icon={<DollarOutlined />}
                style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }}
                onClick={() => setCostModalItem(record)}
              >
                Tính giá cost
              </Button>
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
          <Button icon={<SyncOutlined />} onClick={handleRefresh} loading={isLoading}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/create')}>
            Tạo mới
          </Button>
        </Space>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 0 16px' }}>

        {/* ── ItemType Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', padding: '0 20px', overflowX: 'auto' }}>
          {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map(type => {
            const { label, emoji, color } = ITEM_TYPE_LABELS[type];
            const active = activeItemType === type;
            return (
              <div
                key={type}
                onClick={() => switchItemType(type)}
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
        </div>

        {/* ── ItemGroup Sub-Tabs (only for PRODUCT) ── */}
        {activeItemType === 'PRODUCT' && itemGroups.length > 0 && (
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
                setPage(0);
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
              allowClear
              style={{ width: '100%', maxWidth: 240 }}
            />
            {/* Status filter pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map(({ key, label, color, bg }) => {
                const active = statusFilter === key;
                return (
                  <span
                    key={key}
                    onClick={() => { setStatusFilter(active ? null : key); setPage(0); }}
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
                  onClick={() => { setStatusFilter(null); setPage(0); }}
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
          </div>

          {/* Right: Export & Delete buttons */}
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#16a34a', borderColor: '#16a34a' }}
              loading={isExporting}
              onClick={handleExport}
            >
              Xuất Excel
            </Button>
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
            rowSelection={{
              selectedRowKeys,
              onChange: (keys: React.Key[], rows: Item[]) => {
                setSelectedRowKeys(keys);
                setSelectedRows(rows);
              },
            }}
            columns={columns}
            dataSource={displayItems}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={false}
            bordered={false}
            scroll={{ x: 750 }}
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
              onClick={() => setPage(p => p - 1)}
            >
              ‹
            </Button>
            <Text style={{ fontSize: 13 }}>Trang {page + 1}/{totalPages}</Text>
            <Button
              size="small"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
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
      />
    </div>
  );
};

export default ProductList;
