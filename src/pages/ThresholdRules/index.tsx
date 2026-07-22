import React, { useEffect, useState } from 'react';
import { Card, Select, Form, InputNumber, Button, Table, Space, Row, Col, Tag, Typography, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import thresholdRuleService from '../../api/services/thresholdRuleService';
import itemService from '../../api/services/itemService';
import productionGroupService from '../../api/services/productionGroupService';
import type { ThresholdRule, Item, ProductionGroup } from '../../types';

const { Title } = Typography;

const ThresholdRulesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialItemId = searchParams.get('itemId') || '';

  const [products, setProducts] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ProductionGroup[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [rules, setRules] = useState<ThresholdRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [summaryList, setSummaryList] = useState<{ product: Item; wdCount: number; weCount: number }[]>([]);

  const loadInitialData = async () => {
    try {
      const [prodsData, groupsData] = await Promise.all([
        itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT' }).catch(() => []),
        productionGroupService.getAll().catch(() => []),
      ]);
      setProducts(prodsData || []);
      setGroups(groupsData || []);
      loadSummary(prodsData || []);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải danh sách sản phẩm');
    }
  };

  const loadSummary = async (prods: Item[]) => {
    try {
      const results = await Promise.all(
        prods.map(async (p) => {
          try {
            const r = await thresholdRuleService.getRulesByItem(p.id);
            return {
              product: p,
              wdCount: (r || []).filter((rule) => rule.dayType === 'WEEKDAY').length,
              weCount: (r || []).filter((rule) => rule.dayType === 'WEEKEND').length,
            };
          } catch {
            return { product: p, wdCount: 0, weCount: 0 };
          }
        })
      );
      setSummaryList(results.filter((item) => item.wdCount > 0 || item.weCount > 0));
    } catch {
      // silent catch for summary
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      loadRulesForItem(selectedItemId);
    }
  }, [selectedItemId]);

  const loadRulesForItem = async (itemId: string) => {
    setLoading(true);
    try {
      const data = await thresholdRuleService.getRulesByItem(itemId);
      setRules(data || []);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải threshold rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedItemId('');
    setRules([]);
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedGroupId('');
  };

  const handleAddRule = () => {
    const newRule: any = {
      id: `temp-${Date.now()}`,
      dayType: 'WEEKDAY',
      conditionType: 'COUNT',
      conditionValue: 10,
      actionType: 'TOP_UP',
      actionValue: 50,
      sortOrder: rules.length + 1,
    };
    setRules([...rules, newRule]);
  };

  const handleRemoveRule = (index: number) => {
    const updated = [...rules];
    updated.splice(index, 1);
    setRules(updated);
  };

  const handleUpdateRule = (index: number, field: string, value: any) => {
    const updated: any[] = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const handleSaveRules = async () => {
    if (!selectedItemId) {
      message.warning('Vui lòng chọn sản phẩm để lưu rules');
      return;
    }
    try {
      const payload: any = {
        rules: rules.map((r, i) => ({
          dayType: r.dayType,
          conditionType: r.conditionType,
          conditionValue: Number(r.conditionValue),
          actionType: r.actionType,
          actionValue: Number(r.actionValue),
          sortOrder: i + 1,
        })),
      };
      await thresholdRuleService.updateRules(selectedItemId, payload);
      message.success('Đã lưu threshold rules thành công');
      loadSummary(products);
    } catch (err: any) {
      message.error(err.message || 'Không thể lưu threshold rules');
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedItemId);

  return (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
          Chọn nhóm hoặc sản phẩm riêng lẻ
        </Title>
        <Row gutter={16} align="middle">
          <Col xs={24} md={10}>
            <Select
              style={{ width: '100%' }}
              placeholder="-- Chọn Production Group --"
              value={selectedGroupId || undefined}
              onChange={handleSelectGroup}
              allowClear
              options={groups.map((g) => ({
                value: g.id,
                label: `${g.code} — ${g.name} ${g.groupType === 'BATCH_FORMULA' ? '🧪' : '🔢'}`,
              }))}
            />
          </Col>
          <Col xs={24} md={4} style={{ textAlign: 'center' }}>
            <span style={{ color: '#94a3b8' }}>hoặc</span>
          </Col>
          <Col xs={24} md={10}>
            <Select
              style={{ width: '100%' }}
              showSearch
              placeholder="-- Chọn Sản phẩm --"
              value={selectedItemId || undefined}
              onChange={handleSelectItem}
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              options={products.map((p) => ({
                value: p.id,
                label: `[${p.code}] ${p.name}`,
              }))}
            />
          </Col>
        </Row>
      </Card>

      {selectedItemId && (
        <Card
          title={
            <span>
              Cấu hình Rules cho: <strong>[{selectedProduct?.code}] {selectedProduct?.name}</strong>
            </span>
          }
          style={{ marginBottom: 16 }}
          loading={loading}
          extra={
            <Space>
              <Button onClick={handleAddRule}>+ Thêm dòng Rule</Button>
              <Button type="primary" onClick={handleSaveRules}>
                Lưu thay đổi
              </Button>
            </Space>
          }
        >
          {rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
              Chưa có rule nào. Nhấn "+ Thêm dòng Rule" để bắt đầu.
            </div>
          ) : (
            <div>
              {rules.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8,
                    background: '#f8fafc',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Select
                    value={rule.dayType}
                    onChange={(v) => handleUpdateRule(idx, 'dayType', v)}
                    style={{ width: 120 }}
                    options={[
                      { value: 'WEEKDAY', label: 'Ngày thường (WD)' },
                      { value: 'WEEKEND', label: 'Cuối tuần (WE)' },
                    ]}
                  />

                  <span style={{ fontSize: 12, color: '#64748b' }}>nếu</span>

                  <Select
                    value={rule.conditionType}
                    onChange={(v) => handleUpdateRule(idx, 'conditionType', v)}
                    style={{ width: 120 }}
                    options={[
                      { value: 'COUNT', label: 'Tồn kho <' },
                      { value: 'PERCENT_TARGET', label: 'Tồn kho < %' },
                    ]}
                  />

                  <InputNumber
                    value={rule.conditionValue}
                    onChange={(v) => handleUpdateRule(idx, 'conditionValue', v)}
                    style={{ width: 90 }}
                  />

                  <span style={{ fontSize: 12, color: '#64748b' }}>thì</span>

                  <Select
                    value={rule.actionType}
                    onChange={(v) => handleUpdateRule(idx, 'actionType', v)}
                    style={{ width: 140 }}
                    options={[
                      { value: 'TOP_UP', label: 'Bù đủ' },
                      { value: 'PRODUCE_MORE', label: 'Sản xuất thêm' },
                    ]}
                  />

                  <InputNumber
                    value={rule.actionValue}
                    onChange={(v) => handleUpdateRule(idx, 'actionValue', v)}
                    style={{ width: 90 }}
                  />

                  <Button danger size="small" onClick={() => handleRemoveRule(idx)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="Sản phẩm đã có Threshold Rule">
        <Table
          dataSource={summaryList}
          rowKey={(r) => r.product.id}
          pagination={{ pageSize: 10 }}
          size="small"
          columns={[
            {
              title: 'Code',
              dataIndex: ['product', 'code'],
              key: 'code',
              render: (code: string) => <code>{code}</code>,
            },
            {
              title: 'Tên sản phẩm',
              dataIndex: ['product', 'name'],
              key: 'name',
            },
            {
              title: 'Weekday (WD)',
              dataIndex: 'wdCount',
              key: 'wdCount',
              align: 'center',
              render: (cnt: number) => (cnt ? <Tag color="blue">{cnt} rules</Tag> : '—'),
            },
            {
              title: 'Weekend (WE)',
              dataIndex: 'weCount',
              key: 'weCount',
              align: 'center',
              render: (cnt: number) => (cnt ? <Tag color="purple">{cnt} rules</Tag> : '—'),
            },
            {
              title: 'Thao tác',
              key: 'action',
              render: (_: any, r: any) => (
                <Button size="small" onClick={() => handleSelectItem(r.product.id)}>
                  Sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ThresholdRulesPage;
