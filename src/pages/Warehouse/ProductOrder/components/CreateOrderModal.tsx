import React, { useEffect } from 'react';
import {
  Modal, Form, Select, DatePicker, Input, InputNumber,
  Space, Typography, Alert, Divider, Row, Col,
} from 'antd';
import {
  ShoppingOutlined, CalendarOutlined, UserOutlined,
  PhoneOutlined, DollarOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CakeType, ProductOrderRequest } from '../../../../types';

const { Text } = Typography;
const { TextArea } = Input;

// ─── Nhãn loại bánh ───────────────────────────────────────────────────────────

const CAKE_TYPE_OPTIONS: { value: CakeType; label: string; desc: string }[] = [
  {
    value: 'SHEET_CAKE',
    label: '🎨 Bánh Thiết Kế (Sheet Cake)',
    desc: 'Bánh theo yêu cầu riêng — mô tả chi tiết quy cách, phụ kiện',
  },
  {
    value: 'BENTO',
    label: '🍱 Bento Cake',
    desc: 'Bánh bento nhỏ theo cá nhân hóa',
  },
  {
    value: 'BANH_KEM_CHUAN',
    label: '🎂 Bánh Kem Chuẩn',
    desc: 'Bánh kem theo công thức chuẩn của tiệm',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: ProductOrderRequest) => void;
  submitting: boolean;
  /** Truyền vào để edit đơn hàng đã có */
  initialValues?: Partial<ProductOrderRequest>;
}

interface FormValues {
  cakeType: CakeType;
  deliveryDate: dayjs.Dayjs;
  customerName?: string;
  customerPhone?: string;
  designDescription?: string;
  depositAmount?: number;
  note?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  open, onClose, onSubmit, submitting, initialValues,
}) => {
  const [form] = Form.useForm<FormValues>();
  const cakeType = Form.useWatch('cakeType', form);
  const depositAmount = Form.useWatch('depositAmount', form);

  const isSheetCake = cakeType === 'SHEET_CAKE';
  const hasDeposit = !!depositAmount && depositAmount > 0;

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          deliveryDate: initialValues.deliveryDate ? dayjs(initialValues.deliveryDate) : undefined,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, form, initialValues]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit({
        cakeType: values.cakeType,
        deliveryDate: values.deliveryDate.format('YYYY-MM-DD'),
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        designDescription: isSheetCake ? values.designDescription : undefined,
        depositAmount: values.depositAmount,
        note: values.note,
      });
    });
  };

  const selectedCakeInfo = CAKE_TYPE_OPTIONS.find((o) => o.value === cakeType);

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ShoppingOutlined style={{ color: '#D2691E' }} />
          {initialValues ? 'Chỉnh Sửa Đơn Hàng' : 'Tạo Đơn Hàng Mới'}
        </Space>
      }
      okText={initialValues ? 'Cập Nhật' : 'Tạo Đơn'}
      cancelText="Hủy"
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
      width={640}
    >
      {/* Thông báo trạng thái thanh toán tự động */}
      {hasDeposit && (
        <Alert
          type="info"
          showIcon
          icon={<DollarOutlined />}
          message={
            <Text style={{ fontSize: 13 }}>
              Đơn có tiền cọc → Trạng thái thanh toán tự động:{' '}
              <Text strong style={{ color: '#0958d9' }}>DEPOSIT (Đã cọc)</Text>
            </Text>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" requiredMark="optional">
        {/* ── Loại bánh + Ngày giao ── */}
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              name="cakeType"
              label="Loại Bánh"
              rules={[{ required: true, message: 'Vui lòng chọn loại bánh!' }]}
            >
              <Select placeholder="Chọn loại bánh...">
                {CAKE_TYPE_OPTIONS.map((o) => (
                  <Select.Option key={o.value} value={o.value}>
                    {o.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="deliveryDate"
              label={
                <Space size={4}>
                  <CalendarOutlined />
                  Ngày Giao Bánh
                </Space>
              }
              rules={[{ required: true, message: 'Chọn ngày giao!' }]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
                placeholder="Chọn ngày..."
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Mô tả loại bánh */}
        {selectedCakeInfo && (
          <Alert
            type="info"
            showIcon={false}
            message={
              <Text type="secondary" style={{ fontSize: 12 }}>
                💡 {selectedCakeInfo.desc}
              </Text>
            }
            style={{ marginBottom: 12, padding: '6px 12px' }}
          />
        )}

        {/* ── Thông tin khách hàng ── */}
        <Divider style={{ margin: '8px 0 12px' }}>Thông Tin Khách Hàng</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="customerName"
              label={<Space size={4}><UserOutlined /> Tên Khách Hàng</Space>}
            >
              <Input placeholder="Nguyễn Văn A..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="customerPhone"
              label={<Space size={4}><PhoneOutlined /> Số Điện Thoại</Space>}
            >
              <Input placeholder="0901 234 567" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Mô tả thiết kế (chỉ SHEET_CAKE) ── */}
        {isSheetCake && (
          <>
            <Divider style={{ margin: '4px 0 12px' }}>
              <Space>
                <EditOutlined style={{ color: '#D2691E' }} />
                <Text style={{ color: '#D2691E', fontWeight: 600 }}>
                  Mô Tả Yêu Cầu Thiết Kế
                </Text>
              </Space>
            </Divider>
            <Form.Item
              name="designDescription"
              label=""
              rules={[
                { required: true, message: 'Vui lòng mô tả yêu cầu thiết kế cho bánh SHEET_CAKE!' },
                { min: 20, message: 'Mô tả cần ít nhất 20 ký tự để đảm bảo đủ thông tin cho bếp.' },
              ]}
            >
              <TextArea
                rows={5}
                placeholder={
                  'Ví dụ:\n' +
                  '• Kích cỡ: 20cm × 30cm (cho 20 người)\n' +
                  '• Chủ đề: Sinh nhật — màu hồng pastel, hoa kem 3D\n' +
                  '• Chữ trên bánh: "Happy Birthday Lan"\n' +
                  '• Phụ kiện kèm: 1 nến số tuổi + hộp đựng bánh cao cấp\n' +
                  '• Lưu ý đặc biệt: không dùng màu thực phẩm đỏ'
                }
                maxLength={1000}
                showCount
                style={{ fontSize: 13 }}
              />
            </Form.Item>
          </>
        )}

        {/* ── Tiền cọc ── */}
        <Divider style={{ margin: '8px 0 12px' }}>Thanh Toán</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="depositAmount"
              label={
                <Space size={4}>
                  <DollarOutlined />
                  Tiền Cọc Khách Đặt (VND)
                </Space>
              }
              help={hasDeposit ? '→ Trạng thái: DEPOSIT (Đã cọc)' : '→ Trạng thái: UNPAID (Chưa thanh toán)'}
            >
              <InputNumber
                min={0}
                step={50000}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v?.replace(/,/g, '') ?? 0)}
                placeholder="0"
                style={{ width: '100%' }}
                addonAfter="₫"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Ghi chú ── */}
        <Form.Item name="note" label="Ghi Chú Thêm">
          <TextArea rows={2} placeholder="Ghi chú thêm cho đơn hàng... (tùy chọn)" maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateOrderModal;
