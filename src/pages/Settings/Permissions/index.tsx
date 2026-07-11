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
  Checkbox,
  Divider,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface Permission {
  key: string;
  label: string;
  color: string;
}

interface Role {
  key: string;
  vaiTro: string;
  moTa: string;
  soNguoiDung: number;
  quyenHan: string[];
}

const allPermissions: Permission[] = [
  { key: 'dashboard', label: 'Dashboard', color: 'blue' },
  { key: 'san_pham', label: 'Sản Phẩm', color: 'green' },
  { key: 'don_hang', label: 'Đơn Hàng', color: 'orange' },
  { key: 'kho', label: 'Kho', color: 'purple' },
  { key: 'nhan_vien', label: 'Nhân Viên', color: 'cyan' },
  { key: 'khach_hang', label: 'Khách Hàng', color: 'geekblue' },
  { key: 'bao_cao', label: 'Báo Cáo', color: 'volcano' },
  { key: 'cai_dat', label: 'Cài Đặt', color: 'magenta' },
];

const permissionColorMap: Record<string, string> = {};
allPermissions.forEach((p) => {
  permissionColorMap[p.key] = p.color;
});

const permissionLabelMap: Record<string, string> = {};
allPermissions.forEach((p) => {
  permissionLabelMap[p.key] = p.label;
});

interface DetailedPermission {
  group: string;
  permissions: { key: string; label: string }[];
}

const detailedPermissions: DetailedPermission[] = [
  {
    group: 'Dashboard',
    permissions: [
      { key: 'dashboard.xem', label: 'Xem Dashboard' },
      { key: 'dashboard.thong_ke', label: 'Xem Thống Kê' },
    ],
  },
  {
    group: 'Sản Phẩm',
    permissions: [
      { key: 'san_pham.xem', label: 'Xem Sản Phẩm' },
      { key: 'san_pham.them', label: 'Thêm Sản Phẩm' },
      { key: 'san_pham.sua', label: 'Sửa Sản Phẩm' },
      { key: 'san_pham.xoa', label: 'Xóa Sản Phẩm' },
    ],
  },
  {
    group: 'Đơn Hàng',
    permissions: [
      { key: 'don_hang.xem', label: 'Xem Đơn Hàng' },
      { key: 'don_hang.tao', label: 'Tạo Đơn Hàng' },
      { key: 'don_hang.cap_nhat', label: 'Cập Nhật Trạng Thái' },
      { key: 'don_hang.huy', label: 'Hủy Đơn Hàng' },
    ],
  },
  {
    group: 'Kho',
    permissions: [
      { key: 'kho.xem', label: 'Xem Kho' },
      { key: 'kho.nhap', label: 'Nhập Kho' },
      { key: 'kho.xuat', label: 'Xuất Kho' },
      { key: 'kho.kiem_ke', label: 'Kiểm Kê' },
    ],
  },
  {
    group: 'Nhân Viên',
    permissions: [
      { key: 'nhan_vien.xem', label: 'Xem Nhân Viên' },
      { key: 'nhan_vien.them', label: 'Thêm Nhân Viên' },
      { key: 'nhan_vien.sua', label: 'Sửa Thông Tin' },
      { key: 'nhan_vien.xoa', label: 'Xóa Nhân Viên' },
    ],
  },
  {
    group: 'Khách Hàng',
    permissions: [
      { key: 'khach_hang.xem', label: 'Xem Khách Hàng' },
      { key: 'khach_hang.them', label: 'Thêm Khách Hàng' },
      { key: 'khach_hang.sua', label: 'Sửa Thông Tin' },
    ],
  },
  {
    group: 'Báo Cáo',
    permissions: [
      { key: 'bao_cao.xem', label: 'Xem Báo Cáo' },
      { key: 'bao_cao.xuat', label: 'Xuất Báo Cáo' },
    ],
  },
  {
    group: 'Cài Đặt',
    permissions: [
      { key: 'cai_dat.chung', label: 'Cài Đặt Chung' },
      { key: 'cai_dat.phan_quyen', label: 'Phân Quyền' },
      { key: 'cai_dat.sao_luu', label: 'Sao Lưu Dữ Liệu' },
    ],
  },
];

const allDetailedKeys = detailedPermissions.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

const roleDetailedPermissions: Record<string, string[]> = {
  Admin: [...allDetailedKeys],
  'Quản Lý': [
    'dashboard.xem',
    'dashboard.thong_ke',
    'san_pham.xem',
    'san_pham.them',
    'san_pham.sua',
    'don_hang.xem',
    'don_hang.tao',
    'don_hang.cap_nhat',
    'don_hang.huy',
    'kho.xem',
    'kho.nhap',
    'kho.xuat',
    'kho.kiem_ke',
    'nhan_vien.xem',
    'khach_hang.xem',
    'khach_hang.them',
    'khach_hang.sua',
    'bao_cao.xem',
    'bao_cao.xuat',
    'cai_dat.chung',
  ],
  'Nhân Viên Bán Hàng': [
    'dashboard.xem',
    'san_pham.xem',
    'don_hang.xem',
    'don_hang.tao',
    'don_hang.cap_nhat',
    'khach_hang.xem',
    'khach_hang.them',
  ],
  'Nhân Viên Bếp': [
    'dashboard.xem',
    'san_pham.xem',
    'don_hang.xem',
    'kho.xem',
    'kho.nhap',
    'kho.xuat',
  ],
  'Kế Toán': [
    'dashboard.xem',
    'dashboard.thong_ke',
    'don_hang.xem',
    'bao_cao.xem',
    'bao_cao.xuat',
    'khach_hang.xem',
  ],
};

