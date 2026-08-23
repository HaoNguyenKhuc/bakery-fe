import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Form, Select, Input, InputNumber, Button,
  Space, Row, Col, Popconfirm, message, Tag, Typography, Spin, Empty,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined,
  CheckOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import productMappingService from '../../api/services/productMappingService';
import itemService from '../../api/services/itemService';
import itemGroupService from '../../api/services/itemGroupService';
import type { ProductMapping, Item, ItemGroup } from '../../types';

const formatCurrency = (val?: number | null) => {
  if (val == null) return '—';
  return `${val.toLocaleString('vi-VN')}đ`;
};

const ProductMappingPage: React.FC = () => {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null); // null = Tất cả
  const [editingMapping, setEditingMapping] = useState<ProductMapping | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [mapsData, itemsData, groupsData] = await Promise.all([
        productMappingService.getAll().catch(() => []),
        itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT' }).catch(() => []),
        itemGroupService.getAll().catch(() => []),
      ]);
      setMappings(mapsData || []);
      setProducts(itemsData || []);
      setGroups(groupsData || []);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải dữ liệu product mappings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper: Get item group key from mapping
  const getItemGroupKey = (m: ProductMapping): string | null => {
    const item = products.find((i) => i.code === m.item?.key || i.id === m.item?.id);
    return item?.itemGroup?.key ?? null;
  };

  // Active siblings when editing
  const editingSiblings = useMemo(() => {
    if (!editingMapping) return [];
    const itemKey = editingMapping.item?.key;
    if (!itemKey) return [editingMapping];
    return mappings.filter((m) => m.item?.key === itemKey);
  }, [editingMapping, mappings]);

  const handleEdit = (record: ProductMapping) => {
    setEditingMapping(record);
    const matchedItem = products.find(
      (p) => p.code === record.item?.key || p.id === record.item?.id,
    );
    form.setFieldsValue({
      itemId: matchedItem?.id || '',
      exCode: record.exCode,
      sellingPrice: record.sellingPrice ?? null,
      note: record.note ?? '',
    });
    // Smooth scroll to form
    const formCard = document.getElementById('pm-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingMapping(null);
    form.resetFields();
  };

  const handleSave = async (values: any) => {
    setSubmitting(true);
    try {
      const newPrice = values.sellingPrice != null ? Number(values.sellingPrice) : null;
      const note = values.note ? values.note.trim() : null;

      if (editingMapping) {
        // EDIT MODE: Update all siblings of this product so sellingPrice is applied to all!
        const itemKey = editingMapping.item?.key;
        const siblings = itemKey
          ? mappings.filter((m) => m.item?.key === itemKey)
          : [editingMapping];

        if (!siblings.length) {
          message.error('Không tìm thấy mapping để cập nhật');
          return;
        }

        await Promise.all(
          siblings.map((m) => {
            const mItemId = products.find(
              (i) => i.code === m.item?.key || i.id === m.item?.id,
            )?.id;

            return productMappingService.update(m.id, {
              itemId: mItemId || (values.itemId as string),
              exCode: m.id === editingMapping.id ? values.exCode.trim() : m.exCode,
              sellingPrice: newPrice,
              note: m.id === editingMapping.id ? note : (m.note ?? null),
            });
          }),
        );

        message.success(
          `Đã cập nhật giá ${newPrice != null ? formatCurrency(newPrice) : '(xoá giá)'} cho ${siblings.length} EX_CODE [${itemKey || ''}]`,
        );
      } else {
        // ADD MODE: Create new mapping
        const itemId = values.itemId;
        const exCode = values.exCode.trim();
        await productMappingService.create({
          itemId,
          exCode,
          sellingPrice: newPrice,
          note,
        });
        message.success('Đã thêm mapping thành công');
      }

      handleCancelEdit();
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi lưu product mapping');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await productMappingService.remove(id);
      message.success('Đã xoá mapping thành công');
      if (editingMapping?.id === id) {
        handleCancelEdit();
      }
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Không thể xoá mapping');
    }
  };

  // Dynamic Item Group Tabs: only groups present in mappings
  const dynamicGroupTabs = useMemo(() => {
    const groupsInData = new Set<string>();
    mappings.forEach((m) => {
      const gKey = getItemGroupKey(m);
      if (gKey) groupsInData.add(gKey);
    });

    const presentGroups = groups.filter((g) => groupsInData.has(g.code));
    return [
      { code: null, name: 'Tất cả' },
      ...presentGroups.map((g) => ({ code: g.code, name: g.name })),
    ];
  }, [mappings, groups, products]);

  // Filter mappings by active group and search text
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      // Group filter
      if (activeGroupKey !== null) {
        const gKey = getItemGroupKey(m);
        if (gKey !== activeGroupKey) return false;
      }

      // Search filter
      const q = searchText.trim().toLowerCase();
      if (!q) return true;

      const inCode = (m.item?.key || '').toLowerCase();
      const inName = (m.item?.name || '').toLowerCase();
      const exCode = (m.exCode || '').toLowerCase();
      const note = (m.note || '').toLowerCase();

      return (
        inCode.includes(q) ||
        inName.includes(q) ||
        exCode.includes(q) ||
        note.includes(q)
      );
    });
  }, [mappings, activeGroupKey, searchText, products]);

  // Group filtered mappings by product (item.key)
  const groupedMappings = useMemo(() => {
    const grouped: Record<string, ProductMapping[]> = {};
    filteredMappings.forEach((m) => {
      const key = m.item?.key || '__unknown__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
    return grouped;
  }, [filteredMappings]);

  const hasSiblings = editingSiblings.length > 1;
  const editingItemName =
    editingMapping?.item?.name || editingMapping?.item?.key || 'Sản phẩm';

  return (
    <div style={{ padding: '16px 20px', background: '#f8fafc', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* ── Left Column: Form Card ────────────────────────────────────────── */}
        <Col xs={24} lg={10}>
          <Card
            id="pm-form-card"
            title={
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                {editingMapping
                  ? (hasSiblings
                      ? `Sửa [${editingItemName}] — ${editingSiblings.length} EX_CODE`
                      : `Sửa [${editingItemName}]`)
                  : 'Thêm mapping'}
              </span>
            }
            styles={{
              header: {
                borderBottom: '2px solid #2563eb',
                padding: '12px 16px',
                background: '#fff',
              },
              body: { padding: '16px 18px', background: '#fff' },
            }}
            style={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Form form={form} layout="vertical" onFinish={handleSave}>
              {/* Product Select (Hidden when editing) */}
              {!editingMapping && (
                <Form.Item
                  name="itemId"
                  label={<span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Sản phẩm *</span>}
                  rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
                >
                  <Select
                    showSearch
                    placeholder="-- Chọn SP --"
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                    options={products.map((p) => ({
                      value: p.id,
                      label: `${p.code} — ${p.name}`,
                    }))}
                  />
                </Form.Item>
              )}

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="exCode"
                    label={<span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>EX_CODE (POS) *</span>}
                    rules={[{ required: true, message: 'Nhập EX_CODE từ POS' }]}
                  >
                    <Input placeholder="VD: BK253145683" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="sellingPrice"
                    label={<span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Giá bán (đ)</span>}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="280000"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => Number(v!.replace(/,/g, ''))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="note"
                label={<span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Ghi chú</span>}
              >
                <Input placeholder="Ghi chú..." />
              </Form.Item>

              {/* Sibling Panel (Visible during edit) */}
              {editingMapping && (
                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 16,
                    padding: '10px 12px',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0369a1',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <InfoCircleOutlined /> Các SP cùng EX_CODE — giá sẽ áp dụng cho tất cả:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {editingSiblings.map((s) => {
                      const isCurrent = s.id === editingMapping.id;
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '3px 0',
                            borderBottom: '1px solid #e0f2fe',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: '#0369a1',
                              background: '#e0f2fe',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            {s.exCode}
                          </span>
                          <span style={{ fontSize: 12, color: '#475569' }}>
                            {formatCurrency(s.sellingPrice)}
                          </span>
                          {isCurrent && (
                            <Tag color="blue" style={{ fontSize: 10, marginLeft: 'auto', marginInlineEnd: 0 }}>
                              đang sửa
                            </Tag>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                {editingMapping && (
                  <Button onClick={handleCancelEdit} disabled={submitting}>
                    Huỷ
                  </Button>
                )}
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={editingMapping ? <CheckOutlined /> : <PlusOutlined />}
                  style={{ background: '#2563eb', borderColor: '#2563eb' }}
                >
                  {editingMapping
                    ? (hasSiblings
                        ? `Lưu & áp dụng cho ${editingSiblings.length} EX_CODE`
                        : 'Lưu thay đổi')
                    : 'Thêm mapping'}
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        {/* ── Right Column: Grouped Mappings List ────────────────────────────── */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  Danh sách mappings
                </span>
                <small style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>
                  — nhóm theo EX_CODE
                </small>
              </div>
            }
            styles={{
              header: {
                borderBottom: '2px solid #2563eb',
                padding: '12px 16px',
                background: '#fff',
              },
              body: { padding: '16px 18px', background: '#fff' },
            }}
            style={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Tabs Filter by Item Group */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '2px solid #e2e8f0',
                marginBottom: 14,
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {dynamicGroupTabs.map((tab) => {
                const isActive = activeGroupKey === tab.code;
                return (
                  <div
                    key={tab.code ?? '__ALL__'}
                    onClick={() => setActiveGroupKey(tab.code)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      color: isActive ? '#2563eb' : '#64748b',
                      borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                      marginBottom: -2,
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.name}
                  </div>
                );
              })}
            </div>

            {/* Search Box */}
            <div style={{ marginBottom: 14 }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Tìm theo IN_CODE, tên SP, EX_CODE..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ maxWidth: 360, borderRadius: 6 }}
              />
            </div>

            {/* Grouped Table View */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin tip="Đang tải mappings..." />
              </div>
            ) : Object.keys(groupedMappings).length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <Empty description={<span style={{ color: '#94a3b8' }}>Chưa có mapping nào</span>} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#475569' }}>
                        EX_CODE
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#475569' }}>
                        Giá bán
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#475569' }}>
                        Ghi chú
                      </th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#475569', width: 130 }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedMappings).map(([itemKey, members]) => {
                      const itemName = members[0]?.item?.name || itemKey;
                      const hasMultiEx = members.length > 1;
                      const priceLabel =
                        members[0]?.sellingPrice != null
                          ? formatCurrency(members[0].sellingPrice)
                          : '—';

                      return (
                        <React.Fragment key={itemKey}>
                          {/* Product Group Header Row */}
                          <tr style={{ background: '#f0f9ff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #bae6fd' }}>
                            <td colSpan={4} style={{ padding: '7px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 13 }}>
                                  {itemName}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: '#64748b',
                                    background: '#e2e8f0',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {itemKey}
                                </span>
                                {hasMultiEx && (
                                  <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 500 }}>
                                    {members.length} EX_CODE · {priceLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Sibling Mapping Rows */}
                          {members.map((m) => (
                            <tr
                              key={m.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: editingMapping?.id === m.id ? '#fefce8' : 'transparent',
                                transition: 'background 0.15s',
                              }}
                            >
                              <td style={{ padding: '7px 10px 7px 22px' }}>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                    color: '#0369a1',
                                    background: '#f0f9ff',
                                    border: '1px solid #e0f2fe',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontWeight: 500,
                                  }}
                                >
                                  {m.exCode}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', color: '#374151', fontWeight: 500 }}>
                                {m.sellingPrice != null ? (
                                  <Tag color="green" style={{ fontWeight: 600 }}>
                                    {formatCurrency(m.sellingPrice)}
                                  </Tag>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '7px 10px', fontSize: 12, color: '#64748b' }}>
                                {m.note || '—'}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <Space size={4}>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEdit(m)}
                                    style={{ fontSize: 12 }}
                                  >
                                    Sửa
                                  </Button>
                                  <Popconfirm
                                    title="Xoá mapping này?"
                                    okText="Xoá"
                                    cancelText="Huỷ"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => handleDelete(m.id)}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      style={{ fontSize: 12 }}
                                    >
                                      Xóa
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductMappingPage;

