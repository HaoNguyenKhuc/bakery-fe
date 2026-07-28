import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space, Tag,
  InputNumber, message, Alert, Row, Col, Divider,
  Tooltip, Empty, Statistic, Collapse, Steps,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
  CheckOutlined, LockOutlined, FileTextOutlined,
  DeleteOutlined, ArrowRightOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import dailyReportService from '../../../api/services/dailyReportService';
import deliveryRecordService from '../../../api/services/deliveryRecordService';
import posSaleService from '../../../api/services/posSaleService';
import type { DailyReport, DailyReportLine } from '../../../types/dailyReport';

const { Title, Text } = Typography;

// ─── View State ──────────────────────────────────────────────────────────────
// 'report'  → Báo cáo chính (DRAFT: editable / FINALIZED: read-only)
// 'cancel'  → Bước 1: Nhập số hủy bánh  (chỉ khi DRAFT)
// 'confirm' → Bước 2: Tóm tắt & xác nhận chốt  (chỉ khi DRAFT)
type ViewState = 'report' | 'cancel' | 'confirm';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtNum = (v: number | null | undefined, fallback = '—') =>
  v !== null && v !== undefined ? String(v) : fallback;

const discrepancyColor = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '#94a3b8';
  return Math.abs(v) > 0 ? '#dc2626' : '#059669';
};

