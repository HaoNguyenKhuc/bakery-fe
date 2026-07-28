import React, { useState, useEffect } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Descriptions, message, DatePicker, Select,
  Divider, Alert, Tooltip, Popconfirm, Badge, Form, InputNumber,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CheckOutlined, CloseOutlined,
  EyeOutlined, DeleteOutlined, ReloadOutlined,
  ExclamationCircleOutlined, FileTextOutlined, CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { productionRequestService } from '../../api/services';
import type {
  ProductionRequestDetail,
  ProductionRequestLineDetail,
  ProductionType,
} from '../../types';

const { Title, Text } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toArray = <T,>(raw: any): T[] => {
  if (Array.isArray(raw)) return raw as T[];
  if (raw?.content && Array.isArray(raw.content)) return raw.content as T[];
  if (raw?.data && Array.isArray(raw.data)) return raw.data as T[];
  return [];
};

const TYPE_LABEL: Record<ProductionType, string> = {
  DAILY: 'Hàng Ngày',
  ORDER: 'Theo Đơn',
};
const TYPE_COLOR: Record<ProductionType, string> = {
  DAILY: 'blue',
  ORDER: 'purple',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
  DRAFT: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Chờ Duyệt',
  APPROVED: 'Đã Duyệt',
  REJECTED: 'Từ Chối',
  DRAFT: 'Nháp',
};
const LINE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
};
const LINE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

// ─── Complete Line Modal ───────────────────────────────────────────────────────

