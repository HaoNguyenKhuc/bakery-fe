import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Form, Input, Select, Tag, Space,
  Popconfirm, message, Card, Divider, Typography, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  KeyOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userAccountService } from '../../../api/services/userAccountService';
import { roleService } from '../../../api/services/roleService';
import type { UserAccount, Role, CreateUserRequest, UpdateUserRequest } from '../../../types';

const { Title, Text } = Typography;

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [cpUserId, setCpUserId] = useState<string>('');

  const [form] = Form.useForm();
  const [cpForm] = Form.useForm();

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userAccountService.getAll();
      setUsers(data?.content ?? (data as unknown as UserAccount[]) ?? []);
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const data = await roleService.getAll();
      setRoles(data?.content ?? (data as unknown as Role[]) ?? []);
    } catch {
      // error handled by interceptor
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  // ── Form actions ───────────────────────────────────────────────────────────

  const handleEdit = (user: UserAccount) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      fullName: user.fullName ?? '',
      roleId: user.roleId ?? '',
      password: '',
    });
  };

  const handleResetForm = () => {
    setEditingUser(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        const body: UpdateUserRequest = {
          username: values.username,
          fullName: values.fullName || null,
          roleId: values.roleId || null,
          password: values.password || null,
        };
        await userAccountService.update(editingUser.id, body);
        message.success('Đã cập nhật tài khoản');
      } else {
        const body: CreateUserRequest = {
          username: values.username,
          fullName: values.fullName || null,
          roleId: values.roleId || null,
          password: values.password,
        };
        await userAccountService.create(body);
        message.success('Đã tạo tài khoản mới');
      }
      handleResetForm();
      loadUsers();
    } catch {
      // validation or API errors handled
    }
  };

  const handleDelete = async (user: UserAccount) => {
    try {
      await userAccountService.remove(user.id);
      message.success(`Đã xoá tài khoản "${user.username}"`);
      loadUsers();
    } catch {
      // handled by interceptor
    }
  };

  // ── Change password ────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    try {
      const values = await cpForm.validateFields();
      if (!values.userId) {
        message.error('Vui lòng chọn tài khoản');
        return;
      }
      await userAccountService.changePassword(values.userId, values.newPassword);
      message.success('Đã đổi mật khẩu thành công');
      cpForm.resetFields();
    } catch {
      // handled
    }
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<UserAccount> = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Role',
      dataIndex: 'roleCode',
      key: 'roleCode',
      render: (code: string | null) =>
        code
          ? <Tag color="green">{code}</Tag>
          : <Text type="secondary">Chưa gán</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'ACTIVE' ? 'success' : 'error'}>{s}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_: unknown, record: UserAccount) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setCpUserId(record.id);
              cpForm.setFieldValue('userId', record.id);
            }}
            title="Đổi mật khẩu"
          />
          <Popconfirm
            title={`Xoá tài khoản "${record.username}"?`}
            onConfirm={() => handleDelete(record)}
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const roleOptions = roles.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }));

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>👤 Tài khoản người dùng</Title>
      <Row gutter={16} align="top">
        {/* Left: Form */}
        <Col span={8}>
          <Card
            title={editingUser ? `Sửa: ${editingUser.username}` : 'Tạo tài khoản mới'}
            size="small"
          >
            <Form form={form} layout="vertical" size="middle">
              <Form.Item
                name="username"
                label="Tên đăng nhập *"
                rules={[{ required: true, message: 'Bắt buộc' }]}
              >
                <Input placeholder="VD: admin, kitchen1" disabled={!!editingUser} />
              </Form.Item>

              <Form.Item name="fullName" label="Họ và tên">
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>

              <Form.Item name="roleId" label="Vai trò">
                <Select
                  placeholder="— Chọn role —"
                  options={roleOptions}
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={editingUser ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu *'}
                rules={editingUser ? [] : [{ required: true, message: 'Bắt buộc khi tạo mới' }]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>

              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                >
                  {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </Button>
                {editingUser && (
                  <Button icon={<CloseOutlined />} onClick={handleResetForm}>
                    Huỷ
                  </Button>
                )}
                {!editingUser && (
                  <Button icon={<CloseOutlined />} onClick={() => form.resetFields()}>
                    Xoá trắng
                  </Button>
                )}
              </Space>
            </Form>

            <Divider />

            {/* Đổi mật khẩu */}
            <Title level={5} style={{ marginBottom: 12 }}>🔑 Đổi mật khẩu</Title>
            <Form form={cpForm} layout="vertical" size="middle">
              <Form.Item
                name="userId"
                label="Tài khoản"
                rules={[{ required: true, message: 'Chọn tài khoản' }]}
              >
                <Select
                  placeholder="— Chọn tài khoản —"
                  options={users.map((u) => ({
                    label: `${u.fullName || u.username} (${u.username})`,
                    value: u.id,
                  }))}
                  value={cpUserId || undefined}
                  onChange={setCpUserId}
                />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="Mật khẩu mới *"
                rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>
              <Button
                icon={<KeyOutlined />}
                style={{ background: '#d97706', borderColor: '#d97706', color: '#fff' }}
                onClick={handleChangePassword}
              >
                Đổi mật khẩu
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Right: Table */}
        <Col span={16}>
          <Card
            title="Danh sách tài khoản"
            size="small"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleResetForm}
              >
                Tạo mới
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={users}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UsersPage;
