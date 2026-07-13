import React, { useState, useEffect } from 'react';
import {
  Form, Input, InputNumber, Divider, Select, Space, Button, Typography, Card, Row, Col, message
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService, itemService } from '../../../api/services';
import type { RecipeRequest, RecipeLineRequest } from '../../../types';
import type { ColumnsType } from 'antd/es/table';
import { Table, Popconfirm, Alert } from 'antd';

const { Title } = Typography;

interface RecipeLineRow {
  rowKey: string;
  itemId?: string;
  quantity: number;
  unit: string;
}

const RecipeForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId');
  const [form] = Form.useForm();
  const [lines, setLines] = useState<RecipeLineRow[]>([]);
  const queryClient = useQueryClient();

  // Fetch all items to select for recipe lines and to find current product
  const { data: allItemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  
  const allItems = Array.isArray(allItemsData) ? allItemsData : ((allItemsData as any)?.data || []);
  const product = allItems.find((i: any) => i.id === productId);

  useEffect(() => {
    if (!productId) {
      message.error('Không tìm thấy sản phẩm. Vui lòng chọn sản phẩm trước.');
      navigate('/products/recipes');
    }
  }, [productId, navigate]);

  const createMutation = useMutation({
    mutationFn: (data: RecipeRequest) => recipeService.create(data),
    onSuccess: () => {
      message.success('Tạo phiên bản công thức mới thành công! Phiên bản cũ đã bị deactivate.');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
      navigate('/products/recipes');
    },
    onError: () => message.error('Tạo công thức thất bại.'),
  });

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (lines.length === 0) {
      message.error('Công thức phải có ít nhất 1 dòng nguyên liệu.');
      return;
    }

    if (!product) {
      message.error('Dữ liệu sản phẩm chưa được tải đầy đủ.');
      return;
    }

    const recipeLines: RecipeLineRequest[] = lines.map((l) => ({
      itemId: l.itemId!,
      quantity: l.quantity,
      unit: l.unit,
    }));

    createMutation.mutate({
      productId: product.itemType === 'PRODUCT' ? product.id : undefined,
      semiProductId: product.itemType === 'SEMI_PRODUCT' ? product.id : undefined,
      note: values.note,
      lines: recipeLines,
    });
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        rowKey: crypto.randomUUID(),
        quantity: 0,
        unit: 'g',
      },
    ]);
  };

  const removeLine = (rowKey: string) => {
    setLines(lines.filter((l) => l.rowKey !== rowKey));
  };

  const updateLine = (rowKey: string, updates: Partial<RecipeLineRow>) => {
    setLines(lines.map((l) => (l.rowKey === rowKey ? { ...l, ...updates } : l)));
  };

  const columns: ColumnsType<RecipeLineRow> = [
    {
      title: 'Nguyên Liệu / Bán Thành Phẩm',
      dataIndex: 'itemId',
      render: (v: string, record) => (
        <Select
          size="small"
          showSearch
          placeholder="Tìm và chọn nguyên liệu..."
          value={v}
          onChange={(val) => {
            const selectedItem = allItems.find((i: any) => i.id === val);
            updateLine(record.rowKey, { 
              itemId: val,
              unit: selectedItem?.unit || record.unit
            });
          }}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          options={allItems.map((i: any) => ({
            value: i.id,
            label: `[${i.code}] ${i.name}`
          }))}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantity',
      width: 140,
      render: (v: number, record) => (
        <InputNumber
          size="small"
          min={0}
          value={v}
          style={{ width: '100%' }}
          onChange={(val) => updateLine(record.rowKey, { quantity: val ?? 0 })}
        />
      ),
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      width: 120,
      render: (v: string, record) => (
        <Input
          size="small"
          placeholder="Đơn vị..."
          value={v}
          onChange={(e) => updateLine(record.rowKey, { unit: e.target.value })}
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_: unknown, record) => (
        <Popconfirm
          title="Xoá dòng này?"
          onConfirm={() => removeLine(record.rowKey)}
          okText="Xoá"
          cancelText="Huỷ"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products/recipes')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Tạo Phiên Bản Công Thức Mới {product && `- ${product.name}`}
        </Title>
      </Space>

      <Card loading={itemsLoading}>
        <Alert
          type="warning"
          showIcon
          message="Tạo phiên bản mới sẽ tự động deactivate phiên bản đang hoạt động của cùng sản phẩm."
          style={{ marginBottom: 16 }}
        />
        
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="note" label="Ghi Chú">
                <Input placeholder="Lý do tạo phiên bản mới..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>Danh Sách Nguyên Liệu</Divider>
        
        <div>
          <Table<RecipeLineRow>
            columns={columns}
            dataSource={lines}
            rowKey="rowKey"
            pagination={false}
            size="small"
            bordered
            locale={{ emptyText: 'Chưa có nguyên liệu nào. Bấm "Thêm Dòng" để bắt đầu.' }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addLine}
            style={{ marginTop: 8, width: '100%' }}
          >
            Thêm Dòng Nguyên Liệu
          </Button>
        </div>

        <Divider />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/products/recipes')}>Huỷ</Button>
          <Button type="primary" onClick={handleSubmit} icon={<SaveOutlined />} loading={createMutation.isPending}>
            Lưu Công Thức
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RecipeForm;
