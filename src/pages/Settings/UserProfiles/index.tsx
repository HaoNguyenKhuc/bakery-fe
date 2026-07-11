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

type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

interface UserProfile {
  key: string;
  globalUserId: string;
  identityId: string;
  userEmail: string;
  profileName: string;
  userRole: string;
  status: UserStatus;
}

// --- Dummy Data ---

const dummyUsers: UserProfile[] = [
  {
    key: '1',
    globalUserId: '',
    identityId: '0260dd81-91bb-44d2-b504-c978970561c2',
    userEmail: 'caovanhuy2710@gmail.com',
    profileName: 'Cao Huy',
    userRole: 'Supper Admin',
    status: 'ACTIVE',
  },
  {
    key: '2',
    globalUserId: '019e12a8-12bc-779b-9a37-f5464bfadf4f',
    identityId: '93d52cbb-458c-43b0-a7b1-5a7aa07d376e',
    userEmail: 'olsadmin@oneempower.com',
    profileName: 'tuan ngo',
    userRole: 'Supper Admin',
    status: 'ACTIVE',
  },
  {
    key: '3',
    globalUserId: '019e3e55-dc22-71ba-b190-1542028bb2c2',
    identityId: 'f0c3dbbc-3df5-4a45-87f2-b91f52b49b87',
    userEmail: 'abc1@gmail.com',
    profileName: 'test role',
    userRole: 'Test Role',
    status: 'ACTIVE',
  },
  {
    key: '4',
    globalUserId: '019f1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b',
    identityId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    userEmail: 'manager@bakeryms.com',
    profileName: 'Nguyễn Văn A',
    userRole: 'Quản Lý',
    status: 'PENDING',
  },
  {
    key: '5',
    globalUserId: '019f2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    identityId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    userEmail: 'kitchen@bakeryms.com',
    profileName: 'Trần Văn B',
    userRole: 'Nhân Viên Bếp',
    status: 'PENDING',
  },
  {
    key: '6',
    globalUserId: '019f3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    identityId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    userEmail: 'sales@bakeryms.com',
    profileName: 'Lê Thị C',
    userRole: 'Nhân Viên Bán Hàng',
    status: 'PENDING',
  },
  {
    key: '7',
    globalUserId: '019f4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
    identityId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    userEmail: 'accountant@bakeryms.com',
    profileName: 'Phạm Văn D',
    userRole: 'Kế Toán',
    status: 'PENDING',
  },
];

// --- Status config ---

const statusConfig: Record<UserStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'ACTIVE' },
  PENDING: { color: 'orange', label: 'PENDING' },
  REJECTED: { color: 'red', label: 'REJECTED' },
};

// --- Mapping tab key to status ---

const tabStatusMap: Record<string, UserStatus | null> = {
  Active: 'ACTIVE',
  Pending: 'PENDING',
  Rejected: 'REJECTED',
};

// --- Component ---

const UserProfilesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Active');
  const [searchText, setSearchText] = useState('');

  // Filter data
  const filteredData = useMemo(() => {
    let data = dummyUsers;

    // Filter by status
    const statusFilter = tabStatusMap[activeTab];
    if (statusFilter) {
      data = data.filter((u) => u.status === statusFilter);
    }

    // Filter by search
    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      data = data.filter(
        (u) =>
          u.globalUserId.toLowerCase().includes(keyword) ||
          u.identityId.toLowerCase().includes(keyword) ||
          u.userEmail.toLowerCase().includes(keyword) ||
          u.profileName.toLowerCase().includes(keyword) ||
          u.userRole.toLowerCase().includes(keyword)
      );
    }

    return data;
  }, [activeTab, searchText]);

  // Counts
  const counts = useMemo(() => {
    return {
      Active: dummyUsers.filter((u) => u.status === 'ACTIVE').length,
      Pending: dummyUsers.filter((u) => u.status === 'PENDING').length,
      Rejected: dummyUsers.filter((u) => u.status === 'REJECTED').length,
    };
  }, []);

  // Row actions
  const getRowActions = (_record: UserProfile): MenuProps['items'] => [
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

  // Columns
  const columns: ColumnsType<UserProfile> = [
    {
      title: 'Global User ID',
      dataIndex: 'globalUserId',
      key: 'globalUserId',
      width: 280,
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text || '—'}
        </Text>
      ),
    },
    {
      title: 'Identity ID',
      dataIndex: 'identityId',
      key: 'identityId',
      width: 300,
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</Text>
      ),
    },
    {
      title: 'User Email',
      dataIndex: 'userEmail',
      key: 'userEmail',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Profile Name',
      dataIndex: 'profileName',
      key: 'profileName',
      width: 150,
    },
    {
      title: 'User Roles',
      dataIndex: 'userRole',
      key: 'userRole',
      width: 160,
    },
    {
      title: 'User Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: UserStatus) => (
        <Tag color={statusConfig[status]?.color || 'default'}>
          {statusConfig[status]?.label || status}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      align: 'center',
      render: (_: unknown, record: UserProfile) => (
        <Dropdown
          menu={{
            items: getRowActions(record),
            onClick: ({ key }) => {
              console.log(`Action: ${key} on user: ${record.profileName}`);
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

  // Tabs
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
        Cài Đặt / Phân Quyền / User Profiles
      </Text>

      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginTop: 4, marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            User Profiles
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />}>
            Create User Profile
          </Button>
        </Col>
      </Row>

      {/* Main Card */}
      <Card styles={{ body: { padding: 0 } }}>
        {/* Tabs + Search/Filter */}
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
        <Table<UserProfile>
          columns={columns}
          dataSource={filteredData}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Tổng ${total} người dùng`,
            size: 'small',
          }}
          size="middle"
          rowKey="key"
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default UserProfilesPage;
