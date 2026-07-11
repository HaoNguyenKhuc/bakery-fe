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
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { transactionService, inventoryService } from '../../../api/services';
import { useWarehouseStore } from '../../../store';
import PurchaseModal from '../components/PurchaseModal';
import TransferModal from '../components/TransferModal';
import RejectModal from '../components/RejectModal';
import StockDetailModal from '../components/StockDetailModal';
import AdjustModal from '../components/AdjustModal';
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

// ─── Receipt Modal (Nhập / Xuất) ─────────────────────────────────────────────

interface ReceiptModalProps {
  open: boolean;
  type: 'IMPORT' | 'TRANSFER';
  onClose: () => void;
  onSubmit: (values: UnifiedTransactionRequest) => void;
  submitting: boolean;
  fromBranchId?: string;
  khoBepList?: Branch[];
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ open, type, onClose, onSubmit, submitting, fromBranchId, khoBepList = [] }) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<UnifiedTransactionLine[]>([
    { ingredientCode: '', qty: 1 },
  ]);

  React.useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([{ ingredientCode: '', qty: 1 }]);
    }
  }, [open, form]);

  const addLine = () => setLines((prev) => [...prev, { ingredientCode: '', qty: 1 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof UnifiedTransactionLine, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleOk = () => {
    form.validateFields().then((values) => {
      const payload: UnifiedTransactionRequest = {
        type,
        supplierId:   type === 'IMPORT'   ? values.supplierId  : undefined,
        fromBranchId: type === 'TRANSFER' ? fromBranchId       : undefined,
        toBranchId:   type === 'TRANSFER' ? values.toBranchId  : undefined,
        note: values.note,
        lines,
      };
      onSubmit(payload);
    });
  };

  const isImport = type === 'IMPORT';

  return (
    <Modal
      wrapClassName="fullscreen-modal-wrap"
      title={
        <Space>
          {isImport ? <ImportOutlined style={{ color: '#52c41a' }} /> : <ExportOutlined style={{ color: '#1890ff' }} />}
          {isImport ? 'Nhập Nguyên Liệu (NCC → Kho Tổng)' : 'Xuất Nguyên Liệu (Kho Tổng → Kho Bếp)'}
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Gửi Phiếu (Chờ Duyệt)"
      cancelText="Huỷ"
      confirmLoading={submitting}
      width={680}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message="Phiếu sẽ ở trạng thái Chờ Duyệt cho đến khi Admin phê duyệt."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        {isImport ? (
          <Form.Item name="supplierId" label="Nhà Cung Cấp (Supplier ID)" rules={[{ required: true, message: 'Vui lòng nhập ID nhà cung cấp' }]}>
            <Input placeholder="UUID nhà cung cấp..." />
          </Form.Item>
        ) : (
          <Form.Item name="toBranchId" label="Kho Đích" rules={[{ required: true, message: 'Vui lòng chọn kho bếp đích' }]}>
            <Select placeholder="Chọn Kho Bếp..." loading={khoBepList.length === 0}>
              {khoBepList.map((b) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.name} <Text type="secondary" style={{ fontSize: 11 }}>({b.code})</Text>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        <Form.Item name="note" label="Ghi Chú">
          <Input.TextArea rows={2} placeholder="Ghi chú cho phiếu..." />
        </Form.Item>
      </Form>

      <Divider>Danh Sách Nguyên Liệu</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {lines.map((line, i) => (
          <Row key={i} gutter={8} align="middle">
            <Col span={8}>
              <Input
                placeholder="Mã NL (VD: NL001)"
                value={line.ingredientCode ?? ''}
                onChange={(e) => updateLine(i, 'ingredientCode', e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
            <Col span={isImport ? 7 : 10}>
              <InputNumber
                min={0.01}
                value={line.qty}
                onChange={(v) => updateLine(i, 'qty', v ?? 1)}
                style={{ width: '100%' }}
                placeholder="Số lượng"
              />
            </Col>
            {isImport && (
              <Col span={7}>
                <InputNumber
                  min={0}
                  value={line.unitPrice}
                  onChange={(v) => updateLine(i, 'unitPrice', v ?? 0)}
                  style={{ width: '100%' }}
                  placeholder="Đơn giá (VND)"
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Col>
            )}
            <Col span={2}>
              <Tooltip title="Xoá dòng">
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                />
              </Tooltip>
            </Col>
          </Row>
        ))}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addLine}
          style={{ width: '100%' }}
        >
          Thêm Dòng
        </Button>
      </Space>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MainWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IMPORT' | 'TRANSFER'>('IMPORT');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  // ── Warehouse data from global store (loaded in MainLayout) ──────────────────

  const getKhoTong   = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep    = useWarehouseStore((s) => s.getKhoBep);
  const warehouseLoading = useWarehouseStore((s) => s.loading);

  const khoTong   = getKhoTong();
  const khoTongId = khoTong?.id;
  const khoBepList = getKhoBep();

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
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main', 'pending'] });
      setModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu thất bại. Vui lòng thử lại.'),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: PurchaseRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu nhập kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main', 'requests'] });
      setModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu nhập thất bại. Vui lòng thử lại.'),
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: TransferRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu xuất kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main', 'requests'] });
    },
    onError: () => message.error('Tạo phiếu xuất thất bại. Vui lòng thử lại.'),
  });

  const createAdjustMutation = useMutation({
    mutationFn: (data: import('../../../types').AdjustRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu điều chỉnh thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'main', 'requests'] });
    },
    onError: () => message.error('Tạo phiếu điều chỉnh thất bại. Vui lòng thử lại.'),
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
  ];

  // ── Action buttons (inside Phiếu Nhập tab) ───────────────────────────────────

  const ActionButtons = () => (
    <Space>
      <Button
        type="primary"
        icon={<ImportOutlined />}
        onClick={() => { setModalType('IMPORT'); setModalOpen(true); }}
      >
        Nhập Kho
      </Button>
      <Button
        icon={<ExportOutlined />}
        onClick={() => { setModalType('TRANSFER'); setModalOpen(true); }}
      >
        Xuất Kho
      </Button>
      <Button
        icon={<FormOutlined />}
        onClick={() => setAdjustModalOpen(true)}
      >
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
          onRow={(record) => ({
            onClick: () => {
              setSelectedItemKey(record.item.key);
              setSelectedItemName(record.item.name);
              setDetailModalOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
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
      <PurchaseModal
        open={modalOpen && modalType === 'IMPORT'}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => createPurchaseMutation.mutate(values)}
        submitting={createPurchaseMutation.isPending}
        targetWarehouseId={khoTongId!}
      />

      <TransferModal
        open={modalOpen && modalType === 'TRANSFER'}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => createTransferMutation.mutate(values)}
        submitting={createTransferMutation.isPending}
        sourceWarehouseId={khoTongId!}
      />

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

      <StockDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedItemKey(null);
          setSelectedItemName(null);
        }}
        itemCode={selectedItemKey}
        itemName={selectedItemName}
        warehouseCode={khoTong?.code || 'MAIN'}
      />

      <AdjustModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        onSubmit={(payload) => {
          createAdjustMutation.mutate(payload, {
            onSuccess: () => setAdjustModalOpen(false),
          });
        }}
        submitting={createAdjustMutation.isPending}
        targetWarehouseId={khoTong?.id || ''}
        warehouseCode={khoTong?.code || 'MAIN'}
      />
    </div>
  );
};

export default MainWarehouse;
