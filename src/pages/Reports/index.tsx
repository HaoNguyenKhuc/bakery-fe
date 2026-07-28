import React from 'react';
import { Tabs, Typography } from 'antd';
import { FileTextOutlined, DeleteOutlined, ShopOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import DailyReport from './DailyReport';
import HuyBanh from './HuyBanh';
import POSSales from './POSSales';

const { Title } = Typography;

const VALID_TABS = ['daily', 'huy-banh', 'pos-sales'] as const;
type TabKey = typeof VALID_TABS[number];

const tabItems = [
  {
    key: 'daily' as TabKey,
    label: (
      <span>
        <FileTextOutlined />
        {' '}Báo cáo Ngày
      </span>
    ),
    children: <DailyReport />,
  },
  {
    key: 'huy-banh' as TabKey,
    label: (
      <span>
        <DeleteOutlined />
        {' '}Hủy Bánh
      </span>
    ),
    children: <HuyBanh />,
  },
  {
    key: 'pos-sales' as TabKey,
    label: (
      <span>
        <ShopOutlined />
        {' '}Doanh số POS
      </span>
    ),
    children: <POSSales />,
  },
];

const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeKey: TabKey =
    rawTab && (VALID_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as TabKey)
      : 'daily';

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          📊 Báo Cáo
        </Title>
      </div>

      <Tabs
        activeKey={activeKey}
        onChange={handleTabChange}
        type="card"
        size="middle"
        destroyInactiveTabPane={false}
        items={tabItems}
        style={{ background: '#fff', borderRadius: 8, padding: '0 0 16px' }}
        tabBarStyle={{ marginBottom: 0, paddingLeft: 16, paddingRight: 16 }}
      />
    </div>
  );
};

export default ReportsPage;
