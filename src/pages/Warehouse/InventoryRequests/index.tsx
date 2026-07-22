import React from 'react';
import { Tabs, Typography, Divider } from 'antd';
import ListTab from './components/ListTab';
import CreateTab from './components/CreateTab';

const { Title, Text } = Typography;

const InventoryRequests: React.FC = () => {
  const tabItems = [
    {
      key: 'list',
      label: '📋 Danh sách',
      children: <ListTab />
    },
    {
      key: 'create',
      label: '➕ Tạo phiếu',
      children: <CreateTab />
    }
  ];

  return (
    <div className="pp-page">
      <div className="pp-header">
        <Title level={3} style={{ margin: 0 }}>Phiếu Kho</Title>
        <Text type="secondary">Quản lý và tạo mới các phiếu Nhập / Điều chuyển hàng hoá</Text>
      </div>
      <Divider style={{ margin: '0 0 20px' }} />
      <div className="pp-content">
        <Tabs defaultActiveKey="list" items={tabItems} size="large" />
      </div>
    </div>
  );
};

export default InventoryRequests;
