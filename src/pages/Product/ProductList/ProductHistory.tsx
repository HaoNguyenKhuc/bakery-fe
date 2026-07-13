import React from 'react';
import { Timeline, Typography, Alert, Button, Card, Space, Divider, Tag } from 'antd';
import { ArrowLeftOutlined, HistoryOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { itemService } from '../../../api/services';
import type { ProductHistory as ProductHistoryType } from '../../../types';

const { Title, Text } = Typography;

const ProductHistory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: history, isLoading } = useQuery({
    queryKey: ['product-history', id],
    queryFn: () => itemService.getHistory(id!),
    enabled: !!id,
  });

  const historyData = Array.isArray(history) ? history : [];

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
            Danh Sách Hàng Hoá
          </Button>
          <Divider type="vertical" />
          <HistoryOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            Lịch Sử Thay Đổi Hàng Hoá
          </Title>
          <Tag color="blue" style={{ marginLeft: 8 }}>ID: {id}</Tag>
        </Space>
      </div>

      <Card loading={isLoading} style={{ minHeight: '60vh' }}>
        {historyData.length === 0 && !isLoading ? (
          <Alert type="info" message="Chưa có lịch sử thay đổi." showIcon />
        ) : (
          <Timeline
            items={historyData.map((h: ProductHistoryType) => ({
              color: h.action === 'CREATE' ? 'green' : h.action === 'DELETE' ? 'red' : 'blue',
              children: (
                <div>
                  <Text strong>{h.action}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                    {dayjs(h.createdAt).format('HH:mm DD/MM/YYYY')} — {h.createdBy}
                  </Text>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};

export default ProductHistory;
