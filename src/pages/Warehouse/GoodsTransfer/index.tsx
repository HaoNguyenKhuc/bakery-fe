import React, { useState, useMemo } from 'react';
import {
  Tabs, Table, Button, Tag, Space, Typography, Badge,
  Alert, Tooltip, Row, Col, message, Popconfirm, Input, Empty, DatePicker,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, CopyOutlined,
  SearchOutlined, EyeOutlined, WarningOutlined, ThunderboltOutlined,
  SyncOutlined, CheckOutlined, CalendarOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import type { GoodsTransferSlip } from '../../../types';
import { useAuthStore } from '../../../store';
import { useNavigate } from 'react-router-dom';
import RejectReasonModal from './components/RejectReasonModal';
import ReadyConfirmModal from './components/ReadyConfirmModal';

const { RangePicker } = DatePicker;

const { Title, Text } = Typography;

// ─── Nhãn kho ─────────────────────────────────────────────────────────────────

const WAREHOUSE_LABEL: Record<string, string> = {
  MAIN:    'Kho Tổng',
  KITCHEN: 'Kho Bếp',
  STORE:   'Cửa Hàng',
};

// ─── Dummy data (fallback khi API chưa sẵn sàng) ─────────────────────────────

const dummyPendingMain: GoodsTransferSlip[] = [
  {
    slipId: 'slip-001', slipCode: 'XUAT-20260703-001', status: 'PENDING',
    fromWarehouse: 'MAIN', toWarehouse: 'KITCHEN', toBranchCode: 'BEP-01',
    lines: [
      { ingredientCode: 'NL001', ingredientName: 'Bột Mì Đa Dụng', unit: 'KG', quantity: 30 },
      { ingredientCode: 'NL002', ingredientName: 'Đường Trắng', unit: 'KG', quantity: 10 },
      { ingredientCode: 'NL003', ingredientName: 'Bơ Nhạt', unit: 'KG', quantity: 5 },
    ],
    note: 'Hàng sáng ngày 03/07', createdBy: 'system', createdAt: '2026-07-02T22:00:00Z',
  },
  {
    slipId: 'slip-002', slipCode: 'XUAT-20260703-002', status: 'PENDING',
    fromWarehouse: 'MAIN', toWarehouse: 'KITCHEN', toBranchCode: 'BEP-02',
    lines: [
      { ingredientCode: 'NL004', ingredientName: 'Trứng Gà', unit: 'Cái', quantity: 120 },
      { ingredientCode: 'NL005', ingredientName: 'Sữa Tươi', unit: 'Lít', quantity: 15 },
    ],
    note: 'Bếp 2 — ca sáng', createdBy: 'system', createdAt: '2026-07-02T22:00:00Z',
  },
];

const dummyReadyForKitchen: GoodsTransferSlip[] = [
  {
    slipId: 'slip-003', slipCode: 'XUAT-20260703-001', status: 'READY',
    fromWarehouse: 'MAIN', toWarehouse: 'KITCHEN', toBranchCode: 'BEP-01',
    lines: [
      { ingredientCode: 'NL001', ingredientName: 'Bột Mì Đa Dụng', unit: 'KG', quantity: 30 },
      { ingredientCode: 'NL006', ingredientName: 'Men Nở', unit: 'KG', quantity: 2 },
    ],
    note: 'Kho Tổng đã chuẩn bị xong', createdBy: 'system', createdAt: '2026-07-02T22:00:00Z',
    readyBy: 'cuong.kho', readyAt: '2026-07-03T06:30:00Z',
  },
];

const dummyCompleted: GoodsTransferSlip[] = [
  {
    slipId: 'slip-010', slipCode: 'XUAT-20260702-001', status: 'COMPLETED',
    fromWarehouse: 'MAIN', toWarehouse: 'KITCHEN', toBranchCode: 'BEP-01',
    lines: [
      { ingredientCode: 'NL001', ingredientName: 'Bột Mì Đa Dụng', unit: 'KG', quantity: 25 },
      { ingredientCode: 'NL002', ingredientName: 'Đường Trắng', unit: 'KG', quantity: 8 },
    ],
    note: 'Hàng ngày 02/07', createdBy: 'system', createdAt: '2026-07-01T22:00:00Z',
    readyBy: 'cuong.kho', readyAt: '2026-07-02T06:00:00Z',
    completedBy: 'bep1.staff', completedAt: '2026-07-02T07:30:00Z',
  },
];

const dummyRejected: GoodsTransferSlip[] = [
  {
    slipId: 'slip-020', slipCode: 'XUAT-20260701-003', status: 'REJECTED',
    fromWarehouse: 'MAIN', toWarehouse: 'KITCHEN', toBranchCode: 'BEP-02',
    lines: [
      { ingredientCode: 'NL007', ingredientName: 'Socola Đen 70%', unit: 'KG', quantity: 15 },
    ],
    note: '', createdBy: 'system', createdAt: '2026-06-30T22:00:00Z',
    readyBy: 'cuong.kho', readyAt: '2026-07-01T06:30:00Z',
    rejectedBy: 'bep2.staff', rejectedAt: '2026-07-01T07:00:00Z',
    rejectedReason: 'Số lượng socola không đúng — thực tế chỉ có 8kg, phiếu ghi 15kg.',
  },
];

// ─── Helper: Tag trạng thái ─────────────────────────────────────────────────

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; label: string }> = {
    PENDING:   { color: 'orange', label: '⏳ Chờ chuẩn bị' },
    READY:     { color: 'blue',   label: '📦 Sẵn sàng giao' },
    COMPLETED: { color: 'green',  label: '✅ Hoàn thành' },
    REJECTED:  { color: 'red',    label: '❌ Từ chối' },
  };
  const cfg = map[status] ?? { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const GoodsTransfer: React.FC = () => {
  const queryClient = useQueryClient();

  // Auth / Permission
  const user          = useAuthStore((s) => s.user);
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const isAdmin       = useAuthStore((s) => s.isAdmin);
  const canOnScreen   = useAuthStore((s) => s.canOnScreen);

  const isKhoTong  = isWarehouseRole('KHO_TONG') || isAdmin();
  const isKhoBep   = isWarehouseRole('KHO_BEP');
  const userBranch = user?.branch_code;

  // Local UI state
  const [searchText, setSearchText]       = useState('');
  const [dateRange, setDateRange]         = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const navigate = useNavigate();
  const [rejectTarget, setRejectTarget]   = useState<GoodsTransferSlip | null>(null);
  const [readyTarget, setReadyTarget]     = useState<GoodsTransferSlip | null>(null);
  const [activeTab, setActiveTab]         = useState('pending');

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['goods-transfer', 'pending', userBranch],
    queryFn: async (): Promise<GoodsTransferSlip[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const { data: completedData, isLoading: completedLoading } = useQuery({
    queryKey: ['goods-transfer', 'completed', userBranch],
    queryFn: async (): Promise<GoodsTransferSlip[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    queryKey: ['goods-transfer', 'rejected', userBranch],
    queryFn: async (): Promise<GoodsTransferSlip[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  // Fallback sang dummy data khi API chưa sẵn sàng
  const rawPending   = Array.isArray(pendingData)   ? pendingData   : (isKhoBep ? dummyReadyForKitchen : dummyPendingMain);
  const completedList = Array.isArray(completedData) ? completedData : dummyCompleted;
  const rejectedList  = Array.isArray(rejectedData)  ? rejectedData  : dummyRejected;

  // Branch filter: KHO_BEP chỉ thấy phiếu của mình
  const pendingList = useMemo(() => {
    if (isKhoBep && userBranch) {
      return rawPending.filter((s) => !s.toBranchCode || s.toBranchCode === userBranch);
    }
    return rawPending;
  }, [rawPending, isKhoBep, userBranch]);

  // Search + date range filter (áp dụng trên mọi tab)
  const filterBySearch = (list: GoodsTransferSlip[]) =>
    list.filter((s) => {
      const matchText =
        s.slipCode.toLowerCase().includes(searchText.toLowerCase()) ||
        s.createdBy.toLowerCase().includes(searchText.toLowerCase()) ||
        s.lines.some((l) => l.ingredientName.toLowerCase().includes(searchText.toLowerCase()));

      if (!matchText) return false;

      if (dateRange && dateRange[0] && dateRange[1]) {
        const created = dayjs(s.createdAt);
        return created.isAfter(dateRange[0].startOf('day').subtract(1, 'ms'))
          && created.isBefore(dateRange[1].endOf('day').add(1, 'ms'));
      }

      return true;
    });

  // Row highlight: phiếu tạo trong vòng 2 giờ gần nhất
  const newSlipRowClass = (record: GoodsTransferSlip) => {
    const diff = dayjs().diff(dayjs(record.createdAt), 'minute');
    return diff <= 120 ? 'slip-row-new' : '';
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const readyMutation = useMutation({
    mutationFn: async (_slipId: string) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã đánh dấu "Chuẩn bị hàng xong". Kho Bếp sẽ được thông báo.');
      queryClient.invalidateQueries({ queryKey: ['goods-transfer'] });
      setReadyTarget(null);
    },
    onError: () => message.warning('API chưa sẵn sàng — thao tác đã được ghi nhận (demo).'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (_slipId: string) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã xác nhận nhận hàng. Phiếu chuyển sang COMPLETED.');
      queryClient.invalidateQueries({ queryKey: ['goods-transfer'] });
    },
    onError: () => message.warning('API chưa sẵn sàng — thao tác đã được ghi nhận (demo).'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (_args: { slipId: string; reason: string }) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.warning('⚠️ Đã từ chối phiếu. Kho Tổng sẽ nhận được thông báo.');
      queryClient.invalidateQueries({ queryKey: ['goods-transfer'] });
      setRejectTarget(null);
    },
    onError: () => message.warning('API chưa sẵn sàng — thao tác đã được ghi nhận (demo).'),
  });

  const cloneMutation = useMutation({
    mutationFn: async (_slipId: string) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('📋 Đã tạo phiếu mới từ phiếu bị từ chối. Kiểm tra Tab PENDING.');
      queryClient.invalidateQueries({ queryKey: ['goods-transfer'] });
    },
    onError: () => message.warning('API chưa sẵn sàng — thao tác đã được ghi nhận (demo).'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────


  // ── Cột chung (Phiếu + Luồng) ────────────────────────────────────────────

  const baseColumns: ColumnsType<GoodsTransferSlip> = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'slipCode',
      key: 'slipCode',
      width: 170,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Luồng',
      key: 'flow',
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Space size={4}>
          <Tag color="purple" style={{ margin: 0 }}>{WAREHOUSE_LABEL[r.fromWarehouse]}</Tag>
          <Text type="secondary">→</Text>
          <Tag color="cyan" style={{ margin: 0 }}>
            {WAREHOUSE_LABEL[r.toWarehouse]}
            {r.toBranchCode && <span style={{ fontSize: 10, marginLeft: 3, opacity: 0.7 }}>({r.toBranchCode})</span>}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Số Dòng NL',
      key: 'lines',
      width: 100,
      align: 'center',
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Badge count={r.lines.length} style={{ backgroundColor: '#1890ff' }} />
      ),
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => v ? <Text type="secondary">{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'view',
      width: 60,
      align: 'center',
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Tooltip title="Xem chi tiết">
          <Button type="text" icon={<EyeOutlined />} size="small" onClick={() => navigate(`/warehouse/goods-transfer/${r.slipId}`)} />
        </Tooltip>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: PENDING
  // ─────────────────────────────────────────────────────────────────────────

  // Cột cho Kho Tổng (status=PENDING, nút READY)
  const pendingColumnsKhoTong: ColumnsType<GoodsTransferSlip> = [
    ...baseColumns,
    {
      title: 'Hành Động',
      key: 'action',
      width: 200,
      align: 'center',
      render: (_: unknown, r: GoodsTransferSlip) => (
        canOnScreen('GOODS_TRANSFER', 'update') ? (
          <Button
            type="primary"
            icon={<CheckOutlined />}
            style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
            onClick={() => setReadyTarget(r)}
          >
            Chuẩn Bị Xong
          </Button>
        ) : (
          <Tooltip title="Bạn không có quyền cập nhật">
            <Button disabled>Chuẩn Bị Xong</Button>
          </Tooltip>
        )
      ),
    },
  ];

  // Cột cho Kho Bếp (status=READY, 2 nút lớn ACCEPT / REJECT)
  const pendingColumnsKhoBep: ColumnsType<GoodsTransferSlip> = [
    ...baseColumns,
    {
      title: 'Chuẩn Bị Bởi',
      key: 'readyBy',
      width: 120,
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.readyBy ?? '—'}</Text>
          {r.readyAt && <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(r.readyAt).format('HH:mm')}</Text>}
        </Space>
      ),
    },
    {
      title: 'Xác Nhận Nhận Hàng',
      key: 'actions',
      width: 260,
      align: 'center',
      render: (_: unknown, r: GoodsTransferSlip) => (
        canOnScreen('GOODS_TRANSFER', 'approve') ? (
          <Space size={8}>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 700 }}
              loading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate(r.slipId)}
            >
              XÁC NHẬN
            </Button>
            <Button
              danger
              size="large"
              icon={<CloseCircleOutlined />}
              style={{ fontWeight: 700 }}
              onClick={() => setRejectTarget(r)}
            >
              TỪ CHỐI
            </Button>
          </Space>
        ) : (
          <Tooltip title="Bạn không có quyền phê duyệt">
            <Button disabled size="large">Chưa có quyền</Button>
          </Tooltip>
        )
      ),
    },
  ];

  const renderPendingTab = () => {
    const data = filterBySearch(pendingList);

    if (isKhoBep) {
      return (
        <>
          {data.length === 0 ? (
            <Empty description="✅ Không có phiếu nào đang chờ xác nhận" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                message={`Có ${data.length} phiếu Kho Tổng đã chuẩn bị sẵn sàng — cần bạn xác nhận nhận hàng.`}
                style={{ marginBottom: 12 }}
              />
              <Table<GoodsTransferSlip>
                columns={pendingColumnsKhoBep}
                dataSource={data}
                rowKey="slipId"
                size="middle"
                loading={pendingLoading}
                pagination={{ pageSize: 8, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
              />
            </>
          )}
        </>
      );
    }

    // Kho Tổng / Admin
    return (
      <>
        {data.length === 0 ? (
          <Empty description="✅ Không có phiếu nào đang chờ chuẩn bị" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message={`Có ${data.length} phiếu hệ thống đã gom từ tối hôm trước — cần chuẩn bị hàng.`}
              style={{ marginBottom: 12 }}
            />
            <Table<GoodsTransferSlip>
              columns={pendingColumnsKhoTong}
              dataSource={data}
              rowKey="slipId"
              rowClassName={newSlipRowClass}
              size="middle"
              loading={pendingLoading}
              pagination={{ pageSize: 8, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
            />
          </>
        )}
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: ACTIVE (COMPLETED — read-only)
  // ─────────────────────────────────────────────────────────────────────────

  const completedColumns: ColumnsType<GoodsTransferSlip> = [
    ...baseColumns,
    {
      title: 'Xác Nhận Bởi',
      key: 'completedBy',
      width: 150,
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.completedBy ?? '—'}</Text>
          {r.completedAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(r.completedAt).format('HH:mm DD/MM/YYYY')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 130,
      render: (_: unknown, r: GoodsTransferSlip) => <StatusTag status={r.status} />,
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: REJECT (chỉ Kho Tổng / Admin thấy + nút CLONE)
  // ─────────────────────────────────────────────────────────────────────────

  const rejectedColumns: ColumnsType<GoodsTransferSlip> = [
    ...baseColumns,
    {
      title: 'Lý Do Từ Chối',
      dataIndex: 'rejectedReason',
      key: 'rejectedReason',
      render: (v: string) => (
        <Text type="danger" style={{ fontSize: 13 }}>{v || '—'}</Text>
      ),
    },
    {
      title: 'Từ Chối Bởi',
      key: 'rejectedBy',
      width: 140,
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Space direction="vertical" size={0}>
          <Text>{r.rejectedBy ?? '—'}</Text>
          {r.rejectedAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(r.rejectedAt).format('HH:mm DD/MM/YYYY')}
            </Text>
          )}
        </Space>
      ),
    },
    ...(isKhoTong && canOnScreen('GOODS_TRANSFER', 'create') ? [{
      title: 'Làm Lại',
      key: 'clone',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, r: GoodsTransferSlip) => (
        <Popconfirm
          title="Tạo phiếu mới?"
          description="Hệ thống sẽ tạo bản sao phiếu này để bạn chỉnh sửa và giao lại."
          onConfirm={() => cloneMutation.mutate(r.slipId)}
          okText="Tạo Lại"
          cancelText="Hủy"
        >
          <Button
            icon={<CopyOutlined />}
            style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            loading={cloneMutation.isPending}
          >
            Làm Lại Phiếu
          </Button>
        </Popconfirm>
      ),
    }] : []),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TAB ITEMS
  // ─────────────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'pending',
      label: (
        <Tooltip
          title={
            isKhoBep
              ? 'Hiển thị phiếu trạng thái READY — Kho Tổng đã chuẩn bị xong, chờ bạn xác nhận'
              : 'Hiển thị phiếu trạng thái PENDING — hệ thống gom từ tối hôm trước, chờ chuẩn bị hàng'
          }
          placement="bottom"
        >
          <Space>
            <SyncOutlined spin={pendingLoading} />
            {isKhoBep ? 'PENDING — Chờ Xác Nhận' : 'PENDING — Chờ Chuẩn Bị'}
            {pendingList.length > 0 && (
              <Badge count={pendingList.length} style={{ backgroundColor: '#fa8c16' }} />
            )}
            <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.5 }} />
          </Space>
        </Tooltip>
      ),
      children: renderPendingTab(),
    },
    {
      key: 'active',
      label: (
        <Tooltip title="Lịch sử phiếu đã hoàn thành (trạng thái COMPLETED) — chỉ xem, không chỉnh sửa" placement="bottom">
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ACTIVE — Lịch Sử Thành Công
            <Badge count={completedList.length} color="#52c41a" />
            <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.5 }} />
          </Space>
        </Tooltip>
      ),
      children: (
        <Table<GoodsTransferSlip>
          columns={completedColumns}
          dataSource={filterBySearch(completedList)}
          rowKey="slipId"
          rowClassName={newSlipRowClass}
          size="middle"
          loading={completedLoading}
          pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
          locale={{ emptyText: <Empty description="Chưa có phiếu hoàn thành nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      ),
    },
    // Tab REJECT chỉ hiển thị với Kho Tổng / Admin
    ...(isKhoTong ? [{
      key: 'reject',
      label: (
        <Tooltip title="Phiếu bị Kho Bếp từ chối (trạng thái REJECTED) — bạn có thể tạo lại phiếu" placement="bottom">
          <Space>
            <CloseCircleOutlined style={{ color: rejectedList.length > 0 ? '#ff4d4f' : undefined }} />
            REJECT — Hàng Bị Trả Về
            {rejectedList.length > 0 && (
              <Badge count={rejectedList.length} color="#ff4d4f" />
            )}
            <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.5 }} />
          </Space>
        </Tooltip>
      ),
      children: (
        <>
          {rejectedList.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`Có ${rejectedList.length} phiếu bị Kho Bếp từ chối — cần làm lại phiếu mới.`}
              style={{ marginBottom: 12 }}
            />
          )}
          <Table<GoodsTransferSlip>
            columns={rejectedColumns}
            dataSource={filterBySearch(rejectedList)}
            rowKey="slipId"
            size="middle"
            loading={rejectedLoading}
            pagination={{ pageSize: 8, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
            locale={{ emptyText: <Empty description="✅ Không có phiếu bị từ chối" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </>
      ),
    }] : []),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ color: '#D2691E', marginRight: 10 }} />
            Luân Chuyển Kho
          </Title>
          <Text type="secondary">
            {isKhoBep
              ? `Xác nhận nhận hàng từ Kho Tổng — Chi nhánh: ${userBranch ?? '—'}`
              : 'Quản lý phiếu giao nhận nguyên liệu giữa các kho'}
          </Text>
        </Col>
        <Col>
          <Space wrap>
            {/* Lọc theo ngày */}
            <RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              format="DD/MM/YYYY"
              value={dateRange as [Dayjs, Dayjs] | null}
              onChange={(vals) => setDateRange(vals as [Dayjs | null, Dayjs | null] | null)}
              allowClear
              prefix={<CalendarOutlined />}
              style={{ width: 240 }}
            />
            {/* Tìm kiếm phiếu */}
            <Input
              placeholder="Tìm mã phiếu, nguyên liệu..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 240 }}
            />
          </Space>
        </Col>
      </Row>

      {/* Tab container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        type="card"
        size="middle"
      />

      {/* ── Modals & Drawers ── */}


      <RejectReasonModal
        open={!!rejectTarget}
        slipCode={rejectTarget?.slipCode ?? ''}
        onConfirm={(reason) => rejectTarget && rejectMutation.mutate({ slipId: rejectTarget.slipId, reason })}
        onCancel={() => setRejectTarget(null)}
        loading={rejectMutation.isPending}
      />

      <ReadyConfirmModal
        open={!!readyTarget}
        slip={readyTarget}
        onConfirm={() => readyTarget && readyMutation.mutate(readyTarget.slipId)}
        onCancel={() => setReadyTarget(null)}
        loading={readyMutation.isPending}
      />
    </div>
  );
};

export default GoodsTransfer;
