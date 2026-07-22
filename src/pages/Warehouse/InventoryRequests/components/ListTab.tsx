import React, { useState } from 'react';
import { Table, Button, Input, Tag, Space, Typography, Badge, message, Popconfirm, Select, Card, Row, Col } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { transactionService, inventoryService } from '../../../../api/services';
import RejectModal from '../components/RejectModal';
import { useWarehouseStore } from '../../../../store';

import type {
  UnifiedTransactionResponse,
  RejectRequestPayload,
  TransactionType,
} from '../../../../types';

const { Text } = Typography;

const TYPE_LABEL: Record<TransactionType, string> = {
  PURCHASE: 'Mua Hàng',
  IMPORT: 'Nhập',
  TRANSFER: 'Xuất / Chuyển',
  ADJUSTMENT: 'Điều Chỉnh',
  EXPORT: 'Xuất',
  RETURN: 'Trả NCC',
  DISCARD: 'Hủy',
  STOCK_COUNT: 'Kiểm Kê',
};

const TYPE_COLOR: Record<TransactionType, string> = {
  PURCHASE: 'magenta',
  IMPORT: 'green',
  TRANSFER: 'blue',
  ADJUSTMENT: 'orange',
  EXPORT: 'cyan',
  RETURN: 'volcano',
  DISCARD: 'red',
  STOCK_COUNT: 'purple',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: 'orange',
  APPROVED: 'green',
  DRAFT: 'default',
  REJECTED: 'red',
};

const ListTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING_APPROVAL');
  
  const [selectedRecord, setSelectedRecord] = useState<UnifiedTransactionResponse | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep = useWarehouseStore((s) => s.getKhoBep);
  const getStores = useWarehouseStore((s) => s.getStores);

  const khoTong = getKhoTong();
  const allWarehouses = [khoTong, ...getKhoBep(), ...getStores()].filter(Boolean);

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['inventory-requests', selectedWarehouse, selectedStatus],
    queryFn: () => {
      const params: any = { size: 50 };
      if (selectedWarehouse) params.warehouseCode = selectedWarehouse;
      if (selectedStatus) params.approvalStatus = selectedStatus;
      return inventoryService.getRequests(params);
    },
    staleTime: 15_000,
  });

  const receipts: UnifiedTransactionResponse[] = requestsData ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryService.approveRequest(id),
    onSuccess: () => {
      message.success('Đã phê duyệt phiếu.');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: RejectRequestPayload }) => inventoryService.rejectRequest(id, payload),
    onSuccess: () => {
      message.warning('Đã từ chối phiếu.');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
      setRejectModalOpen(false);
      setSelectedRecord(null);
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  const columns: ColumnsType<UnifiedTransactionResponse> = [
    {
      title: 'Mã phiếu',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'requestType',
      key: 'type',
      width: 130,
      render: (v: TransactionType) => (
        <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>
      ),
    },
    {
      title: 'Kho xuất → nhận',
      key: 'route',
      render: (_, r) => (
        <Space>
          {r.sourceWarehouse?.code && <Text>{r.sourceWarehouse.code} →</Text>}
          <Text strong>{r.targetWarehouse?.code ?? '?'}</Text>
        </Space>
      )
    },
    {
      title: 'Nhà cung cấp',
      key: 'supplier',
      render: (_: unknown, r: UnifiedTransactionResponse) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.supplier?.name ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'status',
      width: 120,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
  ];

  if (selectedStatus === 'PENDING_APPROVAL' || selectedStatus === 'DRAFT') {
    columns.push({
      title: 'Thao tác',
      key: 'action',
      width: 165,
      align: 'center',
      render: (_: unknown, record: UnifiedTransactionResponse) => (
        <Space>
          <Popconfirm
            title="Xác nhận phê duyệt phiếu này?"
            onConfirm={() => approveMutation.mutate(record.id)}
            okText="Duyệt"
            cancelText="Huỷ"
          >
            <Button type="primary" size="small" icon={<CheckOutlined />} loading={approveMutation.isPending}>
              Duyệt
            </Button>
          </Popconfirm>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRecord(record);
              setRejectModalOpen(true);
            }}
          >
            Từ Chối
          </Button>
        </Space>
      ),
    });
  }

  return (
    <Card bordered={false}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Select
            style={{ width: '100%' }}
            placeholder="Tất cả kho"
            allowClear
            value={selectedWarehouse || undefined}
            onChange={(v) => setSelectedWarehouse(v || '')}
            options={allWarehouses.map(w => ({ value: w?.code, label: w?.name }))}
          />
        </Col>
        <Col span={6}>
          <Select
            style={{ width: '100%' }}
            value={selectedStatus}
            onChange={(v) => setSelectedStatus(v)}
            options={[
              { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
              { value: 'APPROVED', label: 'Đã duyệt' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'REJECTED', label: 'Bị từ chối' }
            ]}
          />
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <Button icon={<SearchOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['inventory-requests'] })}>
            Tải lại
          </Button>
        </Col>
      </Row>

      <Table<UnifiedTransactionResponse>
        columns={columns}
        dataSource={receipts}
        loading={isLoading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 15, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
        expandable={{
          expandedRowRender: (record) => {
            const lines = record.lines ?? [];
            if (lines.length === 0) return <Text type="secondary">Không có dòng</Text>;
            return (
              <Table
                dataSource={lines}
                pagination={false}
                size="small"
                rowKey="id"
                columns={[
                  { title: 'Hàng hóa', render: (_, r) => r.item?.name || r.item?.key },
                  { title: 'Số lượng', dataIndex: 'quantity', align: 'right' },
                  { title: 'Đơn vị', dataIndex: 'unit' },
                  { title: 'Đơn giá', render: (_, r) => r.unitCost ? `${r.unitCost}đ` : '—', align: 'right' }
                ]}
              />
            );
          }
        }}
      />
      <RejectModal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedRecord(null);
        }}
        onSubmit={(id, payload) => rejectMutation.mutate({ id, payload })}
        submitting={rejectMutation.isPending}
        record={selectedRecord}
      />
    </Card>
  );
};

export default ListTab;
