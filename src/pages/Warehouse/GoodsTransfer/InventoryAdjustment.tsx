import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Typography, Badge,
  Modal, Form, Select, Input, InputNumber, Divider,
  Alert, Tooltip, Row, Col, message,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, WarningOutlined,
  LockOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type {
  InventoryAdjustment, InventoryAdjustmentLine,
  InventoryAdjustmentRequest, AdjustmentType,
} from '../../../types';
import { useAuthStore } from '../../../store';

const { Title, Text } = Typography;

// ─── Nhãn ─────────────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, { label: string; color: string }> = {
  LOSS:    { label: '🔴 Mất hàng',   color: 'red' },
  DAMAGE:  { label: '🟠 Hư hỏng',   color: 'orange' },
  EXPIRED: { label: '⚫ Hết hạn',    color: 'default' },
  OTHER:   { label: '🔵 Khác',       color: 'blue' },
};

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  PENDING:  { color: 'orange', label: '⏳ Chờ duyệt' },
  APPROVED: { color: 'green',  label: '✅ Đã duyệt' },
  REJECTED: { color: 'red',    label: '❌ Từ chối' },
};

// ─── Dummy data ────────────────────────────────────────────────────────────────

const dummyAdjustments: InventoryAdjustment[] = [
  {
    adjustmentId: 'adj-001', adjustmentCode: 'ADJ-20260702-001',
    adjustmentType: 'LOSS', warehouseCode: 'MAIN', branchCode: 'KHO-TONG',
    status: 'APPROVED', reason: 'Mất hàng trong quá trình vận chuyển',
    lines: [{ ingredientCode: 'NL003', ingredientName: 'Bơ Nhạt', unit: 'KG', lostQuantity: 2 }],
    createdBy: 'cuong.kho', createdAt: '2026-07-02T14:00:00Z',
    approvedBy: 'chinh.admin', approvedAt: '2026-07-02T16:00:00Z',
  },
  {
    adjustmentId: 'adj-002', adjustmentCode: 'ADJ-20260703-001',
    adjustmentType: 'DAMAGE', warehouseCode: 'KITCHEN', branchCode: 'BEP-01',
    status: 'PENDING', reason: 'Hộp sữa bị vỡ khi nhận hàng',
    lines: [{ ingredientCode: 'NL005', ingredientName: 'Sữa Tươi', unit: 'Lít', lostQuantity: 3 }],
    createdBy: 'bep1.staff', createdAt: '2026-07-03T08:30:00Z',
  },
];

// ─── Form tạo phiếu ───────────────────────────────────────────────────────────

interface AdjFormValues {
  adjustmentType: AdjustmentType;
  reason: string;
  note?: string;
}

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: InventoryAdjustmentRequest) => void;
  submitting: boolean;
  warehouseCode: 'MAIN' | 'KITCHEN' | 'STORE';
}

