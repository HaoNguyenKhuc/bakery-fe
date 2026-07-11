import React from 'react';
import { Drawer, Descriptions, Tag, Table, Typography, Space, Divider, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { GoodsTransferSlip, GoodsTransferLine } from '../../../../types';

const { Text } = Typography;

interface Props {
  slip: GoodsTransferSlip | null;
  open: boolean;
  onClose: () => void;
}

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

const SlipDetailDrawer: React.FC<Props> = ({ slip, open, onClose }) => {
  if (!slip) return null;

  const cfg = STATUS_CONFIG[slip.status] ?? { color: 'default', label: slip.status };

  return (
    <Drawer
      title={
        <Space>
          <span>Chi Tiết Phiếu</span>
          <Text code style={{ fontSize: 14 }}>{slip.slipCode}</Text>
          <Badge color={cfg.color} text={<Text style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</Text>} />
        </Space>
      }
      open={open}
      onClose={onClose}
      width={600}
      destroyOnClose
    >
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
        {slip.rejectedReason && (
          <Descriptions.Item label="Lý Do Từ Chối" span={2}>
            <Text type="danger">{slip.rejectedReason}</Text>
          </Descriptions.Item>
        )}
        {slip.note && (
          <Descriptions.Item label="Ghi Chú" span={2}>
            <Text type="secondary">{slip.note}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider style={{ margin: '12px 0' }}>
        Danh Sách Nguyên Liệu
        <Badge count={slip.lines.length} style={{ backgroundColor: '#1890ff', marginLeft: 8 }} />
      </Divider>

      <Table<GoodsTransferLine>
        columns={lineColumns}
        dataSource={slip.lines}
        rowKey="ingredientCode"
        size="small"
        pagination={false}
        scroll={{ y: 300 }}
      />
    </Drawer>
  );
};

export default SlipDetailDrawer;
