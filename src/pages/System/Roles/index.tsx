import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Form, Input, Space, Popconfirm, message,
  Card, Typography, Row, Col, Checkbox, Tag, Tooltip,
} from 'antd';
import {
  SaveOutlined, CloseOutlined, DeleteOutlined,
  EditOutlined, KeyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { roleService } from '../../../api/services/roleService';
import type { Role, Screen, PermissionMap, ActionCode, CreateRoleRequest, SavePermissionsRequest } from '../../../types';

const { Title, Text } = Typography;

const ACTION_ORDER: ActionCode[] = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'FINALIZE', 'HISTORY'];
const ACTION_LABELS: Record<ActionCode, string> = {
  VIEW: 'VIEW', CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE',
  APPROVE: 'APPROVE', REJECT: 'REJECT', FINALIZE: 'FINALIZE', HISTORY: 'HISTORY',
};

// ─── Permission Matrix ────────────────────────────────────────────────────────

interface MatrixState {
  [screenCode: string]: Record<ActionCode, boolean>;
}

function buildMatrixFromMap(screens: Screen[], permsMap: PermissionMap): MatrixState {
  const state: MatrixState = {};
  for (const sc of screens) {
    state[sc.code] = {} as Record<ActionCode, boolean>;
    for (const a of ACTION_ORDER) {
      state[sc.code][a] = permsMap !== null && (permsMap[sc.code]?.includes(a) ?? false);
    }
  }
  return state;
}

function matrixToRequest(state: MatrixState): SavePermissionsRequest {
  const permissions: SavePermissionsRequest['permissions'] = [];
  for (const [screenCode, actions] of Object.entries(state)) {
    for (const [action, checked] of Object.entries(actions)) {
      if (checked) {
        permissions.push({ screenCode, actionCode: action as ActionCode });
      }
    }
  }
  return { permissions };
}

// ─── Roles Page ───────────────────────────────────────────────────────────────

