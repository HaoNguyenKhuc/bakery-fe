import React from 'react';
import {
  Row, Col, Card, Form, Input, InputNumber, Button,
  Table, Popconfirm, Typography, message, Space
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { itemGroupService } from '../../../api/services';
import type { ItemGroup, ItemGroupRequest } from '../../../types';

const { Title, Text } = Typography;

const ItemGroupList: React.FC = () => {
  const [form] = Form.useForm<ItemGroupRequest>();
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: itemGroupsData, isLoading, isError } = useQuery({
    queryKey: ['itemGroups'],
    queryFn: () => itemGroupService.getAll(),
  });

  // Extract array based on potential backend wrappers
  const getArray = (data: any): ItemGroup[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.content)) return data.content;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const itemGroups = getArray(itemGroupsData);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (data: ItemGroupRequest) => itemGroupService.create(data),
    onSuccess: () => {
      message.success('Thêm Item Group thành công!');
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['itemGroups'] });
    },
    onError: () => message.error('Thêm thất bại. Vui lòng thử lại.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => itemGroupService.delete(id),
    onSuccess: () => {
      message.success('Đã xoá Item Group!');
      queryClient.invalidateQueries({ queryKey: ['itemGroups'] });
    },
    onError: () => message.error('Xoá thất bại. Vui lòng thử lại.'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const onFinish = (values: ItemGroupRequest) => {
    // Trim string inputs
    const payload = {
      ...values,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
    };
    createMut.mutate(payload);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const columns: ColumnsType<ItemGroup> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Sort',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 100,
      align: 'center',
    },
    {
      title: '',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title={`Bạn có chắc chắn muốn xóa "${record.name}"?`}
          onConfirm={() => deleteMut.mutate(record.id)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button 
            type="primary" 
            danger 
            size="small"
            icon={<DeleteOutlined />} 
            loading={deleteMut.isPending}
          >
            Xóa
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Item Groups</Title>
        <Text type="secondary">Quản lý nhóm hàng hoá (Item Groups)</Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Col: Form */}
        <Col xs={24} md={8}>
          <Card 
            title="Thêm Item Group" 
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{ sortOrder: 0 }}
            >
              <Form.Item
                name="code"
                label="Code"
                rules={[
                  { required: true, message: 'Vui lòng nhập Code!' },
                  { whitespace: true, message: 'Code không được chỉ chứa khoảng trắng!' }
                ]}
              >
                <Input placeholder="VD: PL" style={{ textTransform: 'uppercase' }} />
              </Form.Item>

              <Form.Item
                name="name"
                label="Tên"
                rules={[
                  { required: true, message: 'Vui lòng nhập Tên!' },
                  { whitespace: true, message: 'Tên không được chỉ chứa khoảng trắng!' }
                ]}
              >
                <Input placeholder="VD: Phòng Lạnh" />
              </Form.Item>

              <Form.Item
                name="sortOrder"
                label="Sort"
                rules={[{ required: true, message: 'Vui lòng nhập thứ tự sort!' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<PlusOutlined />}
                  loading={createMut.isPending}
                >
                  Thêm
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Right Col: Table */}
        <Col xs={24} md={16}>
          <Card 
            title="Danh sách" 
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            {isError ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="danger">Không thể tải danh sách Item Group.</Text>
                <Button size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ['itemGroups'] })}>
                  Thử lại
                </Button>
              </Space>
            ) : (
              <Table<ItemGroup>
                columns={columns}
                dataSource={itemGroups}
                rowKey="id"
                size="middle"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
                bordered
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ItemGroupList;
