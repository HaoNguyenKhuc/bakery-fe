import React from 'react';
import { Tabs, Typography, Divider, Empty } from 'antd';
import { useWarehouseStore } from '../../../store';
import WarehouseSummaryTab from '../components/WarehouseSummaryTab';

const { Title, Text } = Typography;

const MainWarehouse: React.FC = () => {
  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep = useWarehouseStore((s) => s.getKhoBep);
  const getStores = useWarehouseStore((s) => s.getStores);

  const khoTong = getKhoTong();
  const khoBeps = getKhoBep();
  const stores = getStores();

  const activeKitchen = khoBeps.length > 0 ? khoBeps[0] : undefined;
  const activeStore = stores.length > 0 ? stores[0] : undefined;

  const tabItems = [
    {
      key: 'kho-chinh',
      label: 'Kho Chính',
      children: <WarehouseSummaryTab warehouse={khoTong} />
    },
    {
      key: 'kho-bep',
      label: 'Kho Bếp',
      children: activeKitchen ? <WarehouseSummaryTab warehouse={activeKitchen} /> : <Empty description="Chưa có kho bếp nào" />
    },
    {
      key: 'cua-hang',
      label: 'Cửa hàng',
      children: activeStore ? <WarehouseSummaryTab warehouse={activeStore} /> : <Empty description="Chưa có cửa hàng nào" />
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Tổng Quan Kho
        </Title>
        <Text type="secondary">
          Quản lý nhập xuất, phê duyệt và tồn kho cho các khu vực
        </Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="kho-chinh" items={tabItems} size="large" />
    </div>
  );
};

export default MainWarehouse;
