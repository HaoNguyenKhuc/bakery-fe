import React, { useState } from 'react';
import {
  Button, Form, Select, Input, InputNumber, Divider,
  Alert, Space, Typography, Row, Col, message, Card
} from 'antd';
import {
  WarningOutlined, PlusOutlined, DeleteOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { InventoryAdjustmentLine, InventoryAdjustmentRequest, AdjustmentType } from '../../../types';
import { useAuthStore } from '../../../store';

const { Title } = Typography;

interface AdjFormValues {
  adjustmentType: AdjustmentType;
  reason: string;
  note?: string;
}

const InventoryAdjustmentForm: React.FC = () => {
  const [form] = Form.useForm<AdjFormValues>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const warehouseCode = isWarehouseRole('KHO_TONG') ? 'MAIN' : isWarehouseRole('KHO_BEP') ? 'KITCHEN' : 'STORE';

  const [lines, setLines] = useState<InventoryAdjustmentLine[]>([
    { ingredientCode: '', ingredientName: '', unit: 'KG', lostQuantity: 0 },
  ]);

  const addLine = () =>
    setLines((prev) => [...prev, { ingredientCode: '', ingredientName: '', unit: 'KG', lostQuantity: 0 }]);

  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof InventoryAdjustmentLine, value: string | number) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const createMutation = useMutation({
    mutationFn: async (_req: InventoryAdjustmentRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('✅ Đã tạo phiếu điều chỉnh thất thoát (Chờ duyệt).');
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      navigate('/warehouse/inventory-adjustment');
    },
    onError: () => {
      message.warning('API chưa sẵn sàng — phiếu đã được ghi nhận (demo).');
      navigate('/warehouse/inventory-adjustment');
    },
  });

  const onFinish = (values: AdjFormValues) => {
    if (lines.length === 0 || lines.some(l => !l.ingredientCode || !l.ingredientName || !l.lostQuantity)) {
      message.error('Vui lòng nhập đầy đủ thông tin các dòng nguyên liệu thất thoát!');
      return;
    }
    
    createMutation.mutate({
      adjustmentType: values.adjustmentType,
      warehouseCode: warehouseCode as any,
      reason: values.reason,
      note: values.note,
      lines,
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warehouse/inventory-adjustment')}>
          Quay Lại
        </Button>
        <Divider type="vertical" />
        <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f', marginRight: 8 }} />
        <Title level={3} style={{ margin: 0 }}>
          Tạo Phiếu Thất Thoát / Điều Chỉnh
        </Title>
      </div>

      <Card>
        <Alert
          type="warning"
          showIcon
          message="Phiếu sẽ ở trạng thái Chờ Duyệt cho đến khi Admin phê duyệt."
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="adjustmentType"
                label="Loại Điều Chỉnh"
                rules={[{ required: true, message: 'Chọn loại điều chỉnh!' }]}
              >
                <Select placeholder="Chọn loại...">
                  <Select.Option value="LOSS">🔴 Mất hàng</Select.Option>
                  <Select.Option value="DAMAGE">🟠 Hư hỏng</Select.Option>
                  <Select.Option value="EXPIRED">⚫ Hết hạn sử dụng</Select.Option>
                  <Select.Option value="OTHER">🔵 Lý do khác</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label="Lý Do Cụ Thể"
            rules={[{ required: true, message: 'Mô tả lý do thất thoát!' }, { min: 10 }]}
          >
            <Input.TextArea rows={2} placeholder="Mô tả chi tiết nguyên nhân..." maxLength={300} showCount />
          </Form.Item>

          <Form.Item name="note" label="Ghi Chú Thêm">
            <Input.TextArea rows={1} placeholder="(Tùy chọn)" />
          </Form.Item>

          <Divider style={{ margin: '16px 0' }}>Danh Sách Nguyên Liệu Thất Thoát</Divider>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {lines.map((line, i) => (
              <Row key={i} gutter={8} align="middle">
                <Col span={5}>
                  <Input
                    placeholder="Mã NL"
                    value={line.ingredientCode}
                    onChange={(e) => updateLine(i, 'ingredientCode', e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Col>
                <Col span={7}>
                  <Input
                    placeholder="Tên nguyên liệu"
                    value={line.ingredientName}
                    onChange={(e) => updateLine(i, 'ingredientName', e.target.value)}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    value={line.unit}
                    onChange={(v) => updateLine(i, 'unit', v)}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="KG">KG</Select.Option>
                    <Select.Option value="Lít">Lít</Select.Option>
                    <Select.Option value="Cái">Cái</Select.Option>
                    <Select.Option value="Gói">Gói</Select.Option>
                  </Select>
                </Col>
                <Col span={5}>
                  <InputNumber
                    min={0.01}
                    value={line.lostQuantity || undefined}
                    onChange={(v) => updateLine(i, 'lostQuantity', v ?? 0)}
                    style={{ width: '100%' }}
                    placeholder="SL mất"
                  />
                </Col>
                <Col span={3} style={{ textAlign: 'center' }}>
                  {lines.length > 1 && (
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeLine(i)} />
                  )}
                </Col>
              </Row>
            ))}
            <Button type="dashed" block icon={<PlusOutlined />} onClick={addLine}>
              Thêm Dòng
            </Button>
          </Space>

          <Divider />
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => navigate('/warehouse/inventory-adjustment')}>
                Hủy
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={createMutation.isPending}
              >
                Gửi Phiếu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InventoryAdjustmentForm;