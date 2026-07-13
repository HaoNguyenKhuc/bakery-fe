import React, { useEffect } from 'react';
import {
  Form, Select, Input, InputNumber, Row, Col, Card, Button, Space, message, Typography, Divider, Tag
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, ArrowLeftOutlined, SaveOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService } from '../../../api/services';
import type { ProductRequest } from '../../../types';

const { Title, Text } = Typography;

const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm<ProductRequest>();
  const queryClient = useQueryClient();

  const { data: allItemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const allItems = Array.isArray(allItemsData) ? allItemsData : ((allItemsData as any)?.data || []);
  const ingredients = allItems.filter((i: any) => i.itemType === 'INGREDIENT');
  const semiProducts = allItems.filter((i: any) => i.itemType === 'SEMI_PRODUCT');

  const { data: itemData, isLoading: loadingItem } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemService.getById(id!),
    enabled: isEdit,
  });

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
        sellingPrice: editProduct.sellingPrice || undefined,
        ingredientType: editProduct.ingredientType || undefined,
        defaultSupplier: editProduct.defaultSupplier || undefined,
        recipe: recipe as any,
      });
    } else if (!isEdit) {
      form.resetFields();
    }
  }, [isEdit, itemData, form]);

  const mutation = useMutation({
    mutationFn: (values: ProductRequest) => {
      const payload = { ...values };
      if (isEdit) {
        return itemService.submitUpdate(id!, payload);
      }
      return itemService.submitCreate(payload);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Cập nhật thành công' : 'Tạo mới thành công');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/products');
    },
    onError: () => {
      message.error(isEdit ? 'Cập nhật thất bại' : 'Tạo mới thất bại');
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
            {isEdit ? 'Chỉnh Sửa Hàng Hoá' : 'Thêm Hàng Hoá Mới'}
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
            {isEdit ? 'Lưu Cập Nhật' : 'Tạo Mới'}
          </Button>
        </Space>
      </div>

      {/* Main Form */}
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Row gutter={24}>
          {/* Left Column: Core Info */}
          <Col xs={24} lg={14}>
            <Card
              title="Thông Tin Cơ Bản"
              loading={isEdit && loadingItem}
              style={{ marginBottom: 24 }}
            >
              <Form.Item
                name="itemType"
                label="Loại Hàng Hoá"
                rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
              >
                <Select
                  placeholder="Chọn loại hàng hoá"
                  disabled={isEdit}
                  onChange={(val) => form.setFieldsValue({ itemType: val })}
                  size="large"
                >
                  <Select.Option value="INGREDIENT">🥕 Nguyên Liệu</Select.Option>
                  <Select.Option value="SEMI_PRODUCT">🍞 Bán Thành Phẩm</Select.Option>
                  <Select.Option value="PRODUCT">🎂 Sản Phẩm</Select.Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item
                    name="code"
                    label="Mã (IN-CODE)"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mã' },
                      { max: 50, message: 'Tối đa 50 ký tự' },
                    ]}
                  >
                    <Input placeholder="VD: BM001" disabled={isEdit} size="large" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item
                    name="name"
                    label="Tên Hàng Hoá"
                    rules={[
                      { required: true, message: 'Vui lòng nhập tên' },
                      { max: 200, message: 'Tối đa 200 ký tự' },
                    ]}
                  >
                    <Input placeholder="VD: Bánh Mì Bơ Tỏi" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="productType"
                    label="Loại Sản Phẩm"
                    rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
                  >
                    <Select placeholder="Chọn loại" size="large">
                      <Select.Option value="STANDARD">STANDARD (Theo cái)</Select.Option>
                      <Select.Option value="SHEET_CAKE">SHEET_CAKE (Theo kg)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="unit"
                    label="Đơn Vị"
                    rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}
                  >
                    <Select placeholder="Chọn đơn vị" size="large">
                      <Select.Option value="PCS">PCS (cái)</Select.Option>
                      <Select.Option value="KG">KG</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Right Column: Additional Info */}
          <Col xs={24} lg={10}>
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}
            >
              {({ getFieldValue }) => {
                const currentItemType = getFieldValue('itemType');
                return (
                  <Card
                    title={currentItemType === 'INGREDIENT' ? 'Thông Tin Nguyên Liệu' : 'Thông Tin Sản Phẩm'}
                    loading={isEdit && loadingItem}
                    style={{ marginBottom: 24 }}
                  >
                    {currentItemType === 'INGREDIENT' ? (
                      <>
                        <Form.Item name="ingredientType" label="Loại Nguyên Liệu">
                          <Input placeholder="VD: Bột, Đường, Trứng..." size="large" />
                        </Form.Item>
                        <Form.Item name="defaultSupplier" label="Nhà Cung Cấp Mặc Định">
                          <Input placeholder="VD: Công ty ABC" size="large" />
                        </Form.Item>
                      </>
                    ) : (
                      <>
                        <Form.Item name="productCategory" label="Danh Mục">
                          <Input placeholder="VD: Bánh Kem, Bánh Mì..." size="large" />
                        </Form.Item>
                        <Form.Item name="sellingPrice" label="Giá Bán (VNĐ)">
                          <InputNumber<number>
                            min={0}
                            size="large"
                            style={{ width: '100%' }}
                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0}
                            placeholder="VD: 50,000"
                          />
                        </Form.Item>
                      </>
                    )}
                  </Card>
                );
              }}
            </Form.Item>
          </Col>
        </Row>

        {/* Full-width Recipe Section */}
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}
        >
          {({ getFieldValue }) => {
            const currentItemType = getFieldValue('itemType');
            if (currentItemType === 'INGREDIENT') return null;

            return (
              <Card
                title="🔬 Cấu Hình Công Thức (Recipe)"
                extra={<Text type="secondary">Tùy chọn — có thể thêm sau trong mục Công Thức</Text>}
                style={{ marginBottom: 24 }}
              >
                <Form.List name={['recipe', 'lines']}>
                  {(fields, { add, remove }) => (
                    <>
                      {fields.length > 0 && (
                        <Row gutter={8} style={{ marginBottom: 8, padding: '0 4px' }}>
                          <Col flex="1"><Text type="secondary" style={{ fontSize: 12 }}>Nguyên liệu / Bán thành phẩm</Text></Col>
                          <Col style={{ width: 140 }}><Text type="secondary" style={{ fontSize: 12 }}>Số lượng</Text></Col>
                          <Col style={{ width: 120 }}><Text type="secondary" style={{ fontSize: 12 }}>Đơn vị</Text></Col>
                          <Col style={{ width: 40 }} />
                        </Row>
                      )}

                      {fields.map(({ key, name, ...restField }) => (
                        <Row key={key} gutter={8} style={{ marginBottom: 8 }} align="middle">
                          <Col flex="1">
                            <Form.Item
                              {...restField}
                              name={[name, 'itemId']}
                              rules={[{ required: true, message: 'Chọn thành phần' }]}
                              style={{ margin: 0 }}
                            >
                              <Select
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
                                    <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
                                  ))}
                                </Select.OptGroup>
                                <Select.OptGroup label="Bán Thành Phẩm">
                                  {semiProducts.map((i: any) => (
                                    <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
                                  ))}
                                </Select.OptGroup>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col style={{ width: 140 }}>
                            <Form.Item
                              {...restField}
                              name={[name, 'quantity']}
                              rules={[{ required: true, message: 'Nhập số lượng' }]}
                              style={{ margin: 0 }}
                            >
                              <InputNumber min={0.1} step={0.1} placeholder="Số lượng" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col style={{ width: 120 }}>
                            <Form.Item
                              {...restField}
                              name={[name, 'unit']}
                              rules={[{ required: true, message: 'Nhập đơn vị' }]}
                              style={{ margin: 0 }}
                            >
                              <Input placeholder="Đơn vị" />
                            </Form.Item>
                          </Col>
                          <Col style={{ width: 40 }}>
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                          </Col>
                        </Row>
                      ))}

                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                        style={{ marginTop: fields.length > 0 ? 8 : 0 }}
                      >
                        Thêm Dòng Công Thức
                      </Button>
                    </>
                  )}
                </Form.List>
              </Card>
            );
          }}
        </Form.Item>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 24 }}>
          <Button size="large" onClick={() => navigate('/products')}>Huỷ</Button>
          <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={mutation.isPending}>
            {isEdit ? 'Lưu Cập Nhật' : 'Tạo Mới'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ProductForm;
