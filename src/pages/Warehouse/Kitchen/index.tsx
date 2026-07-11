import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, InputNumber, Divider, Alert,
  Tooltip, Badge, Row, Col, message, Empty,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ImportOutlined, ExportOutlined,
  CheckOutlined, CloseOutlined,
  DeleteOutlined, FireOutlined, RollbackOutlined, FormOutlined, InboxOutlined,
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

// ─── Return-to-Main Modal ─────────────────────────────────────────────────────

interface ReturnModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: UnifiedTransactionRequest) => void;
  submitting: boolean;
}

const ReturnModal: React.FC<ReturnModalProps> = ({ open, onClose, onSubmit, submitting }) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<UnifiedTransactionLine[]>([
    { itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' },
  ]);

  React.useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([{ itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' }]);
    }
  }, [open, form]);

  const addLine = () => setLines((prev) => [...prev, { itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof UnifiedTransactionLine, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleOk = () => {
    form.validateFields().then((values) => {
      const payload: UnifiedTransactionRequest = {
        type: 'TRANSFER',
        fromBranchId: '',
        toBranchId: '',
        note: values.note,
        lines,
      };
      onSubmit(payload);
    });
  };

  return (
    <Modal
      wrapClassName="fullscreen-modal-wrap"
      title={
        <Space>
          <RollbackOutlined style={{ color: '#fa8c16' }} />
          Xuất Trả Nguyên Liệu Hư → Kho Tổng
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Gửi Phiếu Xuất Trả (Chờ Duyệt)"
      okButtonProps={{ danger: true }}
      cancelText="Huỷ"
      confirmLoading={submitting}
      width={680}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        message="Phiếu xuất trả nguyên liệu hư hỏng về Kho Tổng. Cần ghi rõ lý do để Admin xem xét và duyệt."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item name="note" label="Lý Do / Ghi Chú" rules={[{ required: true, message: 'Vui lòng ghi rõ lý do trả hàng' }]}>
          <Input.TextArea rows={2} placeholder="VD: Bơ bị mốc do bảo quản sai nhiệt độ..." />
        </Form.Item>
      </Form>

      <Divider>Danh Sách Nguyên Liệu Trả</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {lines.map((line, i) => (
          <Row key={i} gutter={8} align="middle">
            <Col span={12}>
              <Input
                placeholder="Mã NL"
                value={line.itemCode}
                onChange={(e) => updateLine(i, 'itemCode', e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
            <Col span={8}>
              <InputNumber
                min={0.01}
                value={line.quantity}
                onChange={(v) => updateLine(i, 'quantity', v ?? 1)}
                style={{ width: '100%' }}
                placeholder="SL"
              />
            </Col>
            <Col span={4}>
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
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ width: '100%' }}>
          Thêm Dòng
        </Button>
      </Space>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const KitchenWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  // ── Warehouse data from global store (loaded in MainLayout) ──────────────────

  const getKhoBep        = useWarehouseStore((s) => s.getKhoBep);
  const warehouseLoading = useWarehouseStore((s) => s.loading);

  const khoBepList = getKhoBep();
  const khoBep     = khoBepList[0];   // first active Kho Bếp
  const khoBepId   = khoBep?.id;

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['warehouse', 'kitchen', 'requests', 'PENDING_APPROVAL', khoBepId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoBep!.code, approvalStatus: 'PENDING_APPROVAL', size: 50 }),
    enabled: !!khoBep?.code,
    staleTime: 15_000,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['warehouse', 'kitchen', 'requests', 'APPROVED', khoBepId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoBep!.code, approvalStatus: 'APPROVED', size: 50 }),
    enabled: !!khoBep?.code,
    staleTime: 30_000,
  });

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    queryKey: ['warehouse', 'kitchen', 'requests', 'REJECTED', khoBepId],
    queryFn: () => inventoryService.getRequests({ warehouseCode: khoBep!.code, approvalStatus: 'REJECTED', size: 50 }),
    enabled: !!khoBep?.code,
    staleTime: 30_000,
  });

  // Tồn kho
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse', 'kitchen', 'stock-summary', khoBepId],
    queryFn: () => inventoryService.getStockSummary(khoBep!.code),
    enabled: !!khoBep?.code,
    staleTime: 30_000,
  });

  const stockLots = stockData || [];

  // ── Derived Data ──────────────────────────────────────────────────────────────

  const activeTransfers: UnifiedTransactionResponse[] = activeData ?? [];
  const pendingReceipts: UnifiedTransactionResponse[] = pendingData ?? [];
  const rejectedReceipts: UnifiedTransactionResponse[] = rejectedData ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createTransferMutation = useMutation({
    mutationFn: (data: TransferRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu xuất kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen', 'requests'] });
      setReturnModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu xuất thất bại. Vui lòng thử lại.'),
  });

  const createAdjustMutation = useMutation({
    mutationFn: (data: import('../../../types').AdjustRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu điều chỉnh thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen', 'requests'] });
      setAdjustModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu điều chỉnh thất bại. Vui lòng thử lại.'),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: PurchaseRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu nhập kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen', 'requests'] });
      setImportModalOpen(false);
    },
    onError: () => message.error('Tạo phiếu nhập thất bại. Vui lòng thử lại.'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryService.approveRequest(id),
    onSuccess: () => {
      message.success('Đã phê duyệt phiếu.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: RejectRequestPayload }) => inventoryService.rejectRequest(id, payload),
    onSuccess: () => {
      message.warning('Đã từ chối phiếu.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen'] });
      setRejectModalOpen(false);
      setSelectedRecord(null);
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  // ── Base columns ──────────────────────────────────────────────────────────────

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
            loading={approveMutation.isPending}
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
      title: 'Loại',
      key: 'type',
      width: 120,
      render: () => <Tag color="red">TRANSFER</Tag>,
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
                queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen'] });
              })
              .catch(() => message.error('Clone phiếu thất bại.'))
          }
        >
          Clone
        </Button>
      ),
    },
  ];

  // ── Stock columns ─────────────────────────────────────────────────────────────

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

  // ── Action buttons ────────────────────────────────────────────────────────────

  const ActionButtons = () => (
    <Space>
      <Button
        icon={<ImportOutlined />}
        onClick={() => setImportModalOpen(true)}
      >
        Nhập Kho
      </Button>
      <Button
        icon={<ExportOutlined />}
        onClick={() => setReturnModalOpen(true)}
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

  // ── Sub-tabs: pending → active → rejected ─────────────────────────────────────

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
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '✅ Không có phiếu nào đang chờ duyệt.' }}
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
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: '✅ Không có phiếu chuyển kho nào active.' }}
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
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '✅ Không có phiếu nào bị từ chối.' }}
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
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FireOutlined style={{ color: '#D2691E', marginRight: 8 }} />
          Kho Bếp
        </Title>
        <Text type="secondary">Quản lý nguyên liệu tại bếp và xuất trả nguyên liệu hư hỏng về Kho Tổng</Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Kho Bếp chỉ nhận nguyên liệu từ Kho Tổng. Nếu nguyên liệu bị hư hỏng, dùng nút Xuất Kho để gửi phiếu về Kho Tổng."
        style={{ marginBottom: 20 }}
      />

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="phieu-nhap" items={outerTabItems} />

      <TransferModal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onSubmit={(values) => createTransferMutation.mutate(values)}
        submitting={createTransferMutation.isPending}
        sourceWarehouseId={khoBepId!}
        warehouseCode={khoBep?.code || 'KITCHEN'}
        useStockData={true}
      />

      <PurchaseModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSubmit={(values) => createPurchaseMutation.mutate(values)}
        submitting={createPurchaseMutation.isPending}
        targetWarehouseId={khoBepId!}
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
        warehouseCode={khoBep?.code || 'KITCHEN'}
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
        targetWarehouseId={khoBep?.id || ''}
        warehouseCode={khoBep?.code || 'KITCHEN'}
      />
    </div>
  );
};

export default KitchenWarehouse;
