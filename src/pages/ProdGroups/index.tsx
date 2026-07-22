import React, { useState } from 'react';
import {
  Button, Col, Divider, Form, Input, InputNumber,
  message, Popconfirm, Row, Select, Space, Table,
  Typography, Tooltip, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ToolOutlined,
  EditOutlined, DownOutlined, RightOutlined,
  SettingOutlined, CalendarOutlined, AppstoreOutlined,
  ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, itemGroupService, productionGroupService } from '../../api/services';
import type { ProductionGroup, ProductionGroupRequest } from '../../types';
import '../../styles/production-plans.css';

const { Text } = Typography;

// ── Google Fonts (Space Grotesk) ─────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('pp-gfonts')) {
  const link = document.createElement('link');
  link.id = 'pp-gfonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content) return data.content;
  if (data?.data) return data.data;
  return [];
};

interface EditableGroupItem {
  key: number;
  itemId: string;
  gramsPerUnit: number | null;
  sortOrder: number;
}

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const cls =
    status === 'DRAFT'     ? 'pp-status pp-status--draft'    :
    status === 'APPROVED'  ? 'pp-status pp-status--approved'  :
    status === 'REJECTED'  ? 'pp-status pp-status--rejected'  :
    'pp-status pp-status--unknown';
  return <span className={cls}>{status || 'UNKNOWN'}</span>;
};

// ── Type tag ──────────────────────────────────────────────────────────────────
const TypeTag: React.FC<{ type: string }> = ({ type }) =>
  type === 'FREE_GROUP'
    ? <span className="pp-type-tag pp-type-tag--free">FREE</span>
    : <span className="pp-type-tag pp-type-tag--batch">BATCH</span>;

