import React from 'react';
import {
  Space, Typography, Tag, Descriptions, Divider,
  Badge, Empty, Button, Card, message
} from 'antd';
import {
  ShoppingOutlined, CalendarOutlined, UserOutlined,
  PhoneOutlined, DollarOutlined, EditOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProductOrder, CakeType, ProductOrderStatus, PaymentStatus, CustomRecipeUpdateRequest } from '../../../types';
import { useAuthStore } from '../../../store';
import CustomRecipeGrid from './components/CustomRecipeGrid';

const { Title, Text, Paragraph } = Typography;

// ─── Nhãn ─────────────────────────────────────────────────────────────────────

const CAKE_LABEL: Record<CakeType, string> = {
  SHEET_CAKE:     '🎨 Bánh Thiết Kế (Sheet Cake)',
  BENTO:          '🍱 Bento Cake',
  BANH_KEM_CHUAN: '🎂 Bánh Kem Chuẩn',
};

const ORDER_STATUS_MAP: Record<ProductOrderStatus, { color: string; label: string }> = {
  PENDING:       { color: 'orange', label: '⏳ Chờ xử lý' },
  IN_PRODUCTION: { color: 'blue',   label: '🔨 Đang sản xuất' },
  COMPLETED:     { color: 'green',  label: '✅ Hoàn thành' },
  CANCELLED:     { color: 'red',    label: '❌ Đã huỷ' },
};

const PAYMENT_STATUS_MAP: Record<PaymentStatus, { color: string; label: string }> = {
  UNPAID:  { color: 'red',    label: '💸 Chưa thanh toán' },
  DEPOSIT: { color: 'blue',   label: '💳 Đã cọc' },
  PAID:    { color: 'green',  label: '✅ Đã thanh toán đủ' },
};

// ─── Dummy Data (Temporary) ───────────────────────────────────────────────────

const dummyOrder: ProductOrder = {
  orderId: 'ord-001',
  orderCode: 'ORD-20260705-001',
  cakeType: 'SHEET_CAKE',
  status: 'IN_PRODUCTION',
  paymentStatus: 'DEPOSIT',
  depositAmount: 200000,
  deliveryDate: '2026-07-08',
  customerName: 'Nguyễn Thị Lan',
  customerPhone: '0901 234 567',
  designDescription:
    'Kích cỡ: 20cm × 30cm (cho 20 người)\n' +
    'Chủ đề: Sinh nhật — màu hồng pastel, hoa kem 3D\n' +
    'Chữ trên bánh: "Happy Birthday Lan"\n' +
    'Phụ kiện: 1 nến số tuổi + hộp đựng bánh cao cấp\n' +
    'Lưu ý: không dùng màu thực phẩm đỏ',
  createdBy: 'thu.ngan',
  createdAt: '2026-07-05T09:00:00Z',
  customRecipeLines: [
    { ingredientCode: 'NL001', ingredientName: 'Bột Mì', unit: 'KG', defaultQuantity: 1, actualQuantity: 1.2 },
    { ingredientCode: 'NL002', ingredientName: 'Đường', unit: 'KG', defaultQuantity: 0.5, actualQuantity: 0.6 },
  ]
};

