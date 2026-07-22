import React from 'react';
import { Table, Typography, Empty } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../../../api/services';
import type { Warehouse } from '../../../api/services/warehouseService';
import type { StockLotSummary } from '../../../types';
import type { ColumnsType } from 'antd/es/table';
import { Button } from 'antd';

const { Text } = Typography;

interface Props {
  warehouse: Warehouse | undefined;
}

const WarehouseSummaryTab: React.FC<Props> = ({ warehouse }) => {
  const navigate = useNavigate();
  const warehouseId = warehouse?.id;
  const warehouseCode = warehouse?.code;

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse', 'summary', 'stock-summary', warehouseId],
    queryFn: () => inventoryService.getStockSummary(warehouseCode!),
    enabled: !!warehouseCode,
    staleTime: 30_000,
  });

  const stockLots: StockLotSummary[] = stockData ?? [];

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
      width: 60,
      align: 'center',
      render: (_, r) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/warehouse/stock/${warehouseCode || 'MAIN'}/${r.item.key}`)}
        />
      ),
    },
  ];

  if (!warehouse) return <Empty description="Không tìm thấy kho" />;

  return (
    <div>
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
    </div>
  );
};

export default WarehouseSummaryTab;
