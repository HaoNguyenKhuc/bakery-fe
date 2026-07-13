import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, Select, InputNumber, Divider, Alert, Card,
  Tooltip, Popconfirm, Badge, Row, Col, Timeline,
  message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, CheckOutlined, CloseOutlined,
  HistoryOutlined, ExclamationCircleOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { itemService } from '../../../api/services';
import type {
  Product, ProductRequest, ProductHistory,
  ProductType, ProductUnit, ItemType,
} from '../../../types';

const { Title, Text } = Typography;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Create/Edit Modal Removed ────────────────────────────────────────────────────────                



// ─── Main Component ───────────────────────────────────────────────────────────

const ProductList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [activeItemType, setActiveItemType] = useState<ItemType | ''>('PRODUCT');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const debouncedSearchText = useDebounce(searchText, 500);

  const {
    data: activeData,
    isLoading: activeLoading,
    isError: activeError,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['items', 'APPROVED', debouncedSearchText, activeItemType],
    queryFn: () => itemService.getAllItems({ search: debouncedSearchText, approvalStatus: 'APPROVED', itemType: activeItemType || undefined, page: 0, size: 500 }),
    retry: false,
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['items', 'PENDING_APPROVAL', debouncedSearchText, activeItemType],
    queryFn: () => itemService.getAllItems({ search: debouncedSearchText, approvalStatus: 'PENDING_APPROVAL', itemType: activeItemType || undefined, page: 0, size: 500 }),
    retry: false,
  });

  const {
    data: rejectedData,
    isLoading: rejectedLoading,
    isError: rejectedError,
    refetch: refetchRejected,
  } = useQuery({
    queryKey: ['items', 'REJECTED', debouncedSearchText, activeItemType],
    queryFn: () => itemService.getAllItems({ search: debouncedSearchText, approvalStatus: 'REJECTED', itemType: activeItemType || undefined, page: 0, size: 500 }),
    retry: false,
  });

  // Helper: handles direct array OR { data: [...] } envelope from backend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toArray = <T,>(raw: any): T[] => {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object' && Array.isArray(raw.content)) return raw.content as T[];
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) return raw.data as T[];
    return [];
  };

  const activeProducts = toArray<Product>(activeData);
  const pendingCommands = toArray<Product>(pendingData);
  const rejectedCommands = toArray<Product>(rejectedData);

  const handleRefreshAll = () => {
    refetchActive();
    refetchPending();
    refetchRejected();
  };

  // ── Mutations Removed to ProductForm ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemService.submitDelete(id),
    onSuccess: () => {
      message.success('Đã gửi lệnh xoá. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => itemService.approve(id),
    onSuccess: () => {
      message.success('Đã phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => itemService.reject(id, reason),
    onSuccess: () => {
      message.warning('Đã từ chối.');
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleApprove = (product: Product) => {
    Modal.confirm({
      title: 'Phê duyệt hàng hoá',
      content: `Bạn có chắc chắn muốn phê duyệt "${product.name}"?`,
      onOk: () => approveMutation.mutate(product.id),
      okText: 'Phê Duyệt',
      cancelText: 'Hủy',
    });
  };

  const handleOpenRejectModal = (product: Product) => {
    setRejectTargetId(product.id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = () => {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    rejectMutation.mutate({ id: rejectTargetId, reason: rejectReason });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // ── Active Tab Columns ─────────────────────────────────────────────────────────

  const activeColumns: ColumnsType<Product> = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên Hàng Hoá',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Phân Loại',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 140,
      render: (v: ItemType) => (
        <Tag color={v === 'INGREDIENT' ? 'blue' : v === 'SEMI_PRODUCT' ? 'purple' : 'green'}>
          {v === 'INGREDIENT' ? 'Nguyên Liệu' : v === 'SEMI_PRODUCT' ? 'Bán Thành Phẩm' : v === 'PRODUCT' ? 'Sản Phẩm' : 'Khác'}
        </Tag>
      ),
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Giá (Tham khảo)',
      key: 'price',
      width: 130,
      align: 'right',
      render: (_: unknown, record: Product) => {
        const price = record.itemType === 'INGREDIENT' ? record.lastPrice : record.sellingPrice;
        return price ? `${price.toLocaleString()} đ` : '—';
      },
    },
    {
      title: 'Công Thức',
      key: 'activeRecipe',
      width: 120,
      align: 'center',
      render: (_: unknown, record: Product) => {
        if (record.itemType === 'INGREDIENT') return <Text type="secondary">—</Text>;
        return record.activeRecipe
          ? <Tag color="green">Có</Tag>
          : <Tag color="red">Chưa có</Tag>;
      },
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_: unknown, record: Product) => (
        <Space size={4}>
          <Tooltip title="Xem lịch sử">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/products/${record.id}/history`)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => navigate(`/products/edit/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá hàng hoá"
            description={`Lệnh xoá "${record.name}" sẽ được gửi đến Admin để phê duyệt.`}
            onConfirm={() => handleDelete(record.id)}
            okText="Gửi Lệnh Xoá"
            cancelText="Huỷ"
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          >
            <Tooltip title="Xoá">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Pending Tab Columns ────────────────────────────────────────────────────────

  const pendingColumns: ColumnsType<Product> = [
    {
      title: 'Tên Hàng Hoá',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 120,
      render: (v: ItemType) => (
        <Tag color={v === 'INGREDIENT' ? 'blue' : v === 'SEMI_PRODUCT' ? 'purple' : 'green'}>
          {v === 'INGREDIENT' ? 'Nguyên Liệu' : v === 'SEMI_PRODUCT' ? 'Bán Thành Phẩm' : v === 'PRODUCT' ? 'Sản Phẩm' : 'Khác'}
        </Tag>
      ),
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—',
    },
    {
      title: 'Duyệt / Từ Chối',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
            title="Duyệt"
          />
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleOpenRejectModal(record)}
            title="Từ Chối"
          />
        </Space>
      ),
    },
  ];

  // ── Rejected Tab Columns ───────────────────────────────────────────────────────

  const rejectedColumns: ColumnsType<Product> = [
    {
      title: 'Tên Hàng Hoá',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 120,
      render: (v: ItemType) => (
        <Tag color={v === 'INGREDIENT' ? 'blue' : v === 'SEMI_PRODUCT' ? 'purple' : 'green'}>
          {v === 'INGREDIENT' ? 'Nguyên Liệu' : v === 'SEMI_PRODUCT' ? 'Bán Thành Phẩm' : v === 'PRODUCT' ? 'Sản Phẩm' : 'Khác'}
        </Tag>
      ),
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—',
    },
    {
      title: 'Lý Do Từ Chối',
      dataIndex: 'rejectedReason',
      key: 'rejectedReason',
      render: (v: string) => <Text type="danger">{v || '—'}</Text>,
    },
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'active',
      label: (
        <Space>
          Đang Active
          <Badge count={activeProducts.length} color="#52c41a" />
        </Space>
      ),
      children: (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Input
              placeholder="Tìm theo tên hoặc mã sản phẩm..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 380 }}
            />
          </div>
          <Table<Product>
            columns={activeColumns}
            dataSource={activeProducts}
            loading={activeLoading}
            rowKey="id"
            size="middle"
            pagination={{
              pageSize: 8,
              showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} sản phẩm`,
            }}
          />
        </>
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingCommands.length > 0 && (
            <Badge count={pendingCommands.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<Product>
          columns={pendingColumns}
          dataSource={pendingCommands}
          loading={pendingLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
    {
      key: 'rejected',
      label: (
        <Space>
          Bị Từ Chối
          {rejectedCommands.length > 0 && (
            <Badge count={rejectedCommands.length} color="#ff4d4f" />
          )}
        </Space>
      ),
      children: (
        <Table<Product>
          columns={rejectedColumns}
          dataSource={rejectedCommands}
          loading={rejectedLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Quản Lý Hàng Hoá</Title>
          <Text type="secondary">Tạo, chỉnh sửa và phê duyệt nguyên liệu, bán thành phẩm, sản phẩm</Text>
        </div>
        <Space>
          <Input
            placeholder="Tìm kiếm mã, tên..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={activeItemType}
            onChange={(val) => setActiveItemType(val as ItemType | '')}
            style={{ width: 160 }}
            placeholder="Tất cả hàng hoá"
            allowClear
          >
            <Select.Option value="">Tất cả</Select.Option>
            <Select.Option value="INGREDIENT">Nguyên Liệu</Select.Option>
            <Select.Option value="SEMI_PRODUCT">Bán Thành Phẩm</Select.Option>
            <Select.Option value="PRODUCT">Sản Phẩm</Select.Option>
          </Select>
          <Button
            icon={<HistoryOutlined />}
            onClick={handleRefreshAll}
            loading={activeLoading || pendingLoading || rejectedLoading}
          >
            Làm Mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/products/create')}
          >
            Thêm Hàng Hoá
          </Button>
        </Space>
      </div>

      {/* API Error banners */}
      {activeError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách sản phẩm active."
          description="Kiểm tra kết nối đến backend (http://localhost:8080)."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchActive()}>Thử lại</Button>}
        />
      )}
      {pendingError && (
        <Alert
          type="warning"
          showIcon
          message="Không tải được danh sách lệnh chờ duyệt."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchPending()}>Thử lại</Button>}
        />
      )}
      {rejectedError && (
        <Alert
          type="warning"
          showIcon
          message="Không tải được danh sách lệnh bị từ chối."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchRejected()}>Thử lại</Button>}
        />
      )}

      <Divider style={{ margin: '0 0 20px' }} />

      {/* Tabs */}
      <Tabs defaultActiveKey="active" items={tabItems} />

      {/* Drawer */}


      <Modal
        title="Từ Chối Sản Phẩm"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => setRejectModalOpen(false)}
        confirmLoading={rejectMutation.isPending}
        okText="Gửi"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8 }}>Vui lòng nhập lý do từ chối:</div>
        <Input.TextArea
          rows={4}
          placeholder="Lý do..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>


    </div>
  );
};

export default ProductList;
