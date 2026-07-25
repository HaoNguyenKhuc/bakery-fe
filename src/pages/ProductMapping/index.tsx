import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Table, Form, Select, Input, InputNumber, Button,
  Space, Row, Col, Popconfirm, message, Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import productMappingService from '../../api/services/productMappingService';
import itemService from '../../api/services/itemService';
import itemGroupService from '../../api/services/itemGroupService';
import type { ProductMapping, Item, ItemGroup } from '../../types';

// ── Helper ────────────────────────────────────────────────────────────────────
// ProductMapping.item is ReferenceValue { key: string; name: string }
// key  = item code (IN_CODE)
// name = item name

const ProductMappingPage: React.FC = () => {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await productMappingService.update(editingId, values);
        message.success('Đã cập nhật mapping');
      } else {
        await productMappingService.create(values);
        message.success('Đã thêm mapping');
      }
      form.resetFields();
      setEditingId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Không thể lưu mapping');
    }
  };

  const handleEdit = (record: ProductMapping) => {
    setEditingId(record.id);
    // item.key = item code, find by code to get item.id for form
    const matchedItem = products.find(
      (p) => p.code === record.item?.key || p.id === record.item?.key,
    );
    form.setFieldsValue({
      itemId: matchedItem?.id || '',
      exCode: record.exCode,
      sellingPrice: record.sellingPrice,
      note: record.note,
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      await productMappingService.remove(id);
      message.success('Đã xoá mapping');
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Không thể xoá mapping');
    }
  };

  // Build a lookup: itemCode → itemGroup code
  const itemCodeToGroupCode = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      if (p.code && p.itemGroup?.key) {
        map[p.code] = p.itemGroup.key;
      }
    });
    return map;
  }, [products]);

  // Filter by active group tab and search text
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      const inCode = m.item?.key || '';
      const exCode = m.exCode || '';
      const name = m.item?.name || '';

      // Group filter
      const groupOk =
        activeGroupKey === 'ALL' ||
        (itemCodeToGroupCode[inCode] === activeGroupKey);

      // Search filter (case-insensitive)
      const q = searchText.trim().toLowerCase();
      const searchOk =
        !q ||
        inCode.toLowerCase().includes(q) ||
        exCode.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q);

      return groupOk && searchOk;
    });
  }, [mappings, activeGroupKey, searchText, itemCodeToGroupCode]);

  const tabItems = [
    { key: 'ALL', label: 'Tất cả' },
    ...groups.map((g) => ({ key: g.code, label: g.name })),
  ];

  const columns = [
    {
      title: 'SP (IN_CODE)',
      dataIndex: 'item',
      key: 'item',
      render: (item: any) => (
        <span style={{ fontWeight: 500, color: '#1a1a2e' }}>
          {/* key = IN_CODE (product code) */}
          {item?.key || '—'}
        </span>
      ),
    },
    {
      title: 'EX_CODE (POS)',
      dataIndex: 'exCode',
      key: 'exCode',
      render: (code: string) => (
        <code style={{
          background: '#f5f5f5',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 12,
          color: '#595959',
        }}>
          {code || '—'}
        </code>
      ),
    },
    {
      title: 'Giá bán',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      render: (price: number) =>
        price ? (
          <Tag color="green" style={{ fontWeight: 600 }}>
            {price.toLocaleString('vi-VN')}đ
          </Tag>
        ) : (
          <span style={{ color: '#bfbfbf' }}>—</span>
        ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => (
        <span style={{ color: note ? '#595959' : '#bfbfbf' }}>{note || '—'}</span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 130,
      render: (_: any, record: ProductMapping) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ borderColor: '#d2691e', color: '#d2691e' }}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xoá mapping này?"
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        {/* ── Left: Form ─────────────────────────────── */}
        <Col xs={24} lg={9}>
          <Card
            title={editingId ? '✏️ Sửa Product Mapping' : '➕ Thêm Product Mapping'}
            styles={{ header: { borderBottom: '2px solid #d2691e' } }}
          >
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item
                name="itemId"
                label="Sản phẩm"
                rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn SP..."
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={products.map((p) => ({
                    value: p.id,
                    label: `[${p.code}] ${p.name}`,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="exCode"
                label="EX_CODE (POS)"
                rules={[{ required: true, message: 'Nhập EX_CODE từ POS' }]}
              >
                <Input placeholder="VD: BK253145683" />
              </Form.Item>

              <Form.Item name="sellingPrice" label="Giá bán (đ)">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="280000"
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => Number(v!.replace(/,/g, ''))}
                />
              </Form.Item>

              <Form.Item name="note" label="Ghi chú">
                <Input placeholder="Ghi chú..." />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  {editingId && (
                    <Button onClick={() => { setEditingId(null); form.resetFields(); }}>
                      Hủy sửa
                    </Button>
                  )}
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    style={{ background: '#d2691e', borderColor: '#d2691e' }}
                  >
                    {editingId ? 'Cập nhật' : 'Thêm mapping'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* ── Right: Table ────────────────────────────── */}
        <Col xs={24} lg={15}>
          <Card
            title="Danh sách mappings"
            styles={{ header: { borderBottom: '2px solid #d2691e' } }}
          >
            {/* Tabs — group filter */}
            <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 12, overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
                {tabItems.map((tab) => {
                  const isActive = activeGroupKey === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setActiveGroupKey(tab.key); setSearchText(''); }}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? '2px solid #d2691e' : '2px solid transparent',
                        color: isActive ? '#d2691e' : '#595959',
                        fontWeight: isActive ? 600 : 400,
                        fontSize: 14,
                        transition: 'all 0.2s',
                        marginBottom: -1,
                        outline: 'none',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search bar */}
            <div style={{ marginBottom: 12 }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Tìm theo IN_CODE, EX_CODE..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ maxWidth: 360 }}
              />
            </div>

            {/* Table */}
            <Table
              dataSource={filteredMappings}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `${total} bản ghi`,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
              }}
              size="small"
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductMappingPage;
