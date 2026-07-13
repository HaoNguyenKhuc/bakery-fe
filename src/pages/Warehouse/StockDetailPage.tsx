import React from 'react';
import { Table, Typography, Card, Button, Divider, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { inventoryService } from '../../api/services';
import type { StockLotDetail } from '../../types';

const { Text, Title } = Typography;

const StockDetailPage: React.FC = () => {
  const { warehouseCode, itemCode } = useParams<{ warehouseCode: string; itemCode: string }>();
  const navigate = useNavigate();

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['stock-lots-detail', itemCode, warehouseCode],
    queryFn: () => inventoryService.getStockLotsByItem(itemCode!, warehouseCode!),
    enabled: !!itemCode && !!warehouseCode,
  });

  const columns: ColumnsType<StockLotDetail> = [
    {
      title: 'Mã Sản Phẩm',
      dataIndex: ['item', 'key'],
      key: 'itemKey',
      width: 150,
    },
    {
      title: 'Nhà Cung Cấp',
      key: 'supplier',
      render: (_, record) => record.supplier?.name || '---',
      width: 150,
    },
    {
      title: 'SL Ban Đầu',
      dataIndex: 'qtyInitial',
      key: 'qtyInitial',
      align: 'right',
      width: 120,
    },
    {
      title: 'SL Tồn Kho',
      dataIndex: 'qtyRemaining',
      key: 'qtyRemaining',
      align: 'right',
      width: 120,
      render: (val) => <Text strong>{val}</Text>,
    },
    {
      title: 'Đơn Giá',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      width: 130,
      render: (val: number) =>
        val != null ? val.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '---',
    },
    {
      title: 'Ngày Nhập',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      width: 130,
      render: (val) => (val ? dayjs(val).format('DD/MM/YYYY') : '---'),
    },
    {
      title: 'Hạn Sử Dụng',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 130,
      render: (val) => (val ? dayjs(val).format('DD/MM/YYYY') : '---'),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <Title level={3} style={{ margin: 0 }}>
            Chi tiết lô hàng: {itemCode}
          </Title>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={detailData?.content || []}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
          }}
          bordered
          locale={{ emptyText: 'Chưa có thông tin lô hàng.' }}
        />
      </Card>
    </div>
  );
};

export default StockDetailPage;