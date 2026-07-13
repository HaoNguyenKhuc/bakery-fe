import React, { useState } from 'react';
import {
  Table, Button, Space, Typography, Tabs, Modal, Form,
  Select, InputNumber, Input, DatePicker, Tag, Badge,
  Alert, Divider, Row, Col, Card, Statistic, Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, CloseOutlined,
  DollarOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { priceService, itemService } from '../../../api/services';
import type {
  ProductPrice, ProductPriceRequest, ProductPriceCommand,
  IngredientPrice, IngredientPriceRequest, IngredientPriceCommand,
  CommandResponse,
} from '../../../types';

const { Title, Text } = Typography;

const formatVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

// ─── Dummy fallback data ──────────────────────────────────────────────────────

const dummyProductPrices: ProductPrice[] = [
  {
    id: 'pp1', productId: '1', productCode: 'BM001', productName: 'Bánh Mì Bơ Tỏi',
    price: 25000, version: 2, effectiveDate: '2026-05-01', note: 'Tăng giá Q2',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-05-01T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-05-01T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-05-01T08:00:00Z',
  },
  {
    id: 'pp2', productId: '2', productCode: 'BK001', productName: 'Bánh Kem Socola',
    price: 350000, version: 1, effectiveDate: '2026-01-01', note: 'Giá khởi đầu',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-01-01T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-01-01T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'pp3', productId: '3', productCode: 'BN001', productName: 'Bánh Bông Lan Trứng Muối',
    price: 180000, version: 3, effectiveDate: '2026-06-01', note: 'Điều chỉnh mùa hè',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-06-01T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-06-01T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-06-01T08:00:00Z',
  },
];

const dummyPendingProductPrices: ProductPriceCommand[] = [
  {
    commandId: 'ppc-001', action: 'CREATE', status: 'PENDING',
    entityId: 'new-pp-1', submittedAt: '2026-06-30T10:00:00Z', submittedBy: 'manager',
    payload: { productId: '1', price: 27000, effectiveDate: '2026-07-01', note: 'Tăng giá Q3' },
  },
];

const dummyIngredientPrices: IngredientPrice[] = [
  {
    id: 'ip1', ingredientId: 'ing-1', ingredientCode: 'BOT01', ingredientName: 'Bột Mì Số 11',
    pricePerKg: 18000, version: 2, effectiveDate: '2026-05-15', note: 'Cập nhật giá nhà cung cấp',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-05-15T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-05-15T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-05-15T08:00:00Z',
  },
  {
    id: 'ip2', ingredientId: 'ing-2', ingredientCode: 'BO01', ingredientName: 'Bơ Lạt Président',
    pricePerKg: 280000, version: 1, effectiveDate: '2026-01-01', note: 'Giá nhập khẩu',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-01-01T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-01-01T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'ip3', ingredientId: 'ing-3', ingredientCode: 'KEM01', ingredientName: 'Kem Tươi Anchor',
    pricePerKg: 120000, version: 2, effectiveDate: '2026-04-01', note: '',
    entityStatus: 'ACTIVE',
    createdBy: 'admin', createdAt: '2026-04-01T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-04-01T07:00:00Z',
    approvedBy: 'admin', approvedAt: '2026-04-01T08:00:00Z',
  },
];

const dummyPendingIngredientPrices: IngredientPriceCommand[] = [
  {
    commandId: 'ipc-001', action: 'CREATE', status: 'PENDING',
    entityId: 'new-ip-1', submittedAt: '2026-06-29T14:00:00Z', submittedBy: 'accountant',
    payload: { ingredientId: 'ing-1', pricePerKg: 20000, effectiveDate: '2026-07-01', note: 'Tăng giá nhà cung cấp' },
  },
];

// ─── Product Price Tab ────────────────────────────────────────────────────────

interface ProductPriceTabProps {
  active: ProductPrice[];
  pending: ProductPriceCommand[];
  loadingActive: boolean;
  loadingPending: boolean;
  onApprove: (commandId: string) => void;
  onReject: (commandId: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  onOpenDrawer: () => void;
}

const ProductPriceTab: React.FC<ProductPriceTabProps> = ({
  active, pending, loadingActive, loadingPending,
  onApprove, onReject, approvePending, rejectPending, onOpenDrawer,
}) => {
  const avgPrice = active.length > 0
    ? active.reduce((s, p) => s + p.price, 0) / active.length
    : 0;

  const activeColumns: ColumnsType<ProductPrice> = [
    {
      title: 'Mã SP',
      dataIndex: 'productCode',
      key: 'productCode',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
    },
    {
      title: 'Giá Bán',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#52c41a' }}>{formatVND(v)}</Text>
      ),
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: 'Phiên Bản',
      dataIndex: 'version',
      key: 'version',
      align: 'center',
      width: 90,
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: 'Ngày Hiệu Lực',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v || '—'}</Text>,
    },
  ];

  const pendingColumns: ColumnsType<ProductPriceCommand> = [
    {
      title: 'Tên Sản Phẩm',
      key: 'name',
      render: (_: unknown, r: ProductPriceCommand) => (
        <Text>{r.payload.productId}</Text>
      ),
    },
    {
      title: 'Giá Mới',
      key: 'price',
      align: 'right',
      width: 140,
      render: (_: unknown, r: ProductPriceCommand) => (
        <Text strong style={{ color: '#1890ff' }}>{formatVND(r.payload.price)}</Text>
      ),
    },
    {
      title: 'Ngày Hiệu Lực',
      key: 'effectiveDate',
      width: 140,
      render: (_: unknown, r: ProductPriceCommand) =>
        dayjs(r.payload.effectiveDate).format('DD/MM/YYYY'),
    },
    {
      title: 'Người Gửi',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 120,
    },
    {
      title: 'Ghi Chú',
      key: 'note',
      ellipsis: true,
      render: (_: unknown, r: ProductPriceCommand) => (
        <Text type="secondary">{r.payload.note || '—'}</Text>
      ),
    },
    {
      title: 'Duyệt',
      key: 'approve',
      width: 160,
      align: 'center',
      render: (_: unknown, record: ProductPriceCommand) => (
        <Space>
          <Button
            type="primary" size="small" icon={<CheckOutlined />}
            onClick={() => onApprove(record.commandId)}
            loading={approvePending}
          >Duyệt</Button>
          <Button
            danger size="small" icon={<CloseOutlined />}
            onClick={() => onReject(record.commandId)}
            loading={rejectPending}
          >Từ Chối</Button>
        </Space>
      ),
    },
  ];

  const subTabs = [
    {
      key: 'active',
      label: `Giá Hiện Tại (${active.length})`,
      children: (
        <Table<ProductPrice>
          columns={activeColumns}
          dataSource={active}
          loading={loadingActive}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8, showTotal: (t) => `${t} sản phẩm` }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>Giá trung bình</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong style={{ color: '#52c41a' }}>{formatVND(avgPrice)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} colSpan={3} />
            </Table.Summary.Row>
          )}
        />
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>Chờ Duyệt
          {pending.length > 0 && (
            <Badge count={pending.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<ProductPriceCommand>
          columns={pendingColumns}
          dataSource={pending}
          loading={loadingPending}
          rowKey="commandId"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Tổng Sản Phẩm Có Giá"
              value={active.length}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Đang Chờ Duyệt"
              value={pending.length}
              valueStyle={{ color: pending.length > 0 ? '#fa8c16' : '#262626' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={onOpenDrawer}>
            Thêm Phiên Bản Giá Mới
          </Button>
        </Col>
      </Row>
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Giá sản phẩm là bất biến — mỗi thay đổi tạo một phiên bản mới và phải được Admin phê duyệt."
      />
      <Tabs defaultActiveKey="active" size="small" items={subTabs} />
    </div>
  );
};

// ─── Ingredient Price Tab ─────────────────────────────────────────────────────

interface IngredientPriceTabProps {
  active: IngredientPrice[];
  pending: IngredientPriceCommand[];
  loadingActive: boolean;
  loadingPending: boolean;
  onApprove: (commandId: string) => void;
  approvePending: boolean;
  onOpenDrawer: () => void;
}

const IngredientPriceTab: React.FC<IngredientPriceTabProps> = ({
  active, pending, loadingActive, loadingPending,
  onApprove, approvePending, onOpenDrawer,
}) => {
  const activeColumns: ColumnsType<IngredientPrice> = [
    {
      title: 'Mã NL',
      dataIndex: 'ingredientCode',
      key: 'ingredientCode',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên Nguyên Liệu',
      dataIndex: 'ingredientName',
      key: 'ingredientName',
      sorter: (a, b) => a.ingredientName.localeCompare(b.ingredientName),
    },
    {
      title: 'Giá / kg',
      dataIndex: 'pricePerKg',
      key: 'pricePerKg',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#D2691E' }}>{formatVND(v)}</Text>
      ),
      sorter: (a, b) => a.pricePerKg - b.pricePerKg,
    },
    {
      title: 'Phiên Bản',
      dataIndex: 'version',
      key: 'version',
      align: 'center',
      width: 90,
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: 'Ngày Hiệu Lực',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v || '—'}</Text>,
    },
  ];

  const pendingColumns: ColumnsType<IngredientPriceCommand> = [
    {
      title: 'Nguyên Liệu',
      key: 'ingredientId',
      render: (_: unknown, r: IngredientPriceCommand) => (
        <Text code>{r.payload.ingredientId}</Text>
      ),
    },
    {
      title: 'Giá / kg Mới',
      key: 'pricePerKg',
      align: 'right',
      width: 140,
      render: (_: unknown, r: IngredientPriceCommand) => (
        <Text strong style={{ color: '#1890ff' }}>{formatVND(r.payload.pricePerKg)}</Text>
      ),
    },
    {
      title: 'Ngày Hiệu Lực',
      key: 'effectiveDate',
      width: 140,
      render: (_: unknown, r: IngredientPriceCommand) =>
        dayjs(r.payload.effectiveDate).format('DD/MM/YYYY'),
    },
    {
      title: 'Người Gửi',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 120,
    },
    {
      title: 'Duyệt',
      key: 'approve',
      width: 100,
      align: 'center',
      render: (_: unknown, record: IngredientPriceCommand) => (
        <Button
          type="primary" size="small" icon={<CheckOutlined />}
          onClick={() => onApprove(record.commandId)}
          loading={approvePending}
        >Duyệt</Button>
      ),
    },
  ];

  const subTabs = [
    {
      key: 'active',
      label: `Giá Hiện Tại (${active.length})`,
      children: (
        <Table<IngredientPrice>
          columns={activeColumns}
          dataSource={active}
          loading={loadingActive}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>Chờ Duyệt
          {pending.length > 0 && (
            <Badge count={pending.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<IngredientPriceCommand>
          columns={pendingColumns}
          dataSource={pending}
          loading={loadingPending}
          rowKey="commandId"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onOpenDrawer}>
          Thêm Phiên Bản Giá Nguyên Liệu
        </Button>
      </div>
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Giá nguyên liệu được dùng để tính FIFO cost khi khai báo lô sản xuất (Kho Bếp)."
      />
      <Tabs defaultActiveKey="active" size="small" items={subTabs} />
    </div>
  );
};

// ─── Price Submission Drawers Removed ─────────────────────────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

const CostPrice: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: activeProductPrices, isLoading: ppActiveLoading } = useQuery({
    queryKey: ['product-prices', 'active'],
    queryFn: () => priceService.getActiveProductPrices(),
    retry: 1,
  });

  const { data: pendingProductPrices, isLoading: ppPendingLoading } = useQuery({
    queryKey: ['product-prices', 'pending'],
    queryFn: () => priceService.getPendingProductPrices(),
    retry: 1,
  });

  const { data: activeIngredientPrices, isLoading: ipActiveLoading } = useQuery({
    queryKey: ['ingredient-prices', 'active'],
    queryFn: () => priceService.getActiveIngredientPrices(),
    retry: 1,
  });

  const { data: pendingIngredientPrices, isLoading: ipPendingLoading } = useQuery({
    queryKey: ['ingredient-prices', 'pending'],
    queryFn: () => priceService.getPendingIngredientPrices(),
    retry: 1,
  });

  const pp = Array.isArray(activeProductPrices) ? activeProductPrices : dummyProductPrices;
  const ppPending = Array.isArray(pendingProductPrices) ? pendingProductPrices : dummyPendingProductPrices;
  const ip = Array.isArray(activeIngredientPrices) ? activeIngredientPrices : dummyIngredientPrices;
  const ipPending = Array.isArray(pendingIngredientPrices) ? pendingIngredientPrices : dummyPendingIngredientPrices;

  // ── Mutations ─────────────────────────────────────────────────────────────────



  const approvePPMutation = useMutation({
    mutationFn: (commandId: string) => priceService.approveProductPrice(commandId),
    onSuccess: () => {
      message.success('Đã phê duyệt giá sản phẩm.');
      queryClient.invalidateQueries({ queryKey: ['product-prices'] });
    },
  });

  const rejectPPMutation = useMutation({
    mutationFn: (commandId: string) => priceService.rejectProductPrice(commandId),
    onSuccess: () => {
      message.warning('Đã từ chối giá sản phẩm.');
      queryClient.invalidateQueries({ queryKey: ['product-prices'] });
    },
  });



  const approveIPMutation = useMutation({
    mutationFn: (commandId: string) => priceService.approveIngredientPrice(commandId),
    onSuccess: () => {
      message.success('Đã phê duyệt giá nguyên liệu.');
      queryClient.invalidateQueries({ queryKey: ['ingredient-prices'] });
    },
  });

  // ── Main Tabs ─────────────────────────────────────────────────────────────────

  const mainTabs = [
    {
      key: 'product-price',
      label: (
        <Space>
          <DollarOutlined />
          Giá Sản Phẩm
          {ppPending.length > 0 && (
            <Badge count={ppPending.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <ProductPriceTab
          active={pp}
          pending={ppPending}
          loadingActive={ppActiveLoading}
          loadingPending={ppPendingLoading}
          onApprove={(id) => approvePPMutation.mutate(id)}
          onReject={(id) => rejectPPMutation.mutate(id)}
          approvePending={approvePPMutation.isPending}
          rejectPending={rejectPPMutation.isPending}
          onOpenDrawer={() => navigate('/products/cost-price/product-price')}
        />
      ),
    },
    {
      key: 'ingredient-price',
      label: (
        <Space>
          <ShoppingOutlined />
          Giá Nguyên Liệu
          {ipPending.length > 0 && (
            <Badge count={ipPending.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <IngredientPriceTab
          active={ip}
          pending={ipPending}
          loadingActive={ipActiveLoading}
          loadingPending={ipPendingLoading}
          onApprove={(id) => approveIPMutation.mutate(id)}
          approvePending={approveIPMutation.isPending}
          onOpenDrawer={() => navigate('/products/cost-price/ingredient-price')}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Giá Cost</Title>
        <Text type="secondary">
          Quản lý giá bán sản phẩm và giá nguyên liệu theo quy trình phê duyệt
        </Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="product-price" items={mainTabs} />

    </div>
  );
};

export default CostPrice;