const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Permission matrix state
  const [matrixRole, setMatrixRole] = useState<Role | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [matrix, setMatrix] = useState<MatrixState>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const matrixRef = useRef<HTMLDivElement>(null);

  const [form] = Form.useForm();

  // ── Load roles ─────────────────────────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roleService.getAll();
      setRoles(data?.content ?? (data as unknown as Role[]) ?? []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  // ── Form actions ───────────────────────────────────────────────────────────

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({ code: role.code, name: role.name, description: role.description ?? '' });
  };

  const handleResetForm = () => {
    setEditingRole(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values: CreateRoleRequest = await form.validateFields();
      if (editingRole) {
        await roleService.update(editingRole.id, values);
        message.success('Đã cập nhật role');
      } else {
        await roleService.create(values);
        message.success('Đã tạo role mới');
      }
      handleResetForm();
      loadRoles();
    } catch {
      // handled
    }
  };

  const handleDelete = async (role: Role) => {
    try {
      await roleService.remove(role.id);
      message.success(`Đã xoá role "${role.name}"`);
      if (matrixRole?.id === role.id) setMatrixRole(null);
      loadRoles();
    } catch {
      // handled
    }
  };

  // ── Permission matrix ──────────────────────────────────────────────────────

  const showPermissionMatrix = async (role: Role) => {
    setMatrixRole(role);
    setMatrixLoading(true);
    try {
      const [screenList, permsMap] = await Promise.all([
        roleService.getScreens(),
        roleService.getPermissions(role.id),
      ]);
      const sorted = [...screenList].sort((a, b) => a.sortOrder - b.sortOrder);
      setScreens(sorted);
      setMatrix(buildMatrixFromMap(sorted, permsMap));
      // Scroll to matrix
      setTimeout(() => matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      // handled
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleCheckChange = (screenCode: string, action: ActionCode, checked: boolean) => {
    setMatrix((prev) => ({
      ...prev,
      [screenCode]: { ...prev[screenCode], [action]: checked },
    }));
  };

  const handleToggleRow = (screenCode: string, avail: ActionCode[]) => {
    const current = matrix[screenCode] ?? {};
    const allChecked = avail.every((a) => current[a]);
    setMatrix((prev) => {
      const updated = { ...prev[screenCode] };
      for (const a of avail) updated[a] = !allChecked;
      return { ...prev, [screenCode]: updated };
    });
  };

  const handleSavePermissions = async () => {
    if (!matrixRole) return;
    setSaving(true);
    try {
      const body = matrixToRequest(matrix);
      await roleService.savePermissions(matrixRole.id, body);
      message.success('Đã lưu phân quyền ✓');
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<Role> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => (
        <Tag style={{ fontFamily: 'monospace', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
          {v}
        </Tag>
      ),
    },
    { title: 'Tên', dataIndex: 'name', key: 'name' },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_: unknown, record: Role) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Tooltip title="Phân quyền">
            <Button
              size="small"
              icon={<KeyOutlined />}
              type={matrixRole?.id === record.id ? 'primary' : 'default'}
              onClick={() => showPermissionMatrix(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`Xoá role "${record.name}"?`}
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

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>🔐 Phân quyền (User Roles)</Title>

      <Row gutter={16} align="top">
        {/* Left: Form */}
        <Col span={8}>
          <Card title={editingRole ? `Sửa: ${editingRole.name}` : 'Tạo / Sửa Role'} size="small">
            <Form form={form} layout="vertical" size="middle">
              <Form.Item
                name="code"
                label="Mã *"
                rules={[{ required: true, message: 'Bắt buộc' }]}
              >
                <Input placeholder="VD: ADMIN, KITCHEN, SHOP" disabled={!!editingRole} />
              </Form.Item>
              <Form.Item
                name="name"
                label="Tên *"
                rules={[{ required: true, message: 'Bắt buộc' }]}
              >
                <Input placeholder="VD: Quản trị viên" />
              </Form.Item>
              <Form.Item name="description" label="Mô tả">
                <Input placeholder="Mô tả ngắn về role này" />
              </Form.Item>
              <Space>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                  {editingRole ? 'Lưu' : 'Tạo role'}
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleResetForm}>Huỷ</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        {/* Right: Table */}
        <Col span={16}>
          <Card title="Danh sách Role" size="small">
            <Table
              columns={columns}
              dataSource={roles}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* Permission Matrix */}
      {matrixRole && (
        <div ref={matrixRef} style={{ marginTop: 20 }}>
          <Card
            title={`🔑 Ma trận phân quyền: ${matrixRole.name} (${matrixRole.code})`}
            size="small"
            extra={
              <Space>
                <Button onClick={() => setMatrixRole(null)}>Đóng</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSavePermissions}
                >
                  Lưu quyền
                </Button>
              </Space>
            }
            loading={matrixLoading}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{
                      textAlign: 'left', padding: '8px 12px',
                      background: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 180,
                    }}>
                      Màn hình
                    </th>
                    {ACTION_ORDER.map((a) => (
                      <th key={a} style={{
                        textAlign: 'center', padding: '8px 10px',
                        background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
                        color: '#475569', fontSize: 11, whiteSpace: 'nowrap',
                      }}>
                        {ACTION_LABELS[a]}
                      </th>
                    ))}
                    <th style={{
                      textAlign: 'center', padding: '8px 10px',
                      background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
                      color: '#94a3b8', fontSize: 11,
                    }}>
                      Tất cả
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {screens.map((sc, i) => {
                    const avail = sc.availableActions;
                    return (
                      <tr key={sc.code} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ fontWeight: 500 }}>{sc.name}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>{sc.code}</div>
                        </td>
                        {ACTION_ORDER.map((a) => (
                          <td key={a} style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                            {avail.includes(a) ? (
                              <Checkbox
                                checked={matrix[sc.code]?.[a] ?? false}
                                onChange={(e) => handleCheckChange(sc.code, a, e.target.checked)}
                                style={{ accentColor: '#6366f1' } as React.CSSProperties}
                              />
                            ) : (
                              <span style={{ color: '#e2e8f0' }}>—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                          <Button
                            size="small"
                            onClick={() => handleToggleRow(sc.code, avail)}
                            style={{ fontSize: 11, padding: '1px 6px' }}
                          >
                            ±
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              💡 Tip: SUPER_ADMIN bỏ qua toàn bộ phân quyền (không cần cấu hình).
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
