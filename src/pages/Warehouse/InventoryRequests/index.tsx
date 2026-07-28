import React from 'react';
import { Typography, Divider } from 'antd';
import ListTab from './components/ListTab';

const { Title, Text } = Typography;

interface InventoryRequestsProps {
  hideHeader?: boolean;
  warehouseFilter?: { id?: string; code?: string; name?: string };
}

const InventoryRequests: React.FC<InventoryRequestsProps> = ({ hideHeader = false, warehouseFilter }) => {
  return (
    <div className="pp-page">
      {!hideHeader && (
        <>
          <div className="pp-header">
            <Title level={3} style={{ margin: 0 }}>Phiếu Kho</Title>
            <Text type="secondary">Quản lý và tạo mới các phiếu Nhập / Điều chuyển hàng hoá</Text>
          </div>
          <Divider style={{ margin: '0 0 20px' }} />
        </>
      )}
      <div className="pp-content">
        <ListTab warehouseFilter={warehouseFilter} />
      </div>
    </div>
  );
};

export default InventoryRequests;
