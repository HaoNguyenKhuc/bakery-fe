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
  '/products/create': 'Thêm Hàng Hoá Mới',
  '/products/edit': 'Chỉnh Sửa Hàng Hoá',
  '/products/recipes': 'Công Thức',
  '/products/cost-price': 'Giá Cost',
  '/production/plans': 'Kế Hoạch Sản Xuất',
  '/warehouse': 'Kho',
  '/warehouse/main': 'Kho Tổng',
  '/warehouse/kitchen': 'Kho Bếp',
  '/warehouse/store': 'Cửa Hàng',
  '/warehouse/bakery': 'Kho Bánh (Legacy)',
  '/warehouse/goods-transfer': 'Luân Chuyển Kho',
  '/warehouse/inventory-adjustment': 'Phiếu Thất Thoát',
  '/warehouse/product-orders': 'Quản Lý Đơn Hàng',
  '/settings': 'Cài Đặt',
  '/settings/user-roles': 'User Roles',
  '/settings/user-profiles': 'User Profiles',
};

type MenuItem = Required<MenuProps>['items'][number];

// --- Warehouse sub-items (filtered by mockRole) ---

/** Tất cả các trang kho — SUPER_ADMIN thấy hết */
const ALL_WAREHOUSE_ITEMS: MenuItem[] = [
  {
    key: '/warehouse/main',
    icon: <HomeOutlined />,
    label: 'Kho Tổng',
  },
  {
    key: '/warehouse/kitchen',
    icon: <FireOutlined />,
    label: 'Kho Bếp',
  },
  {
    key: '/warehouse/store',
    icon: <ShopOutlined />,
    label: 'Cửa Hàng',
  },
];

/** Map: mockRole → danh sách key được phép */
const WAREHOUSE_ROLE_ACCESS: Record<MockRole, string[]> = {
  SUPER_ADMIN: ['/warehouse/main', '/warehouse/kitchen', '/warehouse/store'],
  ADMIN_KHO: ['/warehouse/main'],
  ADMIN_BEP: ['/warehouse/kitchen'],
  NV_CUA_HANG: ['/warehouse/store'],
};

/** Lọc danh sách trang kho theo mockRole */
function getWarehouseItems(mockRole?: MockRole): MenuItem[] {
  if (!mockRole) return ALL_WAREHOUSE_ITEMS; // fallback: hiện tất cả
  const allowed = WAREHOUSE_ROLE_ACCESS[mockRole];
  return ALL_WAREHOUSE_ITEMS.filter((item) => allowed.includes(item!.key as string));
}

// --- Static menu items (không phụ thuộc role) ---

const STATIC_MENU_ITEMS_BEFORE: MenuItem[] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Tổng Quan',
  },
  {
    key: 'products',
    icon: <ShoppingOutlined />,
    label: 'Sản Phẩm',
    children: [
      {
        key: '/products',
        icon: <UnorderedListOutlined />,
        label: 'Danh Sách Sản Phẩm',
      },
      {
        key: '/products/groups',
        icon: <UnorderedListOutlined />,
        label: 'Item Groups',
      },
      {
        key: '/products/recipes',
        icon: <ExperimentOutlined />,
        label: 'Công Thức',
      },
      {
        key: '/products/cost-price',
        icon: <DollarOutlined />,
        label: 'Giá Cost',
      },
    ],
  },
  {
    key: '/production/plans',
    icon: <ToolOutlined />,
    label: 'Kế Hoạch Sản Xuất',
  },
];

const STATIC_MENU_ITEMS_AFTER: MenuItem[] = [
  {
    key: '/warehouse/product-orders',
    icon: <OrderedListOutlined />,
    label: 'Quản Lý Đơn Hàng',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Cài Đặt',
    children: [
      {
        key: '/settings/user-roles',
        icon: <TeamOutlined />,
        label: 'User Roles',
      },
      {
        key: '/settings/user-profiles',
        icon: <UserSwitchOutlined />,
        label: 'User Profiles',
      },
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
    if (pathname.startsWith('/warehouse')) return ['warehouse'];
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

  // Build menu items căn cứ theo mockRole của user
  const dynamicMenuItems: MenuItem[] = useMemo(() => {
    const warehouseChildren = getWarehouseItems(user?.mockRole);
    const warehouseMenu: MenuItem = {
      key: 'warehouse',
      icon: <DatabaseOutlined />,
      label: 'Kho',
      children: warehouseChildren,
    };
    return [
      ...STATIC_MENU_ITEMS_BEFORE,
      warehouseMenu,
      ...STATIC_MENU_ITEMS_AFTER,
    ];
  }, [user?.mockRole]);

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
          onClick={() => navigate('/')}
        >
          <span className="sidebar-logo-icon">🍞</span>
          {!collapsed && <span className="sidebar-logo-text">BakeryMS</span>}
        </div>

        {/* Navigation Menu */}
        <Menu
          className="sidebar-menu"
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={dynamicMenuItems}
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
