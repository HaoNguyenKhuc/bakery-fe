import React, { useState, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, InputNumber, Divider, Alert,
  Tooltip, Badge, Row, Col, message, Empty, DatePicker,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ImportOutlined, ExportOutlined, EyeOutlined,
  CheckOutlined, CloseOutlined,
  DeleteOutlined, FireOutlined, RollbackOutlined, FormOutlined, InboxOutlined,
  FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { transactionService, inventoryService } from '../../../api/services';
import dailyReportService from '../../../api/services/dailyReportService';
import { useWarehouseStore } from '../../../store';
import RejectModal from '../InventoryRequests/components/RejectModal';
import type { DailyReportLine } from '../../../types/dailyReport';

import { useNavigate } from 'react-router-dom';

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

// ─── End-of-Day Report Tab ────────────────────────────────────────────────────

interface EndOfDayReportTabProps {
  reportDate: Dayjs;
  setReportDate: (d: Dayjs) => void;
  remainingMap: Record<string, number | null>;
  setRemainingMap: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  savingLineId: string | null;
  setSavingLineId: (id: string | null) => void;
}

const EndOfDayReportTab: React.FC<EndOfDayReportTabProps> = ({
  reportDate,
  setReportDate,
  remainingMap,
  setRemainingMap,
  savingLineId,
  setSavingLineId,
}) => {
  const queryClient = useQueryClient();
  const dateStr = reportDate.format('YYYY-MM-DD');

  // Init + load report
  const { data: report, isLoading: reportLoading, refetch } = useQuery({
    queryKey: ['daily-report', dateStr],
    queryFn: () => dailyReportService.init(dateStr),
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery<DailyReportLine[]>({
    queryKey: ['daily-report-lines', report?.id],
    queryFn: () => dailyReportService.getLines(report!.id),
    enabled: !!report?.id,
  });

  const isFinalized = report?.status === 'FINALIZED';

  // Save remaining mutation
  const saveMutation = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      dailyReportService.updateRemaining(report!.id, lineId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report-lines', report?.id] });
    },
    onError: () => message.error('Lưu thất bại'),
    onSettled: () => setSavingLineId(null),
  });

  const handleSave = useCallback(
    (lineId: string) => {
      const qty = remainingMap[lineId];
      if (qty === null || qty === undefined || !report?.id) return;
      setSavingLineId(lineId);
      saveMutation.mutate({ lineId, qty });
    },
    [remainingMap, report?.id, saveMutation, setSavingLineId],
  );

  const columns: ColumnsType<DailyReportLine> = [
    {
      title: 'Sản Phẩm',
      key: 'product',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.item.name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item.key}</Text>
        </div>
      ),
    },
    {
      title: 'Tồn Bếp',
      dataIndex: 'qtyKitchenOpen',
      align: 'right',
      width: 90,
      render: (v) => v ?? 0,
    },
    {
      title: 'Bánh Ra Hôm Nay',
      dataIndex: 'qtyProduced',
      align: 'right',
      width: 130,
      render: (v) => <Text style={{ color: '#52c41a' }}>{v ?? 0}</Text>,
    },
    {
      title: 'Đã Giao Shop',
      dataIndex: 'qtyDelivered',
      align: 'right',
      width: 110,
      render: (v) => <Text style={{ color: '#1677ff' }}>{v ?? 0}</Text>,
    },
    {
      title: 'Còn Lại *',
      key: 'conLai',
      align: 'right',
      width: 120,
      render: (_, row) => {
        if (isFinalized) {
          return row.qtyRemainingActual !== undefined
            ? <Text strong>{row.qtyRemainingActual}</Text>
            : <Text type="secondary">—</Text>;
        }
        return (
          <InputNumber
            min={0}
            size="small"
            style={{ width: 85 }}
            value={remainingMap[row.id] !== undefined ? remainingMap[row.id] : row.qtyRemainingActual}
            placeholder="0"
            onChange={(v) => setRemainingMap((prev) => ({ ...prev, [row.id]: v }))}
            onBlur={() => handleSave(row.id)}
            onPressEnter={() => handleSave(row.id)}
            loading={savingLineId === row.id}
          />
        );
      },
    },
    {
      title: 'Ghi Chú',
      width: 140,
      render: () => (
        <Input size="small" placeholder="tùy chọn" />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Text strong style={{ fontSize: 15 }}>
              Báo cáo cuối ngày — Kho Bếp
            </Text>
            {report && (
              <Tag color={isFinalized ? 'green' : 'orange'}>
                {isFinalized ? '✅ Đã chốt' : 'Draft'}
              </Tag>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            <DatePicker
              value={reportDate}
              onChange={(d) => d && setReportDate(d)}
              format="DD/MM/YYYY"
              disabledDate={(d) => d.isAfter(dayjs())}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={reportLoading} />
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Tồn bếp = Kho bếp hiện tại (tồn tối + làm mới - đã giao). Nhân viên chỉ điền Còn Lại sau khi đếm thực tế."
      />

      <Table<DailyReportLine>
        dataSource={lines}
        columns={columns}
        rowKey="id"
        loading={reportLoading || linesLoading}
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text type="secondary">
                  Chưa có dữ liệu SX / giao nhận cho ngày{' '}
                  <Text strong>{reportDate.format('DD/MM/YYYY')}</Text>
                </Text>
              }
            />
          ),
        }}
      />

      {!isFinalized && lines.length > 0 && (
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            onClick={() => message.success('Đã nộp báo cáo cuối ngày!')}
          >
            🔔 Nộp báo cáo cuối ngày
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const KitchenWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');

  // ── End-of-day report state ───────────────────────────────────────────────
  const [reportDate, setReportDate] = useState<Dayjs>(dayjs());
  const [remainingMap, setRemainingMap] = useState<Record<string, number | null>>({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);

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

  const navigate = useNavigate();

  // ── Mutations ─────────────────────────────────────────────────────────────────



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
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, r) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/warehouse/stock/${khoBep?.code || 'KITCHEN'}/${r.item.code}`)}
        />
      ),
    },
  ];

  // ── Action buttons ────────────────────────────────────────────────────────────

  const ActionButtons = () => (
    <Space>
      <Button
        icon={<ImportOutlined />}
        onClick={() => navigate('/warehouse/main/purchase')}
      >
        Nhập Kho
      </Button>
      <Button
        icon={<ExportOutlined />}
        onClick={() => navigate('/warehouse/transfer/KITCHEN')}
      >
        Xuất Kho
      </Button>
      <Button
        icon={<RollbackOutlined />}
        danger
        onClick={() => navigate('/warehouse/kitchen/return')}
      >
        Xuất Trả
      </Button>
      <Button
        icon={<FormOutlined />}
        onClick={() => navigate('/warehouse/adjust/KITCHEN')}
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
    // ─── Tab 3: Báo cáo cuối ngày ─────────────────────────────────────────
    {
      key: 'bao-cao-cuoi-ngay',
      label: (
        <Space>
          <FileTextOutlined />
          Báo Cáo Cuối Ngày
        </Space>
      ),
      children: <EndOfDayReportTab
        reportDate={reportDate}
        setReportDate={setReportDate}
        remainingMap={remainingMap}
        setRemainingMap={setRemainingMap}
        savingLineId={savingLineId}
        setSavingLineId={setSavingLineId}
      />,
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

export default KitchenWarehouse;
