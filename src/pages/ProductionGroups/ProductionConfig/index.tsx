import React, { useMemo } from 'react';
import { Card, Table, Typography, Space, Spin, Tag, Row, Col, Badge } from 'antd';
import { useQuery, useQueries } from '@tanstack/react-query';
import { itemService, productionGroupService, thresholdRuleService } from '../../../api/services';
import type { ProductionGroup, ThresholdRule } from '../../../types';

const { Text, Title } = Typography;

const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content) return data.content;
  if (data?.data) return data.data;
  return [];
};

interface ProductionConfigProps {
  onNavigateToGroup?: (groupId: string) => void;
  onNavigateToRule?: (itemId: string) => void;
}

const ProductionConfig: React.FC<ProductionConfigProps> = ({ onNavigateToGroup, onNavigateToRule }) => {
  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: groupsRaw = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['production-groups'],
    queryFn: () => productionGroupService.getAll(),
  });
  const groups: ProductionGroup[] = extractArray(groupsRaw);

  const { data: allItemsRaw = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  const allItems = extractArray(allItemsRaw);
  const products = useMemo(() => allItems.filter((i: any) => i.itemType === 'PRODUCT'), [allItems]);

  // Items in groups
  const groupedItemIds = useMemo(() => {
    const ids = new Set<string>();
    groups.forEach((g) => {
      (g.items || []).forEach((gi) => ids.add(gi.itemId));
    });
    return ids;
  }, [groups]);

  // Simple products not in any group
  const simpleProducts = useMemo(() => products.filter((p) => !groupedItemIds.has(p.id)), [products, groupedItemIds]);

  const ruleQueries = useQueries({
    queries: simpleProducts.map((p) => ({
      queryKey: ['threshold-rules', p.id],
      queryFn: () => thresholdRuleService.getRulesByItem(p.id),
      staleTime: 60_000,
    })),
  });

  const isLoadingRules = ruleQueries.some(q => q.isLoading);
  const isLoading = groupsLoading || itemsLoading || isLoadingRules;

  const simpleProductsWithRules = useMemo(() => {
    return simpleProducts.map((p, i) => ({
      product: p,
      rules: ruleQueries[i].data || []
    })).filter(x => x.rules.length > 0);
  }, [simpleProducts, ruleQueries]);

  const noConfigProducts = useMemo(() => {
    const withRulesIds = new Set(simpleProductsWithRules.map(x => x.product.id));
    return simpleProducts.filter(p => !withRulesIds.has(p.id));
  }, [simpleProducts, simpleProductsWithRules]);

  const freeGroups = groups.filter(g => g.groupType === 'FREE_GROUP');
  const batchGroups = groups.filter(g => g.groupType === 'BATCH_FORMULA');

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <Row gutter={[16, 16]}>
        
        {/* FREE_GROUP */}
        {freeGroups.length > 0 && (
          <Col span={24}>
            <Title level={5}>
              <span style={{ marginRight: 8 }}>🔢</span>
              FREE GROUP — Nhân viên phân bổ nội bộ
            </Title>
            <Card size="small" bodyStyle={{ padding: 0 }}>
              <Table
                size="small"
                dataSource={freeGroups.flatMap(g => (g.items || []).map((gi, idx) => ({ ...gi, group: g, isFirst: idx === 0, rowSpan: g.items?.length || 1 })))}
                rowKey={(r) => `${r.group.id}-${r.itemId}`}
                pagination={false}
                bordered
                columns={[
                  {
                    title: 'Nhóm',
                    dataIndex: 'group',
                    render: (g, row) => ({
                      children: (
                        <div>
                          <Text strong>{g.name}</Text><br />
                          <Text type="secondary" style={{ fontSize: 12 }}>{g.code}</Text>
                        </div>
                      ),
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: 'Sản phẩm',
                    dataIndex: 'itemId',
                    render: (_, row) => row.item?.name || row.item?.key || '?',
                  },
                  {
                    title: 'Target WD',
                    dataIndex: 'group',
                    align: 'center',
                    render: (g, row) => ({
                      children: <Text strong>{g.targetWeekday ?? '—'}</Text>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: 'Target WE',
                    dataIndex: 'group',
                    align: 'center',
                    render: (g, row) => ({
                      children: <Text strong>{g.targetWeekend ?? '—'}</Text>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: 'Ngưỡng %',
                    dataIndex: 'group',
                    align: 'center',
                    render: (g, row) => ({
                      children: g.thresholdPercent != null
                        ? <Tag color="warning" style={{ borderRadius: 10 }}>&lt;{g.thresholdPercent}%</Tag>
                        : <Text type="secondary" style={{ fontSize: 12 }}>Luôn SX</Text>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: '',
                    width: 60,
                    render: (_, row) => ({
                      children: <a onClick={() => onNavigateToGroup?.(row.group.id)}>Sửa</a>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  }
                ]}
              />
            </Card>
          </Col>
        )}

        {/* BATCH_FORMULA */}
        {batchGroups.length > 0 && (
          <Col span={24}>
            <Title level={5}>
              <span style={{ marginRight: 8 }}>🧪</span>
              BATCH FORMULA — Sản xuất theo cối
            </Title>
            <Card size="small" bodyStyle={{ padding: 0 }}>
              <Table
                size="small"
                dataSource={batchGroups.flatMap(g => (g.items || []).map((gi, idx) => ({ ...gi, group: g, isFirst: idx === 0, rowSpan: g.items?.length || 1 })))}
                rowKey={(r) => `${r.group.id}-${r.itemId}`}
                pagination={false}
                bordered
                columns={[
                  {
                    title: 'Nhóm',
                    dataIndex: 'group',
                    render: (g, row) => ({
                      children: (
                        <div>
                          <Text strong>{g.name}</Text><br />
                          <Text type="secondary" style={{ fontSize: 12 }}>{g.code}</Text>
                        </div>
                      ),
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: 'Sản phẩm',
                    dataIndex: 'itemId',
                    render: (_, row) => row.item?.name || row.item?.key || '?',
                  },
                  {
                    title: 'Gram / cái',
                    dataIndex: 'gramsPerUnit',
                    align: 'right',
                    render: (val) => val ? `${val}g` : '—',
                  },
                  {
                    title: 'Trọng lượng cối (kg)',
                    dataIndex: 'group',
                    align: 'right',
                    render: (g, row) => ({
                      children: <Text strong>{g.batchWeightGrams ? `${(g.batchWeightGrams / 1000).toFixed(1)}kg` : '—'}</Text>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  },
                  {
                    title: '',
                    width: 60,
                    render: (_, row) => ({
                      children: <a onClick={() => onNavigateToGroup?.(row.group.id)}>Sửa</a>,
                      props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                    }),
                  }
                ]}
              />
            </Card>
          </Col>
        )}

        {/* SIMPLE RULES */}
        {simpleProductsWithRules.length > 0 && (
          <Col span={24}>
            <Title level={5}>
              <span style={{ marginRight: 8 }}>📏</span>
              SIMPLE RULES — Cấu hình ngưỡng từng sản phẩm lẻ
            </Title>
            <Card size="small" bodyStyle={{ padding: 0 }}>
              <Table
                size="small"
                dataSource={simpleProductsWithRules}
                rowKey={(r) => r.product.id}
                pagination={false}
                bordered
                columns={[
                  {
                    title: 'Sản phẩm',
                    dataIndex: 'product',
                    render: (p) => (
                      <Space>
                        <Text code>{p.code}</Text>
                        <Text>{p.name}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: 'WD rules',
                    align: 'center',
                    render: (_, row) => {
                      const count = row.rules.filter(r => r.dayType === 'WEEKDAY').length;
                      return count ? <Tag color="blue" style={{ borderRadius: 10 }}>{count}</Tag> : <Text type="secondary">0</Text>;
                    },
                  },
                  {
                    title: 'WE rules',
                    align: 'center',
                    render: (_, row) => {
                      const count = row.rules.filter(r => r.dayType === 'WEEKEND').length;
                      return count ? <Tag color="purple" style={{ borderRadius: 10 }}>{count}</Tag> : <Text type="secondary">0</Text>;
                    },
                  },
                  {
                    title: 'Rule đầu tiên (WD)',
                    render: (_, row) => {
                      const first = row.rules.filter(r => r.dayType === 'WEEKDAY')[0];
                      if (!first) return '—';
                      const condition = first.conditionType === 'COUNT' ? `tồn < ${first.conditionValue}` : `tồn < ${first.conditionValue}% × ${first.actionValue}`;
                      const action = first.actionType === 'PRODUCE_MORE' ? `làm thêm ${first.actionValue}` : `bù đủ ${first.actionValue}`;
                      return <Text type="secondary" style={{ fontSize: 12 }}>{condition} → {action}</Text>;
                    },
                  },
                  {
                    title: '',
                    width: 60,
                    render: (_, row) => <a onClick={() => onNavigateToRule?.(row.product.id)}>Sửa</a>,
                  }
                ]}
              />
            </Card>
          </Col>
        )}

        {/* CHƯA CẤU HÌNH */}
        {noConfigProducts.length > 0 && (
          <Col span={24}>
            <Title level={5}>
              <span style={{ marginRight: 8 }}>⚠️</span>
              Chưa cấu hình ({noConfigProducts.length} sản phẩm)
            </Title>
            <Space size={[8, 8]} wrap>
              {noConfigProducts.map(p => (
                <Tag
                  key={p.id}
                  color="orange"
                  style={{ borderRadius: 12, cursor: 'pointer', padding: '2px 10px' }}
                  onClick={() => onNavigateToRule?.(p.id)}
                >
                  {p.code}
                </Tag>
              ))}
            </Space>
          </Col>
        )}

      </Row>
    </div>
  );
};

export default ProductionConfig;