const dummyRoles: Role[] = [
  {
    key: '1',
    vaiTro: 'Admin',
    moTa: 'Quản trị viên hệ thống, có toàn quyền truy cập',
    soNguoiDung: 2,
    quyenHan: [
      'dashboard',
      'san_pham',
      'don_hang',
      'kho',
      'nhan_vien',
      'khach_hang',
      'bao_cao',
      'cai_dat',
    ],
  },
  {
    key: '2',
    vaiTro: 'Quản Lý',
    moTa: 'Quản lý cửa hàng, quản lý nhân viên và hàng hóa',
    soNguoiDung: 3,
    quyenHan: [
      'dashboard',
      'san_pham',
      'don_hang',
      'kho',
      'nhan_vien',
      'khach_hang',
      'bao_cao',
      'cai_dat',
    ],
  },
  {
    key: '3',
    vaiTro: 'Nhân Viên Bán Hàng',
    moTa: 'Nhân viên bán hàng tại quầy, quản lý đơn hàng',
    soNguoiDung: 8,
    quyenHan: ['dashboard', 'san_pham', 'don_hang', 'khach_hang'],
  },
  {
    key: '4',
    vaiTro: 'Nhân Viên Bếp',
    moTa: 'Nhân viên sản xuất bánh, quản lý nguyên liệu',
    soNguoiDung: 6,
    quyenHan: ['dashboard', 'san_pham', 'don_hang', 'kho'],
  },
  {
    key: '5',
    vaiTro: 'Kế Toán',
    moTa: 'Nhân viên kế toán, quản lý báo cáo tài chính',
    soNguoiDung: 2,
    quyenHan: ['dashboard', 'don_hang', 'khach_hang', 'bao_cao'],
  },
];

const PermissionsPage: React.FC = () => {
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('1');
  const [checkedPermissions, setCheckedPermissions] = useState<Record<string, string[]>>(
    () => ({ ...roleDetailedPermissions }),
  );

  const selectedRole = useMemo(
    () => dummyRoles.find((r) => r.key === selectedRoleKey),
    [selectedRoleKey],
  );

  const currentChecked = useMemo(
    () => (selectedRole ? checkedPermissions[selectedRole.vaiTro] || [] : []),
    [selectedRole, checkedPermissions],
  );

  const handlePermissionChange = (groupKey: string, values: string[]) => {
    if (!selectedRole) return;

    const groupPermKeys = detailedPermissions
      .find((g) => g.group === groupKey)
      ?.permissions.map((p) => p.key) || [];

    const otherPermissions = currentChecked.filter(
      (p) => !groupPermKeys.includes(p),
    );

    setCheckedPermissions((prev) => ({
      ...prev,
      [selectedRole.vaiTro]: [...otherPermissions, ...values],
    }));
  };

  const columns: ColumnsType<Role> = [
    {
      title: 'Vai Trò',
      dataIndex: 'vaiTro',
      key: 'vaiTro',
      width: 180,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Mô Tả',
      dataIndex: 'moTa',
      key: 'moTa',
      ellipsis: true,
    },
    {
      title: 'Số Người Dùng',
      dataIndex: 'soNguoiDung',
      key: 'soNguoiDung',
      width: 140,
      align: 'center',
      render: (count: number) => (
        <Space>
          <UserOutlined />
          <span style={{ fontWeight: 600 }}>{count}</span>
        </Space>
      ),
    },
    {
      title: 'Quyền Hạn',
      dataIndex: 'quyenHan',
      key: 'quyenHan',
      width: 380,
      render: (permissions: string[]) => (
        <Space size={[4, 6]} wrap>
          {permissions.map((perm) => (
            <Tag key={perm} color={permissionColorMap[perm] || 'default'}>
              {permissionLabelMap[perm] || perm}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_: unknown, record: Role) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setSelectedRoleKey(record.key)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.vaiTro === 'Admin'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Phân Quyền
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />}>
            Thêm Vai Trò
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Table<Role>
          columns={columns}
          dataSource={dummyRoles}
          pagination={false}
          bordered
          size="middle"
          rowSelection={{
            type: 'radio',
            selectedRowKeys: [selectedRoleKey],
            onChange: (keys) => {
              if (keys.length > 0) {
                setSelectedRoleKey(keys[0] as string);
              }
            },
          }}
          onRow={(record) => ({
            onClick: () => setSelectedRoleKey(record.key),
            style: {
              cursor: 'pointer',
              background: record.key === selectedRoleKey ? '#e6f4ff' : undefined,
            },
          })}
        />
      </Card>

      {selectedRole && (
        <Card
          title={
            <Space>
              <span>Chi tiết quyền hạn:</span>
              <Tag color="blue" style={{ fontSize: 14 }}>
                {selectedRole.vaiTro}
              </Tag>
            </Space>
          }
        >
          <Row gutter={[24, 16]}>
            {detailedPermissions.map((group, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={group.group}>
                <Card
                  size="small"
                  title={
                    <Text strong style={{ fontSize: 13 }}>
                      {group.group}
                    </Text>
                  }
                  style={{
                    height: '100%',
                    borderColor: '#d9d9d9',
                  }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <Checkbox.Group
                    value={currentChecked.filter((p) =>
                      group.permissions.some((gp) => gp.key === p),
                    )}
                    onChange={(values) =>
                      handlePermissionChange(group.group, values as string[])
                    }
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {group.permissions.map((perm) => (
                      <Checkbox key={perm.key} value={perm.key}>
                        {perm.label}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </Card>
                {index < detailedPermissions.length - 1 && (
                  <Divider style={{ margin: 0, display: 'none' }} />
                )}
              </Col>
            ))}
          </Row>

          <Divider />

          <Row justify="end">
            <Space>
              <Button>Hủy Thay Đổi</Button>
              <Button type="primary">Lưu Quyền Hạn</Button>
            </Space>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default PermissionsPage;
