import React from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Typography,
  Badge,
  Spin,
  Alert,
  Tooltip,
  Progress,
} from 'antd';
import {
  ShoppingOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Column, Pie } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { dashboardService, kitchenService } from '../../api/services';
import type { ExpiringLot } from '../../types';

const { Title, Text } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatVND = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

const today = dayjs().format('YYYY-MM-DD');

// ─── Static Dummy Data (kept for charts until backend aggregated data is ready) ─

const revenueData = [
  { month: 'Tháng 1', revenue: 18_500_000 },
  { month: 'Tháng 2', revenue: 21_200_000 },
  { month: 'Tháng 3', revenue: 19_800_000 },
  { month: 'Tháng 4', revenue: 23_400_000 },
  { month: 'Tháng 5', revenue: 22_100_000 },
  { month: 'Tháng 6', revenue: 25_600_000 },
];

const categoryData = [
  { type: 'Bánh Mì', value: 35 },
  { type: 'Bánh Ngọt', value: 25 },
  { type: 'Bánh Kem', value: 20 },
  { type: 'Bánh Quy', value: 12 },
  { type: 'Khác', value: 8 },
];

interface TopProduct {
  key: number;
  stt: number;
  name: string;
  quantitySold: number;
  revenue: number;
}

const topProducts: TopProduct[] = [
  { key: 1, stt: 1, name: 'Bánh Mì Việt Nam', quantitySold: 320, revenue: 4_800_000 },
  { key: 2, stt: 2, name: 'Bánh Croissant Bơ', quantitySold: 245, revenue: 6_125_000 },
  { key: 3, stt: 3, name: 'Bánh Kem Socola', quantitySold: 180, revenue: 5_400_000 },
  { key: 4, stt: 4, name: 'Bánh Quy Bơ', quantitySold: 156, revenue: 2_340_000 },
  { key: 5, stt: 5, name: 'Bánh Tiramisu', quantitySold: 132, revenue: 4_620_000 },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  height: '100%',
};

const statCardStyle = (color: string): React.CSSProperties => ({
  ...cardStyle,
  borderTop: `3px solid ${color}`,
});

const iconBoxStyle = (bg: string): React.CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: bg,
  fontSize: 22,
  color: '#fff',
  flexShrink: 0,
});

// ─── Chart configs ────────────────────────────────────────────────────────────

const columnConfig = {
  data: revenueData,
  xField: 'month',
  yField: 'revenue',
  color: '#D2691E',
  columnStyle: { radius: [6, 6, 0, 0] },
  label: {
    position: 'top' as const,
    formatter: (datum: { revenue?: number }) =>
      datum.revenue ? `${(datum.revenue / 1_000_000).toFixed(1)}tr` : '',
    style: { fontSize: 11, fill: '#666' },
  },
  yAxis: {
    label: {
      formatter: (v: string) => `${(Number(v) / 1_000_000).toFixed(0)}tr`,
    },
  },
  xAxis: { label: { style: { fontSize: 12 } } },
  meta: { revenue: { alias: 'Doanh thu (VNĐ)' } },
  tooltip: {
    formatter: (datum: { month?: string; revenue?: number }) => ({
      name: 'Doanh thu',
      value: datum.revenue ? formatVND(datum.revenue) : '0',
    }),
  },
};

const pieConfig = {
  data: categoryData,
  angleField: 'value',
  colorField: 'type',
  radius: 0.85,
  innerRadius: 0.55,
  color: ['#D2691E', '#F4A460', '#1890ff', '#52c41a', '#bfbfbf'],
  label: {
    type: 'outer' as const,
    content: '{name} {percentage}',
    style: { fontSize: 12 },
  },
  legend: { position: 'bottom' as const },
  interactions: [{ type: 'element-active' }],
  statistic: {
    title: {
      content: 'Tổng',
      style: { fontSize: '14px', color: '#999' },
    },
    content: {
      content: '48',
      style: { fontSize: '24px', fontWeight: 700, color: '#333' },
    },
  },
};

// ─── Top Products Table ────────────────────────────────────────────────────────

const topProductColumns: ColumnsType<TopProduct> = [
  {
    title: 'STT',
    dataIndex: 'stt',
    key: 'stt',
    width: 60,
    align: 'center',
  },
  {
    title: 'Tên Sản Phẩm',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Số Lượng Bán',
    dataIndex: 'quantitySold',
    key: 'quantitySold',
    align: 'right',
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'Doanh Thu',
    dataIndex: 'revenue',
    key: 'revenue',
    align: 'right',
    render: (v: number) => formatVND(v),
  },
];

