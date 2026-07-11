import React, { useState } from 'react';
import {
  Form, Input, Button, Card, Typography, Divider,
  Select, Alert, Space, Tag, Tooltip,
} from 'antd';
import {
  UserOutlined, LockOutlined, LoginOutlined,
  BugOutlined, InfoCircleOutlined,
  CrownOutlined, HomeOutlined, FireOutlined, ShopOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import type { LoginRequest, User, UserRole, MockRole } from '../../../types';

const { Title, Text, Paragraph } = Typography;

// ─── Dev-mode preset accounts ─────────────────────────────────────────────────

interface DevAccount {
  mockRole: MockRole;
  role: UserRole;
  label: string;
  icon: React.ReactNode;
  username: string;
  password: string;
  color: string;
  description: string;
  permissions: string[];
  warehouseAccess: string;  // Mô tả trang kho được phép vào
}

const DEV_ACCOUNTS: DevAccount[] = [
  {
    mockRole: 'SUPER_ADMIN',
    role: 'ADMIN',
    label: 'Super Admin',
    icon: <CrownOutlined />,
    color: '#722ed1',
    username: 'superadmin',
    password: '123456',
    description: 'Toàn quyền hệ thống, duyệt lệnh, quản lý master data',
    warehouseAccess: 'Kho Tổng • Kho Bếp • Cửa Hàng',
    permissions: ['*'],
  },
  {
    mockRole: 'ADMIN_KHO',
    role: 'ADMIN',
    label: 'Admin Kho',
    icon: <HomeOutlined />,
    color: '#D2691E',
    username: 'adminkho',
    password: '123456',
    description: 'Quản lý nhập/xuất nguyên liệu Kho Tổng từ NCC',
    warehouseAccess: 'Kho Tổng',
    permissions: ['dashboard:view', 'warehouse:view', 'warehouse:import', 'warehouse:export'],
  },
  {
    mockRole: 'ADMIN_BEP',
    role: 'STAFF',
    label: 'Admin Bếp',
    icon: <FireOutlined />,
    color: '#fa8c16',
    username: 'adminbep',
    password: '123456',
    description: 'Quản lý nguyên liệu tại bếp, sản xuất lô bánh',
    warehouseAccess: 'Kho Bếp',
    permissions: ['dashboard:view', 'warehouse:view', 'warehouse:import', 'warehouse:export'],
  },
  {
    mockRole: 'NV_CUA_HANG',
    role: 'STAFF',
    label: 'NV Cửa Hàng',
    icon: <ShopOutlined />,
    color: '#52c41a',
    username: 'nvcuahang',
    password: '123456',
    description: 'Xem tồn kho bánh, yêu cầu thêm bánh khi hết hàng',
    warehouseAccess: 'Cửa Hàng',
    permissions: ['dashboard:view', 'warehouse:view'],
  },
];

// ─── API call (will 404 until backend Auth sprint) ────────────────────────────

async function callLoginApi(data: LoginRequest): Promise<{
  user: User; accessToken: string; refreshToken: string; expiresIn: number;
}> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{
    user: User; accessToken: string; refreshToken: string; expiresIn: number;
  }>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const [form] = Form.useForm<LoginRequest>();
  const [apiError, setApiError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [selectedDev, setSelectedDev] = useState<DevAccount>(DEV_ACCOUNTS[0]);

  // Redirect back to the page user tried to visit, or dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // ── Real API login ─────────────────────────────────────────────────────────

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => callLoginApi(data),
    onSuccess: ({ user, accessToken, refreshToken, expiresIn }) => {
      setAuth(user, accessToken, refreshToken, expiresIn);
      navigate(from, { replace: true });
    },
    onError: (err: Error) => {
      setApiError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    },
  });

  // ── Dev mode login (bypass API) ────────────────────────────────────────────

  const handleDevLogin = () => {
    const fakeUser: User = {
      id: `dev-${selectedDev.mockRole.toLowerCase()}`,
      username: selectedDev.username,
      fullName: `${selectedDev.label} (Dev Mode)`,
      email: `${selectedDev.username}@bakery.dev`,
      role: selectedDev.role,
      permissions: selectedDev.permissions,
      mockRole: selectedDev.mockRole,
    };
    setAuth(fakeUser, 'dev-token-fake', 'dev-refresh-fake', 86400);
    navigate(from, { replace: true });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = (values: LoginRequest) => {
    setApiError(null);
    loginMutation.mutate(values);
  };

  // ── Fill dev credentials ───────────────────────────────────────────────────

  const fillDevCredentials = (account: DevAccount) => {
    setSelectedDev(account);
    form.setFieldsValue({ username: account.username, password: account.password });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 40%, #5c2d00 70%, #1a0a00 100%)',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorative circles */}
      <div style={{
        position: 'absolute', top: '-120px', right: '-80px',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(210,105,30,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', left: '-60px',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244,164,96,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 52, lineHeight: 1, marginBottom: 12,
            filter: 'drop-shadow(0 4px 12px rgba(210,105,30,0.5))',
          }}>
            🥐
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Bakery MS
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
            Hệ Thống Quản Lý Tiệm Bánh
          </Text>
        </div>

        {/* Main card */}
        <Card
          style={{
            borderRadius: 16,
            border: '1px solid rgba(210,105,30,0.25)',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
          styles={{ body: { padding: '32px 36px' } }}
        >
          {/* Dev Mode Banner */}
          {!devMode && (
            <Alert
              type="info"
              showIcon
              icon={<BugOutlined />}
              message={
                <span>
                  API Auth chưa sẵn sàng.{' '}
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => setDevMode(true)}
                  >
                    Dùng Dev Mode →
                  </Button>
                </span>
              }
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
          )}

          {/* ── Dev Mode Panel ──────────────────────────────────────────── */}
          {devMode && (
            <div style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 10,
              background: 'rgba(24,144,255,0.08)',
              border: '1px solid rgba(24,144,255,0.25)',
            }}>
              <Space style={{ marginBottom: 12 }} align="center">
                <BugOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ color: '#1890ff' }}>Dev Mode</Text>
                <Tag color="blue" style={{ margin: 0 }}>Bypass API</Tag>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => setDevMode(false)}
                  style={{ padding: 0, height: 'auto', marginLeft: 'auto' }}
                >
                  Đóng
                </Button>
              </Space>

              {/* Role switcher — 2 columns x 2 rows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {DEV_ACCOUNTS.map((account) => (
                  <button
                    key={account.mockRole}
                    onClick={() => fillDevCredentials(account)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${
                        selectedDev.mockRole === account.mockRole ? account.color : 'rgba(255,255,255,0.1)'
                      }`,
                      background: selectedDev.mockRole === account.mockRole
                        ? `${account.color}20`
                        : 'rgba(255,255,255,0.04)',
                      color: '#fff', textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Tên role */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ color: account.color, fontSize: 14 }}>{account.icon}</span>
                      <span style={{ color: account.color, fontSize: 12, fontWeight: 700 }}>
                        {account.label}
                      </span>
                    </div>
                    {/* Username */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <UserOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} />
                      <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.85)',
                        fontFamily: 'monospace', letterSpacing: 0.3,
                      }}>
                        {account.username}
                      </span>
                    </div>
                    {/* Password */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LockOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} />
                      <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.85)',
                        fontFamily: 'monospace', letterSpacing: 0.3,
                      }}>
                        {account.password}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <Paragraph style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                <InfoCircleOutlined style={{ marginRight: 4 }} />
                {selectedDev.description}
              </Paragraph>

              <Button
                type="primary"
                block
                icon={<LoginOutlined />}
                onClick={handleDevLogin}
                style={{
                  marginTop: 12, borderRadius: 8, height: 40,
                  background: selectedDev.color,
                  borderColor: selectedDev.color,
                  fontWeight: 600,
                }}
              >
                Đăng nhập Dev — {selectedDev.label}
              </Button>
            </div>
          )}

          {/* ── Login Form ─────────────────────────────────────────────── */}
          {!devMode && (
            <>
              <Title level={4} style={{ color: '#fff', margin: '0 0 24px', fontWeight: 700 }}>
                Đăng nhập
              </Title>

              {apiError && (
                <Alert
                  type="error"
                  message={apiError}
                  closable
                  onClose={() => setApiError(null)}
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
              )}

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                    placeholder="Tên đăng nhập"
                    size="large"
                    style={{
                      borderRadius: 10, height: 48,
                      background: 'rgba(255,255,255,0.06)',
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                    placeholder="Mật khẩu"
                    size="large"
                    style={{
                      borderRadius: 10, height: 48,
                      background: 'rgba(255,255,255,0.06)',
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                    }}
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  icon={<LoginOutlined />}
                  loading={loginMutation.isPending}
                  style={{
                    height: 48, borderRadius: 10, fontWeight: 700,
                    background: 'linear-gradient(135deg, #D2691E, #a0522d)',
                    borderColor: 'transparent',
                    boxShadow: '0 4px 20px rgba(210,105,30,0.4)',
                    marginTop: 4,
                  }}
                >
                  Đăng Nhập
                </Button>
              </Form>
            </>
          )}

          {/* Divider */}
          <Divider style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' }}>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>hoặc</Text>
          </Divider>

          <Button
            block
            icon={<BugOutlined />}
            onClick={() => setDevMode(!devMode)}
            style={{
              borderRadius: 10, height: 40,
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {devMode ? 'Dùng Login thật' : 'Dev Mode (Bypass API)'}
          </Button>
        </Card>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            Bakery Management System v2.0 · Internal Use Only
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Login;