// ─── Component ────────────────────────────────────────────────────────────────
const StoreDailyReport: React.FC = () => {
  const queryClient = useQueryClient();

  // ── Date & View State ──────────────────────────────────────────────────────
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [view, setView] = useState<ViewState>('report');
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);

  // cancelMap: lineId → qtyCancelled (edited locally in Bước 1)
  const [cancelMap, setCancelMap] = useState<Record<string, number>>({});
  const [isSavingCancel, setIsSavingCancel] = useState(false);

  // remainingMap: lineId → qty (optimistic edit before blur-save)
  const [remainingMap, setRemainingMap] = useState<Record<string, number | null>>({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');

  // Khi đổi ngày → reset view + maps
  const handleDateChange = useCallback((d: Dayjs) => {
    setDate(d);
    setLoadedReportId(null); // Force re-init of view for new date
    setCancelMap({});
    setRemainingMap({});
  }, []);

  const goDate = useCallback((delta: number) => {
    handleDateChange(date.add(delta, 'day'));
  }, [date, handleDateChange]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: report,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery<DailyReport>({
    queryKey: ['store-daily-report', dateStr],
    queryFn: () => dailyReportService.init(dateStr),
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery<DailyReportLine[]>({
    queryKey: ['store-daily-report-lines', report?.id],
    queryFn: () => dailyReportService.getLines(report!.id),
    enabled: !!report?.id,
  });

  const { data: cancelList = [], isLoading: cancelLoading, refetch: refetchCancel } =
    useQuery<DailyReportLine[]>({
      queryKey: ['store-cancel-list', report?.id],
      queryFn: () => dailyReportService.getCancelList(report!.id),
      enabled: !!report?.id,
    });

  // ── Extra queries for computing data in DRAFT ─────────────────────────────
  const yesterdayStr = date.subtract(1, 'day').format('YYYY-MM-DD');
  const isFinalized = report?.status === 'FINALIZED';

  const { data: yesterdayReport } = useQuery<DailyReport>({
    queryKey: ['store-daily-report-yesterday', yesterdayStr],
    queryFn: () => dailyReportService.getByDate(yesterdayStr),
    retry: false,
    enabled: view === 'report' || isFinalized,
  });

  const { data: ydLines = [], isLoading: ydLinesLoading } = useQuery<DailyReportLine[]>({
    queryKey: ['store-daily-report-lines', yesterdayReport?.id],
    queryFn: () => dailyReportService.getLines(yesterdayReport!.id),
    enabled: !!yesterdayReport?.id && (view === 'report' || isFinalized),
  });

  const { data: drData = [], isLoading: drLoading } = useQuery({
    queryKey: ['delivery-records', dateStr],
    queryFn: () => deliveryRecordService.getList(dateStr),
    enabled: view === 'report' || isFinalized,
  });

  const { data: posData = [], isLoading: posLoading } = useQuery({
    queryKey: ['pos-sales', dateStr],
    queryFn: () => posSaleService.getBySaleDate(dateStr),
    enabled: view === 'report' || isFinalized,
  });

  const isLoading = reportLoading || linesLoading || ydLinesLoading || drLoading || posLoading;

  // Initialize view state exactly once per report load
  useEffect(() => {
    if (report?.id && loadedReportId !== report.id && !cancelLoading) {
      if (report.status === 'FINALIZED') {
        setView('report');
      } else {
        setView('cancel'); // Step 1 for DRAFT
      }
      setLoadedReportId(report.id);
      
      const initMap: Record<string, number> = {};
      cancelList.forEach((line) => {
        initMap[line.id] = line.qtyCancelled ?? line.qtyRemainingActual ?? 0;
      });
      setCancelMap(initMap);
    }
  }, [report?.id, report?.status, cancelList, cancelLoading, loadedReportId]);

  // Split lines
  const rawMainLines = useMemo(() => lines.filter((l) => !l.isCancelItem), [lines]);

  // Compute merged lines for DRAFT mode
  const computedLines = useMemo(() => {
    if (isFinalized) return rawMainLines;

    // 1. Tồn hôm qua
    const ydRemaining: Record<string, number> = {};
    ydLines.forEach((l) => {
      if (l.item?.key && l.qtyRemainingActual != null) {
        ydRemaining[l.item.key] = l.qtyRemainingActual;
      }
    });

    // 2. POS sales
    const posByCode: Record<string, number> = {};
    posData.forEach((ps) => {
      const code = (ps as any).itemId || ps.exCode; // Fallback to exCode
      if (!code) return;
      posByCode[code] = (posByCode[code] || 0) + (ps.qtySold ?? 0);
    });

    // 3. Delivery records
    const drByCode: Record<string, { produced: number; received: number }> = {};
    drData.forEach((dr) => {
      const code = dr.productCode;
      if (!code) return;
      if (!drByCode[code]) drByCode[code] = { produced: 0, received: 0 };
      drByCode[code].produced += dr.qtyProduced ?? 0;
      drByCode[code].received += dr.qtyReceived ?? 0;
    });

    return rawMainLines.map((line) => {
      const code = line.item?.key || '';
      
      const produced = drByCode[code]?.produced ?? null;
      const received = drByCode[code]?.received ?? null;
      const openPrev = ydRemaining[code] ?? null;
      const qtySoldPos = line.qtyActualPOS ?? posByCode[code] ?? posByCode[(line as any).item?.id] ?? null;

      // Discrepancy
      const qtyDiscrepancy = (produced != null && received != null) ? produced - received : null;
      const qtyExpectedSale = (received != null && line.qtyRemainingActual != null) ? received - line.qtyRemainingActual : null;
      const discrepancyPos = (qtyExpectedSale != null && qtySoldPos != null) ? qtyExpectedSale - qtySoldPos : null;

      return {
        ...line,
        qtyOpenPrev: openPrev ?? line.qtyOpenPrev,
        qtyProduced: produced ?? line.qtyProduced,
        qtyReceivedShop: received ?? line.qtyReceivedShop,
        qtyActualPOS: qtySoldPos ?? line.qtyActualPOS,
        qtyDiscrepancy: qtyDiscrepancy ?? line.qtyDiscrepancy,
        qtyExpectedSale: qtyExpectedSale ?? line.qtyExpectedSale,
        qtyPOSDiscrepancy: discrepancyPos ?? line.qtyPOSDiscrepancy,
      };
    });
  }, [rawMainLines, isFinalized, ydLines, posData, drData]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalSX = computedLines.reduce((s, l) => s + (l.qtyProduced ?? 0), 0);
  const totalPOS = computedLines.reduce((s, l) => s + (l.qtyActualPOS ?? 0), 0);
  const totalRemain = computedLines.reduce((s, l) => s + (l.qtyRemainingActual ?? 0), 0);
  const totalCancel = useMemo(
    () => Object.values(cancelMap).reduce((s, v) => s + v, 0),
    [cancelMap],
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const remainingMutation = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      dailyReportService.updateRemaining(report!.id, lineId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-daily-report-lines', report?.id] });
    },
    onError: () => message.error('Lưu "Còn lại" thất bại'),
    onSettled: () => setSavingLineId(null),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => dailyReportService.finalize(report!.id),
    onSuccess: () => {
      message.success('✅ Đã chốt báo cáo ngày!');
      setView('report');
      setCancelMap({});
      queryClient.invalidateQueries({ queryKey: ['store-daily-report', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['store-daily-report-lines', report?.id] });
      queryClient.invalidateQueries({ queryKey: ['store-cancel-list', report?.id] });
    },
    onError: () => message.error('Chốt báo cáo thất bại'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveRemaining = useCallback(
    (lineId: string) => {
      const qty = remainingMap[lineId];
      if (qty === null || qty === undefined) return;
      setSavingLineId(lineId);
      remainingMutation.mutate({ lineId, qty });
    },
    [remainingMap, remainingMutation],
  );

  // Mở Bước 1: init cancelMap từ cancel-list hiện tại
  const handleOpenCancel = useCallback(() => {
    const initMap: Record<string, number> = {};
    cancelList.forEach((line) => {
      initMap[line.id] = line.qtyCancelled ?? line.qtyRemainingActual ?? 0;
    });
    setCancelMap(initMap);
    setView('cancel');
  }, [cancelList]);

  // Bước 1 → Bước 2: save tất cả cancel rồi chuyển view
  const handleNextToConfirm = useCallback(async () => {
    if (!report?.id) return;
    setIsSavingCancel(true);
    try {
      await Promise.all(
        Object.entries(cancelMap).map(([lineId, qty]) =>
          dailyReportService.updateCancel(report.id, lineId, qty),
        ),
      );
      await refetchCancel();
      setView('report');
    } catch {
      message.error('Lưu số lượng hủy thất bại. Vui lòng thử lại.');
    } finally {
      setIsSavingCancel(false);
    }
  }, [report?.id, cancelMap, refetchCancel]);

  // ── Table columns: Báo cáo chính ──────────────────────────────────────────
  const mainColumns: ColumnsType<DailyReportLine> = [
    {
      title: 'Sản Phẩm',
      key: 'product',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item.key}</Text>
        </div>
      ),
    },
    {
      title: 'Tồn hôm qua',
      dataIndex: 'qtyOpenPrev',
      align: 'right',
      width: 105,
      render: (v) => v != null ? v : <Text type="secondary">—</Text>,
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
      width: 120,
      render: (v) => <Text style={{ color: '#1677ff' }}>{v ?? 0}</Text>,
    },
    {
      title: 'Lệch SX/Nhận',
      dataIndex: 'qtyDiscrepancy',
      align: 'right',
      width: 110,
      render: (v) => {
        if (v == null) return <Text type="secondary">—</Text>;
        return <Text type={v !== 0 ? 'danger' : undefined}>{v}</Text>;
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
      width: 115,
      render: (_, row) => {
        const isReadOnly = isFinalized;
        if (isReadOnly) {
          return row.qtyRemainingActual != null
            ? <Text strong>{row.qtyRemainingActual}</Text>
            : <Text type="secondary">—</Text>;
        }
        return (
          <InputNumber
            min={0}
            size="small"
            style={{ width: 80 }}
            value={remainingMap[row.id] !== undefined ? remainingMap[row.id] : row.qtyRemainingActual}
            placeholder="0"
            loading={savingLineId === row.id}
            onChange={(v) => setRemainingMap((prev) => ({ ...prev, [row.id]: v }))}
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
      render: (v) => v != null ? <Text style={{ color: '#0891b2' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Bán thực (POS)',
      dataIndex: 'qtyActualPOS',
      align: 'right',
      width: 120,
      render: (v) => v != null ? <Text style={{ color: '#b45309' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lệch POS',
      dataIndex: 'qtyPOSDiscrepancy',
      align: 'right',
      width: 100,
      render: (v) => {
        if (v == null) return <Text type="secondary">—</Text>;
        const color = Math.abs(v) > 0 ? '#dc2626' : '#059669';
        const weight = Math.abs(v) > 0 ? 600 : 400;
        return <Text style={{ color, fontWeight: weight }}>{v}</Text>;
      },
    },
  ];

  // ── Table columns: Hủy bánh (read-only preview in view='report') ───────────
  const cancelPreviewColumns: ColumnsType<DailyReportLine> = [
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
      title: <span style={{ color: '#dc2626', fontSize: 11 }}>Mã cần hủy (EX_CODE)</span>,
      key: 'exCodes',
      render: (_, r) => (r.expiringExCodes?.length ?? 0) > 0
        ? r.expiringExCodes!.map((ec) => (
            <Tag key={ec} color="red" style={{ fontSize: 11, marginBottom: 2 }}>{ec}</Tag>
          ))
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhận trong ngày',
      dataIndex: 'qtyReceivedShop',
      align: 'right',
      width: 130,
      render: (v) => <Text style={{ color: '#1677ff' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'Tồn cuối ngày',
      dataIndex: 'qtyRemainingActual',
      align: 'right',
      width: 120,
      render: (v) => v != null
        ? <Text strong style={{ color: '#7c3aed' }}>{v}</Text>
        : <Text type="secondary" style={{ color: '#f59e0b' }}>chưa nhập</Text>,
    },
    {
      title: 'Đã hủy',
      dataIndex: 'qtyCancelled',
      align: 'right',
      width: 100,
      render: (v) => v != null
        ? <Text strong type="danger">{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    ...(isFinalized ? [{
      title: 'Lệch hủy',
      key: 'diff',
      align: 'right' as const,
      width: 100,
      render: (_: unknown, r: DailyReportLine) => {
        const diff = r.discrepancyCancelQty ?? null;
        if (diff === null) return <Text type="secondary">—</Text>;
        if (diff === 0) return <Text style={{ color: '#059669', fontSize: 12 }}>✓ Khớp</Text>;
        return (
          <Text style={{ color: diff < 0 ? '#dc2626' : '#f59e0b', fontWeight: 600, fontSize: 12 }}>
            {diff < 0 ? `▼ ${Math.abs(diff)}` : `▲ ${diff}`}
          </Text>
        );
      },
    }] : []),
  ];

  // ── Table columns: Hủy bánh editable (Bước 1) ─────────────────────────────
  const cancelEditColumns: ColumnsType<DailyReportLine> = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, r) => (
        <div>
          <Text strong>{r.item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item.key}</Text>
          {(r.expiringProductionDates?.length ?? 0) > 0 && (
            <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
              {r.expiringProductionDates!.map((d) => {
                const exp = new Date(d);
                exp.setDate(exp.getDate() + (r.shelfDays ?? 0));
                return `SX ${d} → HSD ${exp.toISOString().slice(0, 10)}`;
              }).join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: <span style={{ color: '#dc2626', fontSize: 11 }}>Mã cần hủy (EX_CODE)</span>,
      key: 'exCodes',
      render: (_, r) => (r.expiringExCodes?.length ?? 0) > 0
        ? r.expiringExCodes!.map((ec) => (
            <Tag key={ec} color="red" style={{ fontSize: 11, marginBottom: 2 }}>{ec}</Tag>
          ))
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhận trong ngày',
      dataIndex: 'qtyReceivedShop',
      align: 'right',
      width: 130,
      render: (v) => <Text style={{ color: '#1677ff' }}>{fmtNum(v)}</Text>,
    },
    {
      title: () => (
        <span>
          Tồn cuối ngày<br />
          <small style={{ fontWeight: 400, color: '#94a3b8' }}>(HT dự kiến hủy)</small>
        </span>
      ),
      dataIndex: 'qtyRemainingActual',
      align: 'right',
      width: 130,
      render: (v) => v != null
        ? <Text strong style={{ color: '#7c3aed' }}>{v}</Text>
        : <Text style={{ color: '#f59e0b' }}>chưa nhập</Text>,
    },
    {
      title: <span style={{ color: '#dc2626' }}>NV nhập hủy</span>,
      key: 'cancel',
      align: 'right',
      width: 130,
      render: (_, row) => (
        <InputNumber
          min={0}
          size="small"
          style={{ width: 90, borderColor: '#fca5a5' }}
          value={cancelMap[row.id] ?? row.qtyCancelled ?? row.qtyRemainingActual ?? 0}
          placeholder={String(row.qtyRemainingActual ?? 0)}
          onChange={(v) => setCancelMap((prev) => ({ ...prev, [row.id]: v ?? 0 }))}
        />
      ),
    },
    {
      title: () => (
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Lệch hủy<br /><small style={{ fontWeight: 400 }}>(NV − HT)</small>
        </span>
      ),
      key: 'diff',
      align: 'right',
      width: 100,
      render: (_, row) => {
        const nv = cancelMap[row.id] ?? row.qtyCancelled;
        const ht = row.qtyRemainingActual;
        if (nv == null || ht == null) return <Text type="secondary">—</Text>;
        const diff = nv - ht;
        if (diff === 0) return <Text style={{ color: '#059669', fontSize: 12 }}>✓ Khớp</Text>;
        return (
          <Text style={{ color: diff < 0 ? '#dc2626' : '#f59e0b', fontWeight: 600, fontSize: 12 }}>
            {diff < 0 ? `▼ ${Math.abs(diff)}` : `▲ ${diff}`}
          </Text>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      width: 110,
      render: (_, row) => {
        const nv = cancelMap[row.id] ?? row.qtyCancelled;
        const ht = row.qtyRemainingActual;
        if (nv == null) {
          return ht != null
            ? <Text style={{ color: '#f59e0b', fontSize: 11 }}>Chưa nhập hủy</Text>
            : <Text type="secondary" style={{ fontSize: 11 }}>Chưa có tồn</Text>;
        }
        const diff = ht != null ? nv - ht : null;
        return diff === 0
          ? <Text style={{ color: '#059669', fontSize: 11 }}>✓ Đã nhập</Text>
          : <Text style={{ color: '#f59e0b', fontSize: 11 }}>⚠️ Lệch</Text>;
      },
    },
  ];

  // ── Render: Date header (always visible) ──────────────────────────────────
  const renderDateHeader = () => (
    <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
      <Col>
        <Space>
          <Tooltip title="Hôm trước">
            <Button icon={<LeftOutlined />} onClick={() => goDate(-1)} />
          </Tooltip>
          <DatePicker
            value={date}
            onChange={(d) => d && handleDateChange(d)}
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
          <Button icon={<ReloadOutlined />} onClick={() => refetchReport()} loading={isLoading} />
        </Space>
      </Col>
      <Col>
        <Space>
          {report && (
            <Tag
              color={isFinalized ? 'green' : 'orange'}
              icon={isFinalized ? <LockOutlined /> : undefined}
              style={{ padding: '4px 12px', fontSize: 13 }}
            >
              {isFinalized ? '🔒 Đã chốt' : 'Draft'}
            </Tag>
          )}

          {/* Action buttons at the top right */}
          {report && !isFinalized && view === 'report' && (
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setView('cancel')}>
                Quay lại
              </Button>
              <Button
                type="primary"
                danger
                icon={<LockOutlined />}
                loading={finalizeMutation.isPending}
                onClick={() => finalizeMutation.mutate()}
              >
                ✅ Chốt báo cáo
              </Button>
            </Space>
          )}
        </Space>
      </Col>
    </Row>
  );

  // ── Render: view = 'report' or 'confirm' ─────────────────────────────────
  const renderReportTable = () => (
    <>
      {!isFinalized && view === 'report' && (
        <Steps
          current={1}
          size="small"
          style={{ marginBottom: 20 }}
          items={[
            { title: 'Xác nhận hủy bánh', icon: <DeleteOutlined />, status: 'finish' },
            { title: 'Báo cáo ngày & Chốt', icon: <FileTextOutlined /> },
          ]}
        />
      )}

      {/* Stats */}
      {computedLines.length > 0 && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="Bếp SX" value={totalSX} suffix="cái"
                valueStyle={{ fontSize: 18, color: '#52c41a' }} />
            </Col>
            <Col span={6}>
              <Statistic title="Bán thực (POS)" value={totalPOS} suffix="cái"
                valueStyle={{ fontSize: 18, color: '#b45309' }} />
            </Col>
            <Col span={6}>
              <Statistic title="Còn lại" value={totalRemain} suffix="cái"
                valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col span={6}>
              <Statistic title="Sản phẩm" value={computedLines.length} suffix="loại"
                valueStyle={{ fontSize: 18 }} />
            </Col>
          </Row>
          <Divider style={{ margin: '0 0 16px' }} />
        </>
      )}

      {/* Main report table */}
      <Table<DailyReportLine>
        dataSource={computedLines}
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
          (!isFinalized && view === 'report' && computedLines.length > 0) ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={9}>
                <Alert
                  type="info"
                  showIcon
                  style={{ padding: '4px 12px' }}
                  message={
                    <Text style={{ fontSize: 12 }}>
                      💡 <Text strong>"Còn lại"</Text> do nhân viên nhập ở màn hình Kho Bếp.
                      Bấm <Text strong>Chốt báo cáo</Text> để chuyển sang bước kiểm tra.
                    </Text>
                  }
                />
              </Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
      />

      {/* Read-only Finalized Status below table */}
      {isFinalized && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Alert
            type="success"
            showIcon
            icon={<LockOutlined />}
            message={
              <Text>
                Báo cáo đã được chốt
                {report?.finalizedBy && <Text strong> bởi {report.finalizedBy}</Text>}
                {report?.finalizedAt && (
                  <Text type="secondary">
                    {' '}lúc {dayjs(report.finalizedAt).format('HH:mm DD/MM/YYYY')}
                  </Text>
                )}
                . Không thể chỉnh sửa thêm.
              </Text>
            }
          />
        </div>
      )}
    </>
  );

  // ── Render: view = 'cancel' (Bước 1) ─────────────────────────────────────
  const renderCancel = () => (
    <>
      <Steps
        current={0}
        size="small"
        style={{ marginBottom: 20 }}
        items={[
          { title: 'Xác nhận hủy bánh', icon: <DeleteOutlined /> },
          { title: 'Chốt báo cáo', icon: <CheckOutlined /> },
        ]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Kiểm tra và điều chỉnh số lượng bánh cần hủy trước khi chốt."
        description="Số hủy mặc định = Còn lại cuối ngày. Nhân viên điều chỉnh nếu thực tế khác."
      />

      {cancelList.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Không có sản phẩm nào cần hủy hôm nay (shelf_days = 0)."
        />
      ) : (
        <>
          <Table<DailyReportLine>
            dataSource={cancelList}
            columns={cancelEditColumns}
            rowKey="id"
            loading={cancelLoading}
            pagination={false}
            size="middle"
          />

          <Row justify="end" style={{ marginTop: 12 }}>
            <Col>
              <Statistic
                title="Tổng hủy"
                value={totalCancel}
                suffix="cái"
                valueStyle={{ color: '#dc2626', fontSize: 18 }}
              />
            </Col>
          </Row>
        </>
      )}

      <Divider />
      <Row justify="end">
        <Col>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            loading={isSavingCancel}
            onClick={handleNextToConfirm}
          >
            Tiếp theo – Bước 2
          </Button>
        </Col>
      </Row>
    </>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Báo cáo ngày – Cửa Hàng
        </Title>
      </div>

      <Divider style={{ margin: '12px 0 16px' }} />

      <Card>
        {renderDateHeader()}

        <Divider style={{ margin: '0 0 16px' }} />

        {view === 'report' && renderReportTable()}
        {view === 'cancel' && renderCancel()}
      </Card>
    </div>
  );
};

export default StoreDailyReport;