// ── ProductionGroups inner tab ────────────────────────────────────────────────
const ProductionGroups: React.FC = () => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<EditableGroupItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupType, setGroupType] = useState<'FREE_GROUP' | 'BATCH_FORMULA'>('FREE_GROUP');

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: groupsRaw = [], isLoading } = useQuery({
    queryKey: ['production-groups'],
    queryFn: () => productionGroupService.getAll(),
  });
  const groups: ProductionGroup[] = groupsRaw;

  const { data: allItemsRaw } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const products = extractArray(allItemsRaw).filter((i: any) => i.itemType === 'PRODUCT');

  const { data: itemGroupsRaw } = useQuery({
    queryKey: ['itemGroups'],
    queryFn: () => itemGroupService.getAll(),
  });
  const itemGroups = extractArray(itemGroupsRaw);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: ProductionGroupRequest) => productionGroupService.create(data),
    onSuccess: () => { message.success('Đã tạo production group'); resetForm(); refetch(); },
    onError: () => message.error('Tạo thất bại'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductionGroupRequest }) =>
      productionGroupService.update(id, data),
    onSuccess: () => { message.success('Đã cập nhật'); resetForm(); refetch(); },
    onError: () => message.error('Cập nhật thất bại'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => productionGroupService.remove(id),
    onSuccess: () => { message.success('Đã xóa'); refetch(); },
    onError: () => message.error('Xóa thất bại'),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['production-groups'] });

  const resetForm = () => {
    form.resetFields();
    setEditingId(null);
    setGroupItems([]);
    setGroupType('FREE_GROUP');
  };

  const startEdit = (g: ProductionGroup) => {
    setEditingId(g.id);
    setGroupType(g.groupType);
    const foundIg = itemGroups.find((ig: any) => ig.code === g.itemGroup?.key);
    form.setFieldsValue({
      code: g.code,
      name: g.name,
      groupType: g.groupType,
      itemGroupId: foundIg?.id ?? undefined,
      targetWeekday: g.targetWeekday,
      targetWeekend: g.targetWeekend,
      thresholdPercent: g.thresholdPercent,
      batchWeightGrams: g.batchWeightGrams,
      note: g.note,
    });
    const mapped: EditableGroupItem[] = (g.items ?? []).map((gi, idx) => {
      const found = products.find((p: any) => p.code === gi.item?.key || p.id === gi.itemId);
      return { key: idx, itemId: found?.id ?? '', gramsPerUnit: gi.gramsPerUnit ?? null, sortOrder: gi.sortOrder };
    });
    setGroupItems(mapped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinish = (values: any) => {
    const body: ProductionGroupRequest = {
      code: values.code,
      name: values.name,
      groupType: values.groupType,
      itemGroupId: values.itemGroupId || null,
      targetWeekday: values.groupType === 'FREE_GROUP' ? (values.targetWeekday ?? null) : null,
      targetWeekend: values.groupType === 'FREE_GROUP' ? (values.targetWeekend ?? null) : null,
      thresholdPercent: values.groupType === 'FREE_GROUP' ? (values.thresholdPercent ?? null) : null,
      batchWeightGrams: values.groupType === 'BATCH_FORMULA' ? (values.batchWeightGrams ?? null) : null,
      note: values.note || null,
      items: groupItems.filter((i) => i.itemId).map((i) => ({
        itemId: i.itemId,
        gramsPerUnit: i.gramsPerUnit,
        sortOrder: i.sortOrder,
      })),
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: body });
    } else {
      createMut.mutate(body);
    }
  };

  const addItem = () => {
    setGroupItems((prev) => [
      ...prev,
      { key: Date.now(), itemId: '', gramsPerUnit: null, sortOrder: prev.length + 1 },
    ]);
  };
  const removeItem = (key: number) => setGroupItems((prev) => prev.filter((i) => i.key !== key));
  const updateItem = (key: number, field: keyof EditableGroupItem, value: any) => {
    setGroupItems((prev) => prev.map((i) => i.key === key ? { ...i, [field]: value } : i));
  };

  const isBatch = groupType === 'BATCH_FORMULA';
  const isPending = createMut.isPending || updateMut.isPending;

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', background: 'var(--pp-paper-3)', padding: '2px 6px', borderRadius: 'var(--pp-radius-xs)', color: 'var(--pp-ink)' }}>
          {v}
        </span>
      ),
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{v}</span>,
    },
    {
      title: 'Loại',
      dataIndex: 'groupType',
      width: 100,
      render: (v: string) => <TypeTag type={v} />,
    },
    {
      title: 'Item Group',
      dataIndex: 'itemGroup',
      width: 130,
      render: (v: any) => v
        ? <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-2)' }}>{v.key}</span>
        : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>,
    },
    {
      title: 'Target WD / WE',
      width: 130,
      render: (_: any, r: ProductionGroup) =>
        r.groupType === 'FREE_GROUP'
          ? <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-sm)' }}>{r.targetWeekday ?? '—'} / {r.targetWeekend ?? '—'}</span>
          : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>,
    },
    {
      title: 'Cối (g)',
      width: 100,
      render: (_: any, r: ProductionGroup) =>
        r.batchWeightGrams
          ? <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-sm)' }}>{r.batchWeightGrams.toLocaleString('vi')}g</span>
          : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>,
    },
    {
      title: 'Items',
      width: 64,
      render: (_: any, r: ProductionGroup) => (
        <span className="pp-tab__badge">{r.items?.length ?? 0}</span>
      ),
    },
    {
      title: '',
      width: 140,
      render: (_: any, r: ProductionGroup) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Chi tiết">
            <button
              className="pp-btn pp-btn--icon"
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              aria-label="Toggle detail"
            >
              {expandedId === r.id ? <DownOutlined /> : <RightOutlined />}
            </button>
          </Tooltip>
          <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--pp-text-xs)' }} onClick={() => startEdit(r)}>
            <EditOutlined /> Sửa
          </button>
          <Popconfirm
            title="Xóa production group này?"
            onConfirm={() => deleteMut.mutate(r.id)}
            okText="Xóa" cancelText="Huỷ"
          >
            <button className="pp-btn pp-btn--icon" aria-label="Delete" style={{ color: 'var(--pp-danger)' }}>
              <DeleteOutlined />
            </button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  // ── Expanded row ──────────────────────────────────────────────────────────────
  const expandedRowRender = (g: ProductionGroup) => {
    const items = g.items ?? [];
    if (!items.length)
      return <div style={{ padding: '12px 16px', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-sm)' }}>Chưa có sản phẩm nào trong group.</div>;
    return (
      <div style={{ padding: '16px 24px', background: 'var(--pp-paper-2)', display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        {/* Info */}
        <div>
          <div style={{ fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Thông tin</div>
          <table style={{ fontSize: 'var(--pp-text-sm)', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Loại</td>
                <td><TypeTag type={g.groupType} /></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Item Group</td>
                <td style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)' }}>{g.itemGroup ? `${g.itemGroup.key} — ${g.itemGroup.name}` : '—'}</td>
              </tr>
              {g.groupType === 'BATCH_FORMULA' && g.batchWeightGrams && (
                <tr>
                  <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Trọng lượng cối</td>
                  <td style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600 }}>{(g.batchWeightGrams / 1000).toFixed(1)} kg</td>
                </tr>
              )}
              {g.groupType === 'FREE_GROUP' && (
                <>
                  <tr>
                    <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Target WD</td>
                    <td style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600 }}>{g.targetWeekday ?? '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Target WE</td>
                    <td style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600 }}>{g.targetWeekend ?? '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, paddingBottom: 6, fontSize: 'var(--pp-text-xs)' }}>Ngưỡng tồn</td>
                    <td>
                      {g.thresholdPercent != null
                        ? <span className="pp-type-tag pp-type-tag--free">SX khi còn &lt;{g.thresholdPercent}%</span>
                        : <span style={{ color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-xs)' }}>Luôn SX đủ target</span>}
                    </td>
                  </tr>
                </>
              )}
              {g.note && (
                <tr>
                  <td style={{ color: 'var(--pp-ink-3)', paddingRight: 16, fontSize: 'var(--pp-text-xs)' }}>Ghi chú</td>
                  <td style={{ fontSize: 'var(--pp-text-sm)' }}>{g.note}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Items list */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Sản phẩm ({items.length})
          </div>
          <table style={{ width: '100%', fontSize: 'var(--pp-text-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', background: 'var(--pp-paper-3)', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sản phẩm</th>
                {g.groupType === 'BATCH_FORMULA' && (
                  <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--pp-paper-3)', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-xs)', fontWeight: 600 }}>Gram/cái</th>
                )}
                <th style={{ textAlign: 'center', padding: '6px 8px', background: 'var(--pp-paper-3)', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-xs)', fontWeight: 600 }}>#</th>
              </tr>
            </thead>
            <tbody>
              {items.map((gi, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--pp-rule)', fontWeight: 500 }}>
                    {gi.item?.name ?? gi.item?.key ?? '?'}
                  </td>
                  {g.groupType === 'BATCH_FORMULA' && (
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--pp-rule)', textAlign: 'right', fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)' }}>
                      {gi.gramsPerUnit != null ? `${gi.gramsPerUnit}g` : '—'}
                    </td>
                  )}
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--pp-rule)', textAlign: 'center', fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>
                    {gi.sortOrder}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pp-page">
      <div className="pp-header">
        <div className="pp-header__left">
          <div className="pp-header__icon">
            <ToolOutlined />
          </div>
          <div>
            <h1 className="pp-header__title">Production Groups</h1>
            <p className="pp-header__sub">Quản lý nhóm sản xuất</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 'var(--pp-space-md)' }}>
          <Tooltip title="Làm mới dữ liệu">
            <button className="pp-btn pp-btn--ghost" style={{ fontSize: 'var(--pp-text-sm)' }} aria-label="Refresh" onClick={refetch}>
              <ReloadOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
      <main className="pp-content">
        {/* Form section */}
      <div className="pp-form-section" style={{ marginBottom: 'var(--pp-space-md)' }}>
        <div className="pp-form-section__head">
          <span className="pp-form-section__label">
            {editingId ? <><EditOutlined /> Chỉnh sửa Production Group</> : <><PlusOutlined /> Tạo Production Group</>}
          </span>
          {editingId && (
            <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 12px', fontSize: 'var(--pp-text-xs)' }} onClick={resetForm}>
              Huỷ
            </button>
          )}
        </div>
        <div className="pp-form-section__body">
          <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ groupType: 'FREE_GROUP' }}>
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Bắt buộc' }]}>
                  <Input placeholder="VD: BANH_BAP" disabled={!!editingId} style={{ fontFamily: 'var(--pp-font-mono)' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Bắt buộc' }]}>
                  <Input placeholder="VD: Nhóm Bánh Bắp" />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item name="groupType" label="Loại" rules={[{ required: true }]}>
                  <Select onChange={(v) => setGroupType(v)}>
                    <Select.Option value="FREE_GROUP">FREE GROUP</Select.Option>
                    <Select.Option value="BATCH_FORMULA">BATCH FORMULA</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item name="itemGroupId" label="Item Group">
                  <Select placeholder="-- Không có --" allowClear
                    options={itemGroups.map((g: any) => ({ label: `${g.code} — ${g.name}`, value: g.id }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            {groupType === 'FREE_GROUP' && (
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item name="targetWeekday" label="Target Weekday">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 40" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="targetWeekend" label="Target Weekend">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 50" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="thresholdPercent"
                    label={<span>Ngưỡng tồn % <span style={{ fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>(tuỳ chọn)</span></span>}
                  >
                    <InputNumber style={{ width: '100%' }} min={1} max={100} placeholder="VD: 50" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {groupType === 'BATCH_FORMULA' && (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="batchWeightGrams" label="Trọng lượng cối (gram)">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 10000" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} placeholder="Ghi chú tuỳ chọn..." />
            </Form.Item>

            {/* Items editor */}
            <div style={{ marginBottom: 'var(--pp-space-xs)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isBatch ? '1fr 130px 90px 36px' : '1fr 90px 36px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sản phẩm</span>
                {isBatch && <span style={{ fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gram/cái</span>}
                <span style={{ fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort</span>
                <div />
              </div>

              {groupItems.map((item) => (
                <div key={item.key} style={{ display: 'grid', gridTemplateColumns: isBatch ? '1fr 130px 90px 36px' : '1fr 90px 36px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <Select
                    showSearch
                    placeholder="-- Chọn sản phẩm --"
                    value={item.itemId || undefined}
                    onChange={(v) => updateItem(item.key, 'itemId', v)}
                    optionFilterProp="label"
                    options={products.map((p: any) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
                  />
                  {isBatch && (
                    <InputNumber
                      placeholder="gram/cái"
                      min={0} step={0.01}
                      style={{ width: '100%' }}
                      value={item.gramsPerUnit ?? undefined}
                      onChange={(v) => updateItem(item.key, 'gramsPerUnit', v)}
                    />
                  )}
                  <InputNumber
                    min={1}
                    value={item.sortOrder}
                    onChange={(v) => updateItem(item.key, 'sortOrder', v ?? 1)}
                    style={{ width: '100%' }}
                  />
                  <button className="pp-btn pp-btn--icon" style={{ color: 'var(--pp-danger)' }} onClick={() => removeItem(item.key)} type="button">
                    <DeleteOutlined />
                  </button>
                </div>
              ))}

              <button type="button" className="pp-btn pp-btn--ghost" style={{ marginTop: 4, fontSize: 'var(--pp-text-sm)' }} onClick={addItem}>
                <PlusOutlined /> Thêm item
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--pp-space-sm)' }}>
              {editingId && <button type="button" className="pp-btn pp-btn--ghost" onClick={resetForm}>Huỷ</button>}
              <button
                type="submit"
                className="pp-btn pp-btn--primary"
                disabled={isPending}
                aria-disabled={isPending}
              >
                {isPending ? <Spin size="small" /> : null}
                {editingId ? 'Lưu thay đổi' : 'Tạo group'}
              </button>
            </div>
          </Form>
        </div>
      </div>

      {/* List table */}
      <div className="pp-card">
        <div className="pp-card__header">
          <span className="pp-card__title">Danh sách Production Groups</span>
          <span className="pp-tab__badge">{groups.length}</span>
        </div>
        <div className="pp-table-wrap">
          <Table
            dataSource={groups}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: 'Chưa có production group nào' }}
            expandable={{
              expandedRowKeys: expandedId ? [expandedId] : [],
              showExpandColumn: false,
              expandedRowRender,
            }}
          />
        </div>
        </div>
      </main>
    </div>
  );
};

export default ProductionGroups;
