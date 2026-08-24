import React from 'react';
import { Modal, Table, Tag, Spin, Alert, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import recipeService from '../../../api/services/recipeService';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface UsageRow {
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  recipeVersion: number;
  quantity: number;
  unit: string;
}

interface ItemUsageModalProps {
  open: boolean;
  itemId: string | null;
  itemName: string;
  onClose: () => void;
}

const PRODUCT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  PRODUCT:      { label: 'Sản phẩm',       color: 'blue' },
  SEMI_PRODUCT: { label: 'Bán thành phẩm', color: 'purple' },
};

const columns: ColumnsType<UsageRow> = [
  {
    title: 'Loại',
    dataIndex: 'productType',
    width: 140,
    render: (v: string) => {
      const cfg = PRODUCT_TYPE_CONFIG[v] ?? { label: v, color: 'default' };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: 'Mã',
    dataIndex: 'productCode',
    width: 140,
    render: (v: string) => <Text code>{v}</Text>,
  },
  {
    title: 'Tên sản phẩm / BTP',
    dataIndex: 'productName',
    render: (v: string) => <Text strong>{v}</Text>,
  },
  {
    title: 'Phiên bản CT',
    dataIndex: 'recipeVersion',
    width: 110,
    align: 'center',
    render: (v: number) => (
      <Tag color="green" style={{ fontFamily: 'monospace' }}>v{v}</Tag>
    ),
  },
  {
    title: 'Số lượng dùng',
    key: 'qty',
    width: 150,
    align: 'right',
    render: (_: unknown, r: UsageRow) => (
      <Text>
        <strong>{Number(r.quantity).toLocaleString('vi-VN')}</strong>{' '}
        <Text type="secondary">{r.unit}</Text>
      </Text>
    ),
  },
];

export const ItemUsageModal: React.FC<ItemUsageModalProps> = ({
  open,
  itemId,
  itemName,
  onClose,
}) => {
  const { data = [], isLoading, isError } = useQuery<UsageRow[]>({
    queryKey: ['item-usage', itemId],
    queryFn: () => recipeService.getUsageByItem(itemId!),
    enabled: open && !!itemId,
    staleTime: 30_000,
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={740}
      destroyOnClose
      title={
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            🔍 Được sử dụng trong công thức
          </div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
            {itemName}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
          <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Đang tải...</div>
        </div>
      ) : isError ? (
        <Alert type="error" showIcon message="Không thể tải danh sách sử dụng" />
      ) : data.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Không có công thức active nào đang dùng nguyên liệu / BTP này."
          style={{ margin: '8px 0' }}
        />
      ) : (
        <>
          <div style={{ marginBottom: 12, color: '#64748b', fontSize: 13 }}>
            Tìm thấy <strong>{data.length}</strong> công thức active đang sử dụng:
          </div>
          <Table<UsageRow>
            dataSource={data}
            columns={columns}
            rowKey="productId"
            pagination={false}
            size="middle"
            bordered
          />
        </>
      )}
    </Modal>
  );
};

export default ItemUsageModal;
