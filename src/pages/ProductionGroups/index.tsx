import React, { useState } from 'react';
import {
  Button, Card, Col, Divider, Form, Input, InputNumber,
  message, Popconfirm, Row, Select, Space, Table, Tag,
  Typography, Tooltip, Tabs
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ToolOutlined,
  EditOutlined, DownOutlined, RightOutlined, SettingOutlined, CalendarOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemService, itemGroupService, productionGroupService } from '../../api/services';
import type { ProductionGroup, ProductionGroupRequest } from '../../types';
import ThresholdRulesTab from './ThresholdRules';
import DailyPlanTab from './DailyPlan';
import ProductionConfigTab from './ProductionConfig';

const { Title, Text } = Typography;

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

// ── Component ─────────────────────────────────────────────────────────────────
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

  // ── Form helpers ─────────────────────────────────────────────────────────────
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

  // ── Group Items editor ───────────────────────────────────────────────────────
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

  // ── List table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (v: string) => <Text strong code>{v}</Text>,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'groupType',
      width: 140,
      render: (v: string) =>
        v === 'FREE_GROUP'
          ? <Tag color="blue">🔢 FREE GROUP</Tag>
          : <Tag color="purple">🧪 BATCH</Tag>,
    },
    {
      title: 'Item Group',
      dataIndex: 'itemGroup',
      width: 130,
      render: (v: any) => v ? <Tag>{v.key}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Target WD / WE',
      width: 130,
      render: (_: any, r: ProductionGroup) =>
        r.groupType === 'FREE_GROUP'
          ? <Text>{r.targetWeekday ?? '—'} / {r.targetWeekend ?? '—'}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cối (g)',
      width: 100,
      render: (_: any, r: ProductionGroup) =>
        r.batchWeightGrams
          ? <Text>{r.batchWeightGrams.toLocaleString('vi')}g</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Items',
      width: 70,
      render: (_: any, r: ProductionGroup) => (
        <Tag color="default">{r.items?.length ?? 0}</Tag>
      ),
    },
    {
      title: '',
      width: 180,
      render: (_: any, r: ProductionGroup) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button
              size="small"
              icon={expandedId === r.id ? <DownOutlined /> : <RightOutlined />}
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            />
          </Tooltip>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => startEdit(r)}
          >Sửa</Button>
          <Popconfirm
            title="Xóa production group này?"
            onConfirm={() => deleteMut.mutate(r.id)}
            okText="Xóa"
            cancelText="Huỷ"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Expanded row detail ──────────────────────────────────────────────────────
  const expandedRowRender = (g: ProductionGroup) => {
    const items = g.items ?? [];
    if (!items.length) return <Text type="secondary" style={{ padding: '8px 16px', display: 'block' }}>Chưa có sản phẩm nào trong group.</Text>;
    return (
      <div style={{ padding: '12px 32px', background: '#fafafa', borderRadius: 6 }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {/* Info */}
          <div>
            <Text strong style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Thông tin</Text>
            <table style={{ marginTop: 6, fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Loại</td>
                  <td>{g.groupType === 'FREE_GROUP' ? <Tag color="blue">FREE GROUP</Tag> : <Tag color="purple">BATCH FORMULA</Tag>}</td>
                </tr>
                <tr>
                  <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Item Group</td>
                  <td>{g.itemGroup ? `${g.itemGroup.key} — ${g.itemGroup.name}` : '—'}</td>
                </tr>
                {g.groupType === 'BATCH_FORMULA' && g.batchWeightGrams && (
                  <tr>
                    <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Trọng lượng cối</td>
                    <td><Text strong>{(g.batchWeightGrams / 1000).toFixed(1)} kg</Text></td>
                  </tr>
                )}
                {g.groupType === 'FREE_GROUP' && (
                  <>
                    <tr>
                      <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Target WD</td>
                      <td><Text strong>{g.targetWeekday ?? '—'}</Text></td>
                    </tr>
                    <tr>
                      <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Target WE</td>
                      <td><Text strong>{g.targetWeekend ?? '—'}</Text></td>
                    </tr>
                    <tr>
                      <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Ngưỡng tồn</td>
                      <td>
                        {g.thresholdPercent != null
                          ? <Tag color="gold">SX khi còn &lt;{g.thresholdPercent}%</Tag>
                          : <Text type="secondary">Luôn SX đủ target</Text>}
                      </td>
                    </tr>
                  </>
                )}
                {g.note && (
                  <tr>
                    <td style={{ color: '#94a3b8', paddingRight: 16, paddingBottom: 4 }}>Ghi chú</td>
                    <td>{g.note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Items */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <Text strong style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              Sản phẩm ({items.length})
            </Text>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', background: '#f1f5f9', color: '#475569' }}>Sản phẩm</th>
                  {g.groupType === 'BATCH_FORMULA' && (
                    <th style={{ textAlign: 'right', padding: '4px 8px', background: '#f1f5f9', color: '#475569' }}>Gram/cái</th>
                  )}
                  <th style={{ textAlign: 'center', padding: '4px 8px', background: '#f1f5f9', color: '#475569' }}>Sort</th>
                </tr>
              </thead>
              <tbody>
                {items.map((gi, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      {gi.item?.name ?? gi.item?.key ?? '?'}
                    </td>
                    {g.groupType === 'BATCH_FORMULA' && (
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                        {gi.gramsPerUnit != null ? `${gi.gramsPerUnit}g` : '—'}
                      </td>
                    )}
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#94a3b8' }}>
                      {gi.sortOrder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const isPending = createMut.isPending || updateMut.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ToolOutlined style={{ fontSize: 22, color: '#D2691E' }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Production Groups</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Quản lý nhóm sản xuất — FREE GROUP (phân bổ nội bộ) hoặc BATCH FORMULA (theo cối)
          </Text>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <Card
        title={editingId ? '✏️ Sửa Production Group' : '➕ Tạo Production Group'}
        style={{ marginBottom: 20 }}
        extra={editingId && (
          <Button size="small" onClick={resetForm}>Huỷ chỉnh sửa</Button>
        )}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}
          initialValues={{ groupType: 'FREE_GROUP' }}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Bắt buộc' }]}>
                <Input placeholder="VD: BANH_BAP" disabled={!!editingId} />
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
                  <Select.Option value="FREE_GROUP">🔢 FREE_GROUP</Select.Option>
                  <Select.Option value="BATCH_FORMULA">🧪 BATCH_FORMULA</Select.Option>
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

          {/* FREE_GROUP fields */}
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
                  label={<span>Ngưỡng tồn % <Text type="secondary" style={{ fontSize: 11 }}>(tuỳ chọn)</Text></span>}
                >
                  <InputNumber style={{ width: '100%' }} min={1} max={100} placeholder="VD: 50 → SX khi còn <50%" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* BATCH_FORMULA fields */}
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
          {/* <Divider orientation="left" style={{ fontSize: 13, color: '#475569' }}>
            Items trong group
          </Divider> */}

          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isBatch ? '1fr 130px 90px 36px' : '1fr 90px 36px',
            gap: 8, padding: '0 4px', marginBottom: 4,
          }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Sản phẩm</Text>
            {isBatch && <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Gram/cái</Text>}
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Sort</Text>
            <div />
          </div>

          {groupItems.map((item) => (
            <div key={item.key} style={{
              display: 'grid',
              gridTemplateColumns: isBatch ? '1fr 130px 90px 36px' : '1fr 90px 36px',
              gap: 8, marginBottom: 6, alignItems: 'center',
            }}>
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
                  min={0}
                  step={0.01}
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
              <Button
                type="text" danger size="small" icon={<DeleteOutlined />}
                onClick={() => removeItem(item.key)}
              />
            </div>
          ))}

          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} style={{ marginBottom: 16 }}>
            Thêm item
          </Button>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {editingId && <Button onClick={resetForm}>Huỷ</Button>}
            <Button type="primary" htmlType="submit" loading={isPending}>
              {editingId ? 'Lưu thay đổi' : 'Tạo group'}
            </Button>
          </div>
        </Form>
      </Card>

      {/* ── LIST CARD ── */}
      <Card title="📋 Danh sách Production Groups">
        <Table
          dataSource={groups}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
          bordered
          locale={{ emptyText: 'Chưa có production group nào' }}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            showExpandColumn: false,
            expandedRowRender,
          }}
        />
      </Card>
    </div>
  );
};

// ── Page Wrapper with Tabs ─────────────────────────────────────────────────────
const ProductionGroupsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('daily-plan');

  const tabItems = [
    {
      key: 'daily-plan',
      label: (
        <span>
          <CalendarOutlined /> Kế hoạch ngày
        </span>
      ),
      children: <DailyPlanTab />,
    },
    {
      key: 'config',
      label: (
        <span>
          <AppstoreOutlined /> Cấu hình SX
        </span>
      ),
      children: <ProductionConfigTab 
        onNavigateToGroup={() => setActiveTab('groups')} 
        onNavigateToRule={() => setActiveTab('threshold-rules')} 
      />,
    },
    {
      key: 'groups',
      label: (
        <span>
          <ToolOutlined /> Production Groups
        </span>
      ),
      children: <ProductionGroups />,
    },
    {
      key: 'threshold-rules',
      label: (
        <span>
          <SettingOutlined /> Threshold Rules
        </span>
      ),
      children: <ThresholdRulesTab />,
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 0 }}
      />
    </div>
  );
};

export default ProductionGroupsPage;
