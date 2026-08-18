import React, { useEffect, useState } from 'react';
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
import { itemService, recipeService, itemGroupService, supplierService } from '../../../api/services';
import unitService from '../../../api/services/unitService';
import type { ProductRequest, ItemPackaging, ItemPackagingRequest } from '../../../types';

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

  // ── Packaging State ───────────────────────────────────────────────────────────
  /** Row trong bảng đóng gói — bao gồm _key để dùng làm React key */
  type PackagingRow = ItemPackagingRequest & { _key: string };
  const [packagings, setPackagings] = useState<PackagingRow[]>([]);
  const [savingPackagings, setSavingPackagings] = useState(false);

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

  const { data: unitsData = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitService.getAll(),
  });
  const units = extractArray(unitsData);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => supplierService.getAll(),
  });
  const suppliers = extractArray(suppliersData);

  const { data: itemData, isLoading: loadingItem } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemService.getById(id!),
    enabled: isEdit,
  });

  // ── Populate form when editing ────────────────────────────────────────────────

  useEffect(() => {
    if (isEdit && itemData) {
      const editProduct: any = itemData;

      // Tìm itemGroupId: nếu API trả về object itemGroup { key, name }, khớp key với itemGroups để lấy ID
      let itemGroupId = editProduct.itemGroupId || editProduct.itemGroup?.id;
      if (!itemGroupId && editProduct.itemGroup) {
        const groupKey = editProduct.itemGroup.key || editProduct.itemGroup.code;
        if (groupKey) {
          const matched = itemGroups.find(
            (g: any) => g.code === groupKey || g.id === groupKey
          );
          if (matched) {
            itemGroupId = matched.id;
          }
        }
      }

      // Tìm defaultSupplierId từ defaultSupplier (string hoặc object { key, name })
      let defaultSupplierId = editProduct.defaultSupplierId || editProduct.defaultSupplier?.id;
      if (!defaultSupplierId && editProduct.defaultSupplier) {
        if (typeof editProduct.defaultSupplier === 'string') {
          // Trường hợp là string (ID, code, hoặc name)
          const matched = suppliers.find(
            (s: any) => s.id === editProduct.defaultSupplier
              || s.code === editProduct.defaultSupplier
              || s.name === editProduct.defaultSupplier
          );
          if (matched) defaultSupplierId = matched.id;
        } else if (typeof editProduct.defaultSupplier === 'object') {
          // Trường hợp là object { key: "SG", name: "SG" }
          const supplierKey = editProduct.defaultSupplier.key || editProduct.defaultSupplier.code;
          const matched = suppliers.find(
            (s: any) =>
              (supplierKey && (s.code === supplierKey || s.id === supplierKey))
              || s.name === editProduct.defaultSupplier.name
          );
          if (matched) defaultSupplierId = matched.id;
        }
      }

      const rawRecipe = editProduct.recipe || editProduct.activeRecipe;
      let recipe = undefined;
      if (rawRecipe && Array.isArray(rawRecipe.lines)) {
        recipe = {
          ...rawRecipe,
          lines: rawRecipe.lines.map((l: any) => {
            const targetKey = l.itemId || l.item?.id || l.item?.key;
            const matchedItem = allItems.find(
              (i: any) => i.id === targetKey || i.code === targetKey
            );
            return {
              ...l,
              itemId: matchedItem ? matchedItem.id : targetKey,
            };
          }),
        };
      }

      form.setFieldsValue({
        code: editProduct.code,
        name: editProduct.name,
        itemType: editProduct.itemType || 'PRODUCT',
        productCategory: editProduct.productCategory || undefined,
        unit: editProduct.unit,
        defaultSupplier: editProduct.defaultSupplier || undefined,
        itemGroupId: editProduct.itemGroupId || undefined,
        splittable: editProduct.splittable ?? false,
        unitSize: editProduct.unitSize ?? undefined,
        baseUnit: editProduct.baseUnit || undefined,
        // ingredientType: editProduct.ingredientType || undefined,
        defaultSupplierId: defaultSupplierId || undefined,
        // itemGroupId: itemGroupId || undefined,
        // splittable: editProduct.splittable ?? false,
        // unitSize: editProduct.unitSize ?? undefined,
        unitCost: editProduct.unitCost ?? editProduct.lastPrice ?? undefined,
        shelfDays: editProduct.shelfDays ?? undefined,
        recipe: recipe as any,
      });
    } else if (!isEdit) {
      form.resetFields();
    }
  }, [isEdit, itemData, itemGroups, allItems, suppliers, form]);

  // ── Packaging Sync — useEffect riêng, chỉ watch itemData ─────────────────────────
  // Tách khỏi useEffect chính để tránh vòng lặp vô tận do allItems tạo array mới mỗi render
  useEffect(() => {
    if (isEdit && itemData) {
      const rawPackagings: ItemPackaging[] = (itemData as any).packagings ?? [];
      setPackagings(rawPackagings.map(p => ({
        // Dùng p.id || p.code — không dùng Date.now() để key ổn định
        _key: p.id || p.code,
        code: p.code,
        name: p.name,
        qtyPerPack: p.qtyPerPack,
        isDefault: !!p.isDefault,
      })));
    } else if (!isEdit) {
      setPackagings([]);
    }
  }, [isEdit, itemData]); // chỉ chạy khi itemData thay đổi thực sự


  // ── Mutation ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: ProductRequest) => {
      const payload = {
        ...values,
        unitSize: values.splittable ? (values.unitSize ?? null) : null,
        shelfDays: values.itemType === 'PRODUCT' ? (values.shelfDays ?? null) : null,
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
    onSuccess: async (savedItem: any) => {
      // 3e — Create flow: nếu tạo mới INGREDIENT + có packaging rows → lưu sau khi có ID
      const newId = savedItem?.id || savedItem?.data?.id;
      const itemType = form.getFieldValue('itemType');
      if (!isEdit && newId && itemType === 'INGREDIENT' && packagings.length > 0) {
        const valid = packagings.filter(p => p.code.trim() && p.name.trim() && p.qtyPerPack > 0);
        if (valid.length > 0) {
          try {
            await itemService.updatePackagings(newId, valid.map(({ _key, ...r }) => r));
          } catch {
            message.warning('Hàng hoá đã tạo, nhưng lưu đóng gói thất bại. Vào chỉnh sửa để thêm lại.');
          }
        }
      }
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

  // ── Packaging Handlers (3d) ───────────────────────────────────────────────────

  /** Thêm 1 dòng trống vào cuối bảng đóng gói */
  const handleAddPackagingRow = () => {
    setPackagings(prev => [...prev, {
      _key: `new_${Date.now()}`,
      code: '',
      name: '',
      qtyPerPack: 1,
      isDefault: prev.length === 0, // Row đầu tiên tự là mặc định
    }]);
  };

  /** Cập nhật 1 field của 1 row */
  const handlePackagingChange = (idx: number, field: keyof ItemPackagingRequest, value: any) => {
    setPackagings(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  /** Mutual-exclusive isDefault: tick row này → tự bỏ tick tất cả row khác */
  const handlePackagingDefaultChange = (clickedIdx: number, checked: boolean) => {
    setPackagings(prev => prev.map((r, i) => ({
      ...r,
      isDefault: checked ? (i === clickedIdx) : (i === clickedIdx ? false : r.isDefault),
    })));
  };

  /** Xóa 1 row. Nếu xóa isDefault → tự set row đầu tiên còn lại làm mặc định */
  const handleRemovePackagingRow = (idx: number) => {
    setPackagings(prev => {
      const wasDefault = prev[idx]?.isDefault;
      const next = prev.filter((_, i) => i !== idx);
      if (wasDefault && next.length > 0) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
  };

  /** Gọi PUT /api/v1/items/{id}/packagings — chỉ dùng khi isEdit */
  const handleSavePackagings = async () => {
    const valid = packagings.filter(p => p.code.trim() && p.name.trim() && p.qtyPerPack > 0);
    if (!valid.length) {
      message.error('Cần ít nhất 1 quy cách có đầy đủ Mã, Tên và Qty/pack!');
      return;
    }
    setSavingPackagings(true);
    try {
      await itemService.updatePackagings(id!, valid.map(({ _key, ...rest }) => rest));
      message.success('Đã lưu quy cách đóng gói ✓');
      queryClient.invalidateQueries({ queryKey: ['item', id] });
    } catch {
      message.error('Lưu đóng gói thất bại, vui lòng thử lại.');
    } finally {
      setSavingPackagings(false);
    }
  };

  const handleFinish = (values: any) => {
    mutation.mutate(values);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
            Danh Sách Hàng Hoá
          </Button>
          <Divider type="vertical" className="hide-on-mobile" />
          <AppstoreOutlined style={{ fontSize: 20, color: '#D2691E' }} />
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? 'Chỉnh Sửa Hàng Hoá' : 'Tạo / Sửa sản phẩm'}
          </Title>
          {isEdit && (
            <Tag color="blue" style={{ marginLeft: 8 }}>ID: {id}</Tag>
          )}
        </Space>
        <Space className="mobile-sticky-footer">
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
          title="Thông Tin Hàng Hoá"
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
              <Form.Item name="itemGroupId" label="Nhóm mặt hàng">
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
                label="Mã"
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
                  options={units.map((u: any) => ({
                    label: u.name || u.code,
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
                      label="Kích cỡ"
                      rules={[{ required: true, message: 'Nhập kích cỡ' }]}
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

            <Col xs={24} md={8}>
              <Form.Item
                name="baseUnit"
                label="Đơn vị cơ sở"
                tooltip="Điền khi unit là đơn vị đóng gói. Vd: unit=HOP, unitSize=5, baseUnit=KG → hệ thống hiểu 1 HOP = 5 KG khi tính giá công thức."
              >
                <Input placeholder="VD: KG, G, L, ML..." style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Conditional fields for INGREDIENT */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) => {
              if (getFieldValue('itemType') !== 'INGREDIENT') return null;
              return (
                <>
                  <Divider />
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item name="defaultSupplier" label="Nhà Cung Cấp Mặc Định">
                        <Input placeholder="VD: Công ty ABC" />
                        {/* <Form.Item name="ingredientType" label="Loại Nguyên Liệu">
                        <Input placeholder="VD: Bột, Đường, Trứng..." /> */}
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="defaultSupplierId" label="Nhà Cung Cấp">
                        <Select
                          placeholder="-- Chọn nhà cung cấp --"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={suppliers.map((s: any) => ({
                            label: `[${s.code}] ${s.name}`,
                            value: s.id,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>

          {/* Hạn sử dụng (ngày) — chỉ hiện cho PRODUCT */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) =>
              getFieldValue('itemType') === 'PRODUCT' ? (
                <Row gutter={24}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="shelfDays"
                      label="Hạn sử dụng (ngày)"
                      tooltip="0 = trong ngày. Để trống nếu không có hạn."
                    >
                      <InputNumber
                        min={0}
                        step={1}
                        precision={0}
                        style={{ width: '100%' }}
                        placeholder="0 = trong ngày"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null
            }
          </Form.Item>

          {/* Giá vốn — INGREDIENT và SEMI_PRODUCT */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) => {
              const t = getFieldValue('itemType');
              // if (t !== 'PRODUCT' && t !== 'SEMI_PRODUCT') return null;
              // return null;
              if (t !== 'INGREDIENT' && t !== 'SEMI_PRODUCT') return null;
              return (
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Form.Item name="unitCost" label="Giá vốn (đ/đvt) — Nhập tay">
                      <InputNumber
                        min={0}
                        step={1000}
                        style={{ width: '100%' }}
                        placeholder="0"
                        formatter={(value) =>
                          value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                        }
                        parser={(value) => value?.replace(/,/g, '') as any}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          {/* ── Đóng Gói Section — chỉ hiện khi INGREDIENT ── */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType || prev.unit !== cur.unit}
          >
            {({ getFieldValue }) => {
              if (getFieldValue('itemType') !== 'INGREDIENT') return null;
              const currentUnit = getFieldValue('unit') || '?';

              const thSt: React.CSSProperties = {
                padding: '6px 8px',
                fontWeight: 600,
                fontSize: 12,
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                textAlign: 'left',
                background: '#f8fafc',
              };
              const tdSt: React.CSSProperties = {
                padding: '4px 6px',
                borderBottom: '1px solid #f1f5f9',
                verticalAlign: 'middle',
              };

              return (
                <>
                  <Divider />

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text strong>
                      📦 Đóng gói{' '}
                      <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                        (đơn vị: {currentUnit})
                      </Text>
                    </Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={handleAddPackagingRow}>
                      Thêm
                    </Button>
                  </div>

                  {/* Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={thSt}>Mã</th>
                        <th style={thSt}>Tên đóng gói</th>
                        <th style={{ ...thSt, width: 120, textAlign: 'right' }}>Qty/pack</th>
                        <th style={{ ...thSt, width: 84, textAlign: 'center' }}>Mặc định</th>
                        <th style={{ ...thSt, width: 40, borderBottom: '1px solid #e2e8f0' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{ padding: '12px 8px', color: '#94a3b8', textAlign: 'center', fontSize: 12 }}
                          >
                            Chưa có đóng gói — nhấn &quot;+ Thêm&quot; để bắt đầu
                          </td>
                        </tr>
                      ) : (
                        packagings.map((row, idx) => (
                          <tr key={row._key}>
                            <td style={tdSt}>
                              <Input
                                size="small"
                                value={row.code}
                                placeholder="BAO10"
                                style={{ width: 80 }}
                                onChange={e => handlePackagingChange(idx, 'code', e.target.value)}
                              />
                            </td>
                            <td style={tdSt}>
                              <Input
                                size="small"
                                value={row.name}
                                placeholder="Bao 10kg"
                                style={{ width: 160 }}
                                onChange={e => handlePackagingChange(idx, 'name', e.target.value)}
                              />
                            </td>
                            <td style={{ ...tdSt, textAlign: 'right' }}>
                              <InputNumber
                                size="small"
                                min={1}
                                step={1}
                                value={row.qtyPerPack}
                                style={{ width: 90 }}
                                onChange={v => handlePackagingChange(idx, 'qtyPerPack', v ?? 0)}
                              />
                            </td>
                            <td style={{ ...tdSt, textAlign: 'center' }}>
                              <Checkbox
                                checked={row.isDefault}
                                onChange={e => handlePackagingDefaultChange(idx, e.target.checked)}
                              />
                            </td>
                            <td style={{ ...tdSt, textAlign: 'center' }}>
                              <Button
                                size="small"
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemovePackagingRow(idx)}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Nút Lưu đóng gói — chỉ hiện khi edit (cần có ID) */}
                  {isEdit && (
                    <div style={{ marginTop: 10 }}>
                      <Button
                        size="small"
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={savingPackagings}
                        onClick={handleSavePackagings}
                      >
                        💾 Lưu đóng gói
                      </Button>
                    </div>
                  )}
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
                        width: 140,
                        render: (name: number, field: any) => (
                          <Form.Item
                            {...field}
                            name={[name, 'unit']}
                            rules={[{ required: true, message: 'Chọn đơn vị' }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              size="small"
                              placeholder="Đơn vị"
                              showSearch
                              optionFilterProp="label"
                              options={units.map((u: any) => ({
                                label: u.name || u.code,
                                value: u.code,
                              }))}
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title: 'Thứ tự',
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
                          scroll={{ x: 550 }}
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
      </Form>
    </div>
  );
};

export default ProductForm;
