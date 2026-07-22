import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, InputNumber, Divider, Alert,
  Badge, Row, Col, message, Empty,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ShopOutlined, EyeOutlined,
  CheckOutlined, CloseOutlined, ShoppingCartOutlined,
  ImportOutlined, ExportOutlined, FormOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type {
  InventoryLot,
  UnifiedTransactionResponse,
  UnifiedTransactionRequest,
  PurchaseRequest,
  TransferRequest,
  RejectRequestPayload,
  TransactionType,
  StockLotSummary,
} from '../../../types';
import { transactionService, inventoryService } from '../../../api/services';
import { useWarehouseStore } from '../../../store';
import RejectModal from '../InventoryRequests/components/RejectModal';
import { useNavigate } from 'react-router-dom';


const { Title, Text } = Typography;

const TYPE_LABEL: Record<TransactionType, string> = {
  PURCHASE: 'Mua Hàng',
  IMPORT: 'Nhập',
  TRANSFER: 'Xuất / Chuyển',
  ADJUSTMENT: 'Điều Chỉnh',
  EXPORT: 'Xuất',
  RETURN: 'Trả NCC',
  DISCARD: 'Hủy',
  STOCK_COUNT: 'Kiểm Kê',
};

const TYPE_COLOR: Record<TransactionType, string> = {
  PURCHASE: 'magenta',
  IMPORT: 'green',
  TRANSFER: 'blue',
  ADJUSTMENT: 'orange',
  EXPORT: 'cyan',
  RETURN: 'volcano',
  DISCARD: 'red',
  STOCK_COUNT: 'purple',
};



// ─── Main Component ───────────────────────────────────────────────────────────

const StoreWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);

  // ── Warehouse data from global store (loaded in MainLayout) ──────────────────

  const getKhoTong  = useWarehouseStore((s) => s.getKhoTong);
  const getStores   = useWarehouseStore((s) => s.getStores);
  const warehouseLoading = useWarehouseStore((s) => s.loading);

  const storeWarehouse = getStores()[0];   // first active Store
  const storeId        = storeWarehouse?.id;
  const khoTong        = getKhoTong();
  const khoTongId      = khoTong?.id;

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['warehouse', 'store', 'requests', 'PENDING_APPROVAL', storeId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: storeWarehouse!.code, approvalStatus: 'PENDING_APPROVAL', size: 50 }),
    enabled: !!storeWarehouse?.code,
    staleTime: 15_000,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['warehouse', 'store', 'requests', 'APPROVED', storeId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: storeWarehouse!.code, approvalStatus: 'APPROVED', size: 50 }),
    enabled: !!storeWarehouse?.code,
    staleTime: 30_000,
  });

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    queryKey: ['warehouse', 'store', 'requests', 'REJECTED', storeId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: storeWarehouse!.code, approvalStatus: 'REJECTED', size: 50 }),
    enabled: !!storeWarehouse?.code,
    staleTime: 30_000,
  });

  // Tồn kho
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse', 'store', 'stock-summary', storeId],
    queryFn: () => inventoryService.getStockSummary(storeWarehouse!.code),
    enabled: !!storeWarehouse?.code,
    staleTime: 30_000,
  });

  const activeTransfers: UnifiedTransactionResponse[] = activeData ?? [];
  const pendingOrders: UnifiedTransactionResponse[] = pendingData ?? [];
  const rejectedOrders: UnifiedTransactionResponse[] = rejectedData ?? [];
  const stockLots: StockLotSummary[] = stockData ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const orderMutation = useMutation({
    mutationFn: (data: UnifiedTransactionRequest) => transactionService.create(data),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu. Chờ Kho Tổng phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'store'] });
      setOrderModalOpen(false);
    },
    onError: () => message.error('Gửi yêu cầu thất bại. Vui lòng thử lại.'),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: PurchaseRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu nhập kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'store'] });
      setOrderModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu nhập thất bại. Vui lòng thử lại.'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryService.approveRequest(id),
    onSuccess: () => {
      message.success('Đã phê duyệt đơn hàng.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'store'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: RejectRequestPayload }) => inventoryService.rejectRequest(id, payload),
    onSuccess: () => {
      message.warning('Đã từ chối đơn hàng.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'store'] });
      setRejectModalOpen(false);
      setSelectedRecord(null);
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  // ── Columns ───────────────────────────────────────────────────────────────────

  const baseColumns: ColumnsType<UnifiedTransactionResponse> = [
    {
      title: 'code',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'request type',
      dataIndex: 'requestType',
      key: 'type',
      width: 130,
      render: (v: TransactionType) => (
        <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>
      ),
    },
    {
      title: 'suppler',
      key: 'suppler',
      render: (_: unknown, r: UnifiedTransactionResponse) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.supplier?.name ?? r.sourceWarehouse?.name ?? '—'}
        </Text>
      ),
    },
    {
      title: 'requestDate',
      dataIndex: 'createdAt',
      key: 'requestDate',
      width: 150,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
  ];

  const pendingColumns: ColumnsType<UnifiedTransactionResponse> = [
    ...baseColumns,
    {
      title: '',
      key: 'approve',
      width: 165,
      align: 'center',
      render: (_: unknown, record: UnifiedTransactionResponse) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => approveMutation.mutate(record.id)}
          >
            Duyệt
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            loading={rejectMutation.isPending}
            onClick={() => {
              setSelectedRecord(record);
              setRejectModalOpen(true);
            }}
          >
            Từ Chối
          </Button>
        </Space>
      ),
    },
  ];

  const activeColumns: ColumnsType<UnifiedTransactionResponse> = [
    ...baseColumns,
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 110,
      render: () => <Tag color="green">APPROVED</Tag>,
    },
  ];

  const rejectedColumns: ColumnsType<UnifiedTransactionResponse> = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Người Gửi',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 130,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 155,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => <Text>{v || '—'}</Text>,
    },
    {
      title: 'Lý Do Từ Chối',
      dataIndex: 'rejectedReason',
      key: 'rejectedReason',
      render: (v: string) => <Text type="danger">{v || '—'}</Text>,
    },
  ];

  const stockColumns: ColumnsType<StockLotSummary> = [
    {
      title: 'Tên Sản phẩm',
      key: 'name',
      render: (_, r) => <Text strong>{r.item.name}</Text>,
    },
    {
      title: 'Tổng tồn Kho',
      key: 'qty',
      width: 130,
      align: 'right',
      render: (_, r) => (
        <Text strong style={{ color: '#722ed1' }}>
          {r.totalQtyRemaining}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/warehouse/stock/${storeWarehouse?.code || 'STORE'}/${r.item.key}`)}
        />
      ),
    },
  ];

  // ── Action buttons ────────────────────────────────────────────────────────────

  const ActionButtons = () => (
    <Space>
      <Button
        icon={<ImportOutlined />}
        onClick={() => navigate('/warehouse/store/request')}      >
        Nhập Kho
      </Button>
      <Button
        icon={<ExportOutlined />}
        onClick={() => navigate('/warehouse/transfer/STORE')}
      >
        Xuất Kho
      </Button>
      <Button
        icon={<FormOutlined />}
        onClick={() => navigate('/warehouse/adjust/STORE')}      >
        Điều Chỉnh
      </Button>
    </Space>
  );

  // ── Sub-tabs: pending → active → rejected ─────────────────────────────────────

  const phieuNhapSubTabs = [
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingOrders.length > 0 && (
            <Badge count={pendingOrders.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<UnifiedTransactionResponse>
          columns={pendingColumns}
          dataSource={pendingOrders}
          loading={pendingLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '✅ Không có đơn nào đang chờ duyệt.' }}
        />
      ),
    },
    {
      key: 'active',
      label: (
        <Space>
          Đang Active
          <Badge count={activeTransfers.length} color="#52c41a" />
        </Space>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="Tìm theo mã phiếu..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 380 }}
            />
          </div>
          <Table<UnifiedTransactionResponse>
            columns={activeColumns}
            dataSource={activeTransfers.filter(r => r.code.toLowerCase().includes(searchText.toLowerCase()))}
            loading={activeLoading}
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
            locale={{ emptyText: '✅ Không có phiếu active nào.' }}
          />
        </>
      ),
    },
    {
      key: 'rejected',
      label: (
        <Space>
          Từ Chối
          {rejectedOrders.length > 0 && (
            <Badge count={rejectedOrders.length} color="#ff4d4f" />
          )}
        </Space>
      ),
      children: (
        <Table<UnifiedTransactionResponse>
          columns={rejectedColumns}
          dataSource={rejectedOrders}
          loading={rejectedLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: 'Chưa có đơn hàng nào bị từ chối.' }}
        />
      ),
    },
  ];

  // ── Outer tabs ────────────────────────────────────────────────────────────────

  const outerTabItems = [
    {
      key: 'phieu-nhap',
      label: (
        <Space>
          <InboxOutlined />
          Phiếu Nhập
        </Space>
      ),
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <ActionButtons />
          </div>
          <Tabs
            defaultActiveKey="pending"
            size="small"
            type="card"
            items={phieuNhapSubTabs}
          />
        </div>
      ),
    },
    {
      key: 'ton-kho',
      label: (
        <Space>
          <SearchOutlined />
          Tồn Kho
        </Space>
      ),
      children: (
        <Table<StockLotSummary>
          columns={stockColumns}
          dataSource={stockLots}
          loading={stockLoading}
          rowKey={(r) => r.item.key}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} mặt hàng` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có dữ liệu tồn kho."
              />
            ),
          }}
        />
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShopOutlined style={{ color: '#722ed1', marginRight: 8 }} />
          Cửa Hàng
        </Title>
        <Text type="secondary">Hiển thị số lượng bánh tại cửa hàng và quản lý đơn yêu cầu thêm bánh</Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="phieu-nhap" items={outerTabItems} />

      <RejectModal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedRecord(null);
        }}
        onSubmit={(id, payload) => rejectMutation.mutate({ id, payload })}
        submitting={rejectMutation.isPending}
        record={selectedRecord}
      />


    </div>
  );
};

export default StoreWarehouse;
