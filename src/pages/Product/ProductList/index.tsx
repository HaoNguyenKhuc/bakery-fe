import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Modal, Alert,
  message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  CheckOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { itemService, itemGroupService } from '../../../api/services';
import type { Item, ItemType, ItemGroup } from '../../../types';

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

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeItemType, setActiveItemType] = useState<ItemType>('PRODUCT');
  const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

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
      search: debouncedSearch,
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

  // ── Switching ──────────────────────────────────────────────────────────────

  const switchItemType = (type: ItemType) => {
    setActiveItemType(type);
    setActiveGroupCode(null);
    setStatusFilter(null);
    setPage(0);
    setSearch('');
  };

  const switchGroup = (code: string | null) => {
    setActiveGroupCode(code);
    setPage(0);
  };

  const handleRefresh = () => {
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
      render: (_: unknown, record: Item) => (
        record.itemGroup?.value
          ? <Text style={{ color: '#2563eb', fontWeight: 500 }}>{record.itemGroup.value}</Text>
          : <Text type="secondary">—</Text>
      ),
    }] : []),
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 200,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
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
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 110,
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 140,
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
              onClick={() => navigate(`/products/edit/${record.id}`)}
            >
              Sửa
            </Button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Danh sách sản phẩm</Title>
          <Text type="secondary">Quản lý hàng hoá, bán thành phẩm và nguyên liệu</Text>
        </div>
        <Space>
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
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', padding: '0 20px' }}>
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
                  }}
                >
                  {g.name}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 12px', flexWrap: 'wrap' }}>
          <Input
            placeholder="Tìm tên / code..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            allowClear
            style={{ maxWidth: 240 }}
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
        <div style={{ padding: '0 20px' }}>
          <Table<Item>
            columns={columns}
            dataSource={displayItems}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={false}
            bordered={false}
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
    </div>
  );
};

export default ProductList;
