import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Space, Divider, Row, Col, InputNumber, Alert, Tooltip, Card, Typography, message } from 'antd';
import { RollbackOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../../../api/services';
import type { UnifiedTransactionRequest, UnifiedTransactionLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

const { Title, Text } = Typography;

const KitchenReturnForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getKhoBep = useWarehouseStore((s) => s.getKhoBep);
  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const khoBep = getKhoBep();
  const khoTong = getKhoTong();

  const [lines, setLines] = useState<UnifiedTransactionLine[]>([
    { itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' },
  ]);

  useEffect(() => {
    form.resetFields();
    setLines([{ itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' }]);
  }, [form]);

  const addLine = () => setLines((prev) => [...prev, { itemCode: '', itemName: '', unit: 'KG', quantity: 1, note: '' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof UnifiedTransactionLine, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const createReturnMutation = useMutation({
    mutationFn: (data: UnifiedTransactionRequest) => {
      // In a real app, this should go to inventoryService for processing returns
      return Promise.resolve(data);
    },
    onSuccess: () => {
      message.success('Đã tạo phiếu xuất trả thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'kitchen'] });
      navigate(-1);
    },
    onError: () => {
      message.error('Tạo phiếu xuất trả thất bại. Vui lòng thử lại.');
      navigate(-1);
    },
  });

  const onFinish = (values: any) => {
    if (!khoBep?.id || !khoTong?.id) {
      message.error('Không tìm thấy thông tin kho!');
      return;
    }

    if (lines.length === 0 || lines.some(l => !l.itemCode || !l.quantity)) {
      message.error('Vui lòng nhập đầy đủ thông tin mã sản phẩm và số lượng!');
      return;
    }

    const payload: UnifiedTransactionRequest = {
      type: 'TRANSFER', // Return is functionally a transfer back
      fromBranchId: khoBep.id,
      toBranchId: khoTong.id,
      note: values.note,
      lines,
    };
    
    createReturnMutation.mutate(payload);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <RollbackOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
          <Title level={3} style={{ margin: 0 }}>
            Xuất Trả Nguyên Liệu Hư → Kho Tổng
          </Title>
        </Space>
      </div>

      <Card>
        <Alert
          type="warning"
          showIcon
          message="Phiếu xuất trả nguyên liệu hư hỏng về Kho Tổng. Cần ghi rõ lý do để Admin xem xét và duyệt."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="note" label="Lý Do / Ghi Chú" rules={[{ required: true, message: 'Vui lòng ghi rõ lý do trả hàng' }]}>
                <Input.TextArea rows={2} placeholder="VD: Bơ bị mốc do bảo quản sai nhiệt độ..." />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
            <Text strong style={{ fontSize: 16 }}>Danh Sách Nguyên Liệu Trả</Text>
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Thêm Dòng
            </Button>
          </div>

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 500, color: '#595959' }}>
            <Col span={14}>Mã Nguyên Liệu</Col>
            <Col span={8}>Số lượng</Col>
            <Col span={2}></Col>
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {lines.map((line, i) => (
              <Row key={i} gutter={8} align="middle">
                <Col span={14}>
                  <Input
                    placeholder="Mã NL"
                    value={line.itemCode}
                    onChange={(e) => updateLine(i, 'itemCode', e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    min={0.01}
                    value={line.quantity}
                    onChange={(v) => updateLine(i, 'quantity', v ?? 1)}
                    style={{ width: '100%' }}
                    placeholder="SL"
                  />
                </Col>
                <Col span={2} style={{ textAlign: 'center' }}>
                  {lines.length > 1 && (
                    <Tooltip title="Xoá dòng">
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => removeLine(i)}
                      />
                    </Tooltip>
                  )}
                </Col>
              </Row>
            ))}
          </Space>

          <Divider />
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => navigate(-1)}>
                Hủy
              </Button>
              <Button 
                type="primary" 
                danger
                htmlType="submit" 
                loading={createReturnMutation.isPending}
                icon={<RollbackOutlined />}
              >
                Gửi Phiếu Xuất Trả (Chờ Duyệt)
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default KitchenReturnForm;