import React from 'react';
import { Tabs, Typography, Divider, Empty } from 'antd';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWarehouseStore } from '../../../store';
import WarehouseSummaryTab from '../components/WarehouseSummaryTab';
import LowStockTab from '../components/LowStockTab';
import InventoryRequests from '../InventoryRequests';
import StoreDailyReport from '../StoreDailyReport';
import KitchenDelivery from '../../Production/KitchenDelivery';
import { Badge } from 'antd';
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/axiosClient';

const { Title, Text } = Typography;

const MainWarehouse: React.FC = () => {
  const { type = 'kho-chinh' } = useParams<{ type: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ton-kho';

  const { data: lowStockCount = 0 } = useQuery<number>({
    queryKey: ['low-stock-count-badge'],
    queryFn: async () => {
      try {
        const res = (await api.get('/api/v1/items/low-stock')) as any[];
        return Array.isArray(res) ? res.length : 0;
      } catch {
        return 0;
      }
    },
    staleTime: 30_000,
  });

  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep = useWarehouseStore((s) => s.getKhoBep);
  const getStores = useWarehouseStore((s) => s.getStores);

  const khoTong = getKhoTong();
  const khoBeps = getKhoBep();
  const stores = getStores();

  const activeKitchen = khoBeps.length > 0 ? khoBeps[0] : undefined;
  const activeStore = stores.length > 0 ? stores[0] : undefined;

  let headerTitle = '🏠 Kho Chính (MAIN / Tổng)';
  let headerDesc = 'Quản lý kiểm kê, nhập xuất và phiếu kho cho khu vực Kho Chính';
  let tabItems: any[] = [];

  const lowStockTabLabel = (
    <span>
      ⚠️ Hàng Cần Nhập
      {lowStockCount > 0 && (
        <Badge
          count={lowStockCount}
          overflowCount={99}
          style={{ backgroundColor: '#dc2626', marginLeft: 6 }}
        />
      )}
    </span>
  );

  if (type === 'kho-bep') {
    headerTitle = '🔥 Kho Bếp (KITCHEN)';
    headerDesc = 'Quản lý tồn kho, kiểm kê nguyên liệu và phiếu kho cho khu vực Bếp';
    tabItems = [
      {
        key: 'ton-kho',
        label: '📦 Tồn Kho',
        children: activeKitchen ? <WarehouseSummaryTab warehouse={activeKitchen} /> : <Empty description="Chưa có kho bếp nào" />,
      },
      {
        key: 'hang-can-nhap',
        label: lowStockTabLabel,
        children: <LowStockTab warehouse={activeKitchen} />,
      },
      {
        key: 'phieu-kho',
        label: '📋 Phiếu Kho',
        children: <InventoryRequests hideHeader warehouseFilter={activeKitchen} />,
      },
    ];
  } else if (type === 'cua-hang') {
    headerTitle = '🛍️ Cửa Hàng (STORE)';
    headerDesc = 'Quản lý tồn kho, phiếu kho và báo cáo ngày tại cửa hàng';
    tabItems = [
      {
        key: 'ton-kho',
        label: '📦 Tồn Kho',
        children: activeStore
          ? <WarehouseSummaryTab warehouse={activeStore} />
          : <Empty description="Chưa có cửa hàng nào" />,
      },
      {
        key: 'phieu-kho',
        label: '📋 Phiếu Kho',
        children: <InventoryRequests hideHeader warehouseFilter={activeStore} />,
      },
      {
        key: 'bao-cao-ngay',
        label: '📊 Báo Cáo Ngày',
        children: <StoreDailyReport />,
      },
      {
        key: 'giao-nhan',
        label: '🚚 Giao Nhận',
        children: <KitchenDelivery />,
      },
    ];
  } else {
    // Default: kho-chinh
    headerTitle = '🏠 Kho Chính (MAIN / Tổng)';
    headerDesc = 'Quản lý kiểm kê, nhập xuất và tồn kho cho khu vực Kho Chính';
    tabItems = [
      {
        key: 'ton-kho',
        label: '📦 Tồn Kho',
        children: <WarehouseSummaryTab warehouse={khoTong} />,
      },
      {
        key: 'hang-can-nhap',
        label: lowStockTabLabel,
        children: <LowStockTab warehouse={khoTong} />,
      },
      {
        key: 'phieu-kho',
        label: '📋 Phiếu Kho',
        children: <InventoryRequests hideHeader warehouseFilter={khoTong} />,
      },
    ];
  }

  const validKeys = tabItems.map((i) => i.key);
  const currentTab = validKeys.includes(activeTab) ? activeTab : 'ton-kho';

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          {headerTitle}
        </Title>
        <Text type="secondary">{headerDesc}</Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs
        activeKey={currentTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

export default MainWarehouse;
