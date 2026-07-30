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
import { roleService } from '../../api/services/roleService';
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
  '/units': 'Đơn Vị Tính',
  '/sx-config': 'Cấu Hình Sản Xuất',
  '/prod-groups': 'Production Groups',
  '/threshold-rules': 'Threshold Rules',
  '/prod-plans': 'Kế Hoạch Ngày',
  '/prod-requests': 'Phiếu Sản Xuất',
  '/delivery': 'Giao Nhận Bếp → Shop',
  '/prod-adjustments': 'Điều Chỉnh Sản Xuất',
  '/stock-summary': 'Tồn Kho',
  '/inventory-requests': 'Phiếu Kho',
  '/reports': 'Báo Cáo',
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
      { key: '/suppliers',       label: '🏭 Nhà cung cấp',  screenCode: 'SUPPLIERS' },
      { key: '/product-mapping', label: '🔗 Product Mapping', screenCode: 'PRODUCT_MAPPING' },
      { key: '/item-groups',     label: '🏠 Item Groups',   screenCode: 'ITEM_GROUPS' },
      { key: '/units',           label: '📐 Đơn vị tính',  screenCode: 'UNITS' },
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
      { key: '/warehouse/kho-chinh', label: '🏠 Kho Chính', screenCode: 'STOCK_SUMMARY' },
      { key: '/warehouse/kho-bep',   label: '🔥 Kho Bếp',    screenCode: 'STOCK_SUMMARY' },
      { key: '/warehouse/cua-hang',  label: '🛍️ Cửa Hàng',   screenCode: 'STOCK_SUMMARY' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { key: '/reports', label: '📊 Báo cáo', screenCode: 'DAILY_REPORT' },
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
  const roleId = useAuthStore((s) => s.roleId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPermissionMap = useAuthStore((s) => s.setPermissionMap);

  // Re-fetch permission map if needed (e.g. after page refresh)
  useEffect(() => {
    if (isAuthenticated && roleId && roleCode && roleCode.toUpperCase() !== 'SUPER_ADMIN' && permissionMap === null) {
      roleService.getPermissions(roleId).then(setPermissionMap).catch(() => {});
    }
  }, [isAuthenticated, roleId, roleCode, permissionMap, setPermissionMap]);

  // Fetch all warehouses once when layout mounts (user is authenticated)
  const fetchWarehouses = useWarehouseStore((s) => s.fetchWarehouses);
  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const navigate = useNavigate();
  const location = useLocation();

  // Track expanded tree nodes in sidebar (all expanded by default)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    NAV_GROUPS.map((g) => g.label)
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((g) => g !== label)
        : [...prev, label]
    );
  };

  // Auto-expand group when active route changes
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) =>
      group.items.some((item) => {
        const itemPath = item.key.split('?')[0];
        return location.pathname.startsWith(itemPath) && (itemPath !== '/' || location.pathname === '/');
      })
    );
    if (activeGroup && !expandedGroups.includes(activeGroup.label)) {
      setExpandedGroups((prev) => [...prev, activeGroup.label]);
    }
  }, [location.pathname, expandedGroups]);

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

  // Build filtered nav groups based on permission map
  const filteredNavGroups = useMemo(() => {
    const isSuper = isSuperAdminFn();
    return NAV_GROUPS.map((group) => {
      const visibleItems = group.items.filter((item) => {
        if (item.screenCode === null) return isSuper;
        return canViewScreen(item.screenCode);
      });
      return { ...group, items: visibleItems };
    }).filter((group) => group.items.length > 0);
  }, [permissionMap, roleCode, canViewScreen, isSuperAdminFn]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* --- Sidebar --- */}
      <Sider
        className="sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={toggleSidebar}
        width={240}
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
          {!collapsed && <span className="sidebar-logo-text">Hệ Thống Quản Lý</span>}
        </div>

        {/* Custom Navigation Tree Menu matching dev-ui.html */}
        <nav className="sidebar-nav">
          {filteredNavGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.label);
            const showChildren = collapsed || isExpanded;
            return (
              <div key={group.label} className="sidebar-nav-group">
                <div
                  className="sidebar-nav-label tree-header"
                  onClick={() => !collapsed && toggleGroup(group.label)}
                  style={{
                    cursor: collapsed ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  title={collapsed ? group.label : `Nhấp để ${isExpanded ? 'thu gọn' : 'mở rộng'}`}
                >
                  <span className="tree-label-text">{group.label}</span>
                  {!collapsed && (
                    <span
                      className="tree-toggle-icon"
                      style={{
                        fontSize: 9,
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        opacity: 0.7,
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
                {showChildren && (
                  <div className="sidebar-nav-children">
                    {group.items.map((item) => {
                      const itemPath = item.key.split('?')[0];
                      const itemQuery = item.key.includes('?') ? item.key.split('?')[1] : null;
                      const isPathMatch = location.pathname.startsWith(itemPath) && (itemPath !== '/' || location.pathname === '/');
                      const isQueryMatch = !itemQuery || location.search.includes(itemQuery) || (!location.search && itemQuery === 'tab=kho-chinh');
                      const isActive = isPathMatch && isQueryMatch;
                      return (
                        <div
                          key={item.key}
                          className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => navigate(item.key)}
                          title={collapsed ? item.label : undefined}
                        >
                          <span className="sidebar-nav-item-text">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

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