// ─── Expiring Lots Table (Live) ────────────────────────────────────────────────

const expiringLotColumns: ColumnsType<ExpiringLot> = [
  {
    title: 'Mã Lô',
    dataIndex: 'lotNumber',
    key: 'lotNumber',
    width: 180,
    render: (v: string) => <Text code>{v}</Text>,
  },
  {
    title: 'Sản Phẩm',
    dataIndex: 'productName',
    key: 'productName',
  },
  {
    title: 'Còn Lại',
    dataIndex: 'qtyRemaining',
    key: 'qtyRemaining',
    align: 'right',
    width: 90,
  },
  {
    title: 'Hết Hạn',
    dataIndex: 'expiryDate',
    key: 'expiryDate',
    width: 110,
    render: (v: string, record: ExpiringLot) => (
      <Tag color={record.isExpiredToday ? 'error' : 'warning'}>
        {dayjs(v).format('DD/MM/YYYY')}
      </Tag>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  // ── Live API Queries ────────────────────────────────────────────────────────

  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
  } = useQuery({
    queryKey: ['health'],
    queryFn: () => dashboardService.getHealth(),
    refetchInterval: 30_000, // poll every 30s
    retry: 1,
  });

  const {
    data: batchResult,
    isLoading: batchLoading,
  } = useQuery({
    queryKey: ['batch-result', today],
    queryFn: () => dashboardService.getBatchResult(today),
    retry: 1,
  });

  const {
    data: expiringLots,
    isLoading: expiringLoading,
  } = useQuery({
    queryKey: ['expiring-lots'],
    queryFn: () => kitchenService.getExpiringLots(1),
    retry: 1,
  });

  // ── Server Status Badge ────────────────────────────────────────────────────

  const serverStatusBadge = () => {
    if (healthLoading) return <Spin size="small" />;
    if (healthError || !health) {
      return (
        <Tooltip title="Không thể kết nối máy chủ">
          <Tag icon={<CloseCircleOutlined />} color="error">
            Server DOWN
          </Tag>
        </Tooltip>
      );
    }
    return (
      <Tag icon={<CheckCircleOutlined />} color="success">
        Server {(health as { status: string }).status}
      </Tag>
    );
  };

  // ── Batch Result Cards ─────────────────────────────────────────────────────

  const batchData = batchResult as {
    totalProducts?: number;
    okCount?: number;
    overCount?: number;
    underCount?: number;
    discrepancyCount?: number;
  } | undefined;

  const okRate = batchData
    ? Math.round(((batchData.okCount ?? 0) / Math.max(batchData.totalProducts ?? 1, 1)) * 100)
    : 0;

  return (
    <div style={{ padding: 0 }}>
      {/* ── Row 0: Server Status Banner ──────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary">Trạng thái hệ thống:</Text>
        {serverStatusBadge()}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cập nhật: {dayjs().format('HH:mm:ss DD/MM/YYYY')}
        </Text>
      </div>

      {/* ── Row 1: Statistic Cards ────────────────────────────────────────── */}
      <Row gutter={[20, 20]}>
        {/* Tổng Sản Phẩm */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={statCardStyle('#D2691E')} styles={{ body: { padding: '20px 24px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#D2691E')}>
                <ShoppingOutlined />
              </div>
              <Statistic
                title={<span style={{ fontSize: 13, color: '#8c8c8c' }}>Tổng Sản Phẩm</span>}
                value={48}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#262626' }}
              />
            </div>
          </Card>
        </Col>

        {/* Tổng Đơn Hàng */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={statCardStyle('#52c41a')} styles={{ body: { padding: '20px 24px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#52c41a')}>
                <ShoppingCartOutlined />
              </div>
              <Statistic
                title={<span style={{ fontSize: 13, color: '#8c8c8c' }}>Tổng Đơn Hàng</span>}
                value={156}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#262626' }}
                suffix={
                  <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 500 }}>
                    <ArrowUpOutlined /> 12%
                  </span>
                }
              />
            </div>
          </Card>
        </Col>

        {/* Doanh Thu */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={statCardStyle('#1890ff')} styles={{ body: { padding: '20px 24px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#1890ff')}>
                <DollarOutlined />
              </div>
              <Statistic
                title={<span style={{ fontSize: 13, color: '#8c8c8c' }}>Doanh Thu</span>}
                value={25_600_000}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#262626' }}
                formatter={(value) => formatVND(value as number)}
              />
            </div>
          </Card>
        </Col>

        {/* Lô Sắp Hết Hạn (LIVE) */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={statCardStyle('#ff4d4f')} styles={{ body: { padding: '20px 24px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#ff4d4f')}>
                <WarningOutlined />
              </div>
              {expiringLoading ? (
                <Spin size="small" />
              ) : (
                <Statistic
                  title={
                    <span style={{ fontSize: 13, color: '#8c8c8c' }}>Lô Bánh Sắp Hết Hạn</span>
                  }
                  value={Array.isArray(expiringLots) ? expiringLots.length : 0}
                  valueStyle={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: (Array.isArray(expiringLots) && expiringLots.length > 0) ? '#ff4d4f' : '#262626',
                  }}
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Row 1.5: Batch Reconciliation Summary (LIVE) ─────────────────── */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24}>
          <Card
            title={
              <span>
                📋 Kết Quả Đối Chiếu Hôm Nay{' '}
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                  ({dayjs().format('DD/MM/YYYY')})
                </Text>
              </span>
            }
            style={cardStyle}
            loading={batchLoading}
            extra={
              batchData ? (
                <Badge
                  status={batchData.discrepancyCount === 0 ? 'success' : 'warning'}
                  text={batchData.discrepancyCount === 0 ? 'Khớp hoàn toàn' : 'Có chênh lệch'}
                />
              ) : null
            }
          >
            {!batchData ? (
              <Alert
                type="info"
                message="Chưa có dữ liệu đối chiếu cho hôm nay."
                description="Upload file POS, báo cáo ngày và bếp xuất trong module Kho Bánh để bắt đầu đối chiếu."
                icon={<ExclamationCircleOutlined />}
                showIcon
              />
            ) : (
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Tổng Sản Phẩm"
                    value={batchData.totalProducts ?? 0}
                    valueStyle={{ color: '#262626' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Khớp ✅"
                    value={batchData.okCount ?? 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Thừa ⬆️"
                    value={batchData.overCount ?? 0}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Thiếu ⬇️"
                    value={batchData.underCount ?? 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col xs={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Tỷ lệ khớp:
                  </Text>
                  <Progress
                    percent={okRate}
                    strokeColor={okRate >= 90 ? '#52c41a' : okRate >= 70 ? '#fa8c16' : '#ff4d4f'}
                    style={{ marginTop: 4 }}
                  />
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 2: Charts ────────────────────────────────────────────────── */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* Column Chart */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                📊 Doanh Thu Theo Tháng
              </Title>
            }
            style={cardStyle}
            styles={{ body: { padding: '16px 24px 24px' } }}
          >
            <Column {...columnConfig} height={320} />
          </Card>
        </Col>

        {/* Pie Chart */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                🍩 Phân Loại Sản Phẩm
              </Title>
            }
            style={cardStyle}
            styles={{ body: { padding: '16px 24px 24px' } }}
          >
            <Pie {...pieConfig} height={320} />
          </Card>
        </Col>
      </Row>

      {/* ── Row 3: Table + Expiring Lots (LIVE) ─────────────────────────── */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* Best-selling Products */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                🏆 Sản Phẩm Bán Chạy
              </Title>
            }
            style={cardStyle}
            styles={{ body: { padding: '8px 0 0' } }}
          >
            <Table<TopProduct>
              columns={topProductColumns}
              dataSource={topProducts}
              pagination={false}
              size="middle"
              rowKey="key"
            />
          </Card>
        </Col>

        {/* Expiring Lots (LIVE from /phase3/lots/expiring?days=1) */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                ⏰ Bánh Sắp Hết Hạn Hôm Nay
              </Title>
            }
            style={cardStyle}
            loading={expiringLoading}
            extra={
              Array.isArray(expiringLots) && expiringLots.length > 0 ? (
                <Tag color="error">{expiringLots.length} lô</Tag>
              ) : null
            }
          >
            {!Array.isArray(expiringLots) || expiringLots.length === 0 ? (
              <Alert
                type="success"
                message="Không có lô bánh nào sắp hết hạn hôm nay."
                showIcon
              />
            ) : (
              <Table<ExpiringLot>
                columns={expiringLotColumns}
                dataSource={expiringLots}
                pagination={false}
                size="small"
                rowKey="lotNumber"
                rowClassName={(record) =>
                  record.isExpiredToday ? 'table-row-expired' : ''
                }
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
