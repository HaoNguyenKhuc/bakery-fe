import React, { useState } from 'react';
import {
  Button, Form, Input, InputNumber, Modal, Select,
  Space, Typography, Alert, Divider, Tag, Table, message,
} from 'antd';
import {
  ThunderboltOutlined, PlusOutlined, CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { UrgentProduction, UrgentProductionRequest } from '../../../../types';
import { useAuthStore } from '../../../../store';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ─── Dummy data ───────────────────────────────────────────────────────────────

const dummyUrgents: UrgentProduction[] = [
  {
    urgentId: 'urg-001',
    urgentCode: 'URGENT-20260705-001',
    productCode: 'BCK-001',
    productName: 'Bánh Kem Chuẩn 20cm',
    quantityNeeded: 5,
    reason: 'Cửa hàng báo hết hàng từ 9:00 sáng, khách đặt thêm',
    status: 'APPROVED',
    createdBy: 'bep.truong',
    createdAt: '2026-07-05T08:45:00Z',
    approvedBy: 'bep.truong',
    approvedAt: '2026-07-05T08:46:00Z',
  },
];

// ─── Nhãn trạng thái ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  PENDING:   { color: 'orange', label: '⏳ Chờ duyệt' },
  APPROVED:  { color: 'green',  label: '✅ Đã duyệt — đang chạy' },
  COMPLETED: { color: 'blue',   label: '🏁 Hoàn thành' },
};

// ─── Sản phẩm có thể phát sinh ───────────────────────────────────────────────

const PRODUCTS = [
  { code: 'BCK-001', name: 'Bánh Kem Chuẩn 20cm' },
  { code: 'BCK-002', name: 'Bánh Kem Chuẩn 24cm' },
  { code: 'BNT-001', name: 'Bento Cake Mini' },
  { code: 'SCK-001', name: 'Sheet Cake Cơ Bản' },
];

// ─── Form tạo lệnh gấp ───────────────────────────────────────────────────────

interface CreateUrgentFormValues {
  productCode: string;
  quantityNeeded: number;
  reason: string;
  note?: string;
}

interface CreateUrgentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: UrgentProductionRequest) => void;
  submitting: boolean;
}

