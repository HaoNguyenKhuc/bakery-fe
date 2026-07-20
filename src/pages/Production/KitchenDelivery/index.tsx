import React, { useState, useCallback, useMemo } from 'react';
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
import productionRequestService from '../../../api/services/productionRequestService';
import deliveryRecordService from '../../../api/services/deliveryRecordService';
import type { DeliveryItem } from '../../../types/deliveryRecord';

const { Title, Text } = Typography;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'success',
  PENDING: 'warning',
  DISCREPANCY: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING: 'Chờ xác nhận',
  DISCREPANCY: 'Chênh lệch',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  CONFIRMED: <CheckCircleOutlined />,
  PENDING: <ClockCircleOutlined />,
  DISCREPANCY: <WarningOutlined />,
};

// ─── Component ───────────────────────────────────────────────────────────────

const KitchenDelivery: React.FC = () => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Dayjs>(dayjs());
  // Map lineId → { qty, note } for pending confirmations
  const [inputMap, setInputMap] = useState<
    Record<string, { qty: number | null; note: string }>
  >({});
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');

  // ── Fetch production requests for the day ──────────────────────────────────

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['production-requests-delivery', dateStr],
    queryFn: () =>
      productionRequestService.list({
        productionDate: dateStr,
        approvalStatus: 'APPROVED',
        size: 100,
      }),
    select: (raw: any) => {
      // Handle both array and paginated response
      const items = Array.isArray(raw) ? raw : raw?.content ?? raw?.data ?? [];
      return items;
    },
  });

  // ── Flatten all delivery items from all requests ───────────────────────────

  const deliveryItems: DeliveryItem[] = useMemo(() => {
    return (requests as any[]).flatMap((req: any) =>
      (req.lines ?? [])
        .filter((line: any) => !!line.deliveryRecord)
        .map((line: any) => ({
          lineId: line.id,
          requestCode: req.code ?? '',
          productName: line.product?.name ?? '—',
          productCode: line.product?.key ?? '',
          plannedQty: line.plannedQty ?? 0,
          deliveryRecord: line.deliveryRecord,
        })),
    );
  }, [requests]);

  const confirmedCount = deliveryItems.filter(
    (i) => i.deliveryRecord.deliveryStatus === 'CONFIRMED',
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
        queryKey: ['production-requests-delivery', dateStr],
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

  const handleConfirmClick = (item: DeliveryItem) => {
    const qty = inputMap[item.lineId]?.qty;
    if (qty === null || qty === undefined) {
      message.warning('Vui lòng nhập số lượng shop nhận');
      return;
    }
    setConfirmModalId(item.lineId);
  };

  const handleConfirmOk = (item: DeliveryItem) => {
    const entry = inputMap[item.lineId];
    if (!entry || entry.qty === null) return;
    confirmMutation.mutate({
      deliveryId: item.deliveryRecord.id,
      qtyReceived: entry.qty,
      note: entry.note || undefined,
    });
  };

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns: ColumnsType<DeliveryItem> = [
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
      title: 'Phiếu SX',
      dataIndex: 'requestCode',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Bếp làm',
      key: 'qtyProduced',
      align: 'right',
      width: 90,
      render: (_, row) => (
        <Text strong>{row.deliveryRecord.qtyProduced}</Text>
      ),
    },
    {
      title: 'Shop nhận',
      key: 'qtyReceived',
      align: 'right',
      width: 130,
      render: (_, row) => {
        if (row.deliveryRecord.deliveryStatus === 'CONFIRMED') {
          return <Text strong>{row.deliveryRecord.qtyReceived}</Text>;
        }
        return (
          <InputNumber
            min={0}
            max={row.deliveryRecord.qtyProduced * 2}
            value={inputMap[row.lineId]?.qty ?? null}
            placeholder="0"
            style={{ width: 90 }}
            onChange={(v) =>
              setInputMap((prev) => ({
                ...prev,
                [row.lineId]: {
                  qty: v,
                  note: prev[row.lineId]?.note ?? '',
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
        if (row.deliveryRecord.deliveryStatus !== 'CONFIRMED') return '—';
        const diff = row.deliveryRecord.discrepancy;
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
        const s = row.deliveryRecord.deliveryStatus;
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
        row.deliveryRecord.confirmedAt ? (
          <Text style={{ fontSize: 12 }}>
            {dayjs(row.deliveryRecord.confirmedAt).format('HH:mm:ss')}
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
        if (row.deliveryRecord.deliveryStatus === 'CONFIRMED') return null;
        return (
          <>
            <Button
              type="primary"
              size="small"
              onClick={() => handleConfirmClick(row)}
              loading={
                confirmMutation.isPending &&
                confirmModalId === row.lineId
              }
            >
              Xác nhận
            </Button>

            {/* Confirm modal */}
            {confirmModalId === row.lineId && (
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
                    <Text strong>{row.deliveryRecord.qtyProduced}</Text>
                  </div>
                  <div>
                    <Text>Shop nhận: </Text>
                    <Text strong style={{ color: '#1677ff' }}>
                      {inputMap[row.lineId]?.qty ?? 0}
                    </Text>
                  </div>
                  {(inputMap[row.lineId]?.qty ?? 0) !==
                    row.deliveryRecord.qtyProduced && (
                    <Alert
                      type="warning"
                      message="Số lượng không khớp với bếp — sẽ ghi nhận chênh lệch."
                      showIcon
                    />
                  )}
                  <div>
                    <Text type="secondary">Ghi chú (tuỳ chọn):</Text>
                    <Input
                      value={inputMap[row.lineId]?.note ?? ''}
                      onChange={(e) =>
                        setInputMap((prev) => ({
                          ...prev,
                          [row.lineId]: {
                            ...prev[row.lineId],
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
        <Table<DeliveryItem>
          dataSource={deliveryItems}
          columns={columns}
          rowKey="lineId"
          loading={isLoading}
          pagination={false}
          size="middle"
          rowClassName={(row) =>
            row.deliveryRecord.deliveryStatus === 'CONFIRMED'
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
