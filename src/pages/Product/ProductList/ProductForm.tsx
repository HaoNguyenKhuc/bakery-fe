import React, { useEffect } from 'react';
import {
  Form, Select, Input, InputNumber, Row, Col, Card, Button,
  Space, message, Typography, Divider, Tag, Table, Popconfirm, Checkbox
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SaveOutlined,
  AppstoreOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, recipeService, itemGroupService, masterService } from '../../../api/services';
import type { ProductRequest } from '../../../types';

const { Title, Text } = Typography;

// Helper: extract array from various API response shapes
const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
};

const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm<ProductRequest>();
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: allItemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const allItems = extractArray(allItemsData);
  const ingredients = allItems.filter((i: any) => i.itemType === 'INGREDIENT');
  const semiProducts = allItems.filter((i: any) => i.itemType === 'SEMI_PRODUCT');

  const { data: itemGroupsData } = useQuery({
    queryKey: ['itemGroups'],
    queryFn: () => itemGroupService.getAll(),
  });
  const itemGroups = extractArray(itemGroupsData);

  const { data: unitsData } = useQuery({
    queryKey: ['codeValues', 'UNIT'],
    queryFn: () => masterService.getCodeValues('UNIT'),
  });
  const units = extractArray(unitsData);

  const { data: itemData, isLoading: loadingItem } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemService.getById(id!),
    enabled: isEdit,
  });

  // ── Populate form when editing ────────────────────────────────────────────────

  useEffect(() => {
    if (isEdit && itemData) {
      const editProduct: any = itemData;
      let recipe = undefined;
      if (editProduct.activeRecipe) {
        recipe = {
          ...editProduct.activeRecipe,
          lines: editProduct.activeRecipe.lines.map((l: any) => ({
            ...l,
            itemId: l.itemId,
          }))
        };
      }
      form.setFieldsValue({
        code: editProduct.code,
        name: editProduct.name,
        itemType: editProduct.itemType || 'PRODUCT',
        productType: editProduct.productType || undefined,
        productCategory: editProduct.productCategory || undefined,
        unit: editProduct.unit,
        ingredientType: editProduct.ingredientType || undefined,
        defaultSupplier: editProduct.defaultSupplier || undefined,
        itemGroupId: editProduct.itemGroupId || undefined,
        splittable: editProduct.splittable ?? false,
        unitSize: editProduct.unitSize ?? undefined,
        recipe: recipe as any,
      });
    } else if (!isEdit) {
      form.resetFields();
    }
  }, [isEdit, itemData, form]);

  // ── Mutation ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: ProductRequest) => {
      const payload = {
        ...values,
        unitSize: values.splittable ? (values.unitSize ?? null) : null,
      };
      let savedItem: any;
      if (isEdit) {
        savedItem = await itemService.submitUpdate(id!, payload);
      } else {
        savedItem = await itemService.submitCreate(payload);
      }

      const recipeLines = values.recipe?.lines;
      if (recipeLines && recipeLines.length > 0) {
        const itemId = savedItem?.id || savedItem?.data?.id || id;
        if (itemId) {
          try {
            await recipeService.create({
              ...(values.itemType === 'PRODUCT'
                ? { productId: itemId }
                : { semiProductId: itemId }),
              note: values.recipe?.note,
              lines: recipeLines,
            });
          } catch {
            throw new Error('Sản phẩm đã được lưu nhưng tạo công thức thất bại.');
          }
        }
      }
      return savedItem;
    },
    onSuccess: () => {
      message.success(isEdit ? 'Cập nhật thành công' : 'Tạo mới thành công');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/products');
    },
    onError: (error: any) => {
      message.error(error.message || (isEdit ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
      if (error.message === 'Sản phẩm đã được lưu nhưng tạo công thức thất bại.') {
        queryClient.invalidateQueries({ queryKey: ['items'] });
        navigate('/products');
      }
    }
  });

  const handleFinish = (values: any) => {
    mutation.mutate(values);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
            Danh Sách Hàng Hoá
          </Button>
          <Divider type="vertical" />
          <AppstoreOutlined style={{ fontSize: 20, color: '#D2691E' }} />
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? 'Chỉnh Sửa Hàng Hoá' : 'Tạo / Sửa sản phẩm'}
          </Title>
          {isEdit && (
            <Tag color="blue" style={{ marginLeft: 8 }}>ID: {id}</Tag>
          )}
        </Space>
        <Space>
          <Button onClick={() => navigate('/products')}>Huỷ</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={mutation.isPending}
            onClick={() => form.submit()}
          >
            {isEdit ? 'Lưu Cập Nhật' : 'Tạo sản phẩm'}
          </Button>
        </Space>
      </div>

      {/* Main Form */}
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Card
          title="Tạo sản phẩm mới"
          loading={isEdit && loadingItem}
          style={{ marginBottom: 24 }}
        >
          {/* Row 1: Loại + Item Group */}
          <Row gutter={24}>
            <Col xs={24} md={10}>
              <Form.Item
                name="itemType"
                label="Loại"
                rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
              >
                <Select
                  placeholder="-- Chọn --"
                  disabled={isEdit}
                  onChange={(val) => form.setFieldsValue({ itemType: val })}
                >
                  <Select.Option value="INGREDIENT">🥕 Nguyên Liệu</Select.Option>
                  <Select.Option value="SEMI_PRODUCT">🍞 Bán Thành Phẩm</Select.Option>
                  <Select.Option value="PRODUCT">🎂 Sản Phẩm</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item name="itemGroupId" label="Item Group">
                <Select
                  placeholder="-- Không có --"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={itemGroups.map((g: any) => ({
                    label: `[${g.code}] ${g.name}`,
                    value: g.id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 2: Code + Tên */}
          <Row gutter={24}>
            <Col xs={24} md={10}>
              <Form.Item
                name="code"
                label="Code"
                rules={[
                  { required: true, message: 'Vui lòng nhập mã' },
                  { max: 50, message: 'Tối đa 50 ký tự' },
                ]}
              >
                <Input placeholder="VD: BM001" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label="Tên"
                rules={[
                  { required: true, message: 'Vui lòng nhập tên' },
                  { max: 200, message: 'Tối đa 200 ký tự' },
                ]}
              >
                <Input placeholder="VD: Bánh Mì Bơ Tỏi" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 3: Đơn vị + Có thể xuất lẻ + Unit size — all bottom-aligned */}
          <Row gutter={24} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item
                name="unit"
                label="Đơn vị"
                rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}
              >
                <Select
                  placeholder="-- Chọn đơn vị --"
                  showSearch
                  optionFilterProp="label"
                  loading={!unitsData}
                  options={units.map((u: any) => ({
                    label: `${u.code} - ${u.name}`,
                    value: u.code,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={4}>
              {/* Empty label spacer to align checkbox with inputs */}
              <Form.Item
                name="splittable"
                valuePropName="checked"
                label=" "
                colon={false}
              >
                <Checkbox>Có thể xuất lẻ</Checkbox>
              </Form.Item>
            </Col>

            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.splittable !== cur.splittable}
            >
              {({ getFieldValue }) =>
                getFieldValue('splittable') ? (
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="unitSize"
                      label="Unit size"
                      rules={[{ required: true, message: 'Nhập unit size' }]}
                    >
                      <InputNumber
                        min={0}
                        step={0.5}
                        style={{ width: '100%' }}
                        placeholder="0.0"
                      />
                    </Form.Item>
                  </Col>
                ) : null
              }
            </Form.Item>
          </Row>

          {/* Conditional extra fields for INGREDIENT */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) => {
              if (getFieldValue('itemType') !== 'INGREDIENT') return null;
              return (
                <>
                  <Divider />
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item name="ingredientType" label="Loại Nguyên Liệu">
                        <Input placeholder="VD: Bột, Đường, Trứng..." />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="defaultSupplier" label="Nhà Cung Cấp Mặc Định">
                        <Input placeholder="VD: Công ty ABC" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>

          {/* Conditional extra fields for PRODUCT / SEMI_PRODUCT */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) => {
              const t = getFieldValue('itemType');
              if (t !== 'PRODUCT' && t !== 'SEMI_PRODUCT') return null;
              return (
                <>
                  <Divider />
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="productType"
                        label="Loại Sản Phẩm"
                        rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
                      >
                        <Select placeholder="Chọn loại">
                          <Select.Option value="STANDARD">STANDARD (Theo cái)</Select.Option>
                          <Select.Option value="SHEET_CAKE">SHEET_CAKE (Theo kg)</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>
        </Card>

        {/* Recipe Section */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
          {({ getFieldValue }) => {
            const t = getFieldValue('itemType');
            if (t !== 'SEMI_PRODUCT' && t !== 'PRODUCT') return null;

            return (
              <Card
                title="🔬 Cấu Hình Công Thức (Recipe)"
                extra={<Text type="secondary">Tùy chọn — có thể thêm sau trong mục Công Thức</Text>}
                style={{ marginBottom: 24 }}
              >
                <Form.List name={['recipe', 'lines']}>
                  {(fields, { add, remove }) => {
                    const columns = [
                      {
                        title: 'Nguyên Liệu / Bán Thành Phẩm',
                        dataIndex: 'name',
                        render: (name: number, field: any) => (
                          <Form.Item
                            {...field}
                            name={[name, 'itemId']}
                            rules={[{ required: true, message: 'Chọn thành phần' }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              size="small"
                              placeholder="Chọn nguyên liệu / bán thành phẩm"
                              showSearch
                              optionFilterProp="children"
                              onChange={(val) => {
                                const selectedItem = allItems.find((i: any) => i.id === val);
                                if (selectedItem) {
                                  const currentLines = form.getFieldValue(['recipe', 'lines']) || [];
                                  currentLines[name] = { ...currentLines[name], unit: selectedItem.unit };
                                  form.setFieldsValue({ recipe: { lines: currentLines } });
                                }
                              }}
                            >
                              <Select.OptGroup label="Nguyên Liệu">
                                {ingredients.map((i: any) => (
                                  <Select.Option key={i.id} value={i.id}>
                                    {`[${i.code}] ${i.name}`}
                                  </Select.Option>
                                ))}
                              </Select.OptGroup>
                              <Select.OptGroup label="Bán Thành Phẩm">
                                {semiProducts.map((i: any) => (
                                  <Select.Option key={i.id} value={i.id}>
                                    {`[${i.code}] ${i.name}`}
                                  </Select.Option>
                                ))}
                              </Select.OptGroup>
                            </Select>
                          </Form.Item>
                        ),
                      },
                      {
                        title: 'Số Lượng',
                        dataIndex: 'name',
                        width: 130,
                        render: (name: number, field: any) => (
                          <Form.Item
                            {...field}
                            name={[name, 'quantity']}
                            rules={[{ required: true, message: 'Nhập số lượng' }]}
                            style={{ margin: 0 }}
                          >
                            <InputNumber size="small" min={0.01} step={0.1} placeholder="Số lượng" style={{ width: '100%' }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: 'Đơn Vị',
                        dataIndex: 'name',
                        width: 110,
                        render: (name: number, field: any) => (
                          <Form.Item
                            {...field}
                            name={[name, 'unit']}
                            rules={[{ required: true, message: 'Nhập đơn vị' }]}
                            style={{ margin: 0 }}
                          >
                            <Input size="small" placeholder="Đơn vị" />
                          </Form.Item>
                        ),
                      },
                      {
                        title: 'Sort',
                        dataIndex: 'name',
                        width: 90,
                        render: (name: number, field: any) => (
                          <Form.Item
                            {...field}
                            name={[name, 'sortOrder']}
                            style={{ margin: 0 }}
                          >
                            <InputNumber size="small" min={1} placeholder="1" style={{ width: '100%' }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '',
                        width: 50,
                        dataIndex: 'name',
                        render: (name: number) => (
                          <Popconfirm
                            title="Xoá dòng này?"
                            onConfirm={() => remove(name)}
                            okText="Xoá"
                            cancelText="Huỷ"
                          >
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ];

                    return (
                      <>
                        <Table
                          columns={columns}
                          dataSource={fields}
                          rowKey="key"
                          pagination={false}
                          size="small"
                          bordered
                          locale={{ emptyText: 'Chưa có nguyên liệu nào. Bấm "Thêm Dòng" để bắt đầu.' }}
                        />
                        <Button
                          type="dashed"
                          onClick={() => add({ sortOrder: fields.length + 1 })}
                          block
                          icon={<PlusOutlined />}
                          style={{ marginTop: 8 }}
                        >
                          Thêm Dòng Công Thức
                        </Button>
                      </>
                    );
                  }}
                </Form.List>
              </Card>
            );
          }}
        </Form.Item>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 24 }}>
          <Button size="large" onClick={() => navigate('/products')}>Huỷ</Button>
          <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={mutation.isPending}>
            {isEdit ? 'Lưu Cập Nhật' : 'Tạo sản phẩm'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ProductForm;