const CreateUrgentModal: React.FC<CreateUrgentModalProps> = ({
  open, onClose, onSubmit, submitting,
}) => {
  const [form] = Form.useForm<CreateUrgentFormValues>();

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit({
        productCode: values.productCode,
        quantityNeeded: values.quantityNeeded,
        reason: values.reason,
        note: values.note,
      });
    });
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
          Tạo Lệnh Sản Xuất Gấp
        </Space>
      }
      okText="Tạo & Duyệt Ngay"
      okButtonProps={{ danger: true, icon: <ThunderboltOutlined /> }}
      cancelText="Hủy"
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      destroyOnClose
      width={560}
    >
      <Alert
        type="warning"
        showIcon
        message="Lệnh sản xuất gấp sẽ được duyệt ngay lập tức và đưa vào hàng chờ bếp."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="productCode"
          label="Sản Phẩm Cần Làm Thêm"
          rules={[{ required: true, message: 'Chọn sản phẩm!' }]}
        >
          <Select placeholder="Chọn sản phẩm...">
            {PRODUCTS.map((p) => (
              <Select.Option key={p.code} value={p.code}>
                {p.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="quantityNeeded"
          label="Số Lượng Cần Làm Thêm"
          rules={[{ required: true, message: 'Nhập số lượng!' }]}
        >
          <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="cái" />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Lý Do Phát Sinh"
          rules={[{ required: true, message: 'Mô tả lý do!' }, { min: 10 }]}
        >
          <TextArea rows={3} placeholder="VD: Cửa hàng báo hết hàng từ 9:00 sáng, có 5 khách đặt thêm..." maxLength={300} showCount />
        </Form.Item>
        <Form.Item name="note" label="Ghi Chú Thêm">
          <TextArea rows={2} placeholder="(Tùy chọn)" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Main Section Component ───────────────────────────────────────────────────

interface UrgentProductionSectionProps {
  /** orderId liên kết (tùy chọn) */
  orderId?: string;
}

const UrgentProductionSection: React.FC<UrgentProductionSectionProps> = ({ orderId: _orderId }) => {
  const queryClient = useQueryClient();

  // Quyền: nút DUYỆT SẢN XUẤT GẤP chỉ hiện khi BEP_TRUONG + approve:true
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const canOnScreen     = useAuthStore((s) => s.canOnScreen);
  const isAdmin         = useAuthStore((s) => s.isAdmin);

  // QUAN TRỌNG: Nút này dành riêng cho BEP_TRUONG — Admin KHÔNG thấy theo tài liệu
  const isBepTruong   = isWarehouseRole('BEP_TRUONG');
  const canApprove    = canOnScreen('PRODUCTION', 'approve');
  const canCreate     = canOnScreen('PRODUCTION', 'create') || isBepTruong;
  // Nút DUYỆT GẤP: chỉ BEP_TRUONG có quyền approve — ẩn với Admin và user khác
  const showUrgentBtn = isBepTruong && canApprove && !isAdmin();

  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['urgent-production'],
    queryFn: async (): Promise<UrgentProduction[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const list: UrgentProduction[] = Array.isArray(data) ? data : dummyUrgents;

  const createMutation = useMutation({
    mutationFn: async (_req: UrgentProductionRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('⚡ Lệnh sản xuất gấp đã được tạo và duyệt. Bếp đang chạy lệnh!');
      queryClient.invalidateQueries({ queryKey: ['urgent-production'] });
      setModalOpen(false);
    },
    onError: () => message.warning('API chưa sẵn sàng — lệnh gấp đã được ghi nhận (demo).'),
  });

  const columns: ColumnsType<UrgentProduction> = [
    {
      title: 'Mã Lệnh',
      dataIndex: 'urgentCode',
      key: 'code',
      width: 180,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'product',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantityNeeded',
      key: 'qty',
      width: 90,
      align: 'center',
      render: (v: number) => (
        <Tag color="orange" style={{ fontWeight: 700, fontSize: 14 }}>
          +{v}
        </Tag>
      ),
    },
    {
      title: 'Lý Do',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (v: string) => {
        const cfg = STATUS_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (v: string) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{dayjs(v).format('HH:mm')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM/YYYY')}</Text>
        </Space>
      ),
    },
  ];

  // Nếu không phải BEP_TRUONG thì không render section này
  if (!isBepTruong && !canCreate) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <Divider />
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            Lệnh Sản Xuất Gấp
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Dành cho ca sản xuất phát sinh trong ngày — hết hàng sớm, cần bổ sung gấp
          </Text>
        </Space>

        {/* Nút DUYỆT SẢN XUẤT GẤP — CHỈ BEP_TRUONG có approve:true */}
        {showUrgentBtn ? (
          <Button
            type="primary"
            danger
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={() => setModalOpen(true)}
            style={{ fontWeight: 700 }}
          >
            DUYỆT SẢN XUẤT GẤP
          </Button>
        ) : isBepTruong ? (
          <Button
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            Tạo Lệnh Phát Sinh
          </Button>
        ) : null}
      </div>

      {/* Thông tin về lệnh đang chạy */}
      {list.some((u) => u.status === 'APPROVED') && (
        <Alert
          type="warning"
          showIcon
          icon={<ClockCircleOutlined />}
          message={`Có ${list.filter((u) => u.status === 'APPROVED').length} lệnh sản xuất gấp đang chạy. Kiểm tra tiến độ bếp.`}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table<UrgentProduction>
        columns={columns}
        dataSource={list}
        rowKey="urgentId"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 5, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} lệnh` }}
        locale={{ emptyText: <Text type="secondary">Chưa có lệnh sản xuất gấp nào hôm nay.</Text> }}
      />

      {/* Ghi chú về quyền hạn */}
      {!showUrgentBtn && isBepTruong && (
        <Alert
          type="info"
          showIcon
          icon={<CheckCircleOutlined />}
          message={
            <Text style={{ fontSize: 12 }}>
              Bạn cần được cấu hình quyền <Text code>approve: true</Text> cho màn hình{' '}
              <Text code>PRODUCTION</Text> để sử dụng nút DUYỆT SẢN XUẤT GẤP.
            </Text>
          }
          style={{ marginTop: 8 }}
        />
      )}

      <CreateUrgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(req) => createMutation.mutate(req)}
        submitting={createMutation.isPending}
      />
    </div>
  );
};

export default UrgentProductionSection;