// ─── Component ────────────────────────────────────────────────────────────────

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const isBepTruong = isWarehouseRole('BEP_TRUONG');

  // Dummy fetch
  const { data: order, isLoading } = useQuery({
    queryKey: ['product-order', id],
    queryFn: async () => {
      // Giả lập call API
      return new Promise<ProductOrder>((resolve) => {
        setTimeout(() => resolve({ ...dummyOrder, orderId: id!, orderCode: `ORD-${id}` }), 400);
      });
    },
    enabled: !!id,
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (_req: CustomRecipeUpdateRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã lưu công thức tùy chỉnh. Bếp sẽ làm theo định lượng mới.');
      queryClient.invalidateQueries({ queryKey: ['product-order', id] });
    },
    onError: () => message.warning('API chưa sẵn sàng — công thức đã được ghi nhận (demo).'),
  });

  if (isLoading) return <Card loading={true} style={{ minHeight: '60vh' }} />;
  if (!order) return <Empty description="Không tìm thấy đơn hàng" />;

  // Hiển thị Custom Recipe Grid khi:
  // 1. Đơn là SHEET_CAKE hoặc có customRecipeLines từ API
  // 2. User là Bếp trưởng
  const showRecipeGrid =
    isBepTruong &&
    (order.cakeType === 'SHEET_CAKE' || (order.customRecipeLines && order.customRecipeLines.length > 0));

  const orderStatus = ORDER_STATUS_MAP[order.status] ?? { color: 'default', label: order.status };
  const paymentStatus = PAYMENT_STATUS_MAP[order.paymentStatus] ?? { color: 'default', label: order.paymentStatus };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warehouse/product-orders')}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <ShoppingOutlined style={{ fontSize: 24, color: '#D2691E' }} />
          <Title level={3} style={{ margin: 0 }}>Chi Tiết Đơn Hàng</Title>
          <Text code style={{ fontSize: 14 }}>{order.orderCode}</Text>
        </Space>
      </div>

      <Card>
        {/* ── Trạng thái ── */}
        <Space size={8} style={{ marginBottom: 24 }}>
          <Tag color={orderStatus.color} style={{ fontSize: 13, padding: '4px 10px' }}>
            {orderStatus.label}
          </Tag>
          <Tag color={paymentStatus.color} style={{ fontSize: 13, padding: '4px 10px' }}>
            {paymentStatus.label}
          </Tag>
          <Tag color="purple" style={{ fontSize: 13, padding: '4px 10px' }}>{CAKE_LABEL[order.cakeType]}</Tag>
        </Space>

        {/* ── Thông tin đơn hàng ── */}
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item
            label={<Space size={4}><CalendarOutlined /> Ngày Giao</Space>}
            span={1}
          >
            <Text strong>{dayjs(order.deliveryDate).format('DD/MM/YYYY')}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày Tạo">
            {dayjs(order.createdAt).format('HH:mm DD/MM/YYYY')}
          </Descriptions.Item>
          {order.customerName && (
            <Descriptions.Item
              label={<Space size={4}><UserOutlined /> Khách Hàng</Space>}
            >
              {order.customerName}
            </Descriptions.Item>
          )}
          {order.customerPhone && (
            <Descriptions.Item
              label={<Space size={4}><PhoneOutlined /> Điện Thoại</Space>}
            >
              {order.customerPhone}
            </Descriptions.Item>
          )}
          {order.depositAmount !== undefined && order.depositAmount > 0 && (
            <Descriptions.Item
              label={<Space size={4}><DollarOutlined /> Tiền Cọc</Space>}
              span={2}
            >
              <Text strong style={{ color: '#0958d9', fontSize: 15 }}>
                {order.depositAmount.toLocaleString('vi-VN')} ₫
              </Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Tạo Bởi" span={2}>
            {order.createdBy}
          </Descriptions.Item>
        </Descriptions>

        {/* ── Mô tả thiết kế (SHEET_CAKE) ── */}
        {order.cakeType === 'SHEET_CAKE' && order.designDescription && (
          <>
            <Divider style={{ margin: '8px 0 16px' }}>
              <Space>
                <EditOutlined style={{ color: '#D2691E' }} />
                <Text style={{ color: '#D2691E', fontWeight: 600 }}>Yêu Cầu Thiết Kế</Text>
              </Space>
            </Divider>
            <div
              style={{
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 24,
              }}
            >
              <Paragraph
                style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.8 }}
              >
                {order.designDescription}
              </Paragraph>
            </div>
          </>
        )}

        {/* ── Ghi chú ── */}
        {order.note && (
          <>
            <Divider style={{ margin: '8px 0 16px' }}>Ghi Chú</Divider>
            <Text type="secondary" style={{ fontSize: 14 }}>{order.note}</Text>
          </>
        )}

        {/* ── Custom Recipe Grid (chỉ Bếp trưởng + SHEET_CAKE) ── */}
        {showRecipeGrid ? (
          <CustomRecipeGrid
            orderId={order.orderId}
            orderCode={order.orderCode}
            initialLines={order.customRecipeLines}
            onSave={(req) => saveRecipeMutation.mutate(req)}
            saving={saveRecipeMutation.isPending}
          />
        ) : (
          order.cakeType !== 'SHEET_CAKE' && (
            <Empty
              style={{ marginTop: 32 }}
              description={
                <Text type="secondary">
                  Công thức chuẩn — không có chỉnh sửa định lượng
                </Text>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        )}

        {/* ── Lịch sử phê duyệt ── */}
        {order.approvedBy && (
          <>
            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Duyệt bởi: <Text strong>{order.approvedBy}</Text> lúc{' '}
              {order.approvedAt ? dayjs(order.approvedAt).format('HH:mm DD/MM/YYYY') : '—'}
            </Text>
          </>
        )}
      </Card>
    </div>
  );
};

export default OrderDetailPage;