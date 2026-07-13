import React from 'react';
import {
  Button, Form, Input, InputNumber, Select,
  Space, Typography, Divider, Card, message
} from 'antd';
import {
  ThunderboltOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UrgentProductionRequest } from '../../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Sản phẩm có thể phát sinh ───────────────────────────────────────────────
const PRODUCTS = [
  { code: 'BCK-001', name: 'Bánh Kem Chuẩn 20cm' },
  { code: 'BCK-002', name: 'Bánh Kem Chuẩn 24cm' },
  { code: 'BNT-001', name: 'Bento Cake Mini' },
  { code: 'SCK-001', name: 'Sheet Cake Cơ Bản' },
];

interface CreateUrgentFormValues {
  productCode: string;
  quantityNeeded: number;
  reason: string;
  note?: string;
}

const UrgentProductionForm: React.FC = () => {
  const [form] = Form.useForm<CreateUrgentFormValues>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createUrgentMutation = useMutation({
    mutationFn: async (_req: UrgentProductionRequest) => {
      // Dummy
      return new Promise((resolve) => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      message.success('🚨 Đã tạo lệnh sản xuất gấp!');
      queryClient.invalidateQueries({ queryKey: ['urgent-productions'] });
      navigate('/warehouse/product-orders');
    },
    onError: () => {
      message.warning('API chưa sẵn sàng — lệnh gấp đã ghi nhận (demo).');
      navigate('/warehouse/product-orders');
    }
  });

  const onFinish = (values: CreateUrgentFormValues) => {
    createUrgentMutation.mutate({
      productCode: values.productCode,
      quantityNeeded: values.quantityNeeded,
      reason: values.reason,
      note: values.note,
    });
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warehouse/product-orders')}>
          Quay Lại
        </Button>
        <Divider type="vertical" />
        <ThunderboltOutlined style={{ fontSize: 24, color: '#ff4d4f', marginRight: 8 }} />
        <Title level={3} style={{ margin: 0 }}>
          Tạo Lệnh Sản Xuất Gấp
        </Title>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
        >
          <Form.Item
            name="productCode"
            label="Sản Phẩm Cần Gấp"
            rules={[{ required: true, message: 'Chọn sản phẩm!' }]}
          >
            <Select placeholder="Chọn sản phẩm...">
              {PRODUCTS.map((p) => (
                <Select.Option key={p.code} value={p.code}>
                  <Text code>{p.code}</Text> - {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantityNeeded"
            label="Số Lượng"
            rules={[{ required: true, message: 'Nhập số lượng!' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="1, 2, 3..." />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý Do Bổ Sung Gấp"
            rules={[{ required: true, message: 'Vui lòng nhập lý do (ex: Khách đặt thêm, lỗi hỏng...)' }]}
          >
            <TextArea rows={2} placeholder="Ví dụ: Cửa hàng báo hết lúc 9h, khách V.I.P đặt thêm..." />
          </Form.Item>

          <Form.Item
            name="note"
            label="Ghi Chú Kỹ Thuật (Tuỳ chọn)"
          >
            <TextArea rows={2} placeholder="Yêu cầu thêm từ Bếp trưởng cho nhân sự..." />
          </Form.Item>

          <Divider />
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => navigate('/warehouse/product-orders')}>
                Hủy
              </Button>
              <Button 
                type="primary" 
                danger 
                htmlType="submit" 
                icon={<ThunderboltOutlined />}
                loading={createUrgentMutation.isPending}
              >
                Tạo & Duyệt Ngay
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UrgentProductionForm;