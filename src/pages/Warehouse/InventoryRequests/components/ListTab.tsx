import React, { useState, useEffect } from 'react';
import { Table, Button, Input, InputNumber, Tag, Space, Typography, Badge, message, Popconfirm, Select, Card, Row, Col, Tabs } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
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

/** Component con: expand row với local state cho unit cost → tính tiền realtime */
const ExpandedLines: React.FC<{
  record: UnifiedTransactionResponse;
  isPending: boolean;
  showPrice: boolean;
}> = ({ record, isPending, showPrice }) => {
  const lines: any[] = (record as any).lines ?? [];

  // local state: lineId → unitCost hiện tại (controlled)
  const [costs, setCosts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    lines.forEach((l) => { if (l.unitCost != null) init[l.id] = Number(l.unitCost); });
    return init;
  });

  const getCost = (l: any) => costs[l.id] ?? Number(l.unitCost ?? 0);
  const total = lines.reduce((sum, l) => sum + getCost(l) * Number(l.quantity ?? 0), 0);

  if (lines.length === 0) return <Text type="secondary">Không có dòng</Text>;

  return (
    <Table
      dataSource={lines}
      pagination={false}
      size="small"
      rowKey="id"
      columns={[
        { title: 'Hàng hóa', render: (_, r: any) => r.item?.name || r.item?.key },
        { title: 'Số lượng', dataIndex: 'quantity', align: 'right' },
        { title: 'Đơn vị', dataIndex: 'unit' },
        ...(!showPrice ? [] : [
          {
            title: 'Đơn giá',
            align: 'right' as const,
            render: (_: any, r: any) => isPending ? (
              <InputNumber
                size="small"
                value={costs[r.id] ?? (r.unitCost != null ? Number(r.unitCost) : undefined)}
                min={0}
                step={500}
                formatter={(v: any) => v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(v: any) => Number((v ?? '').replace(/,/g, '')) as any}
                onChange={(val: any) => {
                  if (val != null) setCosts(prev => ({ ...prev, [r.id]: Number(val) }));
                }}
                onBlur={() => {
                  const val = costs[r.id];
                  if (val != null && val >= 0) {
                    inventoryService.updateLineCost(record.id, r.id, val)
                      .catch(() => message.error('Lưu giá thất bại'));
                  }
                }}
                style={{ width: 110 }}
                suffix="đ"
              />
            ) : (
              <Text>{r.unitCost ? `${Number(r.unitCost).toLocaleString('vi-VN')}đ` : '—'}</Text>
            ),
          },
          {
            title: 'Thành tiền',
            align: 'right' as const,
            render: (_: any, r: any) => {
              const subtotal = getCost(r) * Number(r.quantity ?? 0);
              return subtotal > 0
                ? <Text strong>{subtotal.toLocaleString('vi-VN')}đ</Text>
                : <Text type="secondary">—</Text>;
            },
          },
        ]),
      ]}
      summary={!showPrice ? undefined : () => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={4} align="right">
            <Text strong>Tổng cộng</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            <Text strong style={{ color: total > 0 ? '#1677ff' : undefined }}>
              {total > 0 ? `${total.toLocaleString('vi-VN')}đ` : '—'}
            </Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
};

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

interface ListTabProps {
  warehouseFilter?: { id?: string; code?: string; name?: string };
}

const ListTab: React.FC<ListTabProps> = ({ warehouseFilter }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { type = 'kho-chinh' } = useParams<{ type: string }>();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouseFilter?.code || '');
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING_APPROVAL');

  useEffect(() => {
    if (warehouseFilter?.code !== undefined) {
      setSelectedWarehouse(warehouseFilter.code);
    }
  }, [warehouseFilter?.code]);

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
      return inventoryService.getRequests(params).then((res: any) => res.content || res);
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
          {r.sourceWarehouse && <Text>{r.sourceWarehouse.name || r.sourceWarehouse.key} →</Text>}
          <Text strong>{r.targetWarehouse?.name || r.targetWarehouse?.key || '?'}</Text>
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
      {!warehouseFilter && (
        <Tabs
          className="nav-tabs-only"
          activeKey={selectedWarehouse}
          onChange={(k) => setSelectedWarehouse(k)}
          items={[
            { key: '', label: 'Tất cả kho' },
            ...allWarehouses.map(w => ({ key: w?.code || '', label: w?.name || '' }))
          ]}
        />
      )}

      <Tabs
        className="nav-tabs-only"
        activeKey={selectedStatus}
        onChange={(k) => setSelectedStatus(k)}
        type="card"
        size="small"
        style={{ marginTop: warehouseFilter ? 0 : 16, marginBottom: 16 }}
        items={[
          { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
          { key: 'APPROVED', label: 'Đã duyệt' },
          { key: 'DRAFT', label: 'Draft' },
          { key: 'REJECTED', label: 'Bị từ chối' }
        ]}
        tabBarExtraContent={
          <Space>
            <Button icon={<SearchOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['inventory-requests'] })}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/warehouse/${type}/phieu-kho/create`)}>
              Tạo phiếu
            </Button>
          </Space>
        }
      />

      <Table<UnifiedTransactionResponse>
        columns={columns}
        dataSource={receipts}
        loading={isLoading}
        rowKey="id"
        size="middle"
        scroll={{ x: 750 }}
        pagination={{ pageSize: 15, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} phiếu` }}
        expandable={{
          expandedRowRender: (record) => {
            const isPending = (record as any).approvalStatus === 'PENDING_APPROVAL'
              || (record as any).approvalStatus === 'DRAFT';
            const showPrice = (record as any).requestType === 'PURCHASE';
            return <ExpandedLines record={record} isPending={isPending} showPrice={showPrice} />;
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
