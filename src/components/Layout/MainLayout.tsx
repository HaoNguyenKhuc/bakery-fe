import React, { useMemo, useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Badge, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  UnorderedListOutlined,
  ExperimentOutlined,
  DollarOutlined,
  HomeOutlined,
  ShopOutlined,
  FireOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  OrderedListOutlined,
  ToolOutlined,
  ScheduleOutlined,
  SwapOutlined,
  BarChartOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useAuthStore, useAppStore, selectSidebarCollapsed, selectUnreadCount } from '../../store';
import { useWarehouseStore } from '../../store';
import type { MockRole } from '../../types';

const { Sider, Header, Content } = Layout;

// --- Route & Menu Configuration ---

interface BreadcrumbMap {
  [key: string]: string;
}

const breadcrumbNameMap: BreadcrumbMap = {
  '/': 'Tổng Quan',
  '/products': 'Danh Sách Sản Phẩm',
  '/products/create': 'Tạo Sản Phẩm',
  '/suppliers': 'Nhà Cung Cấp',
  '/product-mapping': 'Product Mapping',
  '/item-groups': 'Item Groups',
  '/sx-config': 'Cấu Hình Sản Xuất',
  '/prod-groups': 'Production Groups',
  '/threshold-rules': 'Threshold Rules',
  '/prod-plans': 'Kế Hoạch Ngày',
  '/prod-requests': 'Phiếu Sản Xuất',
  '/delivery': 'Giao Nhận Bếp → Shop',
  '/prod-adjustments': 'Điều Chỉnh Sản Xuất',
  '/stock-summary': 'Tồn Kho',
  '/inventory-requests': 'Phiếu Kho',
  '/reports/daily': 'Báo Cáo Ngày',
  '/reports/huy-banh': 'Hủy Bánh',
  '/reports/pos-sales': 'POS Sales',
};

type MenuItem = Required<MenuProps>['items'][number];

// --- Menu items strictly matching dev-ui.html ---

const DEV_UI_MENU_ITEMS: MenuItem[] = [
  {
    type: 'group',
    label: 'Master Data',
    children: [
      { key: '/products', label: '📋 Sản phẩm' },
      { key: '/products/create', label: '➕ Tạo sản phẩm' },
      { key: '/suppliers', label: '🏭 Nhà cung cấp' },
      { key: '/product-mapping', label: '🔗 Product Mapping' },
      { key: '/item-groups', label: '🏠 Item Groups' },
    ],
  },
  {
    type: 'group',
    label: 'Kế hoạch SX',
    children: [
      { key: '/sx-config', label: '📋 Cấu hình SX' },
      { key: '/prod-groups', label: '🔧 Prod Groups' },
      { key: '/threshold-rules', label: '📏 Threshold Rules' },
      { key: '/prod-plans', label: '📅 Kế hoạch ngày' },
    ],
  },
  {
    type: 'group',
    label: 'Sản xuất',
    children: [
      { key: '/prod-requests', label: '📝 Phiếu SX' },
      { key: '/delivery', label: '🚚 Giao nhận' },
      { key: '/prod-adjustments', label: '⚠️ Điều chỉnh SX' },
    ],
  },
  {
    type: 'group',
    label: 'Kho',
    children: [
      { key: '/stock-summary', label: '📦 Tồn kho' },
      { key: '/inventory-requests', label: '📋 Phiếu kho' },
    ],
  },
  {
    type: 'group',
    label: 'Báo cáo',
    children: [
      { key: '/reports/daily', label: '📊 Báo cáo ngày' },
      { key: '/reports/huy-banh', label: '🗑 Hủy bánh' },
      { key: '/reports/pos-sales', label: '🏪 POS Sales' },
    ],
  },
];


// --- Role label mapping ---

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản Trị Viên',
  STAFF: 'Nhân Viên',
  // Mock roles
  SUPER_ADMIN: '👑 Super Admin',
  ADMIN_KHO: '🏠 Admin Kho',
  ADMIN_BEP: '🔥 Admin Bếp',
  NV_CUA_HANG: '🛍️ NV Cửa Hàng',
};

// --- Main Layout Component ---

