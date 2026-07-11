import React from 'react';
import {
  Drawer, Space, Typography, Tag, Descriptions, Divider,
  Badge, Empty,
} from 'antd';
import {
  ShoppingOutlined, CalendarOutlined, UserOutlined,
  PhoneOutlined, DollarOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ProductOrder, CakeType, ProductOrderStatus, PaymentStatus } from '../../../../types';
import { useAuthStore } from '../../../../store';
import CustomRecipeGrid from './CustomRecipeGrid';

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderDetailDrawerProps {
  order: ProductOrder | null;
  open: boolean;
  onClose: () => void;
  onSaveRecipe: (req: { orderId: string; lines: { ingredientCode: string; actualQuantity: number }[] }) => void;
  savingRecipe: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order, open, onClose, onSaveRecipe, savingRecipe,
}) => {
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const isBepTruong = isWarehouseRole('BEP_TRUONG');

  // Hiển thị Custom Recipe Grid khi:
  // 1. Đơn là SHEET_CAKE hoặc có customRecipeLines từ API
  // 2. User là Bếp trưởng
  const showRecipeGrid =
    isBepTruong &&
    order !== null &&
    (order.cakeType === 'SHEET_CAKE' || (order.customRecipeLines && order.customRecipeLines.length > 0));

  if (!order) return null;

  const orderStatus = ORDER_STATUS_MAP[order.status] ?? { color: 'default', label: order.status };
  const paymentStatus = PAYMENT_STATUS_MAP[order.paymentStatus] ?? { color: 'default', label: order.paymentStatus };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <Space>
          <ShoppingOutlined style={{ color: '#D2691E' }} />
          <span>Chi Tiết Đơn Hàng</span>
          <Text code style={{ fontSize: 12 }}>{order.orderCode}</Text>
        </Space>
      }
      width={640}
      destroyOnClose
    >
      {/* ── Trạng thái ── */}
      <Space size={8} style={{ marginBottom: 16 }}>
        <Tag color={orderStatus.color} style={{ fontSize: 13, padding: '4px 10px' }}>
          {orderStatus.label}
        </Tag>
        <Tag color={paymentStatus.color} style={{ fontSize: 13, padding: '4px 10px' }}>
          {paymentStatus.label}
        </Tag>
        <Tag color="purple" style={{ fontSize: 12 }}>{CAKE_LABEL[order.cakeType]}</Tag>
      </Space>

      {/* ── Thông tin đơn hàng ── */}
      <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
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
          <Divider style={{ margin: '8px 0 12px' }}>
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
              padding: '12px 16px',
              marginBottom: 12,
            }}
          >
            <Paragraph
              style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.7 }}
            >
              {order.designDescription}
            </Paragraph>
          </div>
        </>
      )}

      {/* ── Ghi chú ── */}
      {order.note && (
        <>
          <Divider style={{ margin: '8px 0 12px' }}>Ghi Chú</Divider>
          <Text type="secondary">{order.note}</Text>
        </>
      )}

      {/* ── Custom Recipe Grid (chỉ Bếp trưởng + SHEET_CAKE) ── */}
      {showRecipeGrid ? (
        <CustomRecipeGrid
          orderId={order.orderId}
          orderCode={order.orderCode}
          initialLines={order.customRecipeLines}
          onSave={onSaveRecipe}
          saving={savingRecipe}
        />
      ) : (
        order.cakeType !== 'SHEET_CAKE' && (
          <Empty
            style={{ marginTop: 24 }}
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
          <Text type="secondary" style={{ fontSize: 11 }}>
            Duyệt bởi: <Text strong>{order.approvedBy}</Text> lúc{' '}
            {order.approvedAt ? dayjs(order.approvedAt).format('HH:mm DD/MM/YYYY') : '—'}
          </Text>
        </>
      )}
    </Drawer>
  );
};

export default OrderDetailDrawer;
