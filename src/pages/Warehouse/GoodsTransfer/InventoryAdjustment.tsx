import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Typography, Badge,
  Modal, Form, Select, Input, InputNumber, Divider,
  Alert, Tooltip, Row, Col, message,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, WarningOutlined,
  LockOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import type { AdjustmentType, InventoryAdjustment } from '../../../types';
import { useAuthStore } from '../../../store';

const { Title, Text } = Typography;

// ─── Nhãn ─────────────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, { label: string; color: string }> = {
  LOSS:    { label: '🔴 Mất hàng',   color: 'red' },
  DAMAGE:  { label: '🟠 Hư hỏng',   color: 'orange' },
  EXPIRED: { label: '⚫ Hết hạn',    color: 'default' },
  OTHER:   { label: '🔵 Khác',       color: 'blue' },
};

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  PENDING:  { color: 'orange', label: '⏳ Chờ duyệt' },
  APPROVED: { color: 'green',  label: '✅ Đã duyệt' },
  REJECTED: { color: 'red',    label: '❌ Từ chối' },
};

// ─── Dummy data ────────────────────────────────────────────────────────────────

const dummyAdjustments: InventoryAdjustment[] = [
  {
    adjustmentId: 'adj-001', adjustmentCode: 'ADJ-20260702-001',
    adjustmentType: 'LOSS', warehouseCode: 'MAIN', branchCode: 'KHO-TONG',
    status: 'APPROVED', reason: 'Mất hàng trong quá trình vận chuyển',
    lines: [{ ingredientCode: 'NL003', ingredientName: 'Bơ Nhạt', unit: 'KG', lostQuantity: 2 }],
    createdBy: 'cuong.kho', createdAt: '2026-07-02T14:00:00Z',
    approvedBy: 'chinh.admin', approvedAt: '2026-07-02T16:00:00Z',
  },
  {
    adjustmentId: 'adj-002', adjustmentCode: 'ADJ-20260703-001',
    adjustmentType: 'DAMAGE', warehouseCode: 'KITCHEN', branchCode: 'BEP-01',
    status: 'PENDING', reason: 'Hộp sữa bị vỡ khi nhận hàng',
    lines: [{ ingredientCode: 'NL005', ingredientName: 'Sữa Tươi', unit: 'Lít', lostQuantity: 3 }],
    createdBy: 'bep1.staff', createdAt: '2026-07-03T08:30:00Z',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const InventoryAdjustmentPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user        = useAuthStore((s) => s.user);
  const canOnScreen = useAuthStore((s) => s.canOnScreen);
  const isAdmin     = useAuthStore((s) => s.isAdmin);
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);

  // Xác định warehouse của user hiện tại
  const warehouseCode = (
    isWarehouseRole('KHO_TONG') ? 'MAIN' :
    isWarehouseRole('KHO_BEP')  ? 'KITCHEN' :
    isWarehouseRole('STORE')    ? 'STORE' : 'MAIN'
  ) as 'MAIN' | 'KITCHEN' | 'STORE';

  // Nút [PHÊ DUYỆT ĐIỀU CHỈNH KHO] chỉ hiện khi ADMIN + can_approve
  const canApproveAdjustment = isAdmin() && canOnScreen('INVENTORY_ADJUSTMENT', 'approve');

  // Nút [Tạo phiếu mất hàng] cho Kho Tổng và Kho Bếp
  const canCreateAdjustment = canOnScreen('INVENTORY_ADJUSTMENT', 'create') &&
    (isWarehouseRole('KHO_TONG') || isWarehouseRole('KHO_BEP') || isAdmin());

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-adjustment', user?.branch_code],
    queryFn: async (): Promise<InventoryAdjustment[]> => { throw new Error('API not ready'); },
    retry: 0,
  });

  const list: InventoryAdjustment[] = Array.isArray(data) ? data : dummyAdjustments;

  const approveMutation = useMutation({
    mutationFn: async (_id: string) => { throw new Error('API not ready'); },
    onSuccess: () => {
      message.success('Đã phê duyệt điều chỉnh kho.');
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustment'] });
    },
    onError: () => message.warning('API chưa sẵn sàng (demo).'),
  });

  const columns: ColumnsType<InventoryAdjustment> = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'adjustmentCode',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'adjustmentType',
      key: 'type',
      width: 130,
      render: (v: AdjustmentType) => {
        const cfg = ADJUSTMENT_TYPE_LABEL[v];
        return <Tag color={cfg?.color}>{cfg?.label ?? v}</Tag>;
      },
    },
    {
      title: 'Kho',
      dataIndex: 'warehouseCode',
      key: 'warehouse',
      width: 100,
      render: (v: string, r: InventoryAdjustment) => (
        <Space direction="vertical" size={0}>
          <Tag color="purple">{v}</Tag>
          {r.branchCode && <Text type="secondary" style={{ fontSize: 11 }}>{r.branchCode}</Text>}
        </Space>
      ),
    },
    {
      title: 'Lý Do',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: 'Số Dòng NL',
      key: 'lines',
      width: 100,
      align: 'center',
      render: (_: unknown, r: InventoryAdjustment) => (
        <Badge count={r.lines.length} style={{ backgroundColor: '#fa8c16' }} />
      ),
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: string) => {
        const cfg = STATUS_TAG[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    // Cột PHÊ DUYỆT — BẮT BUỘC ẨN với mọi user, CHỈ HIỆN khi ADMIN + can_approve
    ...(canApproveAdjustment ? [{
      title: (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          Phê Duyệt
        </Space>
      ),
      key: 'approve',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, r: InventoryAdjustment) =>
        r.status === 'PENDING' ? (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate(r.adjustmentId)}
          >
            PHÊ DUYỆT
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    }] : []),
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WarningOutlined style={{ color: '#ff4d4f', marginRight: 10 }} />
            Phiếu Thất Thoát / Điều Chỉnh Kho
          </Title>
          <Text type="secondary">Ghi nhận và phê duyệt các trường hợp mất hàng, hư hỏng, hết hạn</Text>
        </Col>
        <Col>
          <Space>
            {/* Nút tạo phiếu — Kho Tổng + Kho Bếp */}
            {canCreateAdjustment ? (
              <Button
                type="primary"
                danger
                icon={<PlusOutlined />}
                onClick={() => navigate('/warehouse/inventory-adjustment/create')}
              >
                Tạo Phiếu Mất Hàng
              </Button>
            ) : (
              <Tooltip title="Bạn không có quyền tạo phiếu điều chỉnh kho">
                <Button danger icon={<LockOutlined />} disabled>
                  Tạo Phiếu Mất Hàng
                </Button>
              </Tooltip>
            )}

            {/* Nút PHÊ DUYỆT ĐIỀU CHỈNH KHO — CHỈ ADMIN */}
            {canApproveAdjustment && (
              <Alert
                type="warning"
                showIcon
                icon={<CheckCircleOutlined />}
                message={
                  <Text strong style={{ fontSize: 12 }}>
                    Bạn đang đăng nhập với quyền Admin — có thể phê duyệt điều chỉnh trong bảng bên dưới.
                  </Text>
                }
                style={{ padding: '4px 12px' }}
              />
            )}
          </Space>
        </Col>
      </Row>

      <Table<InventoryAdjustment>
        columns={columns}
        dataSource={list}
        rowKey="adjustmentId"
        size="middle"
        loading={isLoading}
        pagination={{ pageSize: 10, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
        locale={{ emptyText: '✅ Chưa có phiếu điều chỉnh nào.' }}
      />
    </div>
  );
};

export default InventoryAdjustmentPage;
