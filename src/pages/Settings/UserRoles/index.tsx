import React, { useState, useMemo } from 'react';
import {
  Button,
  Table,
  Tag,
  Space,
  Card,
  Typography,
  Row,
  Col,
  Tabs,
  Input,
  Badge,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';

const { Title, Text } = Typography;

// --- Types ---

type RoleStatus = 'Active' | 'Pending' | 'Rejected';

interface UserRole {
  key: string;
  roleCode: string;
  roleName: string;
  description: string;
  status: RoleStatus;
}

// --- Dummy Data ---

const dummyRoles: UserRole[] = [
  {
    key: '1',
    roleCode: 'J6FAY3',
    roleName: 'Supper Admin',
    description: 'Supper Admin',
    status: 'Active',
  },
  {
    key: '2',
    roleCode: 'YDQ8HE',
    roleName: 'Test Role',
    description: '',
    status: 'Active',
  },
  {
    key: '3',
    roleCode: 'NY18WQ',
    roleName: 'Súp bờ Sayan',
    description: '',
    status: 'Active',
  },
  {
    key: '4',
    roleCode: 'AB12CD',
    roleName: 'Quản Lý',
    description: 'Quản lý cửa hàng',
    status: 'Pending',
  },
  {
    key: '5',
    roleCode: 'EF34GH',
    roleName: 'Nhân Viên Bếp',
    description: 'Nhân viên sản xuất bánh',
    status: 'Active',
  },
  {
    key: '6',
    roleCode: 'IJ56KL',
    roleName: 'Kế Toán',
    description: 'Nhân viên kế toán',
    status: 'Active',
  },
];

// --- Status tag config ---

const statusConfig: Record<RoleStatus, { color: string }> = {
  Active: { color: 'green' },
  Pending: { color: 'orange' },
  Rejected: { color: 'red' },
};

// --- Component ---

const UserRolesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Active');
  const [searchText, setSearchText] = useState('');

  // Filter data based on tab and search
  const filteredData = useMemo(() => {
    let data = dummyRoles;

    // Filter by status tab
    if (activeTab !== 'All') {
      data = data.filter((r) => r.status === activeTab);
    }

    // Filter by search text
    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      data = data.filter(
        (r) =>
          r.roleCode.toLowerCase().includes(keyword) ||
          r.roleName.toLowerCase().includes(keyword) ||
          r.description.toLowerCase().includes(keyword)
      );
    }

    return data;
  }, [activeTab, searchText]);

  // Count per tab
  const counts = useMemo(() => {
    return {
      Active: dummyRoles.filter((r) => r.status === 'Active').length,
      Pending: dummyRoles.filter((r) => r.status === 'Pending').length,
      Rejected: dummyRoles.filter((r) => r.status === 'Rejected').length,
    };
  }, []);

  // Row action menu
  const getRowActions = (_record: UserRole): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'Xem chi tiết',
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Chỉnh sửa',
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Xóa',
      danger: true,
    },
  ];

  // Table columns
  const columns: ColumnsType<UserRole> = [
    {
      title: 'Role Code',
      dataIndex: 'roleCode',
      key: 'roleCode',
      width: 180,
      render: (text: string) => <Text style={{ fontFamily: 'monospace' }}>{text}</Text>,
    },
    {
      title: 'Role Name',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 220,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => <Text type="secondary">{text || '—'}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: RoleStatus) => (
        <Tag color={statusConfig[status]?.color || 'default'}>{status}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      align: 'center',
      render: (_: unknown, record: UserRole) => (
        <Dropdown
          menu={{
            items: getRowActions(record),
            onClick: ({ key }) => {
              console.log(`Action: ${key} on role: ${record.roleName}`);
            },
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: 'Active',
      label: 'Active',
    },
    {
      key: 'Pending',
      label: (
        <Space>
          Pending
          {counts.Pending > 0 && (
            <Badge
              count={counts.Pending}
              style={{ backgroundColor: '#fa8c16' }}
              size="small"
            />
          )}
        </Space>
      ),
    },
    {
      key: 'Rejected',
      label: 'Rejected',
    },
  ];

  return (
    <div>
      {/* Breadcrumb text */}
      <Text type="secondary" style={{ fontSize: 13 }}>
        Cài Đặt / Phân Quyền / User Role
      </Text>

      {/* Page Header */}
      <Row justify="space-between" align="middle" style={{ marginTop: 4, marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            User Role
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />}>
            Add Role
          </Button>
        </Col>
      </Row>

      {/* Main Card */}
      <Card styles={{ body: { padding: 0 } }}>
        {/* Tabs + Search/Filter row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ marginBottom: 0 }}
          />

          <Space style={{ paddingBottom: 12 }}>
            <Button icon={<FilterOutlined />}>Filter</Button>
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 200 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Button icon={<AppstoreOutlined />} />
          </Space>
        </div>

        {/* Table */}
        <Table<UserRole>
          columns={columns}
          dataSource={filteredData}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Tổng ${total} vai trò`,
            size: 'small',
          }}
          size="middle"
          rowKey="key"
        />
      </Card>
    </div>
  );
};

export default UserRolesPage;
