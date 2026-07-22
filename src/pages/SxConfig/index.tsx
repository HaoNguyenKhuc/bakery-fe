import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Spin, Alert, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import productionGroupService from '../../api/services/productionGroupService';
import thresholdRuleService from '../../api/services/thresholdRuleService';
import itemService from '../../api/services/itemService';
import type { ProductionGroup, Item, ThresholdRule } from '../../types';

const { Title, Text } = Typography;

interface ProductWithRules {
  product: Item;
  rules: ThresholdRule[];
}

const SxConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [groups, setGroups] = useState<ProductionGroup[]>([]);
  const [withRules, setWithRules] = useState<ProductWithRules[]>([]);
  const [noConfig, setNoConfig] = useState<Item[]>([]);

  const loadSxConfig = async () => {
    setLoading(true);
    try {
      const [pgData, productsData] = await Promise.all([
        productionGroupService.getAll().catch(() => []),
        itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT' }).catch(() => []),
      ]);

      setGroups(pgData || []);

      // Items that belong to a group
      const groupedItemIds = new Set<string>(
        (pgData || []).flatMap((g) => (g.items || []).map((gi: any) => gi.itemId))
      );

      // Simple products (not in any group)
      const simpleProducts = (productsData || []).filter((p) => !groupedItemIds.has(p.id));

      // Fetch rules for simple products
      const ruleResults = await Promise.all(
        simpleProducts.map(async (p) => {
          try {
            const rules = await thresholdRuleService.getRulesByItem(p.id);
            return { product: p, rules: rules || [] };
          } catch {
            return { product: p, rules: [] };
          }
        })
      );

      const hasRulesList = ruleResults.filter((r) => r.rules.length > 0);
      const noConfigList = simpleProducts.filter(
        (p) => !hasRulesList.find((r) => r.product.id === p.id)
      );

      setWithRules(hasRulesList);
      setNoConfig(noConfigList);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải cấu hình sản xuất');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSxConfig();
  }, []);

  const freeGroups = groups.filter((g) => g.groupType === 'FREE_GROUP');
  const batchGroups = groups.filter((g) => g.groupType === 'BATCH_FORMULA');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" tip="Đang tải cấu hình sản xuất..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* FREE GROUP SECTION */}
      <Card
        title={
          <Title level={5} style={{ margin: 0 }}>
            🔢 FREE GROUP — Nhân viên phân bổ nội bộ
          </Title>
        }
        style={{ marginBottom: 16 }}
        extra={<Button onClick={() => navigate('/prod-groups')}>Quản lý Prod Groups</Button>}
      >
        {freeGroups.length === 0 ? (
          <Text type="secondary">Chưa có Free Group nào</Text>
        ) : (
          <Table
            dataSource={freeGroups.flatMap((g) =>
              (g.items || []).map((gi: any, idx: number) => ({
                ...gi,
                groupName: g.name,
                groupCode: g.code,
                targetWeekday: g.targetWeekday,
                targetWeekend: g.targetWeekend,
                thresholdPercent: g.thresholdPercent,
                isFirst: idx === 0,
                rowCount: g.items?.length || 1,
                rowKey: `${g.id}-${gi.itemId || idx}`,
              }))
            )}
            rowKey="rowKey"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Nhóm',
                dataIndex: 'groupName',
                key: 'groupName',
                render: (text: string, record: any) => ({
                  children: (
                    <div>
                      <strong>{text}</strong>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{record.groupCode}</Text>
                    </div>
                  ),
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
              {
                title: 'Sản phẩm',
                dataIndex: 'item',
                key: 'item',
                render: (item: any) => item?.value || item?.name || item?.key || '—',
              },
              {
                title: 'Target WD',
                dataIndex: 'targetWeekday',
                key: 'targetWeekday',
                align: 'center',
                render: (val: number, record: any) => ({
                  children: <strong>{val ?? '—'}</strong>,
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
              {
                title: 'Target WE',
                dataIndex: 'targetWeekend',
                key: 'targetWeekend',
                align: 'center',
                render: (val: number, record: any) => ({
                  children: <strong>{val ?? '—'}</strong>,
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
              {
                title: 'Ngưỡng %',
                dataIndex: 'thresholdPercent',
                key: 'thresholdPercent',
                align: 'center',
                render: (val: number, record: any) => ({
                  children: val != null ? <Tag color="warning">&lt;{val}%</Tag> : <Text type="secondary">luôn SX</Text>,
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
            ]}
          />
        )}
      </Card>

      {/* BATCH FORMULA SECTION */}
      <Card
        title={
          <Title level={5} style={{ margin: 0 }}>
            🧪 BATCH FORMULA — Theo cối
          </Title>
        }
        style={{ marginBottom: 16 }}
      >
        {batchGroups.length === 0 ? (
          <Text type="secondary">Chưa có Batch Formula Group nào</Text>
        ) : (
          <Table
            dataSource={batchGroups.flatMap((g) =>
              (g.items || []).map((gi: any, idx: number) => ({
                ...gi,
                groupName: g.name,
                groupCode: g.code,
                batchWeightKg: g.batchWeightGrams ? (g.batchWeightGrams / 1000).toFixed(1) + 'kg' : '—',
                isFirst: idx === 0,
                rowCount: g.items?.length || 1,
                rowKey: `${g.id}-${gi.itemId || idx}`,
              }))
            )}
            rowKey="rowKey"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Nhóm',
                dataIndex: 'groupName',
                key: 'groupName',
                render: (text: string, record: any) => ({
                  children: (
                    <div>
                      <strong>{text}</strong>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{record.groupCode}</Text>
                    </div>
                  ),
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
              {
                title: 'Sản phẩm',
                dataIndex: 'item',
                key: 'item',
                render: (item: any) => item?.value || item?.name || item?.key || '—',
              },
              {
                title: 'Gram/cái',
                dataIndex: 'gramsPerUnit',
                key: 'gramsPerUnit',
                align: 'right',
                render: (val: number) => (val ? `${val}g` : '—'),
              },
              {
                title: 'Cối (kg)',
                dataIndex: 'batchWeightKg',
                key: 'batchWeightKg',
                align: 'right',
                render: (val: string, record: any) => ({
                  children: <strong>{val}</strong>,
                  props: { rowSpan: record.isFirst ? record.rowCount : 0 },
                }),
              },
            ]}
          />
        )}
      </Card>

      {/* SIMPLE RULES SECTION */}
      <Card
        title={
          <Title level={5} style={{ margin: 0 }}>
            📏 SIMPLE RULES — Ngưỡng theo từng sản phẩm
          </Title>
        }
        style={{ marginBottom: 16 }}
        extra={<Button onClick={() => navigate('/threshold-rules')}>Cấu hình Threshold Rules</Button>}
      >
        <Table
          dataSource={withRules}
          rowKey={(r) => r.product.id}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Sản phẩm',
              dataIndex: 'product',
              key: 'product',
              render: (p: Item) => (
                <span>
                  <code>{p.code}</code> {p.name}
                </span>
              ),
            },
            {
              title: 'WD rules',
              key: 'wd',
              align: 'center',
              render: (_: any, r: ProductWithRules) => {
                const count = r.rules.filter((rule) => rule.dayType === 'WEEKDAY').length;
                return count ? <Tag color="blue">{count}</Tag> : '0';
              },
            },
            {
              title: 'WE rules',
              key: 'we',
              align: 'center',
              render: (_: any, r: ProductWithRules) => {
                const count = r.rules.filter((rule) => rule.dayType === 'WEEKEND').length;
                return count ? <Tag color="purple">{count}</Tag> : '0';
              },
            },
            {
              title: 'Rule đầu tiên (WD)',
              key: 'firstRule',
              render: (_: any, r: ProductWithRules) => {
                const first = r.rules.find((rule) => rule.dayType === 'WEEKDAY');
                if (!first) return '—';
                const cond =
                  first.conditionType === 'COUNT'
                    ? `tồn < ${first.conditionValue}`
                    : `tồn < ${first.conditionValue}% × ${first.actionValue}`;
                const act =
                  first.actionType === 'PRODUCE_MORE'
                    ? `làm thêm ${first.actionValue}`
                    : `bù đủ ${first.actionValue}`;
                return `${cond} → ${act}`;
              },
            },
            {
              title: 'Thao tác',
              key: 'action',
              render: (_: any, r: ProductWithRules) => (
                <Button size="small" onClick={() => navigate(`/threshold-rules?itemId=${r.product.id}`)}>
                  Sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {/* UNCONFIGURED SECTION */}
      {noConfig.length > 0 && (
        <Alert
          message={`⚠️ Chưa cấu hình (${noConfig.length} sản phẩm)`}
          description={
            <Space wrap style={{ marginTop: 8 }}>
              {noConfig.map((p) => (
                <Tag
                  key={p.id}
                  color="warning"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/threshold-rules?itemId=${p.id}`)}
                >
                  {p.code} — {p.name}
                </Tag>
              ))}
            </Space>
          }
          type="warning"
          showIcon
        />
      )}
    </div>
  );
};

export default SxConfigPage;
