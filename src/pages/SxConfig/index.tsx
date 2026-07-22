import React, { useMemo } from 'react';
import { Table, Space, Spin, Tag, Row, Col } from 'antd';
import { useQuery, useQueries } from '@tanstack/react-query';
import { itemService, productionGroupService, thresholdRuleService } from '../../api/services';
import type { ProductionGroup, ThresholdRule } from '../../types';
import { AppstoreOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../../styles/production-plans.css';

const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content) return data.content;
  if (data?.data) return data.data;
  return [];
};

const ProductionConfig: React.FC = () => {
  const navigate = useNavigate();
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
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pp-space-2xl)' }}><Spin size="large" /></div>;
  }

  return (
    <div className="pp-page">
      <div className="pp-header">
        <div className="pp-header__left">
          <div className="pp-header__icon">
            <AppstoreOutlined />
          </div>
          <div>
            <h1 className="pp-header__title">Cấu hình SX</h1>
            <p className="pp-header__sub">Tổng quan cấu hình sản xuất</p>
          </div>
        </div>
      </div>
      <main className="pp-content">
      <Row gutter={[16, 16]}>
        
        {/* FREE_GROUP */}
        {freeGroups.length > 0 && (
          <Col span={24}>
            <div className="pp-card" style={{ marginBottom: 'var(--pp-space-sm)' }}>
              <div className="pp-card__header">
                <span className="pp-card__title">
                  <span style={{ marginRight: 8 }}>🔢</span>
                  FREE GROUP — Nhân viên phân bổ nội bộ
                </span>
              </div>
              <div className="pp-table-wrap">
                <Table
                  size="small"
                  dataSource={freeGroups.flatMap(g => (g.items || []).map((gi, idx) => ({ ...gi, group: g, isFirst: idx === 0, rowSpan: g.items?.length || 1 })))}
                  rowKey={(r) => `${r.group.id}-${r.itemId}`}
                  pagination={false}
                  columns={[
                    {
                      title: 'Nhóm',
                      dataIndex: 'group',
                      render: (g, row) => ({
                        children: (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{g.name}</div>
                            <div style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>{g.code}</div>
                          </div>
                        ),
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: 'Sản phẩm',
                      dataIndex: 'itemId',
                      render: (_, row) => (
                        <span style={{ fontWeight: 500, fontSize: 'var(--pp-text-sm)' }}>
                          {row.item?.name || row.item?.key || '?'}
                        </span>
                      ),
                    },
                    {
                      title: 'Target WD',
                      dataIndex: 'group',
                      align: 'center',
                      render: (g, row) => ({
                        children: <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{g.targetWeekday ?? '—'}</span>,
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: 'Target WE',
                      dataIndex: 'group',
                      align: 'center',
                      render: (g, row) => ({
                        children: <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{g.targetWeekend ?? '—'}</span>,
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: 'Ngưỡng %',
                      dataIndex: 'group',
                      align: 'center',
                      render: (g, row) => ({
                        children: g.thresholdPercent != null
                          ? <span className="pp-type-tag pp-type-tag--free">&lt;{g.thresholdPercent}%</span>
                          : <span style={{ color: 'var(--pp-ink-3)', fontSize: 'var(--pp-text-xs)' }}>Luôn SX</span>,
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: '',
                      width: 60,
                      align: 'center',
                      render: (_, row) => ({
                        children: (
                          <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--pp-text-xs)' }} onClick={() => navigate('/prod-groups')}>
                            Sửa
                          </button>
                        ),
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    }
                  ]}
                />
              </div>
            </div>
          </Col>
        )}

        {/* BATCH_FORMULA */}
        {batchGroups.length > 0 && (
          <Col span={24}>
            <div className="pp-card" style={{ marginBottom: 'var(--pp-space-sm)' }}>
              <div className="pp-card__header">
                <span className="pp-card__title">
                  <span style={{ marginRight: 8 }}>🧪</span>
                  BATCH FORMULA — Sản xuất theo cối
                </span>
              </div>
              <div className="pp-table-wrap">
                <Table
                  size="small"
                  dataSource={batchGroups.flatMap(g => (g.items || []).map((gi, idx) => ({ ...gi, group: g, isFirst: idx === 0, rowSpan: g.items?.length || 1 })))}
                  rowKey={(r) => `${r.group.id}-${r.itemId}`}
                  pagination={false}
                  columns={[
                    {
                      title: 'Nhóm',
                      dataIndex: 'group',
                      render: (g, row) => ({
                        children: (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>{g.name}</div>
                            <div style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>{g.code}</div>
                          </div>
                        ),
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: 'Sản phẩm',
                      dataIndex: 'itemId',
                      render: (_, row) => (
                        <span style={{ fontWeight: 500, fontSize: 'var(--pp-text-sm)' }}>
                          {row.item?.name || row.item?.key || '?'}
                        </span>
                      ),
                    },
                    {
                      title: 'Gram / cái',
                      dataIndex: 'gramsPerUnit',
                      align: 'right',
                      render: (val) => val ? (
                        <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-sm)' }}>{val}g</span>
                      ) : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>,
                    },
                    {
                      title: 'Trọng lượng cối (kg)',
                      dataIndex: 'group',
                      align: 'right',
                      render: (g, row) => ({
                        children: g.batchWeightGrams ? (
                          <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600, fontSize: 'var(--pp-text-sm)' }}>
                            {(g.batchWeightGrams / 1000).toFixed(1)}kg
                          </span>
                        ) : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>,
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    },
                    {
                      title: '',
                      width: 60,
                      align: 'center',
                      render: (_, row) => ({
                        children: (
                          <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--pp-text-xs)' }} onClick={() => navigate('/prod-groups')}>
                            Sửa
                          </button>
                        ),
                        props: { rowSpan: row.isFirst ? row.rowSpan : 0 },
                      }),
                    }
                  ]}
                />
              </div>
            </div>
          </Col>
        )}

        {/* SIMPLE RULES */}
        {simpleProductsWithRules.length > 0 && (
          <Col span={24}>
            <div className="pp-card" style={{ marginBottom: 'var(--pp-space-sm)' }}>
              <div className="pp-card__header">
                <span className="pp-card__title">
                  <span style={{ marginRight: 8 }}>📏</span>
                  SIMPLE RULES — Cấu hình ngưỡng từng sản phẩm lẻ
                </span>
              </div>
              <div className="pp-table-wrap">
                <Table
                  size="small"
                  dataSource={simpleProductsWithRules}
                  rowKey={(r) => r.product.id}
                  pagination={false}
                  columns={[
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
                      title: 'WD rules',
                      align: 'center',
                      render: (_, row) => {
                        const count = row.rules.filter(r => r.dayType === 'WEEKDAY').length;
                        return count ? <span className="pp-tab__badge">{count}</span> : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>;
                      },
                    },
                    {
                      title: 'WE rules',
                      align: 'center',
                      render: (_, row) => {
                        const count = row.rules.filter(r => r.dayType === 'WEEKEND').length;
                        return count ? <span className="pp-tab__badge">{count}</span> : <span style={{ color: 'var(--pp-ink-3)' }}>—</span>;
                      },
                    },
                    {
                      title: 'Rule đầu tiên (WD)',
                      render: (_, row) => {
                        const first = row.rules.filter(r => r.dayType === 'WEEKDAY')[0];
                        if (!first) return <span style={{ color: 'var(--pp-ink-3)' }}>—</span>;
                        const condition = first.conditionType === 'COUNT' ? `tồn < ${first.conditionValue}` : `tồn < ${first.conditionValue}% × ${first.actionValue}`;
                        const action = first.actionType === 'PRODUCE_MORE' ? `làm thêm ${first.actionValue}` : `bù đủ ${first.actionValue}`;
                        return <span style={{ fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-2)' }}>{condition} → {action}</span>;
                      },
                    },
                    {
                      title: '',
                      width: 60,
                      align: 'center',
                      render: (_, row) => (
                        <button className="pp-btn pp-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--pp-text-xs)' }} onClick={() => navigate('/threshold-rules')}>
                          Sửa
                        </button>
                      ),
                    }
                  ]}
                />
              </div>
            </div>
          </Col>
        )}

        {/* CHƯA CẤU HÌNH */}
        {noConfigProducts.length > 0 && (
          <Col span={24}>
            <div className="pp-card" style={{ marginBottom: 'var(--pp-space-sm)', borderColor: 'var(--pp-warning)' }}>
              <div className="pp-card__header" style={{ background: 'var(--pp-paper)' }}>
                <span className="pp-card__title" style={{ color: 'var(--pp-warning)' }}>
                  <WarningOutlined style={{ marginRight: 8 }} />
                  Chưa cấu hình ({noConfigProducts.length} sản phẩm)
                </span>
              </div>
              <div className="pp-card__body">
                <Space size={[8, 8]} wrap>
                  {noConfigProducts.map(p => (
                    <button
                      key={p.id}
                      className="pp-btn pp-btn--ghost"
                      style={{ padding: '2px 10px', fontSize: 'var(--pp-text-xs)', fontFamily: 'var(--pp-font-mono)' }}
                      onClick={() => navigate('/threshold-rules')}
                    >
                      {p.code}
                    </button>
                  ))}
                </Space>
              </div>
            </div>
          </Col>
        )}

      </Row>
      </main>
    </div>
  );
};

export default ProductionConfig;
