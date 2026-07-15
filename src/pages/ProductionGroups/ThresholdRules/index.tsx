import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Select, Form, InputNumber, Row, Col, Typography,
  Tag, Space, message, Spin, Empty, List, Divider, Badge
} from 'antd';
import {
  DeleteOutlined, PlusOutlined, AppstoreOutlined,
  UserOutlined, RightOutlined, TeamOutlined
} from '@ant-design/icons';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { itemService, productionGroupService, thresholdRuleService } from '../../../api/services';
import type { ProductionGroup, ThresholdRule } from '../../../types';

const { Text } = Typography;

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
  const [navMode, setNavMode] = useState<'group' | 'single'>('group');

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
    setNavMode('group');
  };

  const handleItemChange = (val: string) => {
    setSelectedItemId(val);
    setSelectedGroupId(null);
    setNavMode('single');
  };

  const handleJumpToItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedGroupId(null);
    setNavMode('single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Summary Table columns ──────────────────────────────────────────────────
  const summaryColumns: ColumnsType<any> = [
    {
      title: 'Code',
      dataIndex: ['product', 'code'],
      render: (text) => <Text code style={{ fontSize: 12 }}>{text}</Text>,
      width: 100,
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: ['product', 'name'],
    },
    {
      title: 'Weekday',
      align: 'center' as const,
      width: 80,
      render: (_: any, r: any) => {
        const c = r.rules.filter((rule: ThresholdRule) => rule.dayType === 'WEEKDAY').length;
        return c ? <Tag color="blue">{c} rule</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Weekend',
      align: 'center' as const,
      width: 80,
      render: (_: any, r: any) => {
        const c = r.rules.filter((rule: ThresholdRule) => rule.dayType === 'WEEKEND').length;
        return c ? <Tag color="purple">{c} rule</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: '',
      width: 60,
      render: (_: any, r: any) => (
        <Button type="link" size="small" onClick={() => handleJumpToItem(r.product.id)}>
          Sửa
        </Button>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ROW 1: Lối tắt (left) + Cấu hình Rules (right) */}
      <Row gutter={[16, 16]}>
        {/* LEFT: Navigation panel */}
        <Col span={6}>
          <Card
            size="small"
            title={
              <Space>
                <AppstoreOutlined />
                <span>Lối tắt</span>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ padding: '8px 12px 4px', background: '#fafafa' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Theo Production Group
              </Text>
            </div>

            {groupsLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
            ) : groups.length === 0 ? (
              <div style={{ padding: '12px 16px' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Chưa có group nào</Text>
              </div>
            ) : (
              <List
                size="small"
                dataSource={groups}
                renderItem={(g: ProductionGroup) => {
                  const isActive = selectedGroupId === g.id;
                  return (
                    <List.Item
                      onClick={() => handleGroupSelect(g.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px 16px',
                        background: isActive ? '#e6f4ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #1677ff' : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text
                            strong={isActive}
                            style={{ fontSize: 13, color: isActive ? '#1677ff' : undefined }}
                          >
                            {g.name}
                          </Text>
                          {isActive && <RightOutlined style={{ fontSize: 10, color: '#1677ff' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          <Tag
                            style={{ margin: 0, fontSize: 10 }}
                            color={g.groupType === 'FREE_GROUP' ? 'blue' : 'purple'}
                          >
                            {g.groupType === 'FREE_GROUP' ? 'FREE' : 'BATCH'}
                          </Tag>
                          {(g.items?.length ?? 0) > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {g.items.length} sản phẩm
                            </Text>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}

            <Divider style={{ margin: '4px 0' }} />

            <div style={{ padding: '4px 12px 12px' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                Sản Phẩm Lẻ
              </Text>
              <Select
                showSearch
                allowClear
                size="small"
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
          </Card>
        </Col>

        {/* RIGHT: Rules Editor */}
        <Col span={18}>
          <Card title="Cấu hình Rules" size="small">
            {editingItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    Chọn một <strong>Production Group</strong> hoặc <strong>Sản phẩm</strong>{' '}
                    ở bên trái để bắt đầu
                  </span>
                }
                style={{ padding: '40px 0' }}
              />
            ) : (
              editingItems.map((p) => (
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
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* ROW 2: Sản phẩm đã có Rule — full width */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space>
                <Badge count={summaryData.length} size="small" offset={[4, 0]}>
                  <TeamOutlined />
                </Badge>
                <span>Sản phẩm đã có Rule</span>
                {isSummaryLoading && <Spin size="small" />}
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            {!isSummaryLoading && summaryData.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có sản phẩm nào được cấu hình"
                style={{ padding: 24 }}
              />
            ) : (
              <Table
                columns={summaryColumns}
                dataSource={summaryData}
                rowKey={(r) => r.product.id}
                pagination={{ pageSize: 10, size: 'small' }}
                size="small"
                loading={isSummaryLoading}
              />
            )}
          </Card>
        </Col>
      </Row>
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

  if (isLoading) return <Spin style={{ margin: '16px auto', display: 'block' }} />;

  return (
    <Card
      type="inner"
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Space>
          <UserOutlined />
          <Text strong>{item.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>({item.code})</Text>
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<PlusOutlined />}
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
            Thêm Rule
          </Button>
          <Button
            type="primary"
            size="small"
            loading={isSaving}
            onClick={() => form.validateFields().then((v) => onSave(v.rules || []))}
          >
            Lưu
          </Button>
        </Space>
      }
    >
      <Form form={form} component={false}>
        <Row gutter={6} style={{ marginBottom: 6, padding: '0 4px' }}>
          {['Day Type', 'Sort', 'Ngưỡng', 'Giá trị', 'Hành động', 'Value', ''].map((h, i) => (
            <Col key={i} span={[4, 3, 4, 3, 5, 3, 2][i]}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{h}</Text>
            </Col>
          ))}
        </Row>

        <Form.List name="rules">
          {(fields, { remove }) => (
            <>
              {fields.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có rule — bấm Thêm Rule" />
              )}
              {fields.map(({ key, name, ...rest }) => (
                <Row gutter={6} key={key} style={{ marginBottom: 6 }} align="middle">
                  <Col span={4}>
                    <Form.Item {...rest} name={[name, 'dayType']} noStyle>
                      <Select size="small" style={{ width: '100%' }}>
                        <Select.Option value="WEEKDAY">Weekday</Select.Option>
                        <Select.Option value="WEEKEND">Weekend</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={3}>
                    <Form.Item {...rest} name={[name, 'sortOrder']} noStyle>
                      <InputNumber size="small" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item {...rest} name={[name, 'conditionType']} noStyle>
                      <Select size="small" style={{ width: '100%' }}>
                        <Select.Option value="COUNT">&lt; N cái</Select.Option>
                        <Select.Option value="PERCENT">&lt; N %</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={3}>
                    <Form.Item {...rest} name={[name, 'conditionValue']} noStyle>
                      <InputNumber size="small" style={{ width: '100%' }} placeholder="5" />
                    </Form.Item>
                  </Col>
                  <Col span={5}>
                    <Form.Item {...rest} name={[name, 'actionType']} noStyle>
                      <Select size="small" style={{ width: '100%' }}>
                        <Select.Option value="PRODUCE_MORE">Làm thêm N</Select.Option>
                        <Select.Option value="FILL_TO_TARGET">Bù đủ N</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={3}>
                    <Form.Item {...rest} name={[name, 'actionValue']} noStyle>
                      <InputNumber size="small" style={{ width: '100%' }} placeholder="24" />
                    </Form.Item>
                  </Col>
                  <Col span={2} style={{ textAlign: 'center' }}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                    />
                  </Col>
                </Row>
              ))}
            </>
          )}
        </Form.List>
      </Form>
    </Card>
  );
};

export default ThresholdRules;
