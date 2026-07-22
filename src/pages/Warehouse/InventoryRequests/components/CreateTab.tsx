import React, { useState } from 'react';
import { Form, Select, DatePicker, Input, Button, Card, Row, Col, Space, InputNumber, Divider, Tooltip, message } from 'antd';
import { ArrowLeftOutlined, ImportOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { masterService, itemService, transactionService, inventoryService, warehouseService } from '../../../../api/services';

interface RequestLine {
  itemId?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  note?: string;
}

const CreateTab: React.FC = () => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<RequestLine[]>([{ quantity: 1 }]);
  const requestType = Form.useWatch('requestType', form);

  // Queries for lookups
  const { data: ingredientsData, isLoading: loadingIngredients } = useQuery({
    queryKey: ['items', 'ingredient-and-product'],
    queryFn: () => itemService.getAllItems({ size: 2000 }).then(res => res.content),
    staleTime: 60000,
  });

  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => masterService.getSuppliers().then(res => res.content || res),
    staleTime: 60000,
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: () => masterService.getCodeValues('UNIT').then(res => res.content),
    staleTime: 60000,
  });

  const { data: warehousesData, isLoading: loadingWarehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehouseService.getAll().then((res: any) => res.content || res),
    staleTime: 60000,
  });

  const addLine = () => setLines([...lines, { quantity: 1 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof RequestLine, value: any) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => inventoryService.createRequest(payload),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu kho thành công!');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
      form.resetFields();
      setLines([{ quantity: 1 }]);
    },
    onError: () => {
      message.error('Gửi yêu cầu thất bại. Vui lòng thử lại.');
    },
  });

  const onFinish = (values: any) => {
    if (lines.length === 0 || lines.some(l => !l.itemId || !l.quantity || !l.unit)) {
      message.error('Vui lòng nhập đầy đủ thông tin các sản phẩm!');
      return;
    }

    const payload: any = {
      requestType: values.requestType,
      requestDate: values.requestDate ? values.requestDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      targetWarehouseId: values.targetWarehouseId,
      note: values.note,
      lines: lines.map((l, idx) => ({
        itemId: l.itemId!,
        quantity: l.quantity!,
        unit: l.unit!,
        unitCost: l.unitCost ?? null,
        sortOrder: idx + 1,
        note: l.note || null
      })),
    };

    if (values.requestType === 'PURCHASE') {
      payload.supplierId = values.supplierId;
    } else if (values.requestType === 'TRANSFER') {
      payload.sourceWarehouseId = values.sourceWarehouseId;
      if (!payload.sourceWarehouseId) {
        message.error('Vui lòng chọn Kho xuất!');
        return;
      }
    }

    createMutation.mutate(payload);
  };

  const isPurchase = requestType === 'PURCHASE';

  return (
    <Card bordered={false}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ requestType: 'PURCHASE', requestDate: dayjs() }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="requestType" label="Loại Phiếu" rules={[{ required: true }]}>
              <Select options={[
                { value: 'PURCHASE', label: 'Nhập Kho (PURCHASE)' },
                { value: 'TRANSFER', label: 'Điều Chuyển (TRANSFER)' }
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="requestDate" label="Ngày Yêu Cầu" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          
          {isPurchase ? (
            <Col span={12}>
              <Form.Item name="supplierId" label="Nhà Cung Cấp" rules={[{ required: true }]}>
                <Select
                  placeholder="Chọn nhà cung cấp..."
                  loading={loadingSuppliers}
                  showSearch
                  filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={suppliersData?.map((s: any) => ({ value: s.id || s.key, label: s.name }))}
                />
              </Form.Item>
            </Col>
          ) : (
            <Col span={12}>
              <Form.Item name="sourceWarehouseId" label="Kho Xuất" rules={[{ required: true }]}>
                <Select
                  placeholder="Chọn kho xuất..."
                  loading={loadingWarehouses}
                  options={warehousesData?.map((w: any) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
            </Col>
          )}

          <Col span={12}>
            <Form.Item name="targetWarehouseId" label="Kho Nhận" rules={[{ required: true }]}>
              <Select
                placeholder="Chọn kho nhận..."
                loading={loadingWarehouses}
                options={warehousesData?.map((w: any) => ({ value: w.id, label: w.name }))}
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="note" label="Ghi Chú">
              <Input.TextArea rows={1} placeholder="Ghi chú cho phiếu..." />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
          <h4 style={{ margin: 0 }}>Danh Sách Sản Phẩm</h4>
          <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
            Thêm Dòng
          </Button>
        </div>

        <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600, color: '#595959' }}>
          <Col span={isPurchase ? 6 : 9}>Sản phẩm</Col>
          <Col span={4}>Số lượng</Col>
          <Col span={4}>Đơn vị</Col>
          {isPurchase && <Col span={5}>Đơn giá</Col>}
          <Col span={isPurchase ? 3 : 5}>Ghi chú</Col>
          <Col span={2}></Col>
        </Row>

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {lines.map((line, i) => (
            <Row key={i} gutter={8} align="middle">
              <Col span={isPurchase ? 6 : 9}>
                <Select
                  placeholder="Chọn sản phẩm..."
                  value={line.itemId}
                  onChange={(val) => {
                    const item = ingredientsData?.find((x: any) => x.id === val);
                    updateLine(i, 'itemId', val);
                    if (item?.unit) updateLine(i, 'unit', item.unit);
                  }}
                  style={{ width: '100%' }}
                  loading={loadingIngredients}
                  showSearch
                  filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={ingredientsData?.map((item: any) => ({ value: item.id, label: `${item.name} (${item.code})` }))}
                />
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
                  options={unitsData?.map((u: any) => ({ value: u.code, label: u.name }))}
                />
              </Col>
              {isPurchase && (
                <Col span={5}>
                  <InputNumber
                    min={0}
                    value={line.unitCost}
                    onChange={(v) => updateLine(i, 'unitCost', v ?? 0)}
                    style={{ width: '100%' }}
                    placeholder="Đơn giá"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Col>
              )}
              <Col span={isPurchase ? 3 : 5}>
                <Input
                  placeholder="Ghi chú"
                  value={line.note || ''}
                  onChange={(e) => updateLine(i, 'note', e.target.value)}
                />
              </Col>
              <Col span={2} style={{ textAlign: 'center' }}>
                <Tooltip title="Xoá dòng">
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => removeLine(i)}
                  />
                </Tooltip>
              </Col>
            </Row>
          ))}
        </Space>

        <Divider />
        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
          <Space>
            <Button onClick={() => {
              form.resetFields();
              setLines([{ quantity: 1 }]);
            }}>
              Làm Mới
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={createMutation.isPending}
              icon={<ImportOutlined />}
            >
              Tạo Phiếu
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default CreateTab;
