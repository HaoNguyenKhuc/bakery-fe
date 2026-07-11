import React from 'react';
import { Modal, Table, Typography, Alert, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GoodsTransferSlip, GoodsTransferLine } from '../../../../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  slip: GoodsTransferSlip | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const lineColumns: ColumnsType<GoodsTransferLine> = [
  {
    title: 'Nguyên Liệu',
    dataIndex: 'ingredientName',
    key: 'ingredientName',
    render: (v: string, r: GoodsTransferLine) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ fontSize: 13 }}>{v}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{r.ingredientCode}</Text>
      </Space>
    ),
  },
  {
    title: 'Số Lượng',
    key: 'quantity',
    width: 120,
    align: 'right',
    render: (_: unknown, r: GoodsTransferLine) => (
      <Text strong style={{ fontSize: 15, color: '#1890ff' }}>
        {r.quantity.toLocaleString('vi-VN')} <Text type="secondary" style={{ fontSize: 12 }}>{r.unit}</Text>
      </Text>
    ),
  },
];

const WAREHOUSE_LABEL: Record<string, string> = {
  MAIN:    'Kho Tổng',
  KITCHEN: 'Kho Bếp',
  STORE:   'Cửa Hàng',
};

const ReadyConfirmModal: React.FC<Props> = ({ open, slip, onConfirm, onCancel, loading }) => {
  if (!slip) return null;

  return (
    <Modal
      open={open}
      title={
        <span style={{ color: '#52c41a' }}>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          Xác Nhận Chuẩn Bị Hàng Xong
        </span>
      }
      okText="✓ Chuẩn Bị Xong — Gửi sang Kho Bếp"
      cancelText="Hủy"
      okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' }, loading }}
      onOk={onConfirm}
      onCancel={onCancel}
      destroyOnClose
      width={520}
    >
      <Alert
        type="info"
        showIcon
        message={`Phiếu ${slip.slipCode} sẽ chuyển sang trạng thái READY và gửi thông báo đến ${WAREHOUSE_LABEL[slip.toWarehouse] ?? slip.toWarehouse}.`}
        style={{ marginBottom: 16 }}
      />
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Danh sách nguyên liệu sẽ được giao:
      </Text>
      <Table<GoodsTransferLine>
        columns={lineColumns}
        dataSource={slip.lines}
        rowKey="ingredientCode"
        size="small"
        pagination={false}
        scroll={{ y: 240 }}
      />
    </Modal>
  );
};

export default ReadyConfirmModal;
