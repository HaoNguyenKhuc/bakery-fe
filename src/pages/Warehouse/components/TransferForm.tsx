import React, { useState, useEffect } from 'react';
import { Form, Select, Input, Button, Space, Divider, Row, Col, InputNumber, Alert, Tooltip, Card, Typography, message } from 'antd';
import { ExportOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { masterService, inventoryService } from '../../../api/services';
import type { TransferRequest, TransferRequestLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

const { Title } = Typography;

const TransferForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { warehouseCode } = useParams<{ warehouseCode: string }>(); // 'MAIN', 'KITCHEN', 'STORE'
  const queryClient = useQueryClient();

  const warehouses = useWarehouseStore((s) => s.warehouses);
  const sourceWarehouse = warehouses.find(w => w.code === warehouseCode?.toUpperCase());
  const sourceWarehouseId = sourceWarehouse?.id;
  const targetWarehouses = warehouses.filter((w) => w.id !== sourceWarehouseId);

  // API Queries
  const { data: ingredientsData, isLoading: loadingIngredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => masterService.getIngredients().then((res: any) => res.content || []),
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['code-values', 'UNIT'],
    queryFn: () => masterService.getCodeValues('UNIT').then((res: any) => res.content || []),
  });

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['warehouse-stock-summary', warehouseCode],
    queryFn: () => inventoryService.getStockSummary(warehouseCode!),
    enabled: !!warehouseCode,
  });
  const stockLots = stockData || [];

  const [lines, setLines] = useState<Partial<TransferRequestLine>[]>([
    { quantity: 1 }
  ]);

  useEffect(() => {
    form.resetFields();
    setLines([{ quantity: 1 }]);
  }, [form]);

  const addLine = () => setLines((prev) => [...prev, { quantity: 1 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof TransferRequestLine, value: any) => {
    setLines((prev) => prev.map((l, idx) => {
      if (idx === i) {
        const updated = { ...l, [field]: value };
        if (field === 'itemId' && ingredientsData) {
          const ingredient = ingredientsData.find((ing: any) => ing.id === value || ing.code === value);
          if (ingredient) {
            updated.unit = ingredient.unit || ingredient.baseUnit || '';
          }
        }
        return updated;
      }
      return l;
    }));
  };

  const createTransferMutation = useMutation({
    mutationFn: (data: TransferRequest) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu xuất kho thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', warehouseCode?.toLowerCase()] });
      navigate(-1);
    },
    onError: () => {
      message.error('Tạo phiếu xuất thất bại. Vui lòng thử lại.');
      navigate(-1);
    },
  });

  const onFinish = (values: any) => {
    if (!sourceWarehouseId) {
      message.error('Không tìm thấy kho xuất!');
      return;
    }

    if (lines.length === 0 || lines.some(l => !l.itemId || !l.quantity || !l.unit)) {
      message.error('Vui lòng nhập đầy đủ thông tin các sản phẩm!');
      return;
    }

    const payload: TransferRequest = {
      requestType: 'TRANSFER',
      requestDate: dayjs().format('YYYY-MM-DD'),
      sourceWarehouseId,
      targetWarehouseId: values.targetWarehouseId,
      note: values.note,
      lines: lines.map((l, idx) => ({
        itemId: l.itemId!,
        quantity: l.quantity!,
        unit: l.unit!,
        note: l.note || null
      })),
    };
    
    createTransferMutation.mutate(payload);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <ExportOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            Tạo Phiếu Xuất Kho (Từ {sourceWarehouse?.name || warehouseCode})
          </Title>
        </Space>
      </div>

      <Card>
        <Alert
          type="info"
          showIcon
          message="Phiếu xuất kho mới sẽ tự động được gửi yêu cầu phê duyệt."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="targetWarehouseId" label="Kho Nhận" rules={[{ required: true, message: 'Vui lòng chọn kho nhận' }]}>
                <Select placeholder="Chọn kho nhận..." showSearch filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}>
                  {targetWarehouses.map((w) => (
                    <Select.Option key={w.id} value={w.id}>{w.name} ({w.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="note" label="Ghi Chú">
                <Input.TextArea rows={1} placeholder="Ghi chú cho phiếu xuất..." />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
            <Title level={5} style={{ margin: 0 }}>Danh Sách Sản Phẩm</Title>
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Thêm Sản Phẩm
            </Button>
          </div>

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600, color: '#595959' }}>
            <Col span={8}>Sản phẩm</Col>
            <Col span={4}>Số lượng</Col>
            <Col span={4}>Đơn vị</Col>
            <Col span={6}>Ghi chú</Col>
            <Col span={2}></Col>
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {lines.map((line, i) => (
              <Row key={i} gutter={8} align="middle">
                <Col span={8}>
                  <Select
                    placeholder="Chọn sản phẩm..."
                    value={line.itemId}
                    onChange={(val) => updateLine(i, 'itemId', val)}
                    style={{ width: '100%' }}
                    loading={loadingStock}
                    showSearch
                    filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}
                  >
                    {stockLots.map((stock: any) => {
                      const ingredient = ingredientsData?.find((ing: any) => ing.code === stock.item.key);
                      const itemUuid = ingredient ? ingredient.id : stock.item.key;
                      return (
                        <Select.Option key={stock.item.key} value={itemUuid}>
                          {stock.item.name} (Tồn hiện tại: {stock.totalQtyRemaining})
                        </Select.Option>
                      );
                    })}
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
                <Col span={6}>
                  <Input
                    placeholder="Ghi chú thêm..."
                    value={line.note || ''}
                    onChange={(e) => updateLine(i, 'note', e.target.value)}
                  />
                </Col>
                <Col span={2} style={{ textAlign: 'center' }}>
                  {lines.length > 1 && (
                    <Tooltip title="Xoá dòng">
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(i)} />
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
                loading={createTransferMutation.isPending}
                icon={<ExportOutlined />}
              >
                Gửi Phiếu Xuất Kho
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TransferForm;