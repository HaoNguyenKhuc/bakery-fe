import React from 'react';
import { Descriptions, Tag, Table, Typography, Space, Divider, Badge, Button, Card, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import type { GoodsTransferSlip, GoodsTransferLine } from '../../../types';

const { Text, Title } = Typography;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING:   { color: 'orange',  label: '⏳ Chờ chuẩn bị' },
  READY:     { color: 'blue',    label: '📦 Sẵn sàng giao' },
  COMPLETED: { color: 'green',   label: '✅ Hoàn thành' },
  REJECTED:  { color: 'red',     label: '❌ Bị từ chối' },
};

const WAREHOUSE_LABEL: Record<string, string> = {
  MAIN:    'Kho Tổng',
  KITCHEN: 'Kho Bếp',
  STORE:   'Cửa Hàng',
};

const lineColumns: ColumnsType<GoodsTransferLine> = [
  {
    title: 'Mã NL',
    dataIndex: 'ingredientCode',
    key: 'ingredientCode',
    width: 100,
    render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
  },
  {
    title: 'Tên Nguyên Liệu',
    dataIndex: 'ingredientName',
    key: 'ingredientName',
  },
  {
    title: 'Số Lượng',
    key: 'quantity',
    width: 120,
    align: 'right',
    render: (_: unknown, r: GoodsTransferLine) => (
      <Text strong>{r.quantity.toLocaleString('vi-VN')} <Text type="secondary">{r.unit}</Text></Text>
    ),
  },
  {
    title: 'Ghi Chú',
    dataIndex: 'note',
    key: 'note',
    render: (v: string) => v ? <Text type="secondary">{v}</Text> : '—',
  },
];

// Dummy data for GoodsTransferSlip
const dummySlip: GoodsTransferSlip = {
  slipId: 'ts-001',
  slipCode: 'TR-20260706-001',
  fromWarehouse: 'MAIN',
  toWarehouse: 'KITCHEN',
  status: 'PENDING',
  createdBy: 'nguyen.kho',
  createdAt: '2026-07-06T08:00:00Z',
  lines: [
    { ingredientCode: 'NL001', ingredientName: 'Bột Mì Đa Dụng', quantity: 50, unit: 'KG' },
    { ingredientCode: 'NL002', ingredientName: 'Đường Tinh Luyện', quantity: 20, unit: 'KG' },
  ]
};

const SlipDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Mock fetch
  const { data: slip, isLoading } = useQuery({
    queryKey: ['transfer-slip', id],
    queryFn: async () => {
      return new Promise<GoodsTransferSlip>((resolve) => {
        setTimeout(() => resolve({ ...dummySlip, slipId: id!, slipCode: `TR-${id}` }), 400);
      });
    },
    enabled: !!id,
  });

  if (isLoading) return <Card loading={true} style={{ minHeight: '60vh' }} />;
  if (!slip) return <Empty description="Không tìm thấy phiếu" />;

  const cfg = STATUS_CONFIG[slip.status] ?? { color: 'default', label: slip.status };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warehouse/goods-transfer')}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <Title level={3} style={{ margin: 0 }}>Chi Tiết Phiếu</Title>
          <Text code style={{ fontSize: 16 }}>{slip.slipCode}</Text>
          <Badge color={cfg.color} text={<Text style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</Text>} />
        </Space>
        
        <Button 
          type="primary" 
          icon={<PrinterOutlined />}
          onClick={() => navigate(`/warehouse/goods-transfer/print/${slip.slipId}`)}
        >
          In Phiếu
        </Button>
      </div>

      <Card>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Mã Phiếu" span={2}>
            <Text code>{slip.slipCode}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Từ Kho">
            <Tag color="purple">{WAREHOUSE_LABEL[slip.fromWarehouse] ?? slip.fromWarehouse}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Đến Kho">
            <Tag color="cyan">{WAREHOUSE_LABEL[slip.toWarehouse] ?? slip.toWarehouse}
              {slip.toBranchCode && <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({slip.toBranchCode})</span>}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Người Tạo">{slip.createdBy}</Descriptions.Item>
          <Descriptions.Item label="Ngày Tạo">{dayjs(slip.createdAt).format('HH:mm DD/MM/YYYY')}</Descriptions.Item>

          {slip.readyBy && (
            <>
              <Descriptions.Item label="Chuẩn Bị Xong Bởi">{slip.readyBy}</Descriptions.Item>
              <Descriptions.Item label="Lúc">{slip.readyAt ? dayjs(slip.readyAt).format('HH:mm DD/MM/YYYY') : '—'}</Descriptions.Item>
            </>
          )}
          {slip.completedBy && (
            <>
              <Descriptions.Item label="Xác Nhận Bởi">{slip.completedBy}</Descriptions.Item>
              <Descriptions.Item label="Lúc">{slip.completedAt ? dayjs(slip.completedAt).format('HH:mm DD/MM/YYYY') : '—'}</Descriptions.Item>
            </>
          )}

          {slip.reason && (
            <Descriptions.Item label="Lý Do Từ Chối / Ghi Chú" span={2}>
              <Text type="danger">{slip.reason}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider style={{ margin: '16px 0' }}>Danh Sách Nguyên Liệu</Divider>

        <Table
          dataSource={slip.lines}
          columns={lineColumns}
          rowKey={(r) => r.ingredientCode}
          pagination={false}
          size="small"
          bordered
        />
      </Card>
    </div>
  );
};

export default SlipDetailPage;