const MainLayout: React.FC = () => {
  // Use global stores instead of local state
  const collapsed = useAppStore(selectSidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadCount = useAppStore(selectUnreadCount);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Fetch all warehouses once when layout mounts (user is authenticated)
  const fetchWarehouses = useWarehouseStore((s) => s.fetchWarehouses);
  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const navigate = useNavigate();
  const location = useLocation();

  // Determine selected key and open submenu keys from current path
  const selectedKeys = useMemo(() => {
    const { pathname } = location;
    return [pathname];
  }, [location]);

  const getOpenKeyFromPath = (pathname: string): string[] => {
    if (pathname.startsWith('/products')) return ['products'];
    if (pathname.startsWith('/production')) return ['production'];
    if (pathname.startsWith('/warehouse')) return ['warehouse'];
    if (pathname.startsWith('/reports')) return ['reports'];
    if (pathname.startsWith('/settings')) return ['settings'];
    return [];
  };

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getOpenKeyFromPath(location.pathname)
  );

  useEffect(() => {
    const keys = getOpenKeyFromPath(location.pathname);
    if (keys.length > 0) {
      setOpenKeys((prev) => Array.from(new Set([...prev, ...keys])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Build breadcrumb items from path
  const breadcrumbItems = useMemo(() => {
    const { pathname } = location;
    const segments = pathname.split('/').filter(Boolean);

    const items = [
      {
        title: (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            🍞 Trang Chủ
          </span>
        ),
      },
    ];

    if (pathname !== '/') {
      let currentPath = '';
      segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        const name = breadcrumbNameMap[currentPath] || segment;
        const isLast = index === segments.length - 1;

        items.push({
          title: isLast ? (
            <span>{name}</span>
          ) : (
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(currentPath)}
            >
              {name}
            </span>
          ),
        });
      });
    }

    return items;
  }, [location, navigate]);

  // Handle menu click
  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  // Handle user dropdown click
  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key === 'profile') {
      // TODO: Navigate to profile page
    }
  };

  // User dropdown items
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <ProfileOutlined />,
      label: 'Thông Tin Cá Nhân',
    },
    {
      key: 'account-settings',
      icon: <SettingOutlined />,
      label: 'Cài Đặt Tài Khoản',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng Xuất',
      danger: true,
    },
  ];

  // Derive display name and role from store
  const displayName = user?.fullName || user?.username || 'Admin';
  // Ƭu tiên hiển thị mockRole (nếu có) rồi mới đến role thật
  const displayRole = user?.mockRole
    ? (ROLE_LABELS[user.mockRole] || user.mockRole)
    : (user?.role ? (ROLE_LABELS[user.role] || user.role) : 'Quản trị viên');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* --- Sidebar --- */}
      <Sider
        className="sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={toggleSidebar}
        width={260}
        collapsedWidth={80}
        trigger={null}
        breakpoint="lg"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        {/* Logo */}
        <div
          className={`sidebar-logo ${collapsed ? 'collapsed' : ''}`}
          onClick={() => navigate('/products')}
        >
          <span className="sidebar-logo-icon">🥐</span>
          {!collapsed && <span className="sidebar-logo-text">Bakery Dev</span>}
        </div>

        {/* Navigation Menu */}
        <Menu
          className="sidebar-menu"
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={DEV_UI_MENU_ITEMS}
          onClick={onMenuClick}
        />

        {/* Sidebar Footer */}
        {!collapsed && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              © 2026 BakeryMS v1.0
            </span>
          </div>
        )}
      </Sider>

      {/* --- Main Content Area --- */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : 260,
          transition: 'margin-left 0.2s ease',
        }}
      >
        {/* Header */}
        <Header className="app-header">
          <div className="header-left">
            {/* Collapse Toggle */}
            <button
              className="header-action-btn"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>

            {/* Breadcrumb */}
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="header-right">
            {/* Notifications */}
            <Tooltip title="Thông báo">
              <Badge count={unreadCount} size="small">
                <button className="header-action-btn">
                  <BellOutlined />
                </button>
              </Badge>
            </Tooltip>

            {/* User Menu */}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: onUserMenuClick,
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="header-user">
                <Avatar
                  size={36}
                  src={user?.avatar}
                  icon={!user?.avatar ? <UserOutlined /> : undefined}
                  style={{
                    backgroundColor: '#D2691E',
                    cursor: 'pointer',
                  }}
                />
                <div className="header-user-info">
                  <span className="header-user-name">{displayName}</span>
                  <span className="header-user-role">{displayRole}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Page Content */}
        <Content className="app-content">
          <div className="page-wrapper">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
