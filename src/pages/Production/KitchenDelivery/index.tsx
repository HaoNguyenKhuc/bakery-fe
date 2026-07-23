import React, { useState, useCallback } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space,
  Tag, InputNumber, message, Alert, Tooltip, Badge, Row, Col,
  Modal, Input, Empty,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import deliveryRecordService from '../../../api/services/deliveryRecordService';
import type { DeliveryRecordResponse } from '../../../types/deliveryRecord';

const { Title, Text } = Typography;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'success',
  READY: 'warning',
  DISCREPANCY: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  READY: 'Chờ xác nhận',
  DISCREPANCY: 'Chênh lệch',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  CONFIRMED: <CheckCircleOutlined />,
  READY: <ClockCircleOutlined />,
  DISCREPANCY: <WarningOutlined />,
};

// ─── Component ───────────────────────────────────────────────────────────────

const KitchenDelivery: React.FC = () => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Dayjs>(dayjs());
  // Map id → { qty, note } for pending confirmations
  const [inputMap, setInputMap] = useState<
    Record<string, { qty: number | null; note: string }>
  >({});
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');

  // ── Fetch delivery records for the day ─────────────────────────────────────

  const { data: deliveryItems = [], isLoading, refetch } = useQuery({
    queryKey: ['delivery-records', dateStr],
    queryFn: () => deliveryRecordService.getList(dateStr),
    select: (raw: any) => {
      // Handle both array and paginated response
      const items = Array.isArray(raw) ? raw : raw?.content ?? raw?.data ?? [];
      return items;
    },
  });

  const confirmedCount = deliveryItems.filter(
    (i: DeliveryRecordResponse) => i.deliveryStatus === 'CONFIRMED',
  ).length;
  const pendingCount = deliveryItems.length - confirmedCount;

  // ── Confirm mutation ────────────────────────────────────────────────────────

  const confirmMutation = useMutation({
    mutationFn: ({
      deliveryId,
      qtyReceived,
      note,
    }: {
      deliveryId: string;
      qtyReceived: number;
      note?: string;
    }) => deliveryRecordService.confirm(deliveryId, qtyReceived, note),
    onSuccess: () => {
      message.success('Xác nhận giao nhận thành công!');
      setConfirmModalId(null);
      queryClient.invalidateQueries({
        queryKey: ['delivery-records', dateStr],
      });
    },
    onError: () => {
      message.error('Xác nhận thất bại. Vui lòng thử lại.');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const goDate = useCallback(
    (delta: number) => setDate((d) => d.add(delta, 'day')),
    [],
  );

  const handleConfirmClick = (item: DeliveryRecordResponse) => {
    const qty = inputMap[item.id]?.qty;
    if (qty === null || qty === undefined) {
      message.warning('Vui lòng nhập số lượng shop nhận');
      return;
    }
    setConfirmModalId(item.id);
  };

  const handleConfirmOk = (item: DeliveryRecordResponse) => {
    const entry = inputMap[item.id];
    if (!entry || entry.qty === null) return;
    confirmMutation.mutate({
      deliveryId: item.id,
      qtyReceived: entry.qty,
      note: entry.note || undefined,
    });
  };

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns: ColumnsType<DeliveryRecordResponse> = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{row.productName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.productCode}
          </Text>
        </div>
      ),
    },
    {
      title: 'Bếp làm',
      key: 'qtyProduced',
      align: 'right',
      width: 90,
      render: (_, row) => (
        <Text strong>{row.qtyProduced}</Text>
      ),
    },
    {
      title: 'Shop nhận',
      key: 'qtyReceived',
      align: 'right',
      width: 130,
      render: (_, row) => {
        if (row.deliveryStatus === 'CONFIRMED') {
          return <Text strong>{row.qtyReceived}</Text>;
        }
        return (
          <InputNumber
            min={0}
            max={row.qtyProduced * 2}
            value={inputMap[row.id]?.qty ?? row.qtyProduced} // Default to qtyProduced if undefined
            placeholder="0"
            style={{ width: 90 }}
            onChange={(v) =>
              setInputMap((prev) => ({
                ...prev,
                [row.id]: {
                  qty: v,
                  note: prev[row.id]?.note ?? '',
                },
              }))
            }
          />
        );
      },
    },
    {
      title: 'Chênh lệch',
      key: 'discrepancy',
      align: 'center',
      width: 100,
      render: (_, row) => {
        if (row.deliveryStatus !== 'CONFIRMED') return '—';
        const diff = row.discrepancy || 0;
        if (diff === 0) return <Tag color="success">0</Tag>;
        return (
          <Tag color={diff < 0 ? 'error' : 'warning'}>
            {diff > 0 ? '+' : ''}
            {diff}
          </Tag>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      align: 'center',
      render: (_, row) => {
        const s = row.deliveryStatus;
        return (
          <Tag
            icon={STATUS_ICON[s]}
            color={STATUS_COLOR[s]}
          >
            {STATUS_LABEL[s] ?? s}
          </Tag>
        );
      },
    },
    {
      title: 'Xác nhận lúc',
      key: 'confirmedAt',
      width: 110,
      align: 'center',
      render: (_, row) =>
        row.confirmedAt ? (
          <Text style={{ fontSize: 12 }}>
            {dayjs(row.confirmedAt).format('HH:mm:ss')}
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: '',
      key: 'action',
      width: 110,
      render: (_, row) => {
        if (row.deliveryStatus === 'CONFIRMED') return null;
        
        // Ensure default map entry exists if clicking Confirm without typing
        const currentQty = inputMap[row.id]?.qty !== undefined ? inputMap[row.id]?.qty : row.qtyProduced;
        
        return (
          <>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                if (inputMap[row.id] === undefined) {
                  setInputMap(prev => ({...prev, [row.id]: { qty: row.qtyProduced, note: '' }}));
                }
                setConfirmModalId(row.id);
              }}
              loading={
                confirmMutation.isPending &&
                confirmModalId === row.id
              }
            >
              Xác nhận
            </Button>

            {/* Confirm modal */}
            {confirmModalId === row.id && (
              <Modal
                open
                title="Xác nhận giao nhận"
                onOk={() => handleConfirmOk(row)}
                onCancel={() => setConfirmModalId(null)}
                okText="Xác nhận"
                cancelText="Huỷ"
                confirmLoading={confirmMutation.isPending}
                width={400}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>Sản phẩm: </Text>
                    <Text strong>{row.productName}</Text>
                  </div>
                  <div>
                    <Text>Bếp làm: </Text>
                    <Text strong>{row.qtyProduced}</Text>
                  </div>
                  <div>
                    <Text>Shop nhận: </Text>
                    <Text strong style={{ color: '#1677ff' }}>
                      {currentQty ?? 0}
                    </Text>
                  </div>
                  {(currentQty ?? 0) !== row.qtyProduced && (
                    <Alert
                      type="warning"
                      message="Số lượng không khớp với bếp — sẽ ghi nhận chênh lệch."
                      showIcon
                    />
                  )}
                  <div>
                    <Text type="secondary">Ghi chú (tuỳ chọn):</Text>
                    <Input
                      value={inputMap[row.id]?.note ?? ''}
                      onChange={(e) =>
                        setInputMap((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...prev[row.id],
                            note: e.target.value,
                          },
                        }))
                      }
                      placeholder="Nhập ghi chú nếu có..."
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </Space>
              </Modal>
            )}
          </>
        );
      },
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      <Title level={4} style={{ marginBottom: 20 }}>
        🔄 Giao nhận bếp → shop
      </Title>

      <Card>
        {/* ─── Header: date nav + status ────────────────────────────── */}
        <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Tooltip title="Hôm trước">
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => goDate(-1)}
                />
              </Tooltip>
              <DatePicker
                value={date}
                onChange={(d) => d && setDate(d)}
                format="DD/MM/YYYY"
                style={{ width: 150 }}
                allowClear={false}
              />
              <Tooltip title="Hôm sau">
                <Button
                  icon={<RightOutlined />}
                  onClick={() => goDate(1)}
                  disabled={date.isSame(dayjs(), 'day')}
                />
              </Tooltip>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              {confirmedCount > 0 && (
                <Tag color="success" style={{ padding: '4px 10px', fontSize: 13 }}>
                  <CheckCircleOutlined /> Đã xác nhận ({confirmedCount})
                </Tag>
              )}
              {pendingCount > 0 && (
                <Badge count={pendingCount} size="small">
                  <Tag color="warning" style={{ padding: '4px 10px', fontSize: 13 }}>
                    <ClockCircleOutlined /> Chờ xác nhận
                  </Tag>
                </Badge>
              )}
            </Space>
          </Col>
        </Row>

        {/* ─── Table ────────────────────────────────────────────────── */}
        <Table<DeliveryRecordResponse>
          dataSource={deliveryItems}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          rowClassName={(row) =>
            row.deliveryStatus === 'CONFIRMED'
              ? 'ant-table-row-confirmed'
              : ''
          }
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">
                    Không có dữ liệu giao nhận cho ngày{' '}
                    <Text strong>{date.format('DD/MM/YYYY')}</Text>
                  </Text>
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default KitchenDelivery;
