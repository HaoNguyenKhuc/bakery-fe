import React, { useState, useMemo } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Spin, Segmented, Radio,
  Button, Dropdown, Space, message, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, LinkOutlined, SendOutlined, SettingOutlined,
  BarChartOutlined, LineChartOutlined, PieChartOutlined, TableOutlined, AreaChartOutlined,
} from '@ant-design/icons';
import { Column, Bar, Pie, Line, Area } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import cancelRecordService from '../../api/services/cancelRecordService';
import posSaleService from '../../api/services/posSaleService';
import api from '../../api/axiosClient';

const { Title, Text } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

const fmtM = (v: number) => `${(v / 1_000_000).toFixed(1)}tr`;

const today = dayjs().format('YYYY-MM-DD');

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  height: '100%',
};

// ─── Dummy Data ────────────────────────────────────────────────────────────────

const TOP_SELL_MONTH = [
  { product: 'Bánh Mì Việt Nam', qty: 1820 },
  { product: 'Bánh Croissant Bơ', qty: 1540 },
  { product: 'Bánh Kem Socola', qty: 1210 },
  { product: 'Bánh Quy Bơ', qty: 980 },
  { product: 'Bánh Tiramisu', qty: 860 },
  { product: 'Bánh Flan', qty: 720 },
  { product: 'Bánh Su Kem', qty: 640 },
  { product: 'Bánh Mochi', qty: 580 },
];

const TOP_SELL_YEAR = [
  { product: 'Bánh Mì Việt Nam', qty: 21400 },
  { product: 'Bánh Croissant Bơ', qty: 18700 },
  { product: 'Bánh Kem Socola', qty: 15200 },
  { product: 'Bánh Quy Bơ', qty: 12400 },
  { product: 'Bánh Tiramisu', qty: 10800 },
  { product: 'Bánh Flan', qty: 9100 },
  { product: 'Bánh Su Kem', qty: 7800 },
  { product: 'Bánh Mochi', qty: 6900 },
];

const TOP_CANCEL_MONTH = [
  { type: 'Bánh Kem Socola', value: 38 },
  { type: 'Bánh Mì Việt Nam', value: 25 },
  { type: 'Bánh Flan', value: 18 },
  { type: 'Bánh Su Kem', value: 12 },
  { type: 'Khác', value: 7 },
];

const TOP_CANCEL_YEAR = [
  { type: 'Bánh Kem Socola', value: 420 },
  { type: 'Bánh Mì Việt Nam', value: 310 },
  { type: 'Bánh Flan', value: 220 },
  { type: 'Bánh Su Kem', value: 165 },
  { type: 'Khác', value: 85 },
];

const REVENUE_DAILY = Array.from({ length: 30 }, (_, i) => ({
  label: dayjs().subtract(29 - i, 'day').format('DD/MM'),
  revenue: Math.round((15 + Math.sin(i) * 8 + (i % 7 < 2 ? 5 : 0)) * 1_000_000),
}));

const REVENUE_MONTHLY = [
  { label: 'Tháng 1', revenue: 18_500_000 },
  { label: 'Tháng 2', revenue: 21_200_000 },
  { label: 'Tháng 3', revenue: 19_800_000 },
  { label: 'Tháng 4', revenue: 23_400_000 },
  { label: 'Tháng 5', revenue: 22_100_000 },
  { label: 'Tháng 6', revenue: 25_600_000 },
  { label: 'Tháng 7', revenue: 24_300_000 },
  { label: 'Tháng 8', revenue: 27_100_000 },
  { label: 'Tháng 9', revenue: 26_400_000 },
  { label: 'Tháng 10', revenue: 29_800_000 },
  { label: 'Tháng 11', revenue: 31_200_000 },
  { label: 'Tháng 12', revenue: 34_500_000 },
];

const DT_LN_DATA = REVENUE_MONTHLY.flatMap((d) => [
  { month: d.label, value: d.revenue, type: 'Doanh thu' },
  { month: d.label, value: Math.round(d.revenue * 0.31), type: 'Lợi nhuận' },
]);

