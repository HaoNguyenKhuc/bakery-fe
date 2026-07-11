import React, { useState, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Typography, Badge,
  Alert, Tooltip, Row, Col, message, Select, DatePicker,
  Empty,
} from 'antd';
import {
  ShoppingOutlined, PlusOutlined, EyeOutlined,
  CalendarOutlined, FilterOutlined, LockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import type {
  ProductOrder, CakeType, ProductOrderStatus, PaymentStatus,
  ProductOrderRequest, CustomRecipeUpdateRequest,
} from '../../../types';
import { useAuthStore } from '../../../store';
import CreateOrderModal from './components/CreateOrderModal';
import OrderDetailDrawer from './components/OrderDetailDrawer';
import UrgentProductionSection from './components/UrgentProductionSection';

const { Title, Text } = Typography;

// ─── Nhãn ─────────────────────────────────────────────────────────────────────

const CAKE_LABEL: Record<CakeType, { label: string; color: string }> = {
  SHEET_CAKE:     { label: '🎨 Sheet Cake', color: 'purple' },
  BENTO:          { label: '🍱 Bento',      color: 'cyan' },
  BANH_KEM_CHUAN: { label: '🎂 Bánh Kem Chuẩn', color: 'blue' },
};

const STATUS_MAP: Record<ProductOrderStatus, { color: string; label: string }> = {
  PENDING:       { color: 'orange', label: '⏳ Chờ xử lý' },
  IN_PRODUCTION: { color: 'blue',   label: '🔨 Đang SX' },
  COMPLETED:     { color: 'green',  label: '✅ Hoàn thành' },
  CANCELLED:     { color: 'red',    label: '❌ Đã huỷ' },
};

const PAYMENT_MAP: Record<PaymentStatus, { color: string; label: string }> = {
  UNPAID:  { color: 'red',   label: '💸 Chưa TT' },
  DEPOSIT: { color: 'blue',  label: '💳 Đã cọc' },
  PAID:    { color: 'green', label: '✅ Đã TT' },
};

// ─── Dummy data ───────────────────────────────────────────────────────────────

const dummyOrders: ProductOrder[] = [
  {
    orderId: 'ord-001',
    orderCode: 'ORD-20260705-001',
    cakeType: 'SHEET_CAKE',
    status: 'IN_PRODUCTION',
    paymentStatus: 'DEPOSIT',
    depositAmount: 200000,
    deliveryDate: '2026-07-08',
    customerName: 'Nguyễn Thị Lan',
    customerPhone: '0901 234 567',
    designDescription:
      'Kích cỡ: 20cm × 30cm (cho 20 người)\n' +
      'Chủ đề: Sinh nhật — màu hồng pastel, hoa kem 3D\n' +
      'Chữ trên bánh: "Happy Birthday Lan"\n' +
      'Phụ kiện: 1 nến số tuổi + hộp đựng bánh cao cấp\n' +
      'Lưu ý: không dùng màu thực phẩm đỏ',
    createdBy: 'thu.ngan',
    createdAt: '2026-07-05T09:00:00Z',
  },
  {
    orderId: 'ord-002',
    orderCode: 'ORD-20260705-002',
    cakeType: 'BENTO',
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    deliveryDate: '2026-07-06',
    customerName: 'Trần Văn Nam',
    customerPhone: '0912 345 678',
    note: 'Giao trước 10:00 sáng',
    createdBy: 'thu.ngan',
    createdAt: '2026-07-05T10:30:00Z',
  },
  {
    orderId: 'ord-003',
    orderCode: 'ORD-20260704-003',
    cakeType: 'BANH_KEM_CHUAN',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    deliveryDate: '2026-07-04',
    customerName: 'Lê Thị Hoa',
    note: '',
    createdBy: 'thu.ngan',
    createdAt: '2026-07-04T08:00:00Z',
    approvedBy: 'bep.truong',
    approvedAt: '2026-07-04T09:00:00Z',
  },
  {
    orderId: 'ord-004',
    orderCode: 'ORD-20260705-004',
    cakeType: 'SHEET_CAKE',
    status: 'PENDING',
    paymentStatus: 'DEPOSIT',
    depositAmount: 500000,
    deliveryDate: '2026-07-10',
    customerName: 'Phạm Minh Tuấn',
    customerPhone: '0933 456 789',
    designDescription:
      'Bánh kỷ niệm 10 năm cưới\n' +
      'Kích cỡ: 2 tầng — tầng 1: 30cm, tầng 2: 20cm\n' +
      'Màu chủ đạo: trắng và vàng gold\n' +
      'Trang trí: hoa đường + chữ "10 năm hạnh phúc"\n' +
      'Không dùng nhân sầu riêng',
    createdBy: 'thu.ngan2',
    createdAt: '2026-07-05T11:00:00Z',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductOrderPage: React.FC = () => {
  const queryClient = useQueryClient();

  const canOnScreen = useAuthStore((s) => s.canOnScreen);
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const isBepTruong = isWarehouseRole('BEP_TRUONG');

  const canCreate = canOnScreen('PRODUCT_ORDER', 'create');
  const canView   = canOnScreen('PRODUCT_ORDER', 'view');

  // ── Filters ─────────────────────────────────────────────────────────────────

  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | null>(null);
  const [cakeTypeFilter, setCakeTypeFilter] = useState<CakeType | null>(null);

  // ── UI State ─────────────────────────────────────────────────────────────────

  const [createOpen, setCreateOpen]           = useState(false);
  const [detailOrder, setDetailOrder]         = useState<ProductOrder | null>(null);
  const [drawerOpen, setDrawerOpen]           = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['product-orders', deliveryDate?.format('YYYY-MM-DD'), statusFilter, cakeTypeFilter],
    queryFn: async (): Promise<ProductOrder[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const rawList: ProductOrder[] = Array.isArray(data) ? data : dummyOrders;

  // Apply filters client-side (khi dùng dummy data)
  const filteredList = useMemo(() => {
    return rawList.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (cakeTypeFilter && o.cakeType !== cakeTypeFilter) return false;
      if (deliveryDate && o.deliveryDate !== deliveryDate.format('YYYY-MM-DD')) return false;
      return true;
    });
  }, [rawList, statusFilter, cakeTypeFilter, deliveryDate]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (_req: ProductOrderRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã tạo đơn hàng thành công!');
      queryClient.invalidateQueries({ queryKey: ['product-orders'] });
      setCreateOpen(false);
    },
    onError: () => message.warning('API chưa sẵn sàng — đơn hàng đã được ghi nhận (demo).'),
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (_req: CustomRecipeUpdateRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã lưu công thức tùy chỉnh. Bếp sẽ làm theo định lượng mới.');
      queryClient.invalidateQueries({ queryKey: ['product-orders'] });
    },
    onError: () => message.warning('API chưa sẵn sàng — công thức đã được ghi nhận (demo).'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openDetail = (order: ProductOrder) => {
    setDetailOrder(order);
    setDrawerOpen(true);
  };

  const clearFilters = () => {
    setDeliveryDate(null);
    setStatusFilter(null);
    setCakeTypeFilter(null);
  };

  const hasFilters = !!(deliveryDate || statusFilter || cakeTypeFilter);

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const pendingCount = rawList.filter((o) => o.status === 'PENDING').length;
  const inProductionCount = rawList.filter((o) => o.status === 'IN_PRODUCTION').length;

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<ProductOrder> = [
    {
      title: 'Mã Đơn',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Loại Bánh',
      dataIndex: 'cakeType',
      key: 'cakeType',
      width: 160,
      render: (v: CakeType) => {
        const cfg = CAKE_LABEL[v];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Khách Hàng',
      key: 'customer',
      render: (_: unknown, r: ProductOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.customerName ?? '—'}</Text>
          {r.customerPhone && <Text type="secondary" style={{ fontSize: 11 }}>{r.customerPhone}</Text>}
        </Space>
      ),
    },
    {
      title: (
        <Space size={4}>
          <CalendarOutlined />
          Ngày Giao
        </Space>
      ),
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      render: (v: string) => {
        const date = dayjs(v);
        const isToday = date.isSame(dayjs(), 'day');
        const isPast  = date.isBefore(dayjs(), 'day');
        return (
          <Text style={{ color: isPast ? '#ff4d4f' : isToday ? '#D2691E' : undefined, fontWeight: isToday ? 700 : 400 }}>
            {date.format('DD/MM/YYYY')}
            {isToday && <Badge color="orange" style={{ marginLeft: 6 }} />}
          </Text>
        );
      },
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: ProductOrderStatus) => {
        const cfg = STATUS_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Thanh Toán',
      dataIndex: 'paymentStatus',
      key: 'payment',
      width: 120,
      render: (v: PaymentStatus) => {
        const cfg = PAYMENT_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 110,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center',
      render: (_: unknown, r: ProductOrder) => (
        <Tooltip title="Xem chi tiết">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => openDetail(r)}
          />
        </Tooltip>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page Header ── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ShoppingOutlined style={{ color: '#D2691E', marginRight: 10 }} />
            Quản Lý Đơn Hàng
          </Title>
          <Text type="secondary">
            Quản lý đơn hàng custom (SHEET_CAKE, Bento, Bánh Kem Chuẩn) và đơn phát sinh
          </Text>
        </Col>
        <Col>
          {/* Nút TẠO ĐƠN — kiểm tra quyền can_create */}
          {canCreate ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              style={{ background: '#D2691E', borderColor: '#D2691E', fontWeight: 600 }}
              onClick={() => setCreateOpen(true)}
            >
              Tạo Đơn Hàng
            </Button>
          ) : (
            <Tooltip title="Bạn không có quyền tạo đơn hàng">
              <Button icon={<LockOutlined />} size="large" disabled>
                Tạo Đơn Hàng
              </Button>
            </Tooltip>
          )}
        </Col>
      </Row>

      {/* ── Summary Badges ── */}
      {(pendingCount > 0 || inProductionCount > 0) && (
        <Space style={{ marginBottom: 16 }}>
          {pendingCount > 0 && (
            <Alert
              type="warning"
              showIcon={false}
              message={
                <Space>
                  <Badge count={pendingCount} style={{ backgroundColor: '#fa8c16' }} />
                  <Text style={{ fontSize: 12 }}>đơn chờ xử lý</Text>
                </Space>
              }
              style={{ padding: '4px 12px', borderRadius: 6 }}
            />
          )}
          {inProductionCount > 0 && (
            <Alert
              type="info"
              showIcon={false}
              message={
                <Space>
                  <Badge count={inProductionCount} style={{ backgroundColor: '#1677ff' }} />
                  <Text style={{ fontSize: 12 }}>đơn đang sản xuất</Text>
                </Space>
              }
              style={{ padding: '4px 12px', borderRadius: 6 }}
            />
          )}
        </Space>
      )}

      {/* ── Filters ── */}
      <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Space size={4}>
            <FilterOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>Lọc:</Text>
          </Space>
        </Col>
        <Col>
          <DatePicker
            placeholder="Ngày giao bánh"
            format="DD/MM/YYYY"
            value={deliveryDate}
            onChange={setDeliveryDate}
            allowClear
            style={{ width: 160 }}
          />
        </Col>
        <Col>
          <Select
            placeholder="Trạng thái đơn"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 160 }}
          >
            <Select.Option value="PENDING">⏳ Chờ xử lý</Select.Option>
            <Select.Option value="IN_PRODUCTION">🔨 Đang SX</Select.Option>
            <Select.Option value="COMPLETED">✅ Hoàn thành</Select.Option>
            <Select.Option value="CANCELLED">❌ Đã huỷ</Select.Option>
          </Select>
        </Col>
        <Col>
          <Select
            placeholder="Loại bánh"
            value={cakeTypeFilter}
            onChange={setCakeTypeFilter}
            allowClear
            style={{ width: 170 }}
          >
            <Select.Option value="SHEET_CAKE">🎨 Sheet Cake (Thiết Kế)</Select.Option>
            <Select.Option value="BENTO">🍱 Bento Cake</Select.Option>
            <Select.Option value="BANH_KEM_CHUAN">🎂 Bánh Kem Chuẩn</Select.Option>
          </Select>
        </Col>
        {hasFilters && (
          <Col>
            <Button size="small" onClick={clearFilters}>Xoá bộ lọc</Button>
          </Col>
        )}
      </Row>

      {/* ── Table ── */}
      <Table<ProductOrder>
        columns={columns}
        dataSource={filteredList}
        rowKey="orderId"
        size="middle"
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} đơn hàng`,
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              description={
                hasFilters
                  ? 'Không có đơn hàng phù hợp bộ lọc — thử xoá bộ lọc'
                  : 'Chưa có đơn hàng nào'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        rowClassName={(r) => {
          const isToday = dayjs(r.deliveryDate).isSame(dayjs(), 'day');
          return isToday ? 'slip-row-new' : '';
        }}
      />

      {/* ── Urgent Production (chỉ Bếp trưởng) ── */}
      {isBepTruong && <UrgentProductionSection />}

      {/* ── Modals & Drawers ── */}
      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(req) => createMutation.mutate(req)}
        submitting={createMutation.isPending}
      />

      <OrderDetailDrawer
        order={detailOrder}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaveRecipe={(req) => saveRecipeMutation.mutate(req)}
        savingRecipe={saveRecipeMutation.isPending}
      />

      {/* Cảnh báo nếu không có quyền xem */}
      {!canView && (
        <Alert
          type="error"
          showIcon
          message="Bạn không có quyền xem màn hình Quản Lý Đơn Hàng."
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default ProductOrderPage;
