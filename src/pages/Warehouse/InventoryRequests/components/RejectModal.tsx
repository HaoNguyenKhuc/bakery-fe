import React from 'react';
import { Modal, Form, Input, Button, Space, Alert } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { UnifiedTransactionResponse, RejectRequestPayload } from '../../../types';

interface RejectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (id: string, payload: RejectRequestPayload) => void;
  submitting: boolean;
  record: UnifiedTransactionResponse | null;
}

const RejectModal: React.FC<RejectModalProps> = ({ open, onClose, onSubmit, submitting, record }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      if (!record) return;

      const payload: RejectRequestPayload = {
        reason: values.rejectedReason,
        type: record.requestType === 'PURCHASE' ? 'IMPORT' : record.requestType,
        transactionDate: dayjs().format('YYYY-MM-DD'),
        toBranchId: record.targetWarehouse?.key || undefined,
        supplierId: record.supplier?.key || undefined,
        transactionReason: record.requestType === 'PURCHASE' ? 'PURCHASE' : undefined,
        totalAmount: 0,
        paymentStatus: 'UNPAID',
        note: 'Từ chối phiếu yêu cầu',
        lines: record.lines.map((line) => ({
          itemId: line.ingredientId || line.ingredientCode || '',
          itemType: 'INGREDIENT',
          qtyRequested: line.qty,
          unit: line.unit,
          unitPrice: line.unitPrice || 0,
          note: 'Từ chối',
        })),
      };

      onSubmit(record.id, payload);
    }).catch(err => {
      console.log('Validate Failed:', err);
    });
  };

  return (
    <Modal
      title={
        <Space>
          <CloseOutlined style={{ color: '#ff4d4f' }} />
          Từ Chối Phiếu Yêu Cầu
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Từ Chối"
      cancelText="Huỷ"
      okButtonProps={{ danger: true }}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        message={`Bạn đang từ chối phiếu ${record?.code}. Hành động này không thể hoàn tác.`}
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          name="rejectedReason"
          label="Lý Do Từ Chối"
          rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối' }]}
        >
          <Input.TextArea rows={4} placeholder="Nhập lý do từ chối phiếu này..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RejectModal;
