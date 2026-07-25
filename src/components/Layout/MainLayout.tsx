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
import { authService } from '../../api/services/authService';
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
  '/users': 'Tài Khoản Người Dùng',
  '/roles': 'Phân Quyền (Roles)',
  '/activity-log': 'Nhật Ký Hoạt Động',
};

type MenuItem = Required<MenuProps>['items'][number];

// --- Menu items strictly matching dev-ui.html ---

// --- Nav config with screenCode for permission filtering ---

interface NavItem {
  key: string;           // route path
  label: string;
  screenCode: string | null; // null = chỉ SUPER_ADMIN mới thấy
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Master Data',
    items: [
      { key: '/products',        label: '📋 Sản phẩm',      screenCode: 'ITEMS' },
      { key: '/products/create', label: '➕ Tạo sản phẩm',  screenCode: 'ITEMS' },
      { key: '/suppliers',       label: '🏭 Nhà cung cấp',  screenCode: 'SUPPLIERS' },
      { key: '/product-mapping', label: '🔗 Product Mapping', screenCode: 'PRODUCT_MAPPING' },
      { key: '/item-groups',     label: '🏠 Item Groups',   screenCode: 'ITEM_GROUPS' },
    ],
  },
  {
    label: 'Kế hoạch SX',
    items: [
      { key: '/sx-config',        label: '📋 Cấu hình SX',    screenCode: 'SX_CONFIG' },
      { key: '/prod-groups',      label: '🔧 Prod Groups',     screenCode: 'PROD_GROUPS' },
      { key: '/threshold-rules',  label: '📏 Threshold Rules', screenCode: 'THRESHOLD_RULES' },
      { key: '/prod-plans',       label: '📅 Kế hoạch ngày',  screenCode: 'PROD_PLANS' },
    ],
  },
  {
    label: 'Sản xuất',
    items: [
      { key: '/prod-requests',   label: '📝 Phiếu SX',       screenCode: 'PROD_REQUESTS' },
      { key: '/delivery',        label: '🚚 Giao nhận',       screenCode: 'DELIVERY_RECORDS' },
      { key: '/prod-adjustments', label: '⚠️ Điều chỉnh SX', screenCode: 'PROD_ADJUSTMENTS' },
    ],
  },
  {
    label: 'Kho',
    items: [
      { key: '/stock-summary',      label: '📦 Tồn kho',  screenCode: 'STOCK_SUMMARY' },
      { key: '/inventory-requests', label: '📋 Phiếu kho', screenCode: 'INVENTORY_REQUESTS' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { key: '/reports/daily',     label: '📊 Báo cáo ngày', screenCode: 'DAILY_REPORT' },
      { key: '/reports/huy-banh',  label: '🗑 Hủy bánh',    screenCode: 'HUY_BANH' },
      { key: '/reports/pos-sales', label: '🏪 POS Sales',   screenCode: 'POS_SALES' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { key: '/users',        label: '👤 Tài khoản',          screenCode: 'USERS' },
      { key: '/roles',        label: '🔐 Phân quyền',         screenCode: 'ROLES' },
      { key: '/activity-log', label: '📜 Nhật ký hoạt động', screenCode: null }, // chỉ SUPER_ADMIN
    ],
  },
];

/** Build Ant Design menu items, filtering by permission map */
function buildFilteredMenuItems(
  groups: NavGroup[],
  canViewScreen: (code: string) => boolean,
  isSuperAdmin: boolean,
): MenuItem[] {
  const result: MenuItem[] = [];
  for (const group of groups) {
    const visibleItems = group.items.filter((item) => {
      if (item.screenCode === null) return isSuperAdmin;
      return canViewScreen(item.screenCode);
    });
    if (visibleItems.length === 0) continue;
    result.push({
      type: 'group',
      label: group.label,
      children: visibleItems.map((item) => ({
        key: item.key,
        label: item.label,
      })),
    });
  }
  return result;
}


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
  const canViewScreen = useAuthStore((s) => s.canViewScreen);
  const isSuperAdminFn = useAuthStore((s) => s.isSuperAdmin);
  const permissionMap = useAuthStore((s) => s.permissionMap);
  const roleCode = useAuthStore((s) => s.roleCode);

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
  const onUserMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'logout') {
      await authService.logout(); // fire-and-forget, không block UI
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
  const displayRole = roleCode
    ? (ROLE_LABELS[roleCode] || roleCode)
    : (user?.mockRole
      ? (ROLE_LABELS[user.mockRole] || user.mockRole)
      : (user?.role ? (ROLE_LABELS[user.role] || user.role) : 'Quản trị viên'));

  // Build filtered menu items based on permission map
  const filteredMenuItems = useMemo(
    () => buildFilteredMenuItems(NAV_GROUPS, canViewScreen, isSuperAdminFn()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionMap, roleCode],
  );

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
          items={filteredMenuItems}
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
