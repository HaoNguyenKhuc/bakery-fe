import React, { useEffect, useState } from 'react';
import { Card, Table, Form, Select, Input, InputNumber, Button, Tabs, Space, Row, Col, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import productMappingService from '../../api/services/productMappingService';
import itemService from '../../api/services/itemService';
import itemGroupService from '../../api/services/itemGroupService';
import type { ProductMapping, Item, ItemGroup } from '../../types';

const ProductMappingPage: React.FC = () => {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);

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
    const matchedItem = products.find((p) => p.code === record.item?.key || p.id === record.item?.key);
    form.setFieldsValue({
      itemId: matchedItem?.id || '',
      exCode: record.exCode,
      sellingPrice: record.sellingPrice,
      note: record.note,
    });
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

  // Filter mappings by itemGroup
  const getItemGroupKeyOfMapping = (m: ProductMapping) => {
    const item = products.find((p) => p.code === m.item?.key);
    return item?.itemGroup?.key || null;
  };

  const filteredMappings = mappings.filter((m) => {
    if (activeGroupKey === 'ALL') return true;
    return getItemGroupKeyOfMapping(m) === activeGroupKey;
  });

  const tabItems = [
    { key: 'ALL', label: 'Tất cả' },
    ...groups.map((g) => ({ key: g.code, label: g.name })),
  ];

  const columns = [
    {
      title: 'SP (IN_CODE)',
      dataIndex: 'item',
      key: 'item',
      render: (item: any) => item?.value || item?.key || '—',
    },
    {
      title: 'EX_CODE (POS)',
      dataIndex: 'exCode',
      key: 'exCode',
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: 'Giá bán',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      render: (price: number) => (price ? `${price.toLocaleString('vi-VN')}đ` : '—'),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => note || '—',
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: ProductMapping) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Sửa
          </Button>
          <Popconfirm title="Xoá mapping này?" onConfirm={() => handleDelete(record.id)}>
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
        <Col xs={24} lg={9}>
          <Card title={editingId ? 'Sửa Product Mapping' : 'Thêm Product Mapping'}>
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item
                name="itemId"
                label="Sản phẩm *"
                rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn SP..."
                  optionFilterProp="children"
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
                label="EX_CODE (POS) *"
                rules={[{ required: true, message: 'Nhập EX_CODE từ POS' }]}
              >
                <Input placeholder="VD: BK253145683" />
              </Form.Item>

              <Form.Item name="sellingPrice" label="Giá bán (đ)">
                <InputNumber style={{ width: '100%' }} placeholder="280000" />
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
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                    {editingId ? 'Cập nhật' : 'Thêm mapping'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card title="Danh sách mappings">
            <Tabs
              activeKey={activeGroupKey}
              onChange={setActiveGroupKey}
              items={tabItems}
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={filteredMappings}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductMappingPage;
