import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space, Tag,
  InputNumber, message, Alert, Row, Col, Modal, Divider,
  Tooltip, Empty, Statistic,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
  CheckOutlined, LockOutlined, FileTextOutlined,
  DeleteOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import dailyReportService from '../../../api/services/dailyReportService';
import type { DailyReport, DailyReportLine } from '../../../types/dailyReport';

const { Title, Text } = Typography;

// ─── Component ───────────────────────────────────────────────────────────────

const DailyReportPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Dayjs>(dayjs());
  // Track pending "Còn lại" edits (lineId → qty)
  const [remainingMap, setRemainingMap] = useState<
    Record<string, number | null>
  >({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');

  // ── Init + Fetch ─────────────────────────────────────────────────────────────

  const {
    data: report,
    isLoading: reportLoading,
    refetch,
  } = useQuery<DailyReport>({
    queryKey: ['daily-report', dateStr],
    queryFn: async () => {
      const r = await dailyReportService.init(dateStr);
      return r;
    },
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery<
    DailyReportLine[]
  >({
    queryKey: ['daily-report-lines', report?.id],
    queryFn: () => dailyReportService.getLines(report!.id),
    enabled: !!report?.id,
  });

  const isLoading = reportLoading || linesLoading;
  const isFinalized = report?.status === 'FINALIZED';

  // ── Split lines: main vs cancel (shelf_days = 0) ─────────────────────────

  const mainLines = useMemo(
    () => lines.filter((l) => !l.isCancelItem),
    [lines],
  );
  const cancelLines = useMemo(
    () => lines.filter((l) => l.isCancelItem),
    [lines],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────

  const remainingMutation = useMutation({
    mutationFn: ({
      lineId,
      qty,
    }: {
      lineId: string;
      qty: number;
    }) => dailyReportService.updateRemaining(report!.id, lineId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['daily-report-lines', report?.id],
      });
    },
    onError: () => message.error('Lưu thất bại'),
    onSettled: () => setSavingLineId(null),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => dailyReportService.finalize(report!.id),
    onSuccess: () => {
      message.success('Đã chốt báo cáo ngày!');
      queryClient.invalidateQueries({ queryKey: ['daily-report', dateStr] });
      queryClient.invalidateQueries({
        queryKey: ['daily-report-lines', report?.id],
      });
    },
    onError: () => message.error('Chốt báo cáo thất bại'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const goDate = useCallback(
    (delta: number) => {
      setDate((d) => d.add(delta, 'day'));
      setRemainingMap({});
    },
    [],
  );

  const handleSaveRemaining = useCallback(
    async (lineId: string) => {
      const qty = remainingMap[lineId];
      if (qty === null || qty === undefined) return;
      setSavingLineId(lineId);
      remainingMutation.mutate({ lineId, qty });
    },
    [remainingMap, remainingMutation],
  );

  const handleFinalize = () => {
    Modal.confirm({
      title: 'Chốt báo cáo ngày?',
      icon: <ExclamationCircleOutlined />,
      content:
        'Sau khi chốt, dữ liệu sẽ được khoá và không thể chỉnh sửa thêm.',
      okText: 'Chốt báo cáo',
      cancelText: 'Huỷ',
      okType: 'primary',
      onOk: () => finalizeMutation.mutate(),
    });
  };

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalSX = mainLines.reduce((s, l) => s + (l.qtyProduced ?? 0), 0);
  const totalPOS = mainLines.reduce((s, l) => s + (l.qtyActualPOS ?? 0), 0);
  const totalRemaining = mainLines.reduce(
    (s, l) => s + (l.qtyRemainingActual ?? 0),
    0,
  );

  // ── Main table columns ────────────────────────────────────────────────────

  const mainColumns: ColumnsType<DailyReportLine> = [
    {
      title: 'Sản Phẩm',
      key: 'product',
      width: 200,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {r.item.name}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.item.key}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tồn hôm qua',
      dataIndex: 'qtyOpenPrev',
      align: 'right',
      width: 100,
      render: (v) =>
        v !== undefined && v !== null ? v : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Bếp SX',
      dataIndex: 'qtyProduced',
      align: 'right',
      width: 80,
      render: (v) => <Text style={{ color: '#52c41a' }}>{v ?? 0}</Text>,
    },
    {
      title: 'Nhận trong ngày',
      dataIndex: 'qtyReceivedShop',
      align: 'right',
      width: 115,
      render: (v) => <Text style={{ color: '#1677ff' }}>{v ?? 0}</Text>,
    },
    {
      title: 'Lệch SX/Nhận',
      dataIndex: 'qtyDiscrepancy',
      align: 'right',
      width: 110,
      render: (v) => {
        if (v === undefined || v === null) return '—';
        return (
          <Text type={v !== 0 ? 'danger' : undefined}>{v}</Text>
        );
      },
    },
    {
      title: () => (
        <Tooltip title="Nhân viên nhập sau khi đếm thực tế ở Kho Bếp">
          <span>Còn lại *</span>
        </Tooltip>
      ),
      key: 'conLai',
      align: 'right',
      width: 110,
      render: (_, row) => {
        if (isFinalized) {
          return row.qtyRemainingActual !== undefined ? (
            <Text strong>{row.qtyRemainingActual}</Text>
          ) : (
            <Text type="secondary">—</Text>
          );
        }
        return (
          <InputNumber
            min={0}
            size="small"
            style={{ width: 80 }}
            value={
              remainingMap[row.id] !== undefined
                ? remainingMap[row.id]
                : row.qtyRemainingActual
            }
            placeholder="0"
            loading={savingLineId === row.id}
            onChange={(v) =>
              setRemainingMap((prev) => ({ ...prev, [row.id]: v }))
            }
            onBlur={() => handleSaveRemaining(row.id)}
            onPressEnter={() => handleSaveRemaining(row.id)}
          />
        );
      },
    },
    {
      title: 'Bán dự tính',
      dataIndex: 'qtyExpectedSale',
      align: 'right',
      width: 100,
      render: (v) =>
        v !== undefined ? v : <Text type="secondary">—</Text>,
    },
    {
      title: 'Bán thực (POS)',
      dataIndex: 'qtyActualPOS',
      align: 'right',
      width: 115,
      render: (v) =>
        v !== undefined ? (
          <Text strong>{v}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Lệch POS',
      dataIndex: 'qtyPOSDiscrepancy',
      align: 'right',
      width: 90,
      render: (v) => {
        if (v === undefined || v === null) return '—';
        return (
          <Text type={v !== 0 ? 'danger' : undefined}>
            {v !== 0 ? (v > 0 ? `+${v}` : v) : '0'}
          </Text>
        );
      },
    },
  ];

  // ── Cancel lines columns ──────────────────────────────────────────────────

  const cancelColumns: ColumnsType<DailyReportLine> = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, r) => (
        <div>
          <Text strong>{r.item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item.key}</Text>
        </div>
      ),
    },
    {
      title: 'Nhận trong ngày',
      dataIndex: 'qtyReceivedShop',
      align: 'right',
      width: 130,
    },
    {
      title: 'Còn lại cuối ngày',
      dataIndex: 'qtyRemainingActual',
      align: 'right',
      width: 140,
      render: (v) =>
        v !== undefined ? (
          <Text>{v}</Text>
        ) : (
          <Text type="secondary">chưa nhập</Text>
        ),
    },
    {
      title: 'Số lượng hủy',
      align: 'right',
      width: 120,
      render: (_, r) => {
        const cancel = r.qtyRemainingActual ?? 0;
        return cancel > 0 ? (
          <Text type="danger" strong>
            {cancel}
          </Text>
        ) : (
          <Text>0</Text>
        );
      },
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: () => (
        <Text type="secondary" style={{ fontStyle: 'italic' }}>
          tùy chọn
        </Text>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      {/* ─── Page header ──────────────────────────────────────────────── */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            Báo cáo ngày
          </Title>
        </Col>
        <Col>
          <Space>
            {report && (
              <Tag
                color={isFinalized ? 'green' : 'orange'}
                icon={isFinalized ? <LockOutlined /> : undefined}
                style={{ padding: '4px 12px', fontSize: 13 }}
              >
                {isFinalized ? 'Đã chốt' : 'Draft'}
              </Tag>
            )}
            {report && !isFinalized && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={finalizeMutation.isPending}
                onClick={handleFinalize}
              >
                Chốt báo cáo
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Card>
        {/* ─── Date navigation ────────────────────────────────────────── */}
        <Space style={{ marginBottom: 16 }}>
          <Tooltip title="Hôm trước">
            <Button icon={<LeftOutlined />} onClick={() => goDate(-1)} />
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

        {/* ─── Report title ────────────────────────────────────────────── */}
        {report && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Báo cáo{' '}
            <Text strong>{date.format('YYYY-MM-DD')}</Text>
            {isFinalized && (
              <Text type="secondary"> — Đã chốt, không thể chỉnh sửa</Text>
            )}
          </Text>
        )}

        {/* ─── Summary stats ───────────────────────────────────────────── */}
        {mainLines.length > 0 && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="Bếp SX"
                  value={totalSX}
                  suffix="cái"
                  valueStyle={{ fontSize: 18, color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Bán thực (POS)"
                  value={totalPOS}
                  suffix="cái"
                  valueStyle={{ fontSize: 18, color: '#1677ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Còn lại"
                  value={totalRemaining}
                  suffix="cái"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Sản phẩm"
                  value={mainLines.length}
                  suffix="loại"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '0 0 16px' }} />
          </>
        )}

        {/* ─── Main report table ───────────────────────────────────────── */}
        <Table<DailyReportLine>
          dataSource={mainLines}
          columns={mainColumns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1050 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">
                    Chưa có dữ liệu SX / giao nhận cho ngày{' '}
                    <Text strong>{date.format('DD/MM/YYYY')}</Text>
                  </Text>
                }
              />
            ),
          }}
          summary={() =>
            !isFinalized && mainLines.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={9}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ padding: '4px 12px' }}
                    message={
                      <Text style={{ fontSize: 12 }}>
                        💡 <Text strong>"Còn lại"</Text> do nhân viên nhập ở màn
                        hình Kho Bếp. Bấm{' '}
                        <Text strong>Chốt báo cáo</Text> để tổng hợp chính thức.
                      </Text>
                    }
                  />
                </Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null
          }
        />

        {/* ─── Cancel lines section ────────────────────────────────────── */}
        {cancelLines.length > 0 && (
          <>
            <Divider style={{ margin: '24px 0 16px' }} />
            <div style={{ marginBottom: 12 }}>
              <Space>
                <DeleteOutlined style={{ color: '#ff4d4f' }} />
                <Text strong style={{ fontSize: 14, color: '#ff4d4f' }}>
                  Hủy bánh hôm nay
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Bánh tươi trong ngày (shelf_days = 0) — phải hủy cuối ngày
                </Text>
              </Space>
            </div>
            <Table<DailyReportLine>
              dataSource={cancelLines}
              columns={cancelColumns}
              rowKey="id"
              pagination={false}
              size="small"
              rowClassName="cancel-row"
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default DailyReportPage;
