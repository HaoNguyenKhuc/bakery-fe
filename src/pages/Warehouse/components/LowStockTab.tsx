import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Spin,
  message,
} from 'antd';
import {
  ShoppingCartOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShopOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/axiosClient';
import { itemService, masterService } from '../../../api/services';
import type { Warehouse } from '../../../api/services/warehouseService';

const { Title, Text } = Typography;

export interface LowStockItem {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  itemType: 'INGREDIENT' | 'SEMI_FINISHED' | 'PRODUCT';
  minStockQuantity: number;
  currentStock: number;
  shortage: number;
  unitCost?: number;
  supplierId?: string;
  supplierName?: string;
  supplierCode?: string;
}

interface Props {
  warehouse?: Warehouse;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(v);

const fmtMoney = (v?: number) =>
  v != null ? `${new Intl.NumberFormat('vi-VN').format(v)} đ` : '—';

export const LowStockTab: React.FC<Props> = ({ warehouse }) => {
  const navigate = useNavigate();
  const { type = 'kho-chinh' } = useParams<{ type: string }>();

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

  // Query low stock items from API
  const {
    data: lowStockData = [],
    isLoading: loadingLowStock,
    refetch: refetchLowStock,
  } = useQuery<any[]>({
    queryKey: ['low-stock-items-raw'],
    queryFn: async () => {
      try {
        const res = (await api.get('/api/v1/items/low-stock')) as any[];
        return Array.isArray(res) ? res : [];
      } catch (err) {
        return [];
      }
    },
    staleTime: 30_000,
  });

  // Query all items for full item details (defaultSupplier, unitCost)
  const { data: allItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['items', 'all-unpaginated'],
    queryFn: () =>
      itemService
        .getAllItems({ size: 2000 })
        .then((res) => (Array.isArray(res) ? res : res?.content || []))
        .catch(() => []),
    staleTime: 60_000,
  });

  // Query all suppliers for supplier details
  const { data: suppliersData = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () =>
      masterService
        .getSuppliers()
        .then((res) => (Array.isArray(res) ? res : res?.content || []))
        .catch(() => []),
    staleTime: 60_000,
  });

  const isLoading = loadingLowStock || loadingItems || loadingSuppliers;

  // Build merged items with supplier info
  const mergedItems: LowStockItem[] = useMemo(() => {
    if (!lowStockData.length) return [];

    const itemMap = new Map<string, any>();
    allItems.forEach((it: any) => {
      if (it.id) itemMap.set(it.id, it);
    });

    const supplierByCode = new Map<string, any>();
    const supplierById = new Map<string, any>();
    suppliersData.forEach((s: any) => {
      if (s.code) supplierByCode.set(s.code, s);
      if (s.id) supplierById.set(s.id, s);
    });

    return lowStockData.map((row: any) => {
      const fullItem = itemMap.get(row.itemId) || {};
      const defSup = fullItem.defaultSupplier;
      const supCode = defSup?.key ?? defSup?.code;
      const supId = defSup?.id;

      let supplierObj = null;
      if (supCode && supplierByCode.has(supCode)) {
        supplierObj = supplierByCode.get(supCode);
      } else if (supId && supplierById.has(supId)) {
        supplierObj = supplierById.get(supId);
      }

      return {
        itemId: row.itemId,
        code: row.code || fullItem.code || '',
        name: row.name || fullItem.name || '',
        unit: row.unit || fullItem.unit || '',
        itemType: row.itemType || fullItem.itemType || 'INGREDIENT',
        currentStock: row.currentStock ?? 0,
        minStockQuantity: row.minStockQuantity ?? 0,
        shortage: row.shortage ?? (row.minStockQuantity || 0) - (row.currentStock || 0),
        unitCost: fullItem.unitCost ?? row.unitCost,
        supplierId: supplierObj?.id ?? defSup?.id,
        supplierCode: supplierObj?.code ?? supCode,
        supplierName: supplierObj?.name ?? defSup?.value ?? defSup?.name,
      };
    });
  }, [lowStockData, allItems, suppliersData]);

  // Filter items by search and supplier
  const filteredItems = useMemo(() => {
    return mergedItems.filter((item) => {
      const matchKeyword =
        !searchKeyword ||
        item.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.code.toLowerCase().includes(searchKeyword.toLowerCase());

      const itemSup = item.supplierId || '__none__';
      const matchSupplier =
        selectedSupplier === 'ALL' || itemSup === selectedSupplier;

      return matchKeyword && matchSupplier;
    });
  }, [mergedItems, searchKeyword, selectedSupplier]);

  // Group filtered items by supplier
  const supplierGroups = useMemo(() => {
    const groups: {
      [key: string]: {
        supplierId: string | null;
        supplierCode?: string;
        supplierName: string;
        hasCritical: boolean;
        items: LowStockItem[];
      };
    } = {};

    filteredItems.forEach((item) => {
      const key = item.supplierId || '__none__';
      if (!groups[key]) {
        groups[key] = {
          supplierId: item.supplierId || null,
          supplierCode: item.supplierCode,
          supplierName: item.supplierName || '⚠️ Chưa phân loại Nhà Cung Cấp',
          hasCritical: false,
          items: [],
        };
      }
      if ((item.currentStock ?? 0) <= 0) {
        groups[key].hasCritical = true;
      }
      groups[key].items.push(item);
    });

    return Object.values(groups);
  }, [filteredItems]);

  // Unique suppliers list for select dropdown
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, string>();
    mergedItems.forEach((it) => {
      const k = it.supplierId || '__none__';
      const name = it.supplierName || 'Chưa có NCC';
      map.set(k, name);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ id: k, name: v }));
  }, [mergedItems]);

  const handleCreateOrderForSupplier = (group: (typeof supplierGroups)[0]) => {
    message.info(`Chuyển đến form tạo phiếu nhập cho ${group.supplierName}`);
    navigate(
      `/warehouse/${type}/phieu-kho/create?requestType=PURCHASE${
        group.supplierId ? `&supplierId=${group.supplierId}` : ''
      }`
    );
  };

  const handleCreateAllOrders = () => {
    message.success(
      `Đã chuẩn bị thông tin tạo phiếu cho ${supplierGroups.length} nhà cung cấp!`
    );
    navigate(`/warehouse/${type}/phieu-kho/create?requestType=PURCHASE`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Filter Bar & Actions ───────────────────────────────────────── */}
      <Card
        bordered={false}
        bodyStyle={{ padding: '12px 16px' }}
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Space wrap size="middle">
            <Input
              placeholder="Tìm theo tên hoặc mã nguyên liệu..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />

            <Select
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              style={{ width: 260 }}
              options={[
                { value: 'ALL', label: '🏢 Tất cả Nhà Cung Cấp' },
                ...uniqueSuppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
            />

            <Button
              icon={<ReloadOutlined />}
              loading={isLoading}
              onClick={() => {
                refetchLowStock();
                message.info('Đã cập nhật dữ liệu hàng cần nhập');
              }}
            >
              Làm mới
            </Button>
          </Space>

          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={supplierGroups.length === 0}
            onClick={handleCreateAllOrders}
            style={{ background: '#2563eb', borderColor: '#2563eb' }}
          >
            🚀 Nhập tất cả ({supplierGroups.length} NCC)
          </Button>
        </div>
      </Card>

      {/* ── Grouped Supplier Cards ────────────────────────────────────── */}
      {isLoading ? (
        <Card style={{ textAlign: 'center', padding: 48, borderRadius: 8 }}>
          <Spin size="large" tip="Đang tải danh sách hàng cần nhập..." />
        </Card>
      ) : supplierGroups.length === 0 ? (
        <Card
          style={{
            textAlign: 'center',
            padding: 48,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <Title level={4} style={{ color: '#16a34a', margin: 0 }}>
            Tất cả hàng hoá đều đủ tồn kho an toàn!
          </Title>
          <Text type="secondary">
            Không có mặt hàng nào đang ở dưới ngưỡng mức tồn tối thiểu.
          </Text>
        </Card>
      ) : (
        supplierGroups.map((group, idx) => {
          const isCritical = group.hasCritical;
          return (
            <Card
              key={group.supplierId || `group-${idx}`}
              bordered={false}
              style={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                borderLeft: isCritical ? '5px solid #dc2626' : '5px solid #f59e0b',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                marginBottom: 4,
              }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              {/* Supplier Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space size="middle" align="center">
                  <ShopOutlined
                    style={{
                      fontSize: 20,
                      color: isCritical ? '#dc2626' : '#d97706',
                    }}
                  />
                  <div>
                    <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
                      {group.supplierCode ? `[${group.supplierCode}] ` : ''}
                      {group.supplierName}
                    </Text>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <span>{group.items.length} mặt hàng cần nhập</span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>
                        Kho tiếp nhận:{' '}
                        <strong>{warehouse?.name || warehouse?.code || 'Kho Chính'}</strong>
                      </span>
                    </div>
                  </div>
                </Space>

                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => handleCreateOrderForSupplier(group)}
                  style={{
                    background: isCritical ? '#dc2626' : '#16a34a',
                    borderColor: isCritical ? '#dc2626' : '#16a34a',
                  }}
                >
                  📥 Tạo phiếu nhập NCC
                </Button>
              </div>

              {/* Items Table */}
              <Table<LowStockItem>
                dataSource={group.items}
                rowKey="itemId"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Loại',
                    dataIndex: 'itemType',
                    key: 'itemType',
                    width: 100,
                    render: (itemType: string) =>
                      itemType === 'INGREDIENT' ? (
                        <Tag color="blue">🥕 Nguyên liệu</Tag>
                      ) : itemType === 'SEMI_FINISHED' ? (
                        <Tag color="purple">🍞 Bán TP</Tag>
                      ) : (
                        <Tag color="cyan">📦 Thành phẩm</Tag>
                      ),
                  },
                  {
                    title: 'Mã & Tên Mặt Hàng',
                    key: 'name',
                    render: (_, record) => (
                      <div>
                        <Text strong style={{ color: '#0f172a' }}>
                          {record.name}
                        </Text>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          <code>{record.code}</code>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Tồn hiện tại',
                    key: 'currentStock',
                    align: 'right',
                    width: 130,
                    render: (_, record) => {
                      const isZero = (record.currentStock ?? 0) <= 0;
                      return (
                        <span
                          style={{
                            color: isZero ? '#dc2626' : '#d97706',
                            fontWeight: 700,
                          }}
                        >
                          {fmt(record.currentStock)} {record.unit}
                        </span>
                      );
                    },
                  },
                  {
                    title: 'Ngưỡng tối thiểu',
                    key: 'minStockQuantity',
                    align: 'right',
                    width: 140,
                    render: (_, record) => (
                      <span style={{ color: '#64748b' }}>
                        {fmt(record.minStockQuantity)} {record.unit}
                      </span>
                    ),
                  },
                  {
                    title: 'Còn thiếu (Cần nhập)',
                    key: 'shortage',
                    align: 'right',
                    width: 160,
                    render: (_, record) => (
                      <Tag
                        color="red"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        +{fmt(record.shortage)} {record.unit}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Đơn giá tham khảo',
                    dataIndex: 'unitCost',
                    key: 'unitCost',
                    align: 'right',
                    width: 150,
                    render: (cost?: number) => (
                      <Text style={{ color: '#475569', fontSize: 13 }}>
                        {fmtMoney(cost)}
                      </Text>
                    ),
                  },
                ]}
                rowClassName={(record) =>
                  (record.currentStock ?? 0) <= 0 ? 'low-stock-row-critical' : 'low-stock-row-warning'
                }
              />
            </Card>
          );
        })
      )}

      <style>{`
        .low-stock-row-critical td {
          background-color: #fff8f8 !important;
        }
        .low-stock-row-warning td {
          background-color: #fffdf5 !important;
        }
      `}</style>
    </div>
  );
};

export default LowStockTab;
