import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Button, Space, Divider, Row, Col, InputNumber, Alert, Tooltip } from 'antd';
import { ExportOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { masterService, inventoryService } from '../../../api/services';
import type { TransferRequest, TransferRequestLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TransferRequest) => void;
  submitting: boolean;
  sourceWarehouseId: string;
  warehouseCode?: string;
  useStockData?: boolean;
}

const TransferModal: React.FC<TransferModalProps> = ({ open, onClose, onSubmit, submitting, sourceWarehouseId, warehouseCode, useStockData }) => {
  const [form] = Form.useForm();
  
  // API Queries
  const { data: ingredientsData, isLoading: loadingIngredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => masterService.getIngredients().then((res: any) => res.content || []),
    enabled: open,
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['code-values', 'UNIT'],
    queryFn: () => masterService.getCodeValues('UNIT').then((res: any) => res.content || []),
    enabled: open,
  });

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['warehouse-stock-summary', warehouseCode],
    queryFn: () => inventoryService.getStockSummary(warehouseCode!),
    enabled: open && !!warehouseCode && !!useStockData,
  });
  const stockLots = stockData || [];

  // Warehouses
  const warehouses = useWarehouseStore((s) => s.warehouses);
  const targetWarehouses = warehouses.filter((w) => w.id !== sourceWarehouseId);

  const [lines, setLines] = useState<Partial<TransferRequestLine>[]>([
    { quantity: 1 }
  ]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([{ quantity: 1 }]);
    }
  }, [open, form]);

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

  const handleOk = () => {
    form.validateFields().then((values) => {
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
      
      onSubmit(payload);
    }).catch(err => {
      console.log('Validate Failed:', err);
    });
  };

  return (
    <Modal
      wrapClassName="fullscreen-modal-wrap"
      title={
        <Space>
          <ExportOutlined style={{ color: '#1890ff' }} />
          Xuất Kho
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Gửi Phiếu Xuất Kho"
      cancelText="Huỷ"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message="Phiếu xuất kho mới sẽ tự động được gửi yêu cầu phê duyệt."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
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
      </Form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#1f1f1f' }}>Danh Sách Sản Phẩm</div>
        <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
          Thêm Sản Phẩm
        </Button>
      </div>

      <Row gutter={8} style={{ marginBottom: 8, fontWeight: 500, color: '#595959' }}>
        <Col span={8}>Sản phẩm</Col>
        <Col span={4}>Số lượng</Col>
        <Col span={4}>Đơn vị</Col>
        <Col span={6}>Ghi chú</Col>
        <Col span={2}></Col>
      </Row>

      <div style={{ maxHeight: '40vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {lines.map((line, i) => (
          <Row key={i} gutter={8} align="middle">
            <Col span={8}>
              <Select
                placeholder="Chọn sản phẩm..."
                value={line.itemId}
                onChange={(val) => updateLine(i, 'itemId', val)}
                style={{ width: '100%' }}
                loading={useStockData ? loadingStock : loadingIngredients}
                showSearch
                filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}
              >
                {useStockData ? (
                  stockLots.map((stock: any) => {
                    const ingredient = ingredientsData?.find((ing: any) => ing.code === stock.item.key);
                    const itemUuid = ingredient ? ingredient.id : stock.item.key;
                    return (
                      <Select.Option key={stock.item.key} value={itemUuid}>
                        {stock.item.name} (Tồn hiện tại: {stock.totalQtyRemaining})
                      </Select.Option>
                    );
                  })
                ) : (
                  ingredientsData?.map((item: any) => (
                    <Select.Option key={item.id} value={item.id}>{item.name} ({item.code})</Select.Option>
                  ))
                )}
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
            <Col span={2}>
              {lines.length > 1 && (
                <Tooltip title="Xoá dòng">
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(i)} />
                </Tooltip>
              )}
            </Col>
          </Row>
        ))}
        
        </Space>
      </div>
    </Modal>
  );
};

export default TransferModal;
