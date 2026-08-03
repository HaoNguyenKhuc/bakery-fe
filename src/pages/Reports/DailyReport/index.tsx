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
import deliveryRecordService from '../../../api/services/deliveryRecordService';
import posSaleService from '../../../api/services/posSaleService';
import type { DailyReport, DailyReportLine } from '../../../types/dailyReport';
import type { DeliveryRecordResponse } from '../../../types/deliveryRecord';

const { Title, Text } = Typography;

// ─── MergedRow type ───────────────────────────────────────────────────────────

interface MergedRow {
  /** UUID của Item (dùng để gọi /remaining API) */
  itemId: string;
  itemCode: string;
  itemName: string;
  /** Tồn hôm qua (qtyRemainingActual của báo cáo ngày hôm qua) */
  ydRemaining: number | null;
  /** Bếp SX — từ delivery-records */
  qtyProduced: number | null;
  /** Nhận trong ngày — từ delivery-records */
  qtyReceived: number | null;
  /** Còn lại — do nhân viên nhập (từ daily-report-lines) */
  qtyRemainingActual: number | null;
  /** Bán thực POS */
  qtySoldPos: number | null;
  /** id của DailyReportLine (để gọi /remaining với itemId đúng) */
  lineId?: string;
  note?: string;
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

function buildMergedRows(
  drData: DeliveryRecordResponse[],
  todayLines: DailyReportLine[],
  ydLines: DailyReportLine[],
): MergedRow[] {
  // Map yesterday's remaining by item.key (itemCode)
  const ydRemByCode: Record<string, number | null> = {};
  ydLines.forEach((l) => {
    if (l.item?.key) ydRemByCode[l.item.key] = l.qtyRemainingActual ?? null;
  });

  // Map today's lines by item.key
  const lineByCode: Record<string, DailyReportLine> = {};
  todayLines.forEach((l) => {
    if (l.item?.key) lineByCode[l.item.key] = l;
  });

  // Group delivery records by productCode
  const drByCode: Record<string, { qtyProduced: number; qtyReceived: number; productName: string }> = {};
  drData.forEach((dr) => {
    const code = dr.productCode;
    if (!code) return;
    if (!drByCode[code]) drByCode[code] = { qtyProduced: 0, qtyReceived: 0, productName: dr.productName ?? code };
    drByCode[code].qtyProduced += dr.qtyProduced ?? 0;
    drByCode[code].qtyReceived += dr.qtyReceived ?? 0;
  });

  const seen = new Set<string>();
  const rows: MergedRow[] = [];

  // 1. From delivery records
  Object.entries(drByCode).forEach(([code, dr]) => {
    if (seen.has(code)) return;
    seen.add(code);
    const line = lineByCode[code];
    rows.push({
      itemId: line?.item?.key ?? code, // fallback: use code — backend nhận itemId là UUID từ line
      itemCode: code,
      itemName: line ? (line.item?.name ?? dr.productName) : dr.productName,
      ydRemaining: ydRemByCode[code] ?? null,
      qtyProduced: dr.qtyProduced,
      qtyReceived: dr.qtyReceived,
      qtyRemainingActual: line?.qtyRemainingActual ?? null,
      qtySoldPos: line?.qtyActualPOS ?? null,
      lineId: line?.id,
      note: line?.note ?? '',
    });
  });

  // 2. From today lines (items not in DR yet)
  todayLines.forEach((l) => {
    const code = l.item?.key;
    if (!code || seen.has(code)) return;
    seen.add(code);
    rows.push({
      itemId: l.item?.key ?? code,
      itemCode: code,
      itemName: l.item?.name ?? code,
      ydRemaining: ydRemByCode[code] ?? null,
      qtyProduced: null,
      qtyReceived: null,
      qtyRemainingActual: l.qtyRemainingActual ?? null,
      qtySoldPos: l.qtyActualPOS ?? null,
      lineId: l.id,
      note: l.note ?? '',
    });
  });

  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : null;

const discColor = (v: number | null) =>
  v == null ? '#94a3b8' : Math.abs(v) > 0 ? '#dc2626' : '#059669';

// ─── Component ───────────────────────────────────────────────────────────────

const DailyReportPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Dayjs>(dayjs());
  // Track pending "Còn lại" edits (itemCode → qty)
  const [remainingMap, setRemainingMap] = useState<Record<string, number | null>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');
  const yesterday = date.subtract(1, 'day').format('YYYY-MM-DD');

  // ── Step 1: Init report (idempotent) ────────────────────────────────────────

  const {
    data: report,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery<DailyReport>({
    queryKey: ['daily-report', dateStr],
    queryFn: () => dailyReportService.init(dateStr),
  });

  const isFinalized = report?.status === 'FINALIZED';
  const isDraft = report?.status === 'DRAFT';

  // ── Step 2a: Delivery records for the date ───────────────────────────────────

  const { data: drData = [], isLoading: drLoading } = useQuery<DeliveryRecordResponse[]>({
    queryKey: ['delivery-records', dateStr],
    queryFn: () => deliveryRecordService.getList(dateStr),
    enabled: !!report?.id,
    retry: false,
  });

  // ── Step 2b: Today's report lines ────────────────────────────────────────────

  const { data: todayLines = [], isLoading: linesLoading } = useQuery<DailyReportLine[]>({
    queryKey: ['daily-report-lines', report?.id],
    queryFn: () => dailyReportService.getLines(report!.id),
    enabled: !!report?.id,
  });

  // ── Step 2c: Yesterday's report (for opening stock) ─────────────────────────

  const { data: ydReport } = useQuery<DailyReport | null>({
    queryKey: ['daily-report-yd', yesterday],
    queryFn: () => dailyReportService.getByDate(yesterday).catch(() => null),
    enabled: !!report?.id,
    retry: false,
  });

  // ── Step 3: Yesterday's lines ────────────────────────────────────────────────

  const { data: ydLines = [] } = useQuery<DailyReportLine[]>({
    queryKey: ['daily-report-lines', ydReport?.id],
    queryFn: () => dailyReportService.getLines(ydReport!.id),
    enabled: !!ydReport?.id,
    retry: false,
  });

  // ── Step 2d: POS sales (optional) ────────────────────────────────────────────

  useQuery({
    queryKey: ['pos-sales', dateStr],
    queryFn: () => posSaleService.getBySaleDate(dateStr).catch(() => []),
    enabled: !!report?.id,
    retry: false,
  });

  // ── Step 4: Merge rows ────────────────────────────────────────────────────────

  const mergedRows = useMemo(
    () => buildMergedRows(drData, todayLines, ydLines),
    [drData, todayLines, ydLines],
  );

  // Split cancel lines (from todayLines, isCancelItem flag)
  const cancelLines = useMemo(
    () => todayLines.filter((l) => l.isCancelItem),
    [todayLines],
  );

  const isLoading = reportLoading || drLoading || linesLoading;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const remainingMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      dailyReportService.updateRemaining(report!.id, itemId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report-lines', report?.id] });
      message.success('Đã lưu số lượng còn lại');
    },
    onError: () => message.error('Lưu thất bại'),
    onSettled: () => setSavingKey(null),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => dailyReportService.finalize(report!.id),
    onSuccess: () => {
      message.success('Đã chốt báo cáo ngày!');
      queryClient.invalidateQueries({ queryKey: ['daily-report', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['daily-report-lines', report?.id] });
    },
    onError: () => message.error('Chốt báo cáo thất bại'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const goDate = useCallback((delta: number) => {
    setDate((d) => d.add(delta, 'day'));
    setRemainingMap({});
  }, []);

  const handleSaveRemaining = useCallback(
    (itemCode: string, itemId: string) => {
      const qty = remainingMap[itemCode];
      if (qty === null || qty === undefined) return;
      setSavingKey(itemCode);
      remainingMutation.mutate({ itemId, qty });
    },
    [remainingMap, remainingMutation],
  );

  const handleFinalize = () => {
    Modal.confirm({
      title: 'Chốt báo cáo ngày?',
      icon: <ExclamationCircleOutlined />,
      content: 'Sau khi chốt, dữ liệu sẽ được khoá và không thể chỉnh sửa thêm. Hệ thống sẽ tự động tạo kế hoạch SX ngày mai.',
      okText: 'Chốt báo cáo',
      cancelText: 'Huỷ',
      okType: 'primary',
      onOk: () => finalizeMutation.mutate(),
    });
  };

  // ── Summary stats ─────────────────────────────────────────────────────────────

  const totalSX = mergedRows.reduce((s, r) => s + (r.qtyProduced ?? 0), 0);
  const totalReceived = mergedRows.reduce((s, r) => s + (r.qtyReceived ?? 0), 0);
  const totalRemaining = mergedRows.reduce((s, r) => s + (r.qtyRemainingActual ?? 0), 0);

  // ── Main table columns ────────────────────────────────────────────────────────

  const mainColumns: ColumnsType<MergedRow> = [
    {
      title: 'Sản Phẩm',
      key: 'product',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.itemName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.itemCode}</Text>
        </div>
      ),
    },
    {
      title: <span style={{ color: '#64748b' }}>Tồn hôm qua</span>,
      key: 'ydRemaining',
      align: 'right',
      width: 105,
      render: (_, r) =>
        r.ydRemaining != null ? (
          <Text style={{ color: '#64748b' }}>{fmt(r.ydRemaining)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: <span style={{ color: '#059669' }}>Bếp SX</span>,
      key: 'qtyProduced',
      align: 'right',
      width: 85,
      render: (_, r) =>
        r.qtyProduced != null ? (
          <Text strong style={{ color: '#059669' }}>{fmt(r.qtyProduced)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: <span style={{ color: '#2563eb' }}>Nhận trong ngày</span>,
      key: 'qtyReceived',
      align: 'right',
      width: 120,
      render: (_, r) =>
        r.qtyReceived != null ? (
          <Text style={{ color: '#2563eb' }}>{fmt(r.qtyReceived)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: (
        <Tooltip title="Bếp SX − Nhận trong ngày">
          <span style={{ color: '#dc2626' }}>Lệch SX/Nhận</span>
        </Tooltip>
      ),
      key: 'lechSX',
      align: 'right',
      width: 110,
      render: (_, r) => {
        const v =
          r.qtyProduced != null && r.qtyReceived != null
            ? r.qtyProduced - r.qtyReceived
            : null;
        return v != null ? (
          <Text strong style={{ color: discColor(v) }}>{fmt(v)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: (
        <Tooltip title="Nhân viên nhập sau khi đếm thực tế ở Kho Bếp">
          <span style={{ color: '#7c3aed' }}>Còn lại *</span>
        </Tooltip>
      ),
      key: 'conLai',
      align: 'right',
      width: 120,
      render: (_, row) => {
        if (isFinalized) {
          return row.qtyRemainingActual != null ? (
            <Text strong style={{ color: '#7c3aed' }}>{fmt(row.qtyRemainingActual)}</Text>
          ) : (
            <Text type="secondary">—</Text>
          );
        }
        return (
          <InputNumber
            min={0}
            step={0.5}
            size="small"
            style={{ width: 80, textAlign: 'right', borderColor: '#7c3aed' }}
            value={
              remainingMap[row.itemCode] !== undefined
                ? remainingMap[row.itemCode]
                : row.qtyRemainingActual
            }
            placeholder="0"
            loading={savingKey === row.itemCode}
            onChange={(v) =>
              setRemainingMap((prev) => ({ ...prev, [row.itemCode]: v }))
            }
            onBlur={() => handleSaveRemaining(row.itemCode, row.itemId)}
            onPressEnter={() => handleSaveRemaining(row.itemCode, row.itemId)}
          />
        );
      },
    },
    {
      title: (
        <Tooltip title="Nhận trong ngày − Còn lại">
          <span style={{ color: '#0891b2' }}>Bán dự tính</span>
        </Tooltip>
      ),
      key: 'banDuTinh',
      align: 'right',
      width: 105,
      render: (_, r) => {
        const v =
          r.qtyReceived != null && r.qtyRemainingActual != null
            ? r.qtyReceived - r.qtyRemainingActual
            : null;
        return v != null ? (
          <Text style={{ color: '#0891b2' }}>{fmt(v)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: (
        <Tooltip title="Từ máy POS">
          <span style={{ color: '#b45309' }}>Bán thực (POS)</span>
        </Tooltip>
      ),
      key: 'qtySoldPos',
      align: 'right',
      width: 115,
      render: (_, r) =>
        r.qtySoldPos != null ? (
          <Text strong style={{ color: '#b45309' }}>{fmt(r.qtySoldPos)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: (
        <Tooltip title="Bán dự tính − Bán thực POS">
          <span>Lệch POS</span>
        </Tooltip>
      ),
      key: 'lechPOS',
      align: 'right',
      width: 90,
      render: (_, r) => {
        const banDuTinh =
          r.qtyReceived != null && r.qtyRemainingActual != null
            ? r.qtyReceived - r.qtyRemainingActual
            : null;
        const v =
          banDuTinh != null && r.qtySoldPos != null
            ? banDuTinh - r.qtySoldPos
            : null;
        return v != null ? (
          <Text strong style={{ color: discColor(v) }}>
            {v > 0 ? `+${fmt(v)}` : fmt(v)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
  ];

  // ── Cancel lines columns ──────────────────────────────────────────────────────

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
          <Text type="danger" strong>{cancel}</Text>
        ) : (
          <Text>0</Text>
        );
      },
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: () => (
        <Text type="secondary" style={{ fontStyle: 'italic' }}>tùy chọn</Text>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

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
            {report && isDraft && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={finalizeMutation.isPending}
                onClick={handleFinalize}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                ✅ Chốt báo cáo
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
            onClick={() => refetchReport()}
            loading={isLoading}
          />
        </Space>

        {/* ─── Report title & status ───────────────────────────────────── */}
        {report && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Báo cáo{' '}
            <Text strong>{date.format('DD/MM/YYYY')}</Text>
            {isFinalized && report.finalizedBy && (
              <Text type="secondary"> — Đã chốt bởi {report.finalizedBy}</Text>
            )}
            {isFinalized && (
              <Text type="secondary"> · Không thể chỉnh sửa</Text>
            )}
          </Text>
        )}

        {/* ─── Summary stats ───────────────────────────────────────────── */}
        {mergedRows.length > 0 && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={12} md={6}>
                <Statistic
                  title="Bếp SX"
                  value={totalSX}
                  suffix="cái"
                  valueStyle={{ fontSize: 18, color: '#059669' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Nhận trong ngày"
                  value={totalReceived}
                  suffix="cái"
                  valueStyle={{ fontSize: 18, color: '#2563eb' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Còn lại"
                  value={totalRemaining}
                  suffix="cái"
                  valueStyle={{ fontSize: 18, color: '#7c3aed' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Sản phẩm"
                  value={mergedRows.length}
                  suffix="loại"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '0 0 16px' }} />
          </>
        )}

        {/* ─── Main report table ───────────────────────────────────────── */}
        <Table<MergedRow>
          dataSource={mergedRows}
          columns={mainColumns}
          rowKey="itemCode"
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
            isDraft && mergedRows.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={9}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ padding: '4px 12px' }}
                    message={
                      <Text style={{ fontSize: 12 }}>
                        💡 <Text strong>"Còn lại"</Text> do nhân viên nhập sau khi đếm thực tế.
                        Bấm{' '}
                        <Text strong>✅ Chốt báo cáo</Text> để tổng hợp chính thức.
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
