import React from 'react';
import { Modal, Form, Input, Typography } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  open: boolean;
  slipCode: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const RejectReasonModal: React.FC<Props> = ({ open, slipCode, onConfirm, onCancel, loading }) => {
  const [form] = Form.useForm<{ reason: string }>();

  const handleOk = () => {
    form.validateFields().then(({ reason }) => {
      onConfirm(reason.trim());
      form.resetFields();
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={
        <span style={{ color: '#ff4d4f' }}>
          <CloseCircleOutlined style={{ marginRight: 8 }} />
          Xác Nhận Từ Chối Phiếu
        </span>
      }
      okText="Xác Nhận Từ Chối"
      cancelText="Hủy"
      okButtonProps={{ danger: true, loading }}
      onOk={handleOk}
      onCancel={handleCancel}
      destroyOnClose
      width={480}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Bạn đang từ chối phiếu <Text code>{slipCode}</Text>. Vui lòng nhập lý do để Kho Tổng biết và làm lại phiếu mới.
      </Text>
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="Lý Do Từ Chối"
          rules={[
            { required: true, message: 'Bắt buộc nhập lý do từ chối!' },
            { min: 10, message: 'Lý do cần ít nhất 10 ký tự!' },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={300}
            showCount
            placeholder="VD: Số lượng kem tươi không đủ, thiếu 5kg so với phiếu..."
            autoFocus
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RejectReasonModal;
