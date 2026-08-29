import React from 'react';
import { Table, Tag, Typography, Card, Statistic, Row, Col, Tooltip } from 'antd';
import { WarningOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosClient';

const { Text, Title } = Typography;

interface LowStockItem {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  itemType: string;
  minStockQuantity: number;
  currentStock: number;
  shortage: number;
}

const fetchLowStock = () =>
  api.get<LowStockItem[]>('/api/v1/items/low-stock') as Promise<LowStockItem[]>;

const fmt = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(v);

const LowStockPage: React.FC = () => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: fetchLowStock,
    refetchInterval: 60_000, // auto-refresh mỗi phút
  });

  const criticalCount = data.filter(i => i.currentStock <= 0).length;
  const warningCount = data.length - criticalCount;

  const columns = [
    {
      title: 'Loại',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 110,
      render: (v: string) =>
        v === 'INGREDIENT'
          ? <Tag color="blue">🥕 Nguyên liệu</Tag>
          : <Tag color="purple">🍞 Bán TP</Tag>,
    },
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: LowStockItem) => (
        <Text
          style={{ color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
          onClick={() => navigate(`/products/edit/${record.itemId}`)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: 'Tồn hiện tại',
      key: 'currentStock',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, r: LowStockItem) => (
        <Text style={{ color: r.currentStock <= 0 ? '#dc2626' : '#d97706', fontWeight: 600 }}>
          {fmt(r.currentStock)} {r.unit}
        </Text>
      ),
    },
    {
      title: 'Ngưỡng tối thiểu',
      key: 'minStockQuantity',
      width: 150,
      align: 'right' as const,
      render: (_: unknown, r: LowStockItem) => (
        <Text type="secondary">{fmt(r.minStockQuantity)} {r.unit}</Text>
      ),
    },
    {
      title: 'Thiếu',
      key: 'shortage',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, r: LowStockItem) => (
        <Tag color="red" style={{ fontWeight: 600, fontSize: 13 }}>
          -{fmt(r.shortage)} {r.unit}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, r: LowStockItem) => (
        <Tooltip title="Tạo phiếu nhập">
          <Tag
            icon={<ShoppingCartOutlined />}
            color="green"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/warehouse/kho-chinh/phieu-kho/create?itemId=${r.itemId}`)}
          >
            Nhập hàng
          </Tag>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <WarningOutlined style={{ fontSize: 22, color: '#d97706' }} />
        <Title level={4} style={{ margin: 0 }}>Hàng cần nhập</Title>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Mặt hàng thiếu hàng"
              value={data.length}
              valueStyle={{ color: data.length > 0 ? '#d97706' : '#16a34a' }}
              suffix="mặt hàng"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Hết hàng hoàn toàn"
              value={criticalCount}
              valueStyle={{ color: criticalCount > 0 ? '#dc2626' : '#16a34a' }}
              suffix="mặt hàng"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Sắp hết hàng"
              value={warningCount}
              valueStyle={{ color: warningCount > 0 ? '#d97706' : '#16a34a' }}
              suffix="mặt hàng"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={data}
          columns={columns}
          loading={isLoading}
          rowKey="itemId"
          pagination={false}
          rowClassName={(r) => r.currentStock <= 0 ? 'row-critical' : 'row-warning'}
          size="middle"
          locale={{ emptyText: '🎉 Tất cả mặt hàng đều đủ hàng!' }}
        />
      </Card>

      <style>{`
        .row-critical td { background: #fff1f2 !important; }
        .row-warning td { background: #fffbeb !important; }
      `}</style>
    </div>
  );
};

export default LowStockPage;
