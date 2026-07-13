import React, { useState, useEffect } from 'react';
import { Form, Select, Input, Button, Space, Divider, Row, Col, InputNumber, Alert, Tooltip, Card, Typography, message } from 'antd';
import { FormOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { inventoryService, masterService } from '../../../api/services';
import type { AdjustRequest, AdjustRequestLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

const { Title, Text } = Typography;

const AdjustForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { warehouseCode } = useParams<{ warehouseCode: string }>(); // 'MAIN', 'KITCHEN', 'STORE'
  const queryClient = useQueryClient();

  const warehouses = useWarehouseStore((s) => s.warehouses);
  const targetWarehouse = warehouses.find(w => w.code === warehouseCode?.toUpperCase());
  const targetWarehouseId = targetWarehouse?.id;

  // API Queries
  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['warehouse-stock-summary', warehouseCode],
    queryFn: () => inventoryService.getStockSummary(warehouseCode!),
    enabled: !!warehouseCode,
  });

  const { data: ingredientsData } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => masterService.getIngredients().then((res: any) => res.content || []),
  });

  const stockLots = stockData || [];

  const [lines, setLines] = useState<Partial<AdjustRequestLine & { _tempId: number }>[]>([
    { _tempId: Date.now(), quantity: 0 }
  ]);

  useEffect(() => {
    form.resetFields();
    setLines([{ _tempId: Date.now(), quantity: 0 }]);
  }, [form]);

  const addLine = () => setLines((prev) => [...prev, { _tempId: Date.now(), quantity: 0 }]);
  const removeLine = (id: number) => setLines((prev) => prev.filter((l) => l._tempId !== id));
  
  const updateLine = (id: number, field: keyof AdjustRequestLine, value: any) => {
    setLines((prev) => prev.map((l) => {
      if (l._tempId === id) {
        const updated = { ...l, [field]: value };
        // Auto-fill unit and unitCost when item is selected
        if (field === 'itemId' && ingredientsData) {
          const ingredient = ingredientsData.find((ing: any) => ing.id === value || ing.code === value);
          if (ingredient) {
            updated.unit = ingredient.unit || ingredient.baseUnit || '';
            updated.unitCost = ingredient.lastPrice || 0;
          }
        }
        return updated;
      }
      return l;
    }));
  };

  const createAdjustMutation = useMutation({
    mutationFn: (data: any) => inventoryService.createRequest(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu điều chỉnh thành công. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', warehouseCode?.toLowerCase()] });
      navigate(-1);
    },
    onError: () => {
      message.error('Tạo phiếu điều chỉnh thất bại. Vui lòng thử lại.');
      navigate(-1);
    },
  });

  const onFinish = (values: any) => {
    if (!targetWarehouseId) {
      message.error('Không tìm thấy kho!');
      return;
    }

    const validLines = lines.filter(l => l.itemId);
    if (validLines.length === 0) {
      message.error('Vui lòng chọn ít nhất 1 sản phẩm để điều chỉnh!');
      return;
    }

    const payload: AdjustRequest = {
      requestType: 'ADJUSTMENT',
      requestDate: dayjs().format('YYYY-MM-DD'),
      targetWarehouseId,
      note: values.note,
      lines: validLines.map((l) => ({
        itemId: l.itemId!,
        quantity: l.quantity || 0,
        unit: l.unit || '',
        unitCost: l.unitCost ?? undefined,
        note: l.note || undefined,
      })),
    };
    
    createAdjustMutation.mutate(payload);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <FormOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
          <Title level={3} style={{ margin: 0 }}>
            Điều Chỉnh Tồn Kho ({targetWarehouse?.name || warehouseCode})
          </Title>
        </Space>
      </div>

      <Card>
        <Alert
          type="warning"
          showIcon
          message="Phiếu điều chỉnh tồn kho sẽ được gửi yêu cầu phê duyệt. Số lượng có thể là số âm (để giảm tồn) hoặc dương (để tăng tồn)."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="note" label="Ghi Chú / Lý do điều chỉnh">
                <Input.TextArea rows={2} placeholder="Nhập lý do điều chỉnh tồn kho..." />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
            <Text strong style={{ fontSize: 16 }}>Danh Sách Sản Phẩm</Text>
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Thêm Sản Phẩm
            </Button>
          </div>

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 500, color: '#595959' }}>
            <Col span={10}>Sản phẩm</Col>
            <Col span={5}>Số lượng điều chỉnh</Col>
            <Col span={3}>Đơn vị</Col>
            <Col span={5}>Ghi chú</Col>
            <Col span={1}></Col>
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {lines.map((line) => (
              <Row key={line._tempId} gutter={8} align="middle">
                <Col span={10}>
                  <Select
                    placeholder="Chọn sản phẩm trong kho..."
                    value={line.itemId}
                    onChange={(val) => updateLine(line._tempId!, 'itemId', val)}
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
                <Col span={5}>
                  <InputNumber
                    value={line.quantity}
                    onChange={(v) => updateLine(line._tempId!, 'quantity', v ?? 0)}
                    style={{ width: '100%' }}
                    placeholder="Số lượng (VD: -5, 10)"
                  />
                </Col>
                <Col span={3}>
                  <Input
                    placeholder="Đơn vị"
                    value={line.unit || ''}
                    readOnly
                    disabled
                  />
                </Col>
                <Col span={5}>
                  <Input
                    placeholder="Ghi chú dòng"
                    value={line.note || ''}
                    onChange={(e) => updateLine(line._tempId!, 'note', e.target.value)}
                  />
                </Col>
                <Col span={1} style={{ textAlign: 'center' }}>
                  {lines.length > 1 && (
                    <Tooltip title="Xoá dòng">
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(line._tempId!)} />
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
                loading={createAdjustMutation.isPending}
                icon={<FormOutlined />}
              >
                Gửi Yêu Cầu Điều Chỉnh
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AdjustForm;