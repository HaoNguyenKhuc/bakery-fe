import React from 'react';
import { Typography } from 'antd';
import POSSales from './POSSales';

const { Title } = Typography;

/**
 * /reports — Tổng hợp: hiện chỉ còn tab Doanh số POS.
 * - Báo Cáo Ngày (NV): /reports/daily
 * - Báo Cáo Admin:     /reports/admin
 */
const ReportsPage: React.FC = () => (
  <div>
    <div style={{ marginBottom: 16 }}>
      <Title level={3} style={{ margin: 0 }}>📁 Doanh Số POS</Title>
    </div>
    <POSSales />
  </div>
);

export default ReportsPage;
