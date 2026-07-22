import React, { useEffect, useState } from 'react';
import { Card, Table, Form, Input, Button, Tag, Space, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, CheckOutlined, ClearOutlined } from '@ant-design/icons';
import supplierService from '../../api/services/supplierService';
import type { Supplier } from '../../types';

const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [form] = Form.useForm();

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await supplierService.getAll();
      setSuppliers(data || []);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải danh sách nhà cung cấp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editingSupplier) {
        await supplierService.update(editingSupplier.id, values);
        message.success('Đã cập nhật nhà cung cấp');
      } else {
        await supplierService.create(values);
        message.success('Đã thêm nhà cung cấp');
      }
      handleClearForm();
      loadSuppliers();
    } catch (err: any) {
      message.error(err.message || 'Không thể lưu nhà cung cấp');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await supplierService.approve(id);
      message.success('Đã phê duyệt nhà cung cấp');
      loadSuppliers();
    } catch (err: any) {
      message.error(err.message || 'Không thể phê duyệt');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.setFieldsValue({
      code: supplier.code,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
    });
  };

  const handleClearForm = () => {
    setEditingSupplier(null);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      render: (status: string) => {
        const isApproved = status === 'APPROVED';
        return (
          <Tag color={isApproved ? 'success' : 'warning'}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Supplier) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          {(record.approvalStatus === 'DRAFT' || record.approvalStatus === 'PENDING_APPROVAL' || record.approvalStatus === 'PENDING') && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
            >
              Approve
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title={editingSupplier ? `Sửa: ${editingSupplier.name}` : 'Thêm nhà cung cấp'}>
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="code"
                    label="Code"
                    rules={[{ required: true, message: 'Nhập code' }]}
                  >
                    <Input placeholder="VD: NCC_01" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="Tên nhà cung cấp"
                    rules={[{ required: true, message: 'Nhập tên NCC' }]}
                  >
                    <Input placeholder="VD: Công ty Bột Mỹ" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="contactName" label="Người liên hệ">
                    <Input placeholder="Anh Nam" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label="Điện thoại">
                    <Input placeholder="0901234567" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="email" label="Email">
                    <Input placeholder="ncc@gmail.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="address" label="Địa chỉ">
                    <Input placeholder="123 Nguyễn Trãi" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button icon={<ClearOutlined />} onClick={handleClearForm}>
                    Xóa trắng
                  </Button>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                    {editingSupplier ? 'Lưu thay đổi' : 'Tạo NCC'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Danh sách nhà cung cấp">
            <Table
              dataSource={suppliers}
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

export default SuppliersPage;