const CreateAdjustmentModal: React.FC<CreateModalProps> = ({
  open, onClose, onSubmit, submitting, warehouseCode,
}) => {
  const [form] = Form.useForm<AdjFormValues>();
  const [lines, setLines] = useState<InventoryAdjustmentLine[]>([
    { ingredientCode: '', ingredientName: '', unit: 'KG', lostQuantity: 0 },
  ]);

  React.useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([{ ingredientCode: '', ingredientName: '', unit: 'KG', lostQuantity: 0 }]);
    }
  }, [open, form]);

  const addLine = () =>
    setLines((prev) => [...prev, { ingredientCode: '', ingredientName: '', unit: 'KG', lostQuantity: 0 }]);

  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof InventoryAdjustmentLine, value: string | number) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit({
        adjustmentType: values.adjustmentType,
        warehouseCode,
        reason: values.reason,
        note: values.note,
        lines,
      });
    });
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          Tạo Phiếu Thất Thoát / Điều Chỉnh Kho
        </Space>
      }
      okText="Gửi Phiếu"
      cancelText="Hủy"
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
      width={680}
    >
      <Alert
        type="warning"
        showIcon
        message="Phiếu sẽ ở trạng thái Chờ Duyệt cho đến khi Admin phê duyệt."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="adjustmentType"
              label="Loại Điều Chỉnh"
              rules={[{ required: true, message: 'Chọn loại điều chỉnh!' }]}
            >
              <Select placeholder="Chọn loại...">
                <Select.Option value="LOSS">🔴 Mất hàng</Select.Option>
                <Select.Option value="DAMAGE">🟠 Hư hỏng</Select.Option>
                <Select.Option value="EXPIRED">⚫ Hết hạn sử dụng</Select.Option>
                <Select.Option value="OTHER">🔵 Lý do khác</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="reason"
          label="Lý Do Cụ Thể"
          rules={[{ required: true, message: 'Mô tả lý do thất thoát!' }, { min: 10 }]}
        >
          <Input.TextArea rows={2} placeholder="Mô tả chi tiết nguyên nhân..." maxLength={300} showCount />
        </Form.Item>
        <Form.Item name="note" label="Ghi Chú Thêm">
          <Input.TextArea rows={1} placeholder="(Tùy chọn)" />
        </Form.Item>
      </Form>

      <Divider style={{ margin: '8px 0 12px' }}>Danh Sách Nguyên Liệu Thất Thoát</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {lines.map((line, i) => (
          <Row key={i} gutter={8} align="middle">
            <Col span={5}>
              <Input
                placeholder="Mã NL"
                value={line.ingredientCode}
                onChange={(e) => updateLine(i, 'ingredientCode', e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
            <Col span={7}>
              <Input
                placeholder="Tên nguyên liệu"
                value={line.ingredientName}
                onChange={(e) => updateLine(i, 'ingredientName', e.target.value)}
              />
            </Col>
            <Col span={4}>
              <Select
                value={line.unit}
                onChange={(v) => updateLine(i, 'unit', v)}
                style={{ width: '100%' }}
              >
                <Select.Option value="KG">KG</Select.Option>
                <Select.Option value="Lít">Lít</Select.Option>
                <Select.Option value="Cái">Cái</Select.Option>
                <Select.Option value="Gói">Gói</Select.Option>
              </Select>
            </Col>
            <Col span={5}>
              <InputNumber
                min={0.01}
                value={line.lostQuantity || undefined}
                onChange={(v) => updateLine(i, 'lostQuantity', v ?? 0)}
                style={{ width: '100%' }}
                placeholder="SL mất"
              />
            </Col>
            <Col span={3}>
              <Tooltip title="Xóa dòng">
                <Button
                  danger type="text"
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

const InventoryAdjustmentPage: React.FC = () => {
  const queryClient = useQueryClient();

  const user        = useAuthStore((s) => s.user);
  const canOnScreen = useAuthStore((s) => s.canOnScreen);
  const isAdmin     = useAuthStore((s) => s.isAdmin);
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);

  // Xác định warehouse của user hiện tại
  const warehouseCode = (
    isWarehouseRole('KHO_TONG') ? 'MAIN' :
    isWarehouseRole('KHO_BEP')  ? 'KITCHEN' :
    isWarehouseRole('STORE')    ? 'STORE' : 'MAIN'
  ) as 'MAIN' | 'KITCHEN' | 'STORE';

  // Nút [PHÊ DUYỆT ĐIỀU CHỈNH KHO] chỉ hiện khi ADMIN + can_approve
  const canApproveAdjustment = isAdmin() && canOnScreen('INVENTORY_ADJUSTMENT', 'approve');

  // Nút [Tạo phiếu mất hàng] cho Kho Tổng và Kho Bếp
  const canCreateAdjustment = canOnScreen('INVENTORY_ADJUSTMENT', 'create') &&
    (isWarehouseRole('KHO_TONG') || isWarehouseRole('KHO_BEP') || isAdmin());

  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-adjustment', user?.branch_code],
    queryFn: async (): Promise<InventoryAdjustment[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const list: InventoryAdjustment[] = Array.isArray(data) ? data : dummyAdjustments;

  const createMutation = useMutation({
    mutationFn: async (_req: InventoryAdjustmentRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('Đã gửi phiếu thất thoát. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustment'] });
      setModalOpen(false);
    },
    onError: () => message.warning('API chưa sẵn sàng — phiếu đã được ghi nhận (demo).'),
  });

  const approveMutation = useMutation({
    mutationFn: async (_id: string) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('Đã phê duyệt điều chỉnh kho.');
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustment'] });
    },
    onError: () => message.warning('API chưa sẵn sàng (demo).'),
  });

  const columns: ColumnsType<InventoryAdjustment> = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'adjustmentCode',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'adjustmentType',
      key: 'type',
      width: 130,
      render: (v: AdjustmentType) => {
        const cfg = ADJUSTMENT_TYPE_LABEL[v];
        return <Tag color={cfg?.color}>{cfg?.label ?? v}</Tag>;
      },
    },
    {
      title: 'Kho',
      dataIndex: 'warehouseCode',
      key: 'warehouse',
      width: 100,
      render: (v: string, r: InventoryAdjustment) => (
        <Space direction="vertical" size={0}>
          <Tag color="purple">{v}</Tag>
          {r.branchCode && <Text type="secondary" style={{ fontSize: 11 }}>{r.branchCode}</Text>}
        </Space>
      ),
    },
    {
      title: 'Lý Do',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: 'Số Dòng NL',
      key: 'lines',
      width: 100,
      align: 'center',
      render: (_: unknown, r: InventoryAdjustment) => (
        <Badge count={r.lines.length} style={{ backgroundColor: '#fa8c16' }} />
      ),
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: string) => {
        const cfg = STATUS_TAG[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    // Cột PHÊ DUYỆT — BẮT BUỘC ẨN với mọi user, CHỈ HIỆN khi ADMIN + can_approve
    ...(canApproveAdjustment ? [{
      title: (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          Phê Duyệt
        </Space>
      ),
      key: 'approve',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, r: InventoryAdjustment) =>
        r.status === 'PENDING' ? (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate(r.adjustmentId)}
          >
            PHÊ DUYỆT
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    }] : []),
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WarningOutlined style={{ color: '#ff4d4f', marginRight: 10 }} />
            Phiếu Thất Thoát / Điều Chỉnh Kho
          </Title>
          <Text type="secondary">Ghi nhận và phê duyệt các trường hợp mất hàng, hư hỏng, hết hạn</Text>
        </Col>
        <Col>
          <Space>
            {/* Nút tạo phiếu — Kho Tổng + Kho Bếp */}
            {canCreateAdjustment ? (
              <Button
                type="primary"
                danger
                icon={<PlusOutlined />}
                onClick={() => setModalOpen(true)}
              >
                Tạo Phiếu Mất Hàng
              </Button>
            ) : (
              <Tooltip title="Bạn không có quyền tạo phiếu điều chỉnh kho">
                <Button danger icon={<LockOutlined />} disabled>
                  Tạo Phiếu Mất Hàng
                </Button>
              </Tooltip>
            )}

            {/* Nút PHÊ DUYỆT ĐIỀU CHỈNH KHO — CHỈ ADMIN */}
            {canApproveAdjustment && (
              <Alert
                type="warning"
                showIcon
                icon={<CheckCircleOutlined />}
                message={
                  <Text strong style={{ fontSize: 12 }}>
                    Bạn đang đăng nhập với quyền Admin — có thể phê duyệt điều chỉnh trong bảng bên dưới.
                  </Text>
                }
                style={{ padding: '4px 12px' }}
              />
            )}
          </Space>
        </Col>
      </Row>

      <Table<InventoryAdjustment>
        columns={columns}
        dataSource={list}
        rowKey="adjustmentId"
        size="middle"
        loading={isLoading}
        pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
        locale={{ emptyText: '✅ Chưa có phiếu điều chỉnh nào.' }}
      />

      <CreateAdjustmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(req) => createMutation.mutate(req)}
        submitting={createMutation.isPending}
        warehouseCode={warehouseCode}
      />
    </div>
  );
};

export default InventoryAdjustmentPage;
