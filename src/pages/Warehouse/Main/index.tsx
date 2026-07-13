import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, Select, InputNumber, Divider, Alert,
  Tooltip, Badge, Row, Col, message, Popconfirm, Empty,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ImportOutlined, ExportOutlined,
  CheckOutlined, CloseOutlined,
  DeleteOutlined, FormOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { transactionService, inventoryService } from '../../../api/services';
import { useWarehouseStore } from '../../../store';
import RejectModal from '../components/RejectModal';


import type {
  InventoryLot,
  InventoryStockResponse,
  UnifiedTransactionResponse,
  UnifiedTransactionRequest,
  PurchaseRequest,
  TransferRequest,
  RejectRequestPayload,
  UnifiedTransactionLine,
  TransactionType,
  StockLotSummary,
} from '../../../types';

const { Title, Text } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const MainWarehouse: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // ── Warehouse data from global store (loaded in MainLayout) ──────────────────

  const getKhoTong   = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep    = useWarehouseStore((s) => s.getKhoBep);

  const khoTong   = getKhoTong();
  const khoTongId = khoTong?.id;

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['warehouse', 'main', 'requests', 'PENDING_APPROVAL', khoTongId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoTong!.code, approvalStatus: 'PENDING_APPROVAL', size: 50 }),
    enabled: !!khoTong?.code,
    staleTime: 15_000,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['warehouse', 'main', 'requests', 'APPROVED', khoTongId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoTong!.code, approvalStatus: 'APPROVED', size: 50 }),
    enabled: !!khoTong?.code,
    staleTime: 30_000,
  });

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    queryKey: ['warehouse', 'main', 'requests', 'REJECTED', khoTongId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoTong!.code, approvalStatus: 'REJECTED', size: 50 }),
    enabled: !!khoTong?.code,
    staleTime: 30_000,
  });

  // Tồn Kho query
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse', 'main', 'stock-summary', khoTongId],
    queryFn: () => inventoryService.getStockSummary(khoTong!.code),
    enabled: !!khoTong?.code,
    staleTime: 30_000,
  });

  const stockLots: StockLotSummary[] = stockData ?? [];

  // ── Derived data ─────────────────────────────────────────────────────────────

  const activeReceipts: UnifiedTransactionResponse[] = activeData ?? [];
  const pendingReceipts: UnifiedTransactionResponse[] = pendingData ?? [];
  const rejectedReceipts: UnifiedTransactionResponse[] = rejectedData ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createReceiptMutation = useMutation({
    mutationFn: (data: UnifiedTransactionRequest) => transactionService.create(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main'] });
      setModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu thất bại. Vui lòng thử lại.'),
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: TransferRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu xuất kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main'] });
      setModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu xuất thất bại. Vui lòng thử lại.'),
  });



  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryService.approveRequest(id),
    onSuccess: () => {
      message.success('Đã phê duyệt phiếu.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: RejectRequestPayload }) => inventoryService.rejectRequest(id, payload),
    onSuccess: () => {
      message.warning('Đã từ chối phiếu.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main'] });
      setRejectModalOpen(false);
      setSelectedRecord(null);
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  // ── Common columns ────────────────────────────────────────────────────────────

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

  // ── Columns: pending (with approve/reject actions) ───────────────────────────

  const pendingColumns: ColumnsType<UnifiedTransactionResponse> = [
    ...baseColumns,
    {
      title: '',
      key: 'approve',
      width: 165,
      align: 'center',
      render: (_: unknown, record: UnifiedTransactionResponse) => (
        <Space>
          <Popconfirm
            title="Xác nhận phê duyệt phiếu này?"
            onConfirm={() => approveMutation.mutate(record.id)}
            okText="Duyệt"
            cancelText="Huỷ"
          >
            <Button type="primary" size="small" icon={<CheckOutlined />} loading={approveMutation.isPending}>
              Duyệt
            </Button>
          </Popconfirm>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
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

  // ── Columns: active ───────────────────────────────────────────────────────────

  const activeColumns: ColumnsType<UnifiedTransactionResponse> = [
    ...baseColumns,
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: () => <Tag color="green">APPROVED</Tag>,
    },
  ];

  // ── Columns: rejected ─────────────────────────────────────────────────────────

  const rejectedColumns: ColumnsType<UnifiedTransactionResponse> = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'requestType',
      key: 'type',
      width: 130,
      render: (v: TransactionType) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
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
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Lý Do Từ Chối',
      dataIndex: 'rejectedReason',
      key: 'rejectedReason',
      render: (v: string) => <Text type="danger">{v || '—'}</Text>,
    },
    {
      title: 'Clone lại',
      key: 'clone',
      width: 110,
      align: 'center',
      render: (_: unknown, record: UnifiedTransactionResponse) => (
        <Button
          size="small"
          onClick={() =>
            transactionService
              .clone(record.id, record.requestType)
              .then(() => {
                message.success('Đã tạo phiếu mới từ phiếu bị từ chối.');
                queryClient.invalidateQueries({ queryKey: ['warehouse', 'main', 'requests'] });
              })
              .catch(() => message.error('Clone phiếu thất bại.'))
          }
        >
          Clone
        </Button>
      ),
    },
  ];

  // ── Columns: stock lots ────────────────────────────────────────────────────────

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
        <Text strong style={{ color: '#1677ff' }}>
          {r.totalQtyRemaining}
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      align: 'center',
      render: (_, r) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/warehouse/stock/${khoTong?.code || 'MAIN'}/${r.item.key}`)}
        />
      ),
    },
  ];

  // ── Action buttons (inside Phiếu Nhập tab) ───────────────────────────────────

  const ActionButtons = () => (
    <Space>
      <Button
        type="primary"
        icon={<ImportOutlined />}
        onClick={() => navigate('/warehouse/main/purchase')}
      >
        Nhập Kho
      </Button>
      <Button
        icon={<ExportOutlined />}
        onClick={() => navigate('/warehouse/transfer/MAIN')}
      >
        Xuất Kho
      </Button>
      <Button
        icon={<FormOutlined />}
        onClick={() => navigate('/warehouse/adjust/MAIN')}      >
        Điều Chỉnh
      </Button>
    </Space>
  );

  // ── Sub-tabs inside Phiếu Nhập (pending → active → rejected) ─────────────────

  const phieuNhapSubTabs = [
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingReceipts.length > 0 && (
            <Badge count={pendingReceipts.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<UnifiedTransactionResponse>
          columns={pendingColumns}
          dataSource={pendingReceipts}
          loading={pendingLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
          locale={{ emptyText: '✅ Không có phiếu nào đang chờ duyệt.' }}
        />
      ),
    },
    {
      key: 'active',
      label: (
        <Space>
          Đang Active
          <Badge count={activeReceipts.length} color="#52c41a" />
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
            dataSource={activeReceipts.filter(r => r.code?.toLowerCase().includes(searchText.toLowerCase()))}
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
          Bị Từ Chối
          {rejectedReceipts.length > 0 && (
            <Badge count={rejectedReceipts.length} color="#ff4d4f" />
          )}
        </Space>
      ),
      children: (
        <Table<UnifiedTransactionResponse>
          columns={rejectedColumns}
          dataSource={rejectedReceipts}
          loading={rejectedLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
          locale={{ emptyText: '✅ Không có phiếu nào bị từ chối.' }}
        />
      ),
    },
  ];

  // ── Outer tabs: Phiếu Nhập + Tồn Kho ────────────────────────────────────────

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
          {/* Action buttons at the top of the tab */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <ActionButtons />
          </div>
          {/* Sub-tabs: pending → active → rejected */}
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
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          {khoTong?.name ?? 'Kho Tổng'}
        </Title>
        <Text type="secondary">
          {khoTong ? `Mã: ${khoTong.code} — ` : ''}
          Quản lý nhập nguyên liệu từ NCC và xuất sang Kho Bếp
        </Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      {/* Outer 2-tab layout */}
      <Tabs defaultActiveKey="phieu-nhap" items={outerTabItems} />

      {/* Modals */}

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

export default MainWarehouse;