// ─── Widget 1: Low Stock Table columns ────────────────────────────────────────

interface LowStockRow {
  itemId: string;
  code?: string;
  itemName: string;
  currentStock: number;
  minStockQuantity?: number;
  restockQuantity?: number;
  shortage?: number;
  unit?: string;
  unitCost?: number;
}

const lowStockColumns: ColumnsType<LowStockRow> = [
  {
    title: 'Tên Mặt Hàng',
    key: 'itemName',
    dataIndex: 'itemName',
    render: (v: string) => (
      <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>{v}</div>
    ),
  },
  {
    title: 'Tồn kho',
    dataIndex: 'currentStock',
    key: 'currentStock',
    width: 90,
    align: 'right',
    render: (v: number) => <Text style={{ fontWeight: 600 }}>{(v ?? 0).toLocaleString('vi-VN')}</Text>,
  },
  {
    title: 'Ngưỡng',
    dataIndex: 'minStockQuantity',
    key: 'minStockQuantity',
    width: 90,
    align: 'right',
    render: (v?: number) =>
      v != null ? v.toLocaleString('vi-VN') : <Text type="secondary">—</Text>,
  },
  {
    title: 'Mức nhập',
    dataIndex: 'restockQuantity',
    key: 'restockQuantity',
    width: 90,
    align: 'right',
    render: (v?: number) =>
      v != null
        ? <Text style={{ color: '#2563eb', fontWeight: 500 }}>{v.toLocaleString('vi-VN')}</Text>
        : <Text type="secondary">—</Text>,
  },
  {
    title: 'Trạng thái',
    key: 'status',
    width: 110,
    align: 'center',
    render: (_: unknown, r: LowStockRow) =>
      r.currentStock <= 0
        ? <Tag color="error">Hết hàng</Tag>
        : <Tag color="warning">Sắp hết</Tag>,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Widget 2 & 3 time period
  const [sellPeriod, setSellPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [cancelPeriod, setCancelPeriod] = useState<'day' | 'month' | 'year'>('month');
  // Widget 4 time period
  const [revenuePeriod, setRevenuePeriod] = useState<'day' | 'month'>('month');

  // Chart type states
  const [sellChartType, setSellChartType] = useState<'bar' | 'column' | 'pie' | 'table'>('bar');
  const [cancelChartType, setCancelChartType] = useState<'pie' | 'bar' | 'column' | 'table'>('pie');
  const [revenueChartType, setRevenueChartType] = useState<'column' | 'line' | 'area' | 'table'>('column');
  const [dtLnChartType, setDtLnChartType] = useState<'line' | 'column' | 'area' | 'table'>('line');

  // ── Widget 1: Low Stock (LIVE) ──────────────────────────────────────────────
  const { data: lowStockRaw = [], isLoading: lsLoading } = useQuery({
    queryKey: ['low-stock-dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/v1/items/low-stock') as any[];
      return Array.isArray(res) ? res : [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Action Nhập tất cả
  const handleCreateAllOrders = () => {
    if (!lowStockRaw.length) return;
    const lines = lowStockRaw.map((it: any) => {
      const qty =
        it.restockQuantity && it.restockQuantity > 0
          ? Math.max(1, +(it.restockQuantity - (it.currentStock ?? 0)))
          : Math.max(1, +(it.shortage > 0 ? it.shortage : (it.minStockQuantity || 1)));
      return {
        itemId: it.itemId,
        quantity: qty,
        unit: it.unit || '',
        unitCost: it.unitCost ?? undefined,
        note: `Tồn kho: ${it.currentStock ?? 0} | Ngưỡng: ${it.minStockQuantity ?? 0}`,
      };
    });

    message.success(`Đã chuẩn bị thông tin tạo phiếu nhập cho ${lowStockRaw.length} mặt hàng!`);
    navigate('/warehouse/kho-chinh/phieu-kho/create?requestType=PURCHASE&fromLowStock=all', {
      state: {
        requestType: 'PURCHASE',
        note: `Nhập tất cả hàng từ cảnh báo tồn kho (${lowStockRaw.length} mặt hàng)`,
        lines,
      },
    });
  };

  // ── Widget 2: Top Bán Chạy ────────────────────────────────────────────────
  const { data: posSaleData = [], isLoading: posLoading } = useQuery({
    queryKey: ['pos-sale-today', today],
    queryFn: () => posSaleService.getBySaleDate(today),
    staleTime: 60_000,
    retry: 1,
    enabled: sellPeriod === 'day',
  });

  const topSellData = useMemo(() => {
    if (sellPeriod === 'month') return TOP_SELL_MONTH;
    if (sellPeriod === 'year') return TOP_SELL_YEAR;
    const posArr = Array.isArray(posSaleData) ? posSaleData : [];
    if (!posArr.length) {
      return [
        { product: 'Bánh Mì Việt Nam', qty: 62 },
        { product: 'Bánh Croissant Bơ', qty: 54 },
        { product: 'Bánh Kem Socola', qty: 41 },
        { product: 'Bánh Quy Bơ', qty: 33 },
        { product: 'Bánh Tiramisu', qty: 29 },
      ];
    }
    const map: Record<string, number> = {};
    posArr.forEach((s: any) => {
      const name = s.itemName ?? s.productName ?? s.name ?? 'Không rõ';
      map[name] = (map[name] ?? 0) + (s.qtySold ?? s.quantity ?? 0);
    });
    return Object.entries(map)
      .map(([product, qty]) => ({ product, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [sellPeriod, posSaleData]);

  // ── Widget 3: Top Hủy ────────────────────────────────────────────────────
  const { data: cancelData = [], isLoading: cancelLoading } = useQuery({
    queryKey: ['cancel-today', today],
    queryFn: () => cancelRecordService.getByDate(today),
    staleTime: 60_000,
    retry: 1,
    enabled: cancelPeriod === 'day',
  });

  const topCancelData = useMemo(() => {
    if (cancelPeriod === 'month') return TOP_CANCEL_MONTH;
    if (cancelPeriod === 'year') return TOP_CANCEL_YEAR;
    const arr = Array.isArray(cancelData) ? cancelData : [];
    if (!arr.length) {
      return [
        { type: 'Bánh Kem Socola', value: 4 },
        { type: 'Bánh Mì Việt Nam', value: 3 },
        { type: 'Bánh Flan', value: 2 },
        { type: 'Khác', value: 1 },
      ];
    }
    const map: Record<string, number> = {};
    arr.forEach((r: any) => {
      const name = r.productName ?? r.itemName ?? r.name ?? 'Không rõ';
      map[name] = (map[name] ?? 0) + (r.qtyCancelActual ?? r.qty ?? 0);
    });
    return Object.entries(map)
      .map(([type, value]) => ({ type, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [cancelPeriod, cancelData]);

  const revenueChartData = revenuePeriod === 'day' ? REVENUE_DAILY : REVENUE_MONTHLY;

  return (
    <div style={{ padding: 0 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary">Trạng thái hệ thống:</Text>
        <Tag icon={<CheckCircleOutlined />} color="success">Hệ thống hoạt động</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cập nhật: {dayjs().format('HH:mm:ss DD/MM/YYYY')}
        </Text>
      </div>

      {/* ── Widget 1: Hàng Cần Nhập ─────────────────────────────────────────── */}
      <Row>
        <Col xs={24}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>📦 Hàng Cần Nhập</Title>}
            style={cardStyle}
            loading={lsLoading}
            extra={
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={lowStockRaw.length === 0}
                  onClick={handleCreateAllOrders}
                  style={{ background: '#2563eb', borderColor: '#2563eb' }}
                  size="small"
                >
                  🚀 Nhập tất cả ({lowStockRaw.length})
                </Button>
                <span
                  style={{ cursor: 'pointer', color: '#2563eb', fontSize: 13 }}
                  onClick={() => navigate('/warehouse/kho-chinh')}
                >
                  Xem tất cả <LinkOutlined />
                </span>
              </Space>
            }
            styles={{ body: { padding: '0' } }}
          >
            {lowStockRaw.length === 0 && !lsLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                ✅ Không có mặt hàng nào cần nhập lúc này.
              </div>
            ) : (
              <Table<LowStockRow>
                columns={lowStockColumns}
                dataSource={lowStockRaw.slice(0, 10).map((r: any, i: number) => ({ ...r, key: r.itemId ?? i }))}
                pagination={false}
                size="small"
                rowKey="key"
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Widget 2 & 3 ─────────────────────────────────────────────────────── */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* Widget 2: Top bán chạy */}
        <Col xs={24} lg={14}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>🏆 Top Sản Phẩm Bán Chạy</Title>}
            style={cardStyle}
            styles={{ body: { padding: '12px 16px 16px' } }}
            extra={
              <Space size="small">
                <Radio.Group
                  size="small"
                  value={sellPeriod}
                  onChange={(e) => setSellPeriod(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="day">Ngày</Radio.Button>
                  <Radio.Button value="month">Tháng</Radio.Button>
                  <Radio.Button value="year">Năm</Radio.Button>
                </Radio.Group>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'bar', icon: <BarChartOutlined />, label: 'Thanh ngang (Mặc định)' },
                      { key: 'column', icon: <BarChartOutlined />, label: 'Cột đứng' },
                      { key: 'pie', icon: <PieChartOutlined />, label: 'Biểu đồ tròn' },
                      { key: 'table', icon: <TableOutlined />, label: 'Bảng dữ liệu' },
                    ],
                    selectable: true,
                    selectedKeys: [sellChartType],
                    onClick: ({ key }) => setSellChartType(key as any),
                  }}
                  trigger={['click']}
                >
                  <Tooltip title="Đổi loại biểu đồ">
                    <Button size="small" icon={<SettingOutlined />} />
                  </Tooltip>
                </Dropdown>
              </Space>
            }
          >
            {posLoading && sellPeriod === 'day' ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : sellChartType === 'bar' ? (
              <Bar
                data={[...topSellData].reverse()}
                xField="qty"
                yField="product"
                color="#D2691E"
                barStyle={{ radius: [0, 4, 4, 0] }}
                label={{
                  position: 'right',
                  style: { fontSize: 11, fill: '#555' },
                  formatter: (d: any) => d.qty?.toLocaleString('vi-VN') ?? '',
                }}
                xAxis={{ label: { formatter: (v: string) => Number(v).toLocaleString('vi-VN') } }}
                yAxis={{ label: { style: { fontSize: 12 } } }}
                tooltip={{ formatter: (d: any) => ({ name: 'Số lượng', value: d.qty?.toLocaleString('vi-VN') }) }}
                height={280}
              />
            ) : sellChartType === 'column' ? (
              <Column
                data={topSellData}
                xField="product"
                yField="qty"
                color="#D2691E"
                columnStyle={{ radius: [4, 4, 0, 0] }}
                label={{
                  position: 'top',
                  style: { fontSize: 11, fill: '#555' },
                  formatter: (d: any) => d.qty?.toLocaleString('vi-VN') ?? '',
                }}
                xAxis={{ label: { style: { fontSize: 11 } } }}
                yAxis={{ label: { formatter: (v: string) => Number(v).toLocaleString('vi-VN') } }}
                tooltip={{ formatter: (d: any) => ({ name: 'Số lượng', value: d.qty?.toLocaleString('vi-VN') }) }}
                height={280}
              />
            ) : sellChartType === 'pie' ? (
              <Pie
                data={topSellData}
                angleField="qty"
                colorField="product"
                radius={0.85}
                innerRadius={0.5}
                label={{ text: 'product', style: { fontSize: 11 } }}
                legend={{ position: 'bottom' as const }}
                height={280}
                tooltip={{ formatter: (d: any) => ({ name: d.product, value: `${d.qty?.toLocaleString('vi-VN')} cái` }) }}
              />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={topSellData.map((d, i) => ({ ...d, key: i, stt: i + 1 }))}
                columns={[
                  { title: '#', dataIndex: 'stt', width: 45, align: 'center' },
                  { title: 'Sản phẩm', dataIndex: 'product', key: 'product' },
                  {
                    title: 'Số lượng bán',
                    dataIndex: 'qty',
                    key: 'qty',
                    align: 'right',
                    render: (v: number) => <strong>{v?.toLocaleString('vi-VN')}</strong>,
                  },
                ]}
                style={{ maxHeight: 280, overflowY: 'auto' }}
              />
            )}
          </Card>
        </Col>

        {/* Widget 3: Top hủy */}
        <Col xs={24} lg={10}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>❌ Top Sản Phẩm Hủy</Title>}
            style={cardStyle}
            styles={{ body: { padding: '12px 16px 16px' } }}
            extra={
              <Space size="small">
                <Radio.Group
                  size="small"
                  value={cancelPeriod}
                  onChange={(e) => setCancelPeriod(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="day">Ngày</Radio.Button>
                  <Radio.Button value="month">Tháng</Radio.Button>
                  <Radio.Button value="year">Năm</Radio.Button>
                </Radio.Group>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'pie', icon: <PieChartOutlined />, label: 'Biểu đồ tròn (Mặc định)' },
                      { key: 'bar', icon: <BarChartOutlined />, label: 'Thanh ngang' },
                      { key: 'column', icon: <BarChartOutlined />, label: 'Cột đứng' },
                      { key: 'table', icon: <TableOutlined />, label: 'Bảng dữ liệu' },
                    ],
                    selectable: true,
                    selectedKeys: [cancelChartType],
                    onClick: ({ key }) => setCancelChartType(key as any),
                  }}
                  trigger={['click']}
                >
                  <Tooltip title="Đổi loại biểu đồ">
                    <Button size="small" icon={<SettingOutlined />} />
                  </Tooltip>
                </Dropdown>
              </Space>
            }
          >
            {cancelLoading && cancelPeriod === 'day' ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : cancelChartType === 'pie' ? (
              <Pie
                data={topCancelData}
                angleField="value"
                colorField="type"
                radius={0.85}
                innerRadius={0.55}
                color={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']}
                label={{ text: 'type', style: { fontSize: 11 } }}
                legend={{ position: 'bottom' as const }}
                height={280}
                tooltip={{ formatter: (d: any) => ({ name: d.type, value: `${d.value} cái` }) }}
                statistic={{
                  title: { content: 'Tổng hủy', style: { fontSize: 12, color: '#999' } },
                  content: {
                    content: `${topCancelData.reduce((s, d) => s + d.value, 0)}`,
                    style: { fontSize: 22, fontWeight: 700 },
                  },
                }}
              />
            ) : cancelChartType === 'bar' ? (
              <Bar
                data={[...topCancelData].reverse()}
                xField="value"
                yField="type"
                color="#ef4444"
                barStyle={{ radius: [0, 4, 4, 0] }}
                label={{
                  position: 'right',
                  style: { fontSize: 11, fill: '#555' },
                  formatter: (d: any) => `${d.value} cái`,
                }}
                xAxis={{ label: { formatter: (v: string) => Number(v).toLocaleString('vi-VN') } }}
                yAxis={{ label: { style: { fontSize: 12 } } }}
                tooltip={{ formatter: (d: any) => ({ name: d.type, value: `${d.value} cái` }) }}
                height={280}
              />
            ) : cancelChartType === 'column' ? (
              <Column
                data={topCancelData}
                xField="type"
                yField="value"
                color="#ef4444"
                columnStyle={{ radius: [4, 4, 0, 0] }}
                label={{
                  position: 'top',
                  style: { fontSize: 11, fill: '#555' },
                  formatter: (d: any) => `${d.value}`,
                }}
                xAxis={{ label: { style: { fontSize: 11 } } }}
                yAxis={{ label: { formatter: (v: string) => Number(v).toLocaleString('vi-VN') } }}
                tooltip={{ formatter: (d: any) => ({ name: d.type, value: `${d.value} cái` }) }}
                height={280}
              />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={topCancelData.map((d, i) => ({ ...d, key: i, stt: i + 1 }))}
                columns={[
                  { title: '#', dataIndex: 'stt', width: 45, align: 'center' },
                  { title: 'Sản phẩm hủy', dataIndex: 'type', key: 'type' },
                  {
                    title: 'Số lượng hủy',
                    dataIndex: 'value',
                    key: 'value',
                    align: 'right',
                    render: (v: number) => <span style={{ color: '#ef4444', fontWeight: 600 }}>{v} cái</span>,
                  },
                ]}
                style={{ maxHeight: 280, overflowY: 'auto' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Widget 4 & 5 ─────────────────────────────────────────────────────── */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* Widget 4: Doanh thu */}
        <Col xs={24} lg={14}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>💰 Doanh Thu</Title>}
            style={cardStyle}
            styles={{ body: { padding: '12px 16px 16px' } }}
            extra={
              <Space size="small">
                <Segmented
                  size="small"
                  options={[
                    { label: 'Ngày', value: 'day' },
                    { label: 'Tháng', value: 'month' },
                  ]}
                  value={revenuePeriod}
                  onChange={(v) => setRevenuePeriod(v as 'day' | 'month')}
                />
                <Dropdown
                  menu={{
                    items: [
                      { key: 'column', icon: <BarChartOutlined />, label: 'Cột đứng (Mặc định)' },
                      { key: 'line', icon: <LineChartOutlined />, label: 'Biểu đồ đường' },
                      { key: 'area', icon: <AreaChartOutlined />, label: 'Biểu đồ miền' },
                      { key: 'table', icon: <TableOutlined />, label: 'Bảng số liệu' },
                    ],
                    selectable: true,
                    selectedKeys: [revenueChartType],
                    onClick: ({ key }) => setRevenueChartType(key as any),
                  }}
                  trigger={['click']}
                >
                  <Tooltip title="Đổi loại biểu đồ">
                    <Button size="small" icon={<SettingOutlined />} />
                  </Tooltip>
                </Dropdown>
              </Space>
            }
          >
            {revenueChartType === 'column' ? (
              <Column
                data={revenueChartData}
                xField="label"
                yField="revenue"
                color="#2563eb"
                columnStyle={{ radius: [4, 4, 0, 0] }}
                label={{
                  position: 'top',
                  formatter: (d: any) => fmtM(d.revenue ?? 0),
                  style: { fontSize: 10, fill: '#555' },
                }}
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                xAxis={{ label: { style: { fontSize: revenuePeriod === 'day' ? 9 : 12 } } }}
                tooltip={{ formatter: (d: any) => ({ name: 'Doanh thu', value: fmtVND(d.revenue ?? 0) }) }}
                height={280}
              />
            ) : revenueChartType === 'line' ? (
              <Line
                data={revenueChartData}
                xField="label"
                yField="revenue"
                color="#2563eb"
                point={{ size: 4 }}
                smooth
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                xAxis={{ label: { style: { fontSize: revenuePeriod === 'day' ? 9 : 12 } } }}
                tooltip={{ formatter: (d: any) => ({ name: 'Doanh thu', value: fmtVND(d.revenue ?? 0) }) }}
                height={280}
              />
            ) : revenueChartType === 'area' ? (
              <Area
                data={revenueChartData}
                xField="label"
                yField="revenue"
                color="#2563eb"
                smooth
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                xAxis={{ label: { style: { fontSize: revenuePeriod === 'day' ? 9 : 12 } } }}
                tooltip={{ formatter: (d: any) => ({ name: 'Doanh thu', value: fmtVND(d.revenue ?? 0) }) }}
                height={280}
              />
            ) : (
              <Table
                size="small"
                pagination={{ pageSize: 6 }}
                dataSource={revenueChartData.map((d, i) => ({ ...d, key: i }))}
                columns={[
                  { title: revenuePeriod === 'day' ? 'Ngày' : 'Tháng', dataIndex: 'label', key: 'label' },
                  {
                    title: 'Doanh thu (VNĐ)',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    align: 'right',
                    render: (v: number) => <strong style={{ color: '#2563eb' }}>{fmtVND(v)}</strong>,
                  },
                ]}
                style={{ maxHeight: 280 }}
              />
            )}
          </Card>
        </Col>

        {/* Widget 5: Doanh thu / Lợi nhuận */}
        <Col xs={24} lg={10}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>📊 Doanh Thu / Lợi Nhuận</Title>}
            style={cardStyle}
            styles={{ body: { padding: '12px 16px 16px' } }}
            extra={
              <Dropdown
                menu={{
                  items: [
                    { key: 'line', icon: <LineChartOutlined />, label: 'Biểu đồ đường (Mặc định)' },
                    { key: 'column', icon: <BarChartOutlined />, label: 'Cột nhóm so sánh' },
                    { key: 'area', icon: <AreaChartOutlined />, label: 'Biểu đồ miền' },
                    { key: 'table', icon: <TableOutlined />, label: 'Bảng so sánh' },
                  ],
                  selectable: true,
                  selectedKeys: [dtLnChartType],
                  onClick: ({ key }) => setDtLnChartType(key as any),
                }}
                trigger={['click']}
              >
                <Tooltip title="Đổi loại biểu đồ">
                  <Button size="small" icon={<SettingOutlined />} />
                </Tooltip>
              </Dropdown>
            }
          >
            {dtLnChartType === 'line' ? (
              <Line
                data={DT_LN_DATA}
                xField="month"
                yField="value"
                seriesField="type"
                color={['#2563eb', '#16a34a']}
                point={{ size: 4 }}
                smooth
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                legend={{ position: 'top-right' as const }}
                tooltip={{
                  formatter: (d: any) => ({ name: d.type, value: fmtVND(d.value ?? 0) }),
                }}
                height={280}
              />
            ) : dtLnChartType === 'column' ? (
              <Column
                data={DT_LN_DATA}
                xField="month"
                yField="value"
                seriesField="type"
                isGroup={true}
                color={['#2563eb', '#16a34a']}
                columnStyle={{ radius: [3, 3, 0, 0] }}
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                legend={{ position: 'top-right' as const }}
                tooltip={{
                  formatter: (d: any) => ({ name: d.type, value: fmtVND(d.value ?? 0) }),
                }}
                height={280}
              />
            ) : dtLnChartType === 'area' ? (
              <Area
                data={DT_LN_DATA}
                xField="month"
                yField="value"
                seriesField="type"
                color={['#2563eb', '#16a34a']}
                smooth
                yAxis={{ label: { formatter: (v: string) => fmtM(Number(v)) } }}
                legend={{ position: 'top-right' as const }}
                tooltip={{
                  formatter: (d: any) => ({ name: d.type, value: fmtVND(d.value ?? 0) }),
                }}
                height={280}
              />
            ) : (
              <Table
                size="small"
                pagination={{ pageSize: 6 }}
                dataSource={REVENUE_MONTHLY.map((d, i) => ({
                  key: i,
                  month: d.label,
                  revenue: d.revenue,
                  profit: Math.round(d.revenue * 0.31),
                }))}
                columns={[
                  { title: 'Tháng', dataIndex: 'month', key: 'month' },
                  {
                    title: 'Doanh thu',
                    dataIndex: 'revenue',
                    key: 'revenue',
                    align: 'right',
                    render: (v: number) => <span style={{ color: '#2563eb', fontWeight: 500 }}>{fmtVND(v)}</span>,
                  },
                  {
                    title: 'Lợi nhuận',
                    dataIndex: 'profit',
                    key: 'profit',
                    align: 'right',
                    render: (v: number) => <strong style={{ color: '#16a34a' }}>{fmtVND(v)}</strong>,
                  },
                ]}
                style={{ maxHeight: 280 }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
