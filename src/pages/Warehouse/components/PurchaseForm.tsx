import React, { useState, useEffect } from 'react';
import { Form, Select, DatePicker, Input, Button, Space, Divider, Row, Col, InputNumber, Tooltip, Alert, Card, Typography, message } from 'antd';
import { ImportOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { masterService } from '../../../api/services';
import type { PurchaseRequest, PurchaseRequestLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

const { Title, Text } = Typography;

const PurchaseForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const khoTongId = getKhoTong?.id;

  // API Queries
  const { data: ingredientsData, isLoading: loadingIngredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => masterService.getIngredients().then((res: any) => res.content || []),
  });

  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => masterService.getSuppliers().then((res: any) => res.content || []),
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['code-values', 'UNIT'],
    queryFn: () => masterService.getCodeValues('UNIT').then((res: any) => res.content || []),
  });

  const [lines, setLines] = useState<Partial<PurchaseRequestLine>[]>([
    { quantity: 1, unitCost: 0 }
  ]);

  useEffect(() => {
    form.setFieldsValue({
      expectedDeliveryDate: dayjs(),
    });
  }, [form]);

  const addLine = () => setLines((prev) => [...prev, { quantity: 1, unitCost: 0 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof PurchaseRequestLine, value: any) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const createPurchaseMutation = useMutation({
    mutationFn: async (_req: PurchaseRequest) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('Đã gửi yêu cầu nhập kho thành công!');
      queryClient.invalidateQueries({ queryKey: ['purchase-receipts'] });
      navigate(-1);
    },
    onError: () => {
      message.warning('API chưa sẵn sàng — yêu cầu đã được ghi nhận (demo).');
      navigate(-1);
    },
  });

  const onFinish = (values: any) => {
    if (!khoTongId) {
      message.error('Không tìm thấy Kho Tổng!');
      return;
    }

    if (lines.length === 0 || lines.some(l => !l.itemId || !l.quantity || !l.unit)) {
      message.error('Vui lòng nhập đầy đủ thông tin các sản phẩm!');
      return;
    }

    const payload: PurchaseRequest = {
      requestType: 'PURCHASE',
      requestDate: dayjs().format('YYYY-MM-DD'),
      expectedDeliveryDate: values.expectedDeliveryDate ? values.expectedDeliveryDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      targetWarehouseId: khoTongId,
      supplierId: values.supplierId,
      note: values.note,
      lines: lines.map((l, idx) => ({
        itemId: l.itemId!,
        quantity: l.quantity!,
        unit: l.unit!,
        unitCost: l.unitCost!,
        sortOrder: idx + 1,
        note: l.note || null
      })),
    };
    
    createPurchaseMutation.mutate(payload);
  };

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current < dayjs().startOf('day');
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <ImportOutlined style={{ fontSize: 24, color: '#52c41a' }} />
          <Title level={3} style={{ margin: 0 }}>
            Tạo Phiếu Nhập Kho (Từ NCC)
          </Title>
        </Space>
      </div>

      <Card>
        <Alert
          type="info"
          showIcon
          message="Phiếu nhập kho mới sẽ tự động được gửi yêu cầu phê duyệt."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplierId" label="Nhà Cung Cấp" rules={[{ required: true, message: 'Vui lòng chọn nhà cung cấp' }]}>
                <Select placeholder="Chọn nhà cung cấp..." loading={loadingSuppliers} showSearch filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}>
                  {suppliersData?.map((s: any) => (
                    <Select.Option key={s.id || s.key} value={s.id || s.key}>{s.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expectedDeliveryDate" label="Ngày Dự Kiến Giao" rules={[{ required: true, message: 'Vui lòng chọn ngày giao' }]}>
                <DatePicker style={{ width: '100%' }} disabledDate={disabledDate} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="Ghi Chú">
            <Input.TextArea rows={2} placeholder="Ghi chú cho phiếu nhập..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
            <Title level={5} style={{ margin: 0 }}>Danh Sách Sản Phẩm</Title>
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Thêm Sản Phẩm
            </Button>
          </div>

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600, color: '#595959' }}>
            <Col span={6}>Sản phẩm</Col>
            <Col span={4}>Số lượng</Col>
            <Col span={4}>Đơn vị</Col>
            <Col span={5}>Đơn giá</Col>
            <Col span={3}>Ghi chú</Col>
            <Col span={2}></Col>
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {lines.map((line, i) => (
              <Row key={i} gutter={8} align="middle">
                <Col span={6}>
                  <Select
                    placeholder="Chọn sản phẩm..."
                    value={line.itemId}
                    onChange={(val) => updateLine(i, 'itemId', val)}
                    style={{ width: '100%' }}
                    loading={loadingIngredients}
                    showSearch
                    filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}
                  >
                    {ingredientsData?.map((item: any) => (
                      <Select.Option key={item.id} value={item.id}>{item.name} ({item.code})</Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={4}>
                  <InputNumber
                    min={0.01}
                    value={line.quantity}
                    onChange={(v) => updateLine(i, 'quantity', v ?? 1)}
                    style={{ width: '100%' }}
                    placeholder="Số lượng"
                  />
                </Col>
                <Col span={4}>
                  <Select
                    placeholder="Đơn vị"
                    value={line.unit}
                    onChange={(val) => updateLine(i, 'unit', val)}
                    style={{ width: '100%' }}
                    loading={loadingUnits}
                  >
                    {unitsData?.map((u: any) => (
                      <Select.Option key={u.code} value={u.code}>{u.name}</Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <InputNumber
                    min={0}
                    value={line.unitCost}
                    onChange={(v) => updateLine(i, 'unitCost', v ?? 0)}
                    style={{ width: '100%' }}
                    placeholder="Tổng Giá (VND)"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Col>
                <Col span={3}>
                  <Input
                    placeholder="Ghi chú"
                    value={line.note || ''}
                    onChange={(e) => updateLine(i, 'note', e.target.value)}
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
                htmlType="submit" 
                loading={createPurchaseMutation.isPending}
                icon={<ImportOutlined />}
              >
                Gửi Phiếu Nhập Kho
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PurchaseForm;