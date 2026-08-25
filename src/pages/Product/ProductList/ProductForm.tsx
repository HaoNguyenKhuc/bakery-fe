import React, { useEffect, useState, useMemo } from 'react';
import {
  Form, Select, Input, InputNumber, Row, Col, Card, Button,
  Space, message, Typography, Divider, Tag, Table, Popconfirm, Checkbox, Tooltip
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SaveOutlined,
  AppstoreOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, itemGroupService, supplierService, recipeService } from '../../../api/services';
import unitService from '../../../api/services/unitService';
import type { ProductRequest, ItemPackaging, ItemPackagingRequest } from '../../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

  // ── Price Input State (INGREDIENT only) ──────────────────────────────────────
  /** Giá nhập — do user nhập tay (đ/đvị nhập). Không lưu DB trực tiếp.
   *  Logic chuẩn (theo dev-ui.html):
   *    User nhập  → Giá Nhập (editable)
   *    Tính ra    → Giá Lẻ = Giá Nhập ÷ qtyPerPack  (readonly, hiển thị)
   *    DB lưu     → unitCost = Giá Lẻ
   *  Khi chưa có đóng gói: qty fallback = 1 → Giá Lẻ = Giá Nhập
   */
  const [giaNhapInput, setGiaNhapInput] = useState<number | null>(null);

  // ── Recipe Yield State (SEMI_PRODUCT & PRODUCT) ─────────────────────────────
  const [yieldQuantity, setYieldQuantity] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: allItemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const allItems = extractArray(allItemsData);
  const ingredients = allItems.filter((i: any) => i.itemType === 'INGREDIENT');
  const semiProducts = allItems.filter((i: any) => i.itemType === 'SEMI_PRODUCT');
  const itemMap = useMemo(() => new Map(allItems.map((i: any) => [i.id, i])), [allItems]);

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

  const { data: conversionsRaw = [] } = useQuery({
    queryKey: ['unit-conversions'],
    queryFn: () => unitService.getConversions(),
    staleTime: 60_000,
  });
  const conversions: any[] = Array.isArray(conversionsRaw) ? conversionsRaw : [];

  // Convert any unit → KG via conversion table
  const toKg = (qty: number, unit: string): number | null => {
    if (!unit || !qty) return null;
    const u = unit.trim().toUpperCase();
    if (u === 'KG') return qty;
    const conv = conversions.find(
      (c: any) => c.fromUnit?.toUpperCase() === u && c.toUnit?.toUpperCase() === 'KG'
    );
    if (conv) return qty * Number(conv.factor);
    const rev = conversions.find(
      (c: any) => c.toUnit?.toUpperCase() === u && c.fromUnit?.toUpperCase() === 'KG'
    );
    if (rev) return qty / Number(rev.factor);
    if (u === 'G' || u === 'GRAM' || u === 'GR') return qty / 1000;
    if (u === 'MG') return qty / 1_000_000;
    if (u === 'ML') return qty / 1000;
    if (u === 'L' || u === 'LIT' || u === 'LÍT') return qty;
    return null;
  };

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => supplierService.getAll(),
  });
  const suppliers = extractArray(suppliersData);

  const { data: itemData, isLoading: loadingItem } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemService.getById(id!),
    enabled: isEdit,
    staleTime: 0,           // Luôn coi dữ liệu là cũ → gọi API mới mỗi lần vào trang edit
    refetchOnMount: 'always', // Đảm bảo gọi lại dù cache vẫn còn
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
          note: rawRecipe.note || undefined,
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

      const rawYield = editProduct.recipe?.yieldQuantity ?? editProduct.activeRecipe?.yieldQuantity ?? editProduct.recipeYieldQuantity ?? null;
      setYieldQuantity(rawYield != null ? Number(rawYield) : null);

      form.setFieldsValue({
        code: editProduct.code,
        name: editProduct.name,
        itemType: editProduct.itemType || 'PRODUCT',
        productCategory: editProduct.productCategory || undefined,
        unit: editProduct.unit,
        itemGroupId: editProduct.itemGroupId || undefined,
        splittable: editProduct.splittable ?? false,
        unitSize: editProduct.unitSize ?? undefined,
        defaultSupplierId: defaultSupplierId || undefined,
        unitCost: editProduct.unitCost ?? editProduct.lastPrice ?? undefined,
        shelfDays: editProduct.shelfDays ?? undefined,
        recipe: recipe as any,
      });
    } else if (!isEdit) {
      form.resetFields();
      setYieldQuantity(null);
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

  // ── Giá Nhập Sync — populate khi chỉnh sửa ─────────────────────────────────
  // unitCost (DB) = Giá Lẻ → để hiện lại Giá Nhập: giaNhap = unitCost × qty
  useEffect(() => {
    if (isEdit && itemData) {
      const editProduct: any = itemData;
      const unitCost = editProduct.unitCost ?? editProduct.lastPrice;
      const rawPackagings: ItemPackaging[] = (editProduct as any).packagings ?? [];
      const defaultPkg = rawPackagings.find(p => p.isDefault) ?? rawPackagings[0] ?? null;
      const qty = (defaultPkg && defaultPkg.qtyPerPack > 0) ? Number(defaultPkg.qtyPerPack) : 1;
      if (unitCost != null) {
        // Tính ngược: giaNhap = giaLe × qty
        setGiaNhapInput(Math.round(Number(unitCost) * qty));
      } else {
        setGiaNhapInput(null);
      }
    } else if (!isEdit) {
      setGiaNhapInput(null);
    }
  }, [isEdit, itemData]);

  // ── Recalculate khi packagings thay đổi ──────────────────────────────────────
  // Trigger: user thêm/sửa/xóa đóng gói SAU khi đã nhập Giá nhập
  // → tính lại Giá Lẻ (unitCost) = giaNhap ÷ qty mới
  useEffect(() => {
    if (giaNhapInput == null) return; // chưa có giá nhập, không cần tính
    const defaultPkg = packagings.find(p => p.isDefault) ?? packagings[0] ?? null;
    const qty = (defaultPkg && defaultPkg.qtyPerPack > 0) ? Number(defaultPkg.qtyPerPack) : 1;
    const newGiaLe = Math.round(giaNhapInput / qty);
    form.setFieldValue('unitCost', newGiaLe > 0 ? newGiaLe : null);
  }, [packagings, form, giaNhapInput]);

  // ── Recipe Calculations (Total KG & Cost) ──────────────────────────────────
  const watchedRecipeLines = Form.useWatch(['recipe', 'lines'], form) || [];

  const { totalCost, totalKgCalc, totalKgHasGap } = useMemo(() => {
    let cost = 0;
    let kg = 0;
    let hasGap = false;
    for (const l of watchedRecipeLines) {
      if (!l || !l.itemId) continue;
      const item = itemMap.get(l.itemId);
      const unitCost = (item as any)?.unitCost ?? null;
      const qty = Number(l.quantity) || 0;
      if (unitCost != null && qty > 0) cost += Number(unitCost) * qty;
      const lineKg = toKg(qty, l.unit);
      if (lineKg != null) kg += lineKg;
      else if (qty > 0) hasGap = true;
    }
    return { totalCost: cost, totalKgCalc: kg, totalKgHasGap: hasGap };
  }, [watchedRecipeLines, itemMap, conversions]);

  // ── Mutation ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: ProductRequest) => {
      // Chuẩn hoá recipeLines → gửi phẳng trong ItemRequest (khớp backend ItemRequest.java)
      const rawLines: any[] = values.recipe?.lines || [];
      const recipeLines = rawLines
        .filter((l: any) => l?.itemId)
        .map((l: any, idx: number) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unit: l.unit,
          sortOrder: l.sortOrder ?? idx + 1,
        }));

      // Nếu user nhập thực tế thì lấy yieldQuantity, nếu để trống và có totalKgCalc > 0 thì tự động lấy totalKgCalc
      const finalYield = yieldQuantity != null ? yieldQuantity : (totalKgCalc > 0 ? totalKgCalc : null);

      const payload = {
        ...values,
        unitSize: values.splittable ? (values.unitSize ?? null) : null,
        shelfDays: values.itemType === 'PRODUCT' ? (values.shelfDays ?? null) : null,
        // Gửi recipe phẳng theo đúng chuẩn backend — KHÔNG gọi recipeService.create riêng
        recipeNote: values.recipe?.note ?? null,
        recipeYieldQuantity: finalYield,
        recipeLines: recipeLines.length > 0 ? recipeLines : undefined,
        // Bỏ trường recipe lồng nhau để tránh backend bỏ qua recipeLines
        recipe: undefined,
      };

      let savedItem: any;
      if (isEdit) {
        savedItem = await itemService.submitUpdate(id!, payload);
      } else {
        savedItem = await itemService.submitCreate(payload);
      }
      return savedItem;
    },
    onSuccess: async (savedItem: any) => {
      // Create flow: nếu tạo mới INGREDIENT + có packaging rows → lưu sau khi có ID
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
      // Invalidate đầy đủ: cả list lẫn detail của item này
      queryClient.invalidateQueries({ queryKey: ['items'] });
      if (isEdit && id) {
        queryClient.invalidateQueries({ queryKey: ['item', id] });
      }
      navigate('/products');
    },
    onError: (error: any) => {
      message.error(error.message || (isEdit ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
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

          {/* Row 2: Tên (code ẩn — tự sinh khi tạo mới) */}
          {/* Hidden code field — vẫn submit lên backend, user không nhìn thấy */}
          <Form.Item name="code" style={{ display: 'none' }}>
            <Input />
          </Form.Item>

          <Row gutter={24}>
            <Col xs={24} md={24}>
              <Form.Item
                name="name"
                label="Tên"
                rules={[
                  { required: true, message: 'Vui lòng nhập tên' },
                  { max: 200, message: 'Tối đa 200 ký tự' },
                ]}
              >
                <Input
                  placeholder="VD: Bánh Mì Bơ Tỏi"
                  onChange={(e) => {
                    if (!isEdit) {
                      // Auto-generate code từ tên sản phẩm khi tạo mới
                      const raw = e.target.value;
                      if (!raw.trim()) return;
                      const normalized = raw
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[đĐ]/g, 'd')
                        .replace(/[^a-zA-Z0-9\s]/g, '')
                        .trim();
                      const initials = normalized
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 5)
                        .map((w: string) => w[0].toUpperCase())
                        .join('');
                      // Suffix = timestamp base36 (4 chars) + 2 random digits → rất ít khả năng trùng
                      const tsPart = Date.now().toString(36).slice(-4).toUpperCase();
                      const randPart = Math.floor(10 + Math.random() * 90);
                      form.setFieldValue('code', `${initials}${tsPart}${randPart}`);
                    }
                  }}
                />
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

            <Col xs={24} md={6}>
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
              if (t !== 'INGREDIENT' && t !== 'SEMI_PRODUCT') return null;

              // ── INGREDIENT: Giá Nhập (editable) → tính Giá Lẻ (readonly) ──────
              if (t === 'INGREDIENT') {
                // Đóng gói mặc định — lấy từ state packagings
                const defaultPkg = packagings.find(p => p.isDefault) ?? packagings[0] ?? null;
                const qty = (defaultPkg && defaultPkg.qtyPerPack > 0) ? Number(defaultPkg.qtyPerPack) : 1;
                const hasPackaging = defaultPkg != null && defaultPkg.qtyPerPack > 0;

                // Label đơn vị nhập (tên đóng gói mặc định hoặc fallback)
                const importUnitLabel = hasPackaging
                  ? (defaultPkg!.name || 'đvị nhập')
                  : getFieldValue('unit') || 'đvị tính';

                // Dòng quy đổi hiển thị bên dưới
                const conversionLabel = hasPackaging
                  ? `1 ${defaultPkg!.name} = ${qty.toLocaleString('vi-VN')} ${getFieldValue('unit') || 'đvị tính'}`
                  : null;

                const numFmt = (v: number | string | undefined) =>
                  v !== undefined && v !== '' ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
                const numParse = (v: string | undefined) => v?.replace(/,/g, '') as any;

                // Giá lẻ hiện tại tính từ giaNhapInput ÷ qty (để hiển thị readonly)
                const giaLeDisplay = (giaNhapInput != null && giaNhapInput > 0)
                  ? Math.round(giaNhapInput / qty)
                  : null;

                // Khi user thay đổi Giá nhập → tính Giá lẻ → set unitCost
                const onChangeGiaNhap = (val: number | null) => {
                  setGiaNhapInput(val);
                  const giaLe = (val != null && val > 0) ? Math.round(val / qty) : null;
                  form.setFieldValue('unitCost', giaLe);
                };

                return (
                  <>
                    {conversionLabel && (
                      <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
                        💱 Quy đổi đóng gói mặc định: <strong>{conversionLabel}</strong>
                      </div>
                    )}
                    <Row gutter={24}>
                      {/* Giá nhập — user nhập tay */}
                      <Col xs={24} md={12}>
                        <Form.Item
                          label={
                            <span>
                              Giá nhập&nbsp;
                              <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>
                                (đ / {importUnitLabel})
                              </span>
                            </span>
                          }
                          tooltip={
                            hasPackaging
                              ? `Giá nhập trên mỗi ${importUnitLabel}. Hệ thống tự tính Giá lẻ = Giá nhập ÷ ${qty.toLocaleString('vi-VN')}.`
                              : 'Chưa có đóng gói — nhập Giá nhập, hệ thống coi qty=1, Giá lẻ = Giá nhập.'
                          }
                        >
                          <InputNumber
                            min={0}
                            step={1000}
                            style={{ width: '100%' }}
                            placeholder="Ví dụ: 480,000"
                            value={giaNhapInput}
                            formatter={numFmt}
                            parser={numParse}
                            onChange={onChangeGiaNhap}
                          />
                        </Form.Item>
                      </Col>

                      {/* Giá lẻ — readonly, tính từ Giá nhập ÷ qty, lưu vào unitCost */}
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="unitCost"
                          label={
                            <span>
                              Giá lẻ&nbsp;
                              <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>
                                (đ / {getFieldValue('unit') || 'đvị tính'})
                                {hasPackaging && ` = Giá nhập ÷ ${qty.toLocaleString('vi-VN')}`}
                              </span>
                            </span>
                          }
                          tooltip="Giá trên mỗi đơn vị tính (KG, L, CAI…). Được tính tự động từ Giá nhập ÷ Qty/pack. Đây là giá vốn lưu vào DB."
                        >
                          <InputNumber
                            min={0}
                            style={{ width: '100%', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                            placeholder="—"
                            readOnly
                            value={giaLeDisplay ?? undefined}
                            formatter={numFmt}
                            parser={numParse}
                            tabIndex={-1}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                );
              }

              // ── SEMI_PRODUCT: Giá vốn = Tổng thành tiền dự tính (disabled, auto từ recipe) ────
              const numFmtSemi = (v: number | string | undefined) =>
                v !== undefined && v !== '' ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
              const numParseSemi = (v: string | undefined) => v?.replace(/,/g, '') as any;

              // Sync unitCost với totalCost mỗi lần totalCost thay đổi
              if (totalCost > 0) {
                const current = form.getFieldValue('unitCost');
                if (current !== Math.round(totalCost)) {
                  form.setFieldValue('unitCost', Math.round(totalCost));
                }
              }

              return (
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="unitCost"
                      label={
                        <span>
                          Giá vốn&nbsp;
                          <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>
                            (đ/đvt — tự tính từ công thức)
                          </span>
                        </span>
                      }
                      tooltip="Tự động lấy từ Tổng thành tiền dự tính của công thức. Không thể nhập tay."
                    >
                      <InputNumber
                        disabled
                        min={0}
                        style={{
                          width: '100%',
                          background: '#e0f2fe',
                          color: '#0c4a6e',
                          fontWeight: 600,
                        }}
                        placeholder={totalCost > 0 ? '' : '— Chưa có công thức —'}
                        formatter={numFmtSemi}
                        parser={numParseSemi}
                      />
                    </Form.Item>
                  </Col>
                  {totalCost > 0 && (
                    <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                      <span style={{ fontSize: 12, color: '#0369a1' }}>
                        💡 Tổng thành tiền dự tính: <strong>{Math.round(totalCost).toLocaleString('vi-VN')} đ</strong>
                      </span>
                    </Col>
                  )}
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
                {/* ⚖ Khối lượng mẻ (KG) — chỉ hiện cho SEMI_PRODUCT */}
                {t === 'SEMI_PRODUCT' && (
                <div style={{
                  padding: '12px 16px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 8,
                  marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
                      ⚖ Khối lượng mẻ (KG)
                    </div>
                    {totalCost > 0 && (
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: '#64748b', marginRight: 6 }}>Tổng thành tiền dự tính:</span>
                        <strong style={{ color: '#b45309', fontSize: 15 }}>
                          {Math.round(totalCost).toLocaleString('vi-VN')} đ
                        </strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* Tự tính */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Tự tính:</span>
                      <Input
                        readOnly
                        value={totalKgCalc > 0 ? `${totalKgCalc.toFixed(3)}${totalKgHasGap ? ' ⚠' : ''}` : '—'}
                        suffix="KG"
                        style={{
                          width: 120,
                          fontWeight: 700,
                          color: '#0c4a6e',
                          background: '#e0f2fe',
                          cursor: 'default',
                        }}
                        title="Tổng KG nguyên liệu trong công thức — tự động tính"
                      />
                    </div>

                    {/* Thực tế */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Thực tế:</span>
                      <InputNumber
                        min={0.001}
                        step={0.001}
                        placeholder="Nhập..."
                        value={yieldQuantity}
                        onChange={(val) => setYieldQuantity(val)}
                        addonAfter="KG"
                        style={{ width: 145, fontWeight: 600 }}
                        title="Khối lượng thực tế sản phẩm BTP thu được sau khi sản xuất. Dùng để tính đơn giá/KG và so sánh hao hụt."
                      />
                      {yieldQuantity != null && (
                        <Button
                          size="small"
                          type="link"
                          onClick={() => setYieldQuantity(null)}
                          style={{ padding: '0 4px', fontSize: 12 }}
                        >
                          Reset
                        </Button>
                      )}
                    </div>

                    {/* Hao hụt */}
                    <div>
                      {totalKgCalc > 0 && yieldQuantity != null ? (
                        (() => {
                          const diff = totalKgCalc - yieldQuantity;
                          const pct = ((diff / totalKgCalc) * 100).toFixed(1);
                          if (Math.abs(diff) < 0.0001) {
                            return <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>✓ Không hao hụt</span>;
                          }
                          return (
                            <span style={{ fontSize: 13, color: diff > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {diff > 0 ? 'Hao hụt: +' : 'Dư ra: '}
                              {diff.toFixed(3)} KG ({diff > 0 ? '+' : ''}{pct}%)
                            </span>
                          );
                        })()
                      ) : totalKgCalc > 0 ? (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>← Nhập thực tế để so sánh hao hụt</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                )}

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

                {/* Recipe Note */}
                <div style={{ marginTop: 16, marginBottom: 0 }}>
                  <Text strong style={{ display: 'block', marginBottom: 6 }}>
                    Ghi chú công thức
                  </Text>
                  <Form.Item name={['recipe', 'note']} style={{ margin: 0 }}>
                    <TextArea
                      rows={2}
                      placeholder="Nhập ghi chú cho công thức này (tùy chọn)..."
                    />
                  </Form.Item>
                </div>
              </Card>
            );
          }}
        </Form.Item>

        {/* Usage Section (INGREDIENT & SEMI_PRODUCT only in edit mode) */}
        {isEdit && (
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.itemType !== cur.itemType}>
            {({ getFieldValue }) => {
              const t = getFieldValue('itemType');
              if (t !== 'INGREDIENT' && t !== 'SEMI_PRODUCT') return null;

              return (
                <Card
                  title={
                    <Space>
                      <span>📦 Dùng trong sản phẩm</span>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                        (active recipe)
                      </Text>
                    </Space>
                  }
                  style={{ marginBottom: 24 }}
                >
                  <ItemUsageTable itemId={id!} />
                </Card>
              );
            }}
          </Form.Item>
        )}
      </Form>
    </div>
  );
};

// ─── Inline Usage Table for INGREDIENT & SEMI_PRODUCT ─────────────────────────

const ItemUsageTable: React.FC<{ itemId: string }> = ({ itemId }) => {
  const navigate = useNavigate();
  const { data: usageList = [], isLoading, isError } = useQuery({
    queryKey: ['item-usage', itemId],
    queryFn: () => recipeService.getUsageByItem(itemId),
    enabled: !!itemId,
    staleTime: 30_000,
  });

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'productCode',
      width: 140,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên sản phẩm / BTP',
      dataIndex: 'productName',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'productType',
      width: 150,
      render: (v: string) => (
        <Tag color={v === 'PRODUCT' ? 'blue' : 'purple'}>
          {v === 'PRODUCT' ? 'Sản phẩm' : 'Bán thành phẩm'}
        </Tag>
      ),
    },
    {
      title: 'Số lượng dùng',
      key: 'quantity',
      width: 160,
      align: 'right' as const,
      render: (_: any, r: any) => (
        <span>
          <strong>{Number(r.quantity).toLocaleString('vi-VN')}</strong>{' '}
          <Text type="secondary">{r.unit}</Text>
        </span>
      ),
    },
    {
      title: 'Phiên bản CT',
      dataIndex: 'recipeVersion',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="green">v{v}</Tag>,
    },
    {
      title: '',
      width: 100,
      render: (_: any, r: any) => (
        <Button
          size="small"
          onClick={() => {
            navigate(`/products/edit/${r.productId}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Xem CT
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>Đang tải danh sách sử dụng...</div>;
  }

  if (isError) {
    return <div style={{ color: '#ef4444', fontSize: 13 }}>Không thể tải danh sách sản phẩm sử dụng.</div>;
  }

  if (!usageList || usageList.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
        Chưa có sản phẩm nào dùng NL/BTP này trong công thức đang active.
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      dataSource={usageList}
      rowKey={(r: any) => r.productId || r.productCode}
      pagination={false}
      size="small"
      bordered
    />
  );
};

export default ProductForm;
