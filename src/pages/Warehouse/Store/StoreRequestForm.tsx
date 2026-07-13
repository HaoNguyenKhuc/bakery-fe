import React, { useState } from 'react';
import {
  Form, Input, Button, Space, Divider, Row, Col,
  InputNumber, Alert, Tooltip, Card, Typography,
  message, Select, Spin,
} from 'antd';
import {
  ShoppingCartOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryService, masterService } from '../../../api/services';
import type { TransferRequest, TransferRequestLine } from '../../../types';
import { useWarehouseStore } from '../../../store';

const { Title, Text } = Typography;

const StoreRequestForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getStores  = useWarehouseStore((s) => s.getStores);
  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const storeWarehouse = getStores()[0];
  const khoTong        = getKhoTong();

  // Load items (products/ingredients) for selection
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => masterService.getIngredients().then((res: any) => res.content ?? res ?? []),
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['code-values', 'UNIT'],
    queryFn: () => masterService.getCodeValues('UNIT').then((res: any) => res.content ?? res ?? []),
  });

  const [lines, setLines] = useState<Partial<TransferRequestLine>[]>([
    { quantity: 1 },
  ]);

  const addLine    = () => setLines((p) => [...p, { quantity: 1 }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof TransferRequestLine, value: any) =>
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const createMutation = useMutation({
    mutationFn: (payload: TransferRequest) => inventoryService.createRequest(payload),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu thêm bánh thành công. Chờ Kho Tổng phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'store'] });
      navigate(-1);
    },
    onError: (err: any) => {
      message.error(err?.message ?? 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    },
  });

  const onFinish = (values: any) => {
    if (!storeWarehouse?.id) {
      message.error('Không tìm thấy thông tin Cửa Hàng!');
      return;
    }
    if (!khoTong?.id) {
      message.error('Không tìm thấy thông tin Kho Tổng!');
      return;
    }
    if (lines.some((l) => !l.itemId || !l.quantity || !l.unit)) {
      message.error('Vui lòng nhập đầy đủ thông tin (sản phẩm, số lượng, đơn vị)!');
      return;
    }

    const payload: TransferRequest = {
      requestType:       'TRANSFER',
      requestDate:       dayjs().format('YYYY-MM-DD'),
      sourceWarehouseId: khoTong.id,
      targetWarehouseId: storeWarehouse.id,
      note:              values.note,
      lines:             lines as TransferRequestLine[],
    };

    createMutation.mutate(payload);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <ShoppingCartOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            Yêu Cầu Thêm Bánh
          </Title>
        </Space>
      </div>

      <Card>
        <Alert
          type="info"
          showIcon
          message="Đơn yêu cầu sẽ ở trạng thái Chờ Duyệt cho đến khi Kho Tổng phê duyệt."
          style={{ marginBottom: 16 }}
        />

        {/* Warehouse info banner */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
              <Text type="secondary">Kho nguồn (Kho Tổng)</Text>
              <br />
              <Text strong>{khoTong?.name ?? '—'}</Text>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
              <Text type="secondary">Kho nhận (Cửa Hàng)</Text>
              <br />
              <Text strong>{storeWarehouse?.name ?? '—'}</Text>
            </div>
          </Col>
        </Row>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="note" label="Ghi Chú / Lý Do">
            <Input.TextArea
              rows={2}
              placeholder="VD: Bánh Tiramisu hết sạch từ 9h sáng, cần bổ sung gấp..."
            />
          </Form.Item>

          {/* Line items header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
            <Text strong style={{ fontSize: 15 }}>Danh Sách Bánh Yêu Cầu</Text>
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Thêm Bánh
            </Button>
          </div>

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600, color: '#595959', fontSize: 12, textTransform: 'uppercase' }}>
            <Col span={10}>Sản phẩm</Col>
            <Col span={5}>Số lượng</Col>
            <Col span={7}>Đơn vị</Col>
            <Col span={2} />
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {lines.map((line, i) => (
              <Row key={i} gutter={8} align="middle">
                <Col span={10}>
                  <Select
                    showSearch
                    placeholder="Chọn sản phẩm..."
                    value={line.itemId}
                    onChange={(v) => updateLine(i, 'itemId', v)}
                    style={{ width: '100%' }}
                    loading={loadingItems}
                    filterOption={(input, option) =>
                      String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={loadingItems ? <Spin size="small" /> : 'Không tìm thấy'}
                  >
                    {(itemsData ?? []).map((item: any) => (
                      <Select.Option key={item.id} value={item.id}>
                        {item.name} {item.code ? `(${item.code})` : ''}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <InputNumber
                    min={1}
                    value={line.quantity}
                    onChange={(v) => updateLine(i, 'quantity', v ?? 1)}
                    style={{ width: '100%' }}
                    placeholder="SL"
                  />
                </Col>
                <Col span={7}>
                  <Select
                    placeholder="Đơn vị"
                    value={line.unit}
                    onChange={(v) => updateLine(i, 'unit', v)}
                    style={{ width: '100%' }}
                    loading={loadingUnits}
                  >
                    {(unitsData ?? []).map((u: any) => (
                      <Select.Option key={u.code} value={u.code}>{u.name}</Select.Option>
                    ))}
                  </Select>
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
              <Button onClick={() => navigate(-1)}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
                icon={<ShoppingCartOutlined />}
              >
                Gửi Yêu Cầu (Chờ Duyệt)
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default StoreRequestForm;