import React from 'react';
import {
  Form, Select, InputNumber, Input, Button, Card, Typography, Space, message, Row, Col
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, priceService } from '../../../api/services';
import type { ProductPriceRequest } from '../../../types';

const { Title, Text } = Typography;

const ProductPriceForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<ProductPriceRequest>();
  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT' }),
    retry: 1,
  });
  const products = Array.isArray(productsData) ? productsData : [];

  const submitPPMutation = useMutation({
    mutationFn: (data: ProductPriceRequest) => priceService.submitProductPrice(data),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu giá sản phẩm. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['product-prices'] });
      navigate('/products/cost-price');
    },
    onError: () => {
      message.error('Gửi yêu cầu giá thất bại.');
    }
  });

  const onSubmit = (data: ProductPriceRequest) => {
    submitPPMutation.mutate(data);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products/cost-price')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Thêm Phiên Bản Giá Sản Phẩm
        </Title>
      </Space>

      <Card loading={isLoading}>
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary">Nhập thông tin giá bán cho sản phẩm. Phiên bản giá mới sẽ được chuyển vào danh sách chờ duyệt.</Text>
        </div>
        
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="productId" label="Sản Phẩm" rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}>
            <Select
              showSearch
              placeholder="Chọn sản phẩm..."
              options={products.map((p) => ({ value: p.id, label: `[${p.code}] ${p.name}` }))}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price" label="Giá Bán (VND)" rules={[{ required: true, message: 'Vui lòng nhập giá' }]}>
                <InputNumber
                  min={0} step={1000} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => Number(v?.replace(/,/g, '') || 0)}
                  placeholder="VD: 25,000"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effectiveDate" label="Ngày Hiệu Lực" rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="note" label="Ghi Chú">
            <Input.TextArea rows={4} placeholder="Lý do điều chỉnh giá, thay đổi chính sách..." />
          </Form.Item>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => navigate('/products/cost-price')}>Huỷ</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitPPMutation.isPending}>
              Gửi Chờ Duyệt
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ProductPriceForm;
