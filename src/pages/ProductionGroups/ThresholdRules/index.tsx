import React, { useState, useMemo } from 'react';
import {
  Table, Select, Form, InputNumber, Row, Col, Space, message, Spin, Empty, List
} from 'antd';
import {
  DeleteOutlined, PlusOutlined, AppstoreOutlined,
  RightOutlined, TeamOutlined, EditOutlined
} from '@ant-design/icons';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { itemService, productionGroupService, thresholdRuleService } from '../../../api/services';
import type { ProductionGroup, ThresholdRule } from '../../../types';

const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content) return data.content;
  if (data?.data) return data.data;
  return [];
};

// ── Component ─────────────────────────────────────────────────────────────────
const ThresholdRules: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: groupsRaw = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['production-groups'],
    queryFn: () => productionGroupService.getAll(),
  });
  const groups: ProductionGroup[] = extractArray(groupsRaw);

  const { data: allItemsRaw = [] } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const products = useMemo(
    () => extractArray(allItemsRaw).filter((i: any) => i.itemType === 'PRODUCT'),
    [allItemsRaw]
  );

  // Summary queries — parallel per product
  const summaryQueries = useQueries({
    queries: products.map((p) => ({
      queryKey: ['threshold-rules', p.id],
      queryFn: () => thresholdRuleService.getRulesByItem(p.id),
      staleTime: 60_000,
    })),
  });

  const isSummaryLoading = summaryQueries.some((q) => q.isLoading);

  const summaryData = useMemo(
    () =>
      products
        .map((p, i) => ({ product: p, rules: summaryQueries[i].data || [] }))
        .filter((x) => x.rules.length > 0),
    [products, summaryQueries]
  );

  // ── Which items are shown in editor ─────────────────────────────────────────
  const editingItems = useMemo(() => {
    if (selectedItemId) {
      const p = products.find((p) => p.id === selectedItemId);
      return p ? [p] : [];
    }
    if (selectedGroupId) {
      const g = groups.find((g) => g.id === selectedGroupId);
      if (g) {
        return g.items
          .map((gi) => products.find((p) => p.id === gi.itemId))
          .filter((p): p is any => p !== undefined);
      }
    }
    return [];
  }, [selectedItemId, selectedGroupId, products, groups]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (args: { itemId: string; rules: ThresholdRule[] }) =>
      thresholdRuleService.updateRules(args.itemId, { rules: args.rules }),
    onSuccess: (_, args) => {
      message.success('Đã lưu rules');
      queryClient.invalidateQueries({ queryKey: ['threshold-rules', args.itemId] });
    },
    onError: () => message.error('Lỗi khi lưu rules'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId === selectedGroupId ? null : groupId);
    setSelectedItemId(null);
  };

  const handleItemChange = (val: string) => {
    setSelectedItemId(val);
    setSelectedGroupId(null);
  };

  const handleJumpToItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedGroupId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Summary Table columns ──────────────────────────────────────────────────
  const summaryColumns: ColumnsType<any> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{p.name}</div>
          <div style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>{p.code}</div>
        </div>
      ),
    },
    {
      title: 'Weekday',
      align: 'center' as const,
      width: 100,
      render: (_: any, r: any) => {
        const c = r.rules.filter((rule: ThresholdRule) => rule.dayType === 'WEEKDAY').length;
        return c ? <span className="pp-tab__badge">{c}</span> : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>;
      },
    },
    {
      title: 'Weekend',
      align: 'center' as const,
      width: 100,
      render: (_: any, r: any) => {
        const c = r.rules.filter((rule: ThresholdRule) => rule.dayType === 'WEEKEND').length;
        return c ? <span className="pp-tab__badge">{c}</span> : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>;
      },
    },
    {
      title: '',
      width: 80,
      align: 'center',
      render: (_: any, r: any) => (
        <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--pp-text-xs)' }} onClick={() => handleJumpToItem(r.product.id)}>
          Sửa
        </button>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Row gutter={[24, 24]}>
        {/* LEFT: Navigation panel */}
        <Col span={7}>
          <div className="pp-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="pp-card__header" style={{ padding: '12px 16px' }}>
              <span className="pp-card__title" style={{ fontSize: 'var(--pp-text-sm)' }}>
                <AppstoreOutlined style={{ marginRight: 6 }} /> Nhóm Sản Xuất
              </span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {groupsLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--pp-space-xl)' }}><Spin size="small" /></div>
              ) : groups.length === 0 ? (
                <div style={{ padding: 'var(--pp-space-md)', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-sm)' }}>
                  Chưa có group nào
                </div>
              ) : (
                <div style={{ padding: 'var(--pp-space-xs) 0' }}>
                  {groups.map((g: ProductionGroup) => {
                    const isActive = selectedGroupId === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => handleGroupSelect(g.id)}
                        style={{
                          cursor: 'pointer',
                          padding: '10px 16px',
                          background: isActive ? 'var(--pp-accent-dim)' : 'transparent',
                          borderLeft: `3px solid ${isActive ? 'var(--pp-accent)' : 'transparent'}`,
                          transition: 'all var(--pp-dur-short) var(--pp-ease-out)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--pp-text-sm)', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--pp-accent)' : 'var(--pp-ink)' }}>
                            {g.name}
                          </span>
                          {isActive && <RightOutlined style={{ fontSize: 10, color: 'var(--pp-accent)' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {g.groupType === 'FREE_GROUP' ? (
                            <span className="pp-type-tag pp-type-tag--free" style={{ fontSize: 10, padding: '0 4px' }}>FREE</span>
                          ) : (
                            <span className="pp-type-tag pp-type-tag--batch" style={{ fontSize: 10, padding: '0 4px' }}>BATCH</span>
                          )}
                          {(g.items?.length ?? 0) > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--pp-ink-3)' }}>{g.items.length} sản phẩm</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--pp-rule)', background: 'var(--pp-paper-2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Hoặc chọn Sản Phẩm Lẻ
              </div>
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                placeholder="Tìm sản phẩm..."
                value={selectedItemId}
                onChange={handleItemChange}
                options={products.map((p) => ({
                  label: `${p.code} – ${p.name}`,
                  value: p.id,
                }))}
                optionFilterProp="label"
              />
            </div>
          </div>
        </Col>

        {/* RIGHT: Rules Editor */}
        <Col span={17}>
          {editingItems.length === 0 ? (
            <div className="pp-card" style={{ padding: 'var(--pp-space-2xl) var(--pp-space-lg)' }}>
              <div className="pp-empty">
                <EditOutlined className="pp-empty__icon" />
                <div style={{ fontWeight: 600, fontSize: 'var(--pp-text-md)', marginBottom: 4 }}>
                  Chưa chọn mục tiêu
                </div>
                <div className="pp-empty__text">
                  Chọn một <span style={{ fontWeight: 600 }}>Production Group</span> hoặc <span style={{ fontWeight: 600 }}>Sản phẩm lẻ</span> ở bên trái để bắt đầu cấu hình rules
                </div>
              </div>
            </div>
          ) : (
            <div>
              {editingItems.map((p) => (
                <ItemRuleEditor
                  key={p.id}
                  item={p}
                  queryClient={queryClient}
                  onSave={(rules) => saveMutation.mutate({ itemId: p.id, rules })}
                  isSaving={
                    saveMutation.isPending &&
                    (saveMutation.variables as any)?.itemId === p.id
                  }
                />
              ))}
            </div>
          )}
        </Col>
      </Row>

      {/* ROW 2: Sản phẩm đã có Rule — full width */}
      <div className="pp-card" style={{ marginTop: 'var(--pp-space-lg)' }}>
        <div className="pp-card__header">
          <span className="pp-card__title">
            <TeamOutlined style={{ marginRight: 8 }} />
            Sản phẩm đã cấu hình Rule ({summaryData.length})
          </span>
          {isSummaryLoading && <Spin size="small" />}
        </div>
        <div className="pp-table-wrap">
          {!isSummaryLoading && summaryData.length === 0 ? (
            <div className="pp-empty" style={{ padding: 'var(--pp-space-lg)' }}>
              <div className="pp-empty__text">Chưa có sản phẩm nào được cấu hình</div>
            </div>
          ) : (
            <Table
              columns={summaryColumns}
              dataSource={summaryData}
              rowKey={(r) => r.product.id}
              pagination={false}
              size="small"
              loading={isSummaryLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── SubComponent: Editor for one item ─────────────────────────────────────────
const ItemRuleEditor: React.FC<{
  item: any;
  queryClient: any;
  onSave: (rules: ThresholdRule[]) => void;
  isSaving: boolean;
}> = ({ item, onSave, isSaving }) => {
  const [form] = Form.useForm();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['threshold-rules', item.id],
    queryFn: () => thresholdRuleService.getRulesByItem(item.id),
  });

  React.useEffect(() => {
    if (!isLoading) form.setFieldsValue({ rules });
  }, [rules, isLoading, form]);

  return (
    <div className="pp-form-section" style={{ marginBottom: 'var(--pp-space-md)' }}>
      <div className="pp-form-section__head" style={{ background: 'var(--pp-paper-2)' }}>
        <span className="pp-form-section__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--pp-text-md)', color: 'var(--pp-ink)' }}>{item.name}</span>
          <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)', fontWeight: 400 }}>{item.code}</span>
        </span>
        <Space>
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            style={{ fontSize: 'var(--pp-text-xs)', padding: '6px 12px' }}
            onClick={() => {
              const cur = form.getFieldValue('rules') || [];
              form.setFieldsValue({
                rules: [
                  ...cur,
                  {
                    dayType: 'WEEKDAY',
                    sortOrder: cur.length + 1,
                    conditionType: 'COUNT',
                    conditionValue: null,
                    actionType: 'PRODUCE_MORE',
                    actionValue: null,
                  },
                ],
              });
            }}
          >
            <PlusOutlined /> Thêm Rule
          </button>
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            style={{ fontSize: 'var(--pp-text-xs)', padding: '6px 16px' }}
            disabled={isSaving || isLoading}
            onClick={() => form.validateFields().then((v) => onSave(v.rules || []))}
          >
            {isSaving ? <Spin size="small" /> : null} Lưu
          </button>
        </Space>
      </div>

      <div className="pp-form-section__body">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--pp-space-md)' }}><Spin /></div>
        ) : (
          <Form form={form} component={false}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 100px 90px 140px 90px 40px', gap: 8, padding: '0 4px', marginBottom: 8 }}>
              {['Day Type', 'Sort', 'Ngưỡng', 'Giá trị', 'Hành động', 'Value', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--pp-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            <Form.List name="rules">
              {(fields, { remove }) => (
                <>
                  {fields.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--pp-space-sm)', color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-sm)' }}>
                      Chưa có rule cho sản phẩm này
                    </div>
                  )}
                  {fields.map(({ key, name, ...rest }) => (
                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 80px 100px 90px 140px 90px 40px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <Form.Item {...rest} name={[name, 'dayType']} noStyle>
                        <Select size="small" style={{ width: '100%' }}>
                          <Select.Option value="WEEKDAY">Weekday</Select.Option>
                          <Select.Option value="WEEKEND">Weekend</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'sortOrder']} noStyle>
                        <InputNumber size="small" style={{ width: '100%', fontFamily: 'var(--pp-font-mono)' }} min={1} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'conditionType']} noStyle>
                        <Select size="small" style={{ width: '100%' }}>
                          <Select.Option value="COUNT">&lt; N cái</Select.Option>
                          <Select.Option value="PERCENT">&lt; N %</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'conditionValue']} noStyle>
                        <InputNumber size="small" style={{ width: '100%', fontFamily: 'var(--pp-font-mono)' }} placeholder="5" min={0} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'actionType']} noStyle>
                        <Select size="small" style={{ width: '100%' }}>
                          <Select.Option value="PRODUCE_MORE">Làm thêm N</Select.Option>
                          <Select.Option value="FILL_TO_TARGET">Bù đủ N</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'actionValue']} noStyle>
                        <InputNumber size="small" style={{ width: '100%', fontFamily: 'var(--pp-font-mono)' }} placeholder="24" min={0} />
                      </Form.Item>
                      <div style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="pp-btn pp-btn--icon"
                          style={{ color: 'var(--pp-danger)' }}
                          onClick={() => remove(name)}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Form.List>
          </Form>
        )}
      </div>
    </div>
  );
};

export default ThresholdRules;
