import React from 'react';
import { Modal, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { inventoryService } from '../../../api/services';
import type { StockLotDetail } from '../../../types';

const { Text } = Typography;

interface StockDetailModalProps {
  open: boolean;
  onClose: () => void;
  itemCode: string | null;
  itemName: string | null;
  warehouseCode: string;
}

const StockDetailModal: React.FC<StockDetailModalProps> = ({
  open,
  onClose,
  itemCode,
  itemName,
  warehouseCode,
}) => {
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['stock-lots-detail', itemCode, warehouseCode],
    queryFn: () => inventoryService.getStockLotsByItem(itemCode!, warehouseCode),
    enabled: !!itemCode && open,
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
    <Modal
      title={`Chi tiết lô hàng: ${itemName || '---'}`}
      open={open}
      onCancel={onClose}
      footer={null}
      wrapClassName="fullscreen-modal-wrap"
      destroyOnClose
    >
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={detailData?.content || []}
        loading={isLoading}
        pagination={{
          total: detailData?.totalElements || 0,
          current: (detailData?.page || 0) + 1,
          pageSize: detailData?.size || 20,
          showSizeChanger: false,
        }}
        scroll={{ y: 'calc(100vh - 250px)' }}
      />
    </Modal>
  );
};

export default StockDetailModal;