const CompleteLineModal: React.FC<{
  open: boolean;
  requestId: string;
  line: ProductionRequestLineDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ open, requestId, line, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  // Bug fix: defaultValue bị ignore bởi Form controlled component.
  // Dùng setFieldsValue để pre-fill giá trị khi modal mở hoặc line thay đổi.
  useEffect(() => {
    if (open && line) {
      form.setFieldsValue({
        qtyProduced: line.plannedQty > 0 ? line.plannedQty : undefined,
        note: undefined,
      });
    }
    if (!open) {
      form.resetFields();
    }
  }, [open, line, form]);

  const mutation = useMutation({
    mutationFn: (vals: { qtyProduced: number; note?: string }) =>
      productionRequestService.completeLine(requestId, line!.id, vals),
    onSuccess: () => {
      message.success('Đã hoàn thành dòng sản xuất.');
      form.resetFields();
      onSuccess();
      onClose();
    },
    onError: () => message.error('Thao tác thất bại. Vui lòng thử lại.'),
  });

  return (
    <Modal
      title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />Hoàn Thành Dòng</Space>}
      open={open}
      onOk={() => form.validateFields().then(v => mutation.mutate(v))}
      onCancel={() => { form.resetFields(); onClose(); }}
      confirmLoading={mutation.isPending}
      okText="Xác Nhận"
      cancelText="Hủy"
    >
      {line && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Sản phẩm: </Text><Text strong>{line.product?.name}</Text><br />
          <Text type="secondary">SL kế hoạch: </Text>
          <Text strong>{line.plannedQty > 0 ? line.plannedQty : <Tag>Tự do</Tag>}</Text>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="qtyProduced" label="Số Lượng Thực Tế"
          rules={[{ required: true, message: 'Vui lòng nhập số lượng' }, { type: 'number', min: 0, message: 'Số lượng phải ≥ 0' }]}>
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            placeholder="Nhập số lượng sản xuất được"
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi Chú">
          <Input.TextArea rows={2} placeholder="Ghi chú (nếu có)..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Expanded Detail Row ───────────────────────────────────────────────────────

const ExpandedDetail: React.FC<{
  record: ProductionRequestDetail;
  onRefresh: () => void;
}> = ({ record, onRefresh }) => {
  const queryClient = useQueryClient();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ProductionRequestLineDetail | null>(null);

  const lines = record.lines ?? [];
  const hasCompleted = lines.some((l) => l.lineStatus === 'COMPLETED');
  const pendingLines = lines.filter(l => l.lineStatus === 'PENDING' || l.lineStatus === 'IN_PROGRESS');

  // Batch complete: hoàn thành tất cả lines đang PENDING/IN_PROGRESS
  const batchMutation = useMutation({
    mutationFn: () =>
      productionRequestService.completeLines(
        record.id,
        pendingLines.map(l => ({
          lineId: l.id,
          qtyProduced: l.plannedQty > 0 ? l.plannedQty : 0,
        }))
      ),
    onSuccess: () => {
      message.success(`✅ Hoàn thành ${pendingLines.length} dòng sản xuất!`);
      queryClient.invalidateQueries({ queryKey: ['production-requests'] });
      onRefresh();
    },
    onError: () => message.error('Hoàn thành batch thất bại. Vui lòng thử lại.'),
  });

  const handleBatchComplete = () => {
    Modal.confirm({
      title: 'Hoàn Thành Tất Cả Dòng',
      content: `Hoàn thành ${pendingLines.length} dòng sản xuất với số lượng theo kế hoạch?`,
      okText: 'Xác Nhận',
      cancelText: 'Hủy',
      onOk: () => batchMutation.mutate(),
    });
  };

  const lineColumns: ColumnsType<ProductionRequestLineDetail> = [
    {
      title: '#',
      key: 'idx',
      width: 40,
      render: (_, __, i) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>,
    },
    {
      title: 'Sản Phẩm',
      key: 'product',
      render: (_, r) => <Text strong>{r.product?.name || '—'}</Text>,
    },
    {
      title: 'Kế Hoạch',
      key: 'planned',
      align: 'right',
      width: 90,
      render: (_, r) =>
        r.plannedQty > 0 ? (
          <Text strong>{r.plannedQty}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>tự do</Text>
        ),
    },
    {
      title: 'Bếp Làm',
      key: 'qtyProduced',
      align: 'right',
      width: 85,
      render: (_, r) =>
        r.deliveryRecord?.qtyProduced != null ? (
          <Text style={{ color: '#059669' }}>{r.deliveryRecord.qtyProduced}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Shop Nhận',
      key: 'qtyReceived',
      align: 'right',
      width: 85,
      render: (_, r) =>
        r.deliveryRecord?.qtyReceived != null ? (
          <Text style={{ color: '#2563eb' }}>{r.deliveryRecord.qtyReceived}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Tag color={LINE_STATUS_COLOR[r.lineStatus] || 'default'}>
            {LINE_STATUS_LABEL[r.lineStatus] || r.lineStatus}
          </Tag>
          {r.deliveryRecord?.deliveryStatus === 'READY' && (
            <Tag color="warning">Chờ shop XN</Tag>
          )}
          {r.deliveryRecord?.deliveryStatus === 'CONFIRMED' && (
            <Tag color="success">Đã giao</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Hoàn Thành',
      key: 'action',
      width: 130,
      render: (_, r) => {
        if (r.lineStatus === 'PENDING' || r.lineStatus === 'IN_PROGRESS') {
          return (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => { setSelectedLine(r); setCompleteOpen(true); }}
            >
              Hoàn Thành
            </Button>
          );
        }
        if (r.lineStatus === 'COMPLETED' && r.deliveryRecord?.deliveryStatus === 'READY') {
          return <Text style={{ fontSize: 11, color: '#b45309' }}>⏳ Chờ shop XN</Text>;
        }
        if (r.deliveryRecord?.deliveryStatus === 'CONFIRMED') {
          return <Text style={{ fontSize: 11, color: '#059669' }}>✅ Đã giao</Text>;
        }
        if (r.lineStatus === 'COMPLETED') {
          return <Tag color="success">Đã xong</Tag>;
        }
        return null;
      },
    },
  ];

  return (
    <div style={{ padding: '12px 16px', background: '#f8fafc' }}>
      {/* Cảnh báo nếu có line đã hoàn thành */}
      {hasCompleted && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 10 }}
          message={
            <Text style={{ fontSize: 13 }}>
              ⚠️ Có line đã hoàn thành →{' '}
              <Text strong>Vào 🚚 Giao nhận để shop xác nhận và chuyển kho</Text>
              {' '}(chọn đúng ngày:{' '}
              <Text strong>{record.productionDate}</Text>)
            </Text>
          }
        />
      )}

      {/* Nút Hoàn thành tất cả */}
      {pendingLines.length > 0 && (
        <div style={{ marginBottom: 10, textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={batchMutation.isPending}
            onClick={handleBatchComplete}
          >
            Hoàn thành tất cả ({pendingLines.length} dòng)
          </Button>
        </div>
      )}

      {/* Bảng chi tiết lines */}
      <Table<ProductionRequestLineDetail>
        columns={lineColumns}
        dataSource={lines}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 680 }}
        style={{ background: '#fff' }}
      />

      {/* CompleteLineModal */}
      <CompleteLineModal
        open={completeOpen}
        requestId={record.id}
        line={selectedLine}
        onClose={() => setCompleteOpen(false)}
        onSuccess={onRefresh}
      />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductionRequestList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState('');
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ProductionType | ''>('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const buildParams = (approvalStatus: string) => ({
    approvalStatus,
    ...(filterDate ? { productionDate: filterDate } : {}),
    ...(filterType ? { productionType: filterType } : {}),
    page: 0,
    size: 500,
  });

  const { data: approvedData, isLoading: approvedLoading, isError: approvedError, refetch: refetchApproved } =
    useQuery({
      queryKey: ['production-requests', 'APPROVED', filterDate, filterType],
      queryFn: () => productionRequestService.list(buildParams('APPROVED')),
      retry: false,
    });

  const { data: pendingData, isLoading: pendingLoading, isError: pendingError, refetch: refetchPending } =
    useQuery({
      queryKey: ['production-requests', 'PENDING_APPROVAL', filterDate, filterType],
      queryFn: () => productionRequestService.list(buildParams('PENDING_APPROVAL')),
      retry: false,
    });

  const { data: draftData, isLoading: draftLoading, isError: draftError, refetch: refetchDraft } =
    useQuery({
      queryKey: ['production-requests', 'DRAFT', filterDate, filterType],
      queryFn: () => productionRequestService.list(buildParams('DRAFT')),
      retry: false,
    });

  const { data: rejectedData, isLoading: rejectedLoading, isError: rejectedError, refetch: refetchRejected } =
    useQuery({
      queryKey: ['production-requests', 'REJECTED', filterDate, filterType],
      queryFn: () => productionRequestService.list(buildParams('REJECTED')),
      retry: false,
    });

  const approvedList = toArray<ProductionRequestDetail>(approvedData);
  const pendingList = [...toArray<ProductionRequestDetail>(draftData), ...toArray<ProductionRequestDetail>(pendingData)];
  const rejectedList = toArray<ProductionRequestDetail>(rejectedData);

  const filtered = (list: ProductionRequestDetail[]) =>
    searchText.trim()
      ? list.filter(r =>
        r.code?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.createdBy?.toLowerCase().includes(searchText.toLowerCase()),
      )
      : list;

  const handleRefreshAll = () => { refetchApproved(); refetchPending(); refetchDraft(); refetchRejected(); };

  const handleRefreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['production-requests'] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: (id: string) => productionRequestService.approve(id),
    onSuccess: () => { message.success('Đã phê duyệt.'); queryClient.invalidateQueries({ queryKey: ['production-requests'] }); },
    onError: () => message.error('Phê duyệt thất bại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productionRequestService.reject(id, reason),
    onSuccess: () => {
      message.warning('Đã từ chối.');
      setRejectModalOpen(false); setRejectReason(''); setRejectTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['production-requests'] });
    },
    onError: () => message.error('Từ chối thất bại.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productionRequestService.remove(id),
    onSuccess: () => { message.success('Đã xóa.'); queryClient.invalidateQueries({ queryKey: ['production-requests'] }); },
    onError: () => message.error('Xóa thất bại.'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleApprove = (r: ProductionRequestDetail) =>
    Modal.confirm({
      title: 'Phê Duyệt Lệnh Sản Xuất',
      content: `Phê duyệt lệnh "${r.code}"?`,
      onOk: () => approveMutation.mutate(r.id),
      okText: 'Phê Duyệt', cancelText: 'Hủy',
    });

  const handleOpenReject = (r: ProductionRequestDetail) => {
    setRejectTargetId(r.id); setRejectReason(''); setRejectModalOpen(true);
  };

  const submitReject = () => {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) { message.error('Vui lòng nhập lý do từ chối.'); return; }
    rejectMutation.mutate({ id: rejectTargetId, reason: rejectReason });
  };

  // ── Expandable row config ─────────────────────────────────────────────────────

  const expandable = {
    expandedRowRender: (record: ProductionRequestDetail) => (
      <ExpandedDetail record={record} onRefresh={handleRefreshQueries} />
    ),
    rowExpandable: (record: ProductionRequestDetail) => (record.lines?.length ?? 0) > 0,
  };

  // ── Base columns ──────────────────────────────────────────────────────────────

  const baseColumns: ColumnsType<ProductionRequestDetail> = [
    {
      title: 'Mã Lệnh', dataIndex: 'code', key: 'code', width: 160,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Loại', dataIndex: 'productionType', key: 'productionType', width: 120,
      render: (v: ProductionType) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
    },
    {
      title: 'Ngày SX', dataIndex: 'productionDate', key: 'productionDate', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
      sorter: (a, b) => (a.productionDate || '').localeCompare(b.productionDate || ''),
    },
    {
      title: 'Số Dòng', key: 'lines', width: 85, align: 'center',
      render: (_, r) => <Badge count={r.lines?.length || 0} color="#1890ff" showZero />,
    },
    { title: 'Người Tạo', dataIndex: 'createdBy', key: 'createdBy', width: 140 },
    {
      title: 'Ngày Tạo', dataIndex: 'createdAt', key: 'createdAt', width: 155,
      render: (v: string) => v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—',
    },
  ];

  const approvedColumns: ColumnsType<ProductionRequestDetail> = [
    ...baseColumns,
    {
      title: 'Thao Tác', key: 'action', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem Chi Tiết">
            <Button type="text" icon={<EyeOutlined style={{ color: '#1890ff' }} />}
              onClick={(e) => { e.stopPropagation(); }} />
          </Tooltip>
          <Popconfirm
            title="Xóa Lệnh Sản Xuất"
            description={`Xóa lệnh "${record.code}"?`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          >
            <Tooltip title="Xóa">
              <Button type="text" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pendingColumns: ColumnsType<ProductionRequestDetail> = [
    ...baseColumns,
    {
      title: 'Ghi Chú', dataIndex: 'note', key: 'note',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Duyệt / Từ Chối', key: 'action', width: 140, align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="Phê Duyệt">
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={(e) => { e.stopPropagation(); handleApprove(record); }} loading={approveMutation.isPending} />
          </Tooltip>
          <Tooltip title="Từ Chối">
            <Button size="small" danger icon={<CloseOutlined />}
              onClick={(e) => { e.stopPropagation(); handleOpenReject(record); }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rejectedColumns: ColumnsType<ProductionRequestDetail> = [
    ...baseColumns,
    {
      title: 'Lý Do Từ Chối', dataIndex: 'rejectedReason', key: 'rejectedReason',
      render: (v: string) => <Text type="danger">{v || '—'}</Text>,
    },
  ];

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'approved',
      label: (
        <Space>Đã Duyệt<Badge count={filtered(approvedList).length} color="#52c41a" showZero /></Space>
      ),
      children: (
        <Table<ProductionRequestDetail>
          columns={approvedColumns}
          dataSource={filtered(approvedList)}
          loading={approvedLoading}
          rowKey="id"
          size="middle"
          expandable={expandable}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
          })}
          pagination={{ pageSize: 8, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} lệnh` }}
        />
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingList.length > 0 && <Badge count={pendingList.length} style={{ backgroundColor: '#fa8c16' }} />}
        </Space>
      ),
      children: (
        <Table<ProductionRequestDetail>
          columns={pendingColumns}
          dataSource={filtered(pendingList)}
          loading={pendingLoading || draftLoading}
          rowKey="id"
          size="middle"
          expandable={expandable}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
          })}
          pagination={{ pageSize: 8 }}
        />
      ),
    },
    {
      key: 'rejected',
      label: (
        <Space>
          Bị Từ Chối
          {rejectedList.length > 0 && <Badge count={rejectedList.length} color="#ff4d4f" />}
        </Space>
      ),
      children: (
        <Table<ProductionRequestDetail>
          columns={rejectedColumns}
          dataSource={filtered(rejectedList)}
          loading={rejectedLoading}
          rowKey="id"
          size="middle"
          expandable={expandable}
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
          <Title level={3} style={{ margin: 0 }}>Quản Lý Lệnh Sản Xuất</Title>
          <Text type="secondary">Bấm vào từng lệnh để xem và thao tác chi tiết từng dòng sản xuất</Text>
        </div>
        <Space>
          <Input
            placeholder="Tìm mã lệnh, người tạo..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 230 }}
            allowClear
          />
          <DatePicker
            placeholder="Ngày sản xuất"
            format="DD/MM/YYYY"
            onChange={(_, s) =>
              setFilterDate(typeof s === 'string' && s ? dayjs(s, 'DD/MM/YYYY').format('YYYY-MM-DD') : null)
            }
            allowClear
          />
          <Select
            value={filterType}
            onChange={val => setFilterType(val as ProductionType | '')}
            style={{ width: 150 }}
            placeholder="Loại sản xuất"
            allowClear
          >
            <Select.Option value="">Tất cả loại</Select.Option>
            <Select.Option value="DAILY">Hàng Ngày</Select.Option>
            <Select.Option value="ORDER">Theo Đơn</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefreshAll}
            loading={approvedLoading || pendingLoading || draftLoading || rejectedLoading}
          >
            Làm Mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/prod-requests/create')}
          >
            Tạo Lệnh SX
          </Button>
        </Space>
      </div>

      {/* Error banners */}
      {approvedError && (
        <Alert type="error" showIcon message="Không tải được danh sách lệnh đã duyệt."
          description="Kiểm tra kết nối đến backend (http://localhost:8080)."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchApproved()}>Thử lại</Button>}
        />
      )}
      {(pendingError || draftError) && (
        <Alert type="warning" showIcon message="Không tải được danh sách lệnh chờ duyệt."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => { refetchPending(); refetchDraft(); }}>Thử lại</Button>}
        />
      )}
      {rejectedError && (
        <Alert type="warning" showIcon message="Không tải được danh sách lệnh bị từ chối."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchRejected()}>Thử lại</Button>}
        />
      )}

      {/* Expand hint */}
      <Alert
        type="info"
        showIcon
        icon={<FileTextOutlined />}
        style={{ marginBottom: 12 }}
        message={
          <Text style={{ fontSize: 12 }}>
            💡 Bấm vào hàng để <Text strong>mở rộng chi tiết</Text> và thao tác hoàn thành từng dòng sản xuất.
          </Text>
        }
      />

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="approved" items={tabItems} />

      {/* Reject Modal */}
      <Modal
        title="Từ Chối Lệnh Sản Xuất"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        confirmLoading={rejectMutation.isPending}
        okText="Gửi" cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8 }}>Vui lòng nhập lý do từ chối:</div>
        <Input.TextArea
          rows={4}
          placeholder="Lý do..."
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default ProductionRequestList;
