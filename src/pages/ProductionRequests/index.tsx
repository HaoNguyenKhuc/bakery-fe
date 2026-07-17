import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Descriptions, message, DatePicker, Select,
  Divider, Alert, Tooltip, Popconfirm, Badge, Form, InputNumber,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CheckOutlined, CloseOutlined,
  EyeOutlined, DeleteOutlined, ReloadOutlined,
  ExclamationCircleOutlined, FileTextOutlined, CheckCircleOutlined,
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
  CompleteLineRequest,
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
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Chờ Duyệt',
  APPROVED: 'Đã Duyệt',
  REJECTED: 'Từ Chối',
};
const LINE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
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
          <Text type="secondary">SL kế hoạch: </Text><Text strong>{line.plannedQty}</Text>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="qtyProduced" label="Số Lượng Thực Tế"
          rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Nhập số lượng sản xuất được" />
        </Form.Item>
        <Form.Item name="note" label="Ghi Chú">
          <Input.TextArea rows={2} placeholder="Ghi chú (nếu có)..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal: React.FC<{
  open: boolean;
  record: ProductionRequestDetail | null;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ open, record, onClose, onRefresh }) => {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ProductionRequestLineDetail | null>(null);

  const lineColumns: ColumnsType<ProductionRequestLineDetail> = [
    { title: '#', key: 'idx', width: 45, render: (_, __, i) => i + 1 },
    { title: 'Sản Phẩm', key: 'product', render: (_, r) => <Text strong>{r.product?.name || '—'}</Text> },
    {
      title: 'Công Thức', key: 'recipe',
      render: (_, r) => r.recipe?.name ? <Tag>{r.recipe.name}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'SL KH', dataIndex: 'plannedQty', key: 'plannedQty', width: 90, align: 'right',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: 'SL Thực', key: 'qtyProduced', width: 90, align: 'right',
      render: (_, r) => r.deliveryRecord?.qtyProduced != null
        ? <Text type="success">{r.deliveryRecord.qtyProduced}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng Thái', dataIndex: 'lineStatus', key: 'lineStatus', width: 110,
      render: (v: string) => <Tag color={LINE_STATUS_COLOR[v] || 'default'}>{v || '—'}</Tag>,
    },
    {
      title: 'Thao Tác', key: 'action', width: 120, align: 'center',
      render: (_, r) => r.lineStatus !== 'COMPLETED'
        ? (
          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => { setSelectedLine(r); setCompleteOpen(true); }}>
            Hoàn Thành
          </Button>
        )
        : <Tag color="success">Đã Xong</Tag>,
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <FileTextOutlined />Chi Tiết Lệnh Sản Xuất
            {record?.code && <Tag color="blue">{record.code}</Tag>}
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={<Button onClick={onClose}>Đóng</Button>}
        width={900}
      >
        {record && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Mã Lệnh"><Text code>{record.code}</Text></Descriptions.Item>
              <Descriptions.Item label="Loại">
                <Tag color={TYPE_COLOR[record.productionType]}>{TYPE_LABEL[record.productionType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày SX">
                {dayjs(record.productionDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng Thái">
                <Tag color={STATUS_COLOR[record.approvalStatus] || 'default'}>
                  {STATUS_LABEL[record.approvalStatus] || record.approvalStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người Tạo">{record.createdBy}</Descriptions.Item>
              <Descriptions.Item label="Ngày Tạo">
                {dayjs(record.createdAt).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
              {record.approvedBy && (
                <Descriptions.Item label="Người Duyệt">{record.approvedBy}</Descriptions.Item>
              )}
              {record.approvedAt && (
                <Descriptions.Item label="Ngày Duyệt">
                  {dayjs(record.approvedAt).format('HH:mm DD/MM/YYYY')}
                </Descriptions.Item>
              )}
              {record.rejectedReason && (
                <Descriptions.Item label="Lý Do Từ Chối" span={2}>
                  <Text type="danger">{record.rejectedReason}</Text>
                </Descriptions.Item>
              )}
              {record.note && (
                <Descriptions.Item label="Ghi Chú" span={2}>{record.note}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>
              Dòng Sản Xuất ({record.lines?.length || 0} dòng)
            </Title>
            <Table<ProductionRequestLineDetail>
              columns={lineColumns}
              dataSource={record.lines || []}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 650 }}
            />
          </>
        )}
      </Modal>

      {record && (
        <CompleteLineModal
          open={completeOpen}
          requestId={record.id}
          line={selectedLine}
          onClose={() => setCompleteOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductionRequestList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState('');
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ProductionType | ''>('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ProductionRequestDetail | null>(null);

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

  const { data: rejectedData, isLoading: rejectedLoading, isError: rejectedError, refetch: refetchRejected } =
    useQuery({
      queryKey: ['production-requests', 'REJECTED', filterDate, filterType],
      queryFn: () => productionRequestService.list(buildParams('REJECTED')),
      retry: false,
    });

  const approvedList = toArray<ProductionRequestDetail>(approvedData);
  const pendingList = toArray<ProductionRequestDetail>(pendingData);
  const rejectedList = toArray<ProductionRequestDetail>(rejectedData);

  const filtered = (list: ProductionRequestDetail[]) =>
    searchText.trim()
      ? list.filter(r =>
          r.code?.toLowerCase().includes(searchText.toLowerCase()) ||
          r.createdBy?.toLowerCase().includes(searchText.toLowerCase()),
        )
      : list;

  const handleRefreshAll = () => { refetchApproved(); refetchPending(); refetchRejected(); };

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

  // ── Columns ──────────────────────────────────────────────────────────────────

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
      title: 'Số Dòng', key: 'lines', width: 90, align: 'center',
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
      title: 'Thao Tác', key: 'action', width: 110, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem Chi Tiết">
            <Button type="text" icon={<EyeOutlined style={{ color: '#1890ff' }} />}
              onClick={() => { setDetailRecord(record); setDetailOpen(true); }} />
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
              onClick={() => handleApprove(record)} loading={approveMutation.isPending} />
          </Tooltip>
          <Tooltip title="Xem Chi Tiết">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => { setDetailRecord(record); setDetailOpen(true); }} />
          </Tooltip>
          <Tooltip title="Từ Chối">
            <Button size="small" danger icon={<CloseOutlined />}
              onClick={() => handleOpenReject(record)} />
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
    {
      title: 'Thao Tác', key: 'action', width: 80, align: 'center',
      render: (_, record) => (
        <Tooltip title="Xem Chi Tiết">
          <Button type="text" icon={<EyeOutlined style={{ color: '#1890ff' }} />}
            onClick={() => { setDetailRecord(record); setDetailOpen(true); }} />
        </Tooltip>
      ),
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
          columns={approvedColumns} dataSource={filtered(approvedList)}
          loading={approvedLoading} rowKey="id" size="middle"
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
          columns={pendingColumns} dataSource={filtered(pendingList)}
          loading={pendingLoading} rowKey="id" size="middle"
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
          columns={rejectedColumns} dataSource={filtered(rejectedList)}
          loading={rejectedLoading} rowKey="id" size="middle"
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
          <Text type="secondary">Tạo, xem và phê duyệt các lệnh sản xuất hàng ngày và theo đơn</Text>
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
            loading={approvedLoading || pendingLoading || rejectedLoading}
          >
            Làm Mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/production/requests/create')}
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
      {pendingError && (
        <Alert type="warning" showIcon message="Không tải được danh sách lệnh chờ duyệt."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchPending()}>Thử lại</Button>}
        />
      )}
      {rejectedError && (
        <Alert type="warning" showIcon message="Không tải được danh sách lệnh bị từ chối."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchRejected()}>Thử lại</Button>}
        />
      )}

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="approved" items={tabItems} />

      {/* Detail Modal */}
      <DetailModal
        open={detailOpen}
        record={detailRecord}
        onClose={() => setDetailOpen(false)}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['production-requests'] })}
      />

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
