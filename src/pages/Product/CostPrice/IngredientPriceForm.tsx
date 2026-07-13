import React from 'react';
import {
  Form, Select, InputNumber, Input, Button, Card, Typography, Space, message, Row, Col
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, priceService } from '../../../api/services';
import type { IngredientPriceRequest } from '../../../types';

const { Title, Text } = Typography;

const IngredientPriceForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<IngredientPriceRequest>();
  const queryClient = useQueryClient();

  const { data: ingredientsData, isLoading } = useQuery({
    queryKey: ['items', 'ingredients'],
    queryFn: () => itemService.getAllItemsUnpaginated({ itemType: 'INGREDIENT' }),
    retry: 1,
  });
  const ingredients = Array.isArray(ingredientsData) ? ingredientsData : [];

  const submitIPMutation = useMutation({
    mutationFn: (data: IngredientPriceRequest) => priceService.submitIngredientPrice(data),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu giá nguyên liệu. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['ingredient-prices'] });
      navigate('/products/cost-price');
    },
    onError: () => {
      message.error('Gửi yêu cầu giá thất bại.');
    }
  });

  const onSubmit = (data: IngredientPriceRequest) => {
    submitIPMutation.mutate(data);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products/cost-price')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Thêm Phiên Bản Giá Nguyên Liệu
        </Title>
      </Space>

      <Card loading={isLoading}>
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary">Nhập thông tin giá nguyên liệu. Giá nguyên liệu được dùng để tính FIFO cost khi khai báo lô sản xuất (Kho Bếp).</Text>
        </div>
        
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="ingredientId" label="Nguyên Liệu" rules={[{ required: true, message: 'Vui lòng chọn nguyên liệu' }]}>
            <Select
              showSearch
              placeholder="Chọn nguyên liệu..."
              options={ingredients.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pricePerKg" label="Giá / kg (VND)" rules={[{ required: true, message: 'Vui lòng nhập giá' }]}>
                <InputNumber
                  min={0} step={500} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => Number(v?.replace(/,/g, '') || 0)}
                  placeholder="VD: 18,000"
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
            <Input.TextArea rows={4} placeholder="Lý do điều chỉnh giá nhà cung cấp..." />
          </Form.Item>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => navigate('/products/cost-price')}>Huỷ</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitIPMutation.isPending}>
              Gửi Chờ Duyệt
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default IngredientPriceForm;
