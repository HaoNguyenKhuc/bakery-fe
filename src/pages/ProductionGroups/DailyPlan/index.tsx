import React, { useState, useMemo } from 'react';
import {
  Table, Button, DatePicker, Typography,
  message, Spin, InputNumber, Popconfirm, Tooltip,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import productionService from '../../../api/services/productionService';
import type { ProductionPlan, ProductionPlanLine } from '../../../types';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, ExportOutlined, CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const cls =
    status === 'DRAFT' ? 'pp-status pp-status--draft' :
      status === 'APPROVED' ? 'pp-status pp-status--approved' :
        status === 'REJECTED' ? 'pp-status pp-status--rejected' :
          'pp-status pp-status--unknown';
  return <span className={cls}>{status || 'UNKNOWN'}</span>;
};

// ── Day type badge ────────────────────────────────────────────────────────────
const DayTypeBadge: React.FC<{ type?: string }> = ({ type }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px',
    borderRadius: 'var(--pp-radius-xs)',
    fontSize: 'var(--pp-text-xs)',
    fontWeight: 600,
    fontFamily: 'var(--pp-font-mono)',
    background: type === 'WEEKEND' ? 'oklch(94% 0.04 295)' : 'var(--pp-paper-3)',
    color: type === 'WEEKEND' ? 'oklch(40% 0.18 295)' : 'var(--pp-ink-2)',
  }}>
    {type || 'WEEKDAY'}
  </span>
);

// ── DailyPlan ─────────────────────────────────────────────────────────────────
const DailyPlan: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [adjustingLines, setAdjustingLines] = useState<Record<string, number>>({});

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['production-plans', 'by-date', selectedDate],
    queryFn: async () => {
      try {
        const res = await productionService.getPlanByDate(selectedDate);
        return res;
      } catch (e: any) {
        if (e.response?.status === 404 || e.status === 404) return null;
        throw e;
      }
    },
  });

  const actualPlan: ProductionPlan | null = (plan as any)?.data ?? plan;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (date: string) => productionService.generatePlan(date),
    onSuccess: () => {
      message.success('Đã tạo kế hoạch DRAFT');
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
    onError: () => message.error('Không thể tạo kế hoạch'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => productionService.approvePlan(id),
    onSuccess: () => {
      message.success('Đã approve kế hoạch');
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      productionService.rejectPlan(id, reason),
    onSuccess: () => {
      message.success('Đã reject kế hoạch');
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => productionService.regeneratePlan(id),
    onSuccess: () => {
      message.success('Đã tạo lại kế hoạch DRAFT');
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
  });

  const generateRequestsMutation = useMutation({
    mutationFn: (id: string) => productionService.generateRequestsFromPlan(id),
    onSuccess: (res: any) => {
      const count = res?.requestsCreated || res?.data?.requestsCreated || 0;
      if (count === 0) {
        message.warning('Không tạo được phiếu SX (kiểm tra items đã có item_group chưa?)');
      } else {
        message.success(`Đã tạo ${count} phiếu SX`);
      }
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, lineId, qty }: { id: string; lineId: string; qty: number }) =>
      productionService.adjustPlanLine(id, [{ lineId, adjustedQty: qty }]),
    onSuccess: () => {
      message.success('Đã cập nhật số lượng');
      setAdjustingLines({});
      queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleGenerate = () => generateMutation.mutate(selectedDate);

  const handleAdjustChange = (lineId: string, val: number | null) => {
    if (val === null) return;
    setAdjustingLines(prev => ({ ...prev, [lineId]: val }));
  };

  const submitAdjust = (lineId: string) => {
    if (!actualPlan) return;
    const qty = adjustingLines[lineId];
    if (qty === undefined) return;
    adjustMutation.mutate({ id: actualPlan.id, lineId, qty });
  };

  const handleRejectPrompt = () => {
    if (!actualPlan) return;
    const reason = window.prompt('Lý do reject:');
    if (reason) rejectMutation.mutate({ id: actualPlan.id, reason });
  };

  // ── State helpers ─────────────────────────────────────────────────────────────
  const isDraft = actualPlan?.approvalStatus === 'DRAFT' || actualPlan?.status === 'DRAFT';
  const isApproved = actualPlan?.approvalStatus === 'APPROVED' || actualPlan?.status === 'APPROVED';
  const isRejected = actualPlan?.approvalStatus === 'REJECTED' || actualPlan?.status === 'REJECTED';

  const lines = actualPlan?.lines || [];
  const totalItems = lines.length;
  const totalQty = lines.reduce((sum: number, l: ProductionPlanLine) => {
    return sum + (l.adjustedQty ?? l.suggestedQty ?? l.plannedQty ?? 0);
  }, 0);

  const groupedLines = useMemo(() => {
    const grouped = new Map<string, { group: any; lines: ProductionPlanLine[] }>();
    const standalone: ProductionPlanLine[] = [];
    for (const line of lines) {
      if (line.group) {
        const key = line.group.key || line.group.id;
        if (!grouped.has(key)) grouped.set(key, { group: line.group, lines: [] });
        grouped.get(key)!.lines.push(line);
      } else {
        standalone.push(line);
      }
    }
    return { standalone, grouped: Array.from(grouped.values()) };
  }, [lines]);

  // ── Table columns ─────────────────────────────────────────────────────────────
  const makeColumns = (groupType?: 'BATCH_FORMULA' | 'FREE_GROUP') => [
    {
      title: 'Sản phẩm',
      dataIndex: 'itemName',
      render: (text: string, record: ProductionPlanLine) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 'var(--pp-text-sm)' }}>
            {text || (record as any).productName || record.item?.name}
          </div>
          <div style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)', marginTop: 1 }}>
            {(record as any).itemCode || (record as any).productCode || record.item?.key}
          </div>
        </div>
      ),
    },
    {
      title: 'Gợi ý (HT tính)',
      dataIndex: 'suggestedQty',
      align: 'right' as const,
      width: 130,
      render: (val: number, record: ProductionPlanLine) => (
        <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-sm)', color: 'var(--pp-ink-2)' }}>
          {val ?? (record as any).plannedQty ?? '—'}
        </span>
      ),
    },
    {
      title: isDraft ? 'Điều chỉnh' : 'Chốt',
      dataIndex: 'adjustedQty',
      align: 'right' as const,
      width: 130,
      render: (val: number, record: ProductionPlanLine) => {
        const displayVal = val ?? record.suggestedQty ?? (record as any).plannedQty ?? 0;
        if (isDraft) {
          const currentEdit = adjustingLines[record.id];
          return (
            <InputNumber
              size="small"
              value={currentEdit !== undefined ? currentEdit : displayVal}
              onChange={(v) => handleAdjustChange(record.id, v)}
              onPressEnter={() => submitAdjust(record.id)}
              onBlur={() => submitAdjust(record.id)}
              style={{ width: 80, fontFamily: 'var(--pp-font-mono)' }}
            />
          );
        }
        return (
          <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 700, fontSize: 'var(--pp-text-sm)', color: 'var(--pp-accent)' }}>
            {displayVal}
          </span>
        );
      },
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      width: 80,
      render: (val: string, record: ProductionPlanLine) => (
        <span style={{ fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)', fontFamily: 'var(--pp-font-mono)' }}>
          {val || record.item?.unit || '—'}
        </span>
      ),
    },
  ];

  // ── Group table ───────────────────────────────────────────────────────────────
  const renderGroupTable = (dataSource: ProductionPlanLine[], groupName?: string) => (
    <div className="pp-card" style={{ marginBottom: 'var(--pp-space-sm)' }}>
      {groupName && (
        <div className="pp-card__header" style={{ padding: '8px 16px' }}>
          <span style={{ fontFamily: 'var(--pp-font-mono)', fontSize: 'var(--pp-text-xs)', fontWeight: 700, color: 'var(--pp-ink-2)' }}>
            {groupName}
          </span>
          <span className="pp-tab__badge">{dataSource.length}</span>
        </div>
      )}
      <div className="pp-table-wrap">
        <Table
          size="small"
          dataSource={dataSource}
          rowKey="id"
          pagination={false}
          columns={makeColumns()}
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="pp-toolbar">
        <div className="pp-toolbar__left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined style={{ color: 'var(--pp-ink-3)', fontSize: 13 }} />
            <span style={{ fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ngày</span>
          </div>
          <DatePicker
            className="pp-datepicker"
            allowClear={false}
            value={dayjs(selectedDate)}
            onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : '')}
          />
          <button
            className="pp-btn pp-btn--ghost"
            style={{ fontSize: 'var(--pp-text-sm)' }}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] })}
            aria-label="Reload"
          >
            <ReloadOutlined /> Tải lại
          </button>
        </div>

        <div className="pp-toolbar__right">
          {!actualPlan && !isLoading && (
            <button
              className="pp-btn pp-btn--primary"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Spin size="small" /> : null}
              Tạo kế hoạch
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pp-space-2xl)' }}>
          <Spin size="large" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="pp-card" style={{ padding: 'var(--pp-space-lg)', textAlign: 'center', color: 'var(--pp-danger)' }}>
          <InfoCircleOutlined /> Không thể tải dữ liệu. Kiểm tra kết nối.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !actualPlan && (
        <div className="pp-card">
          <div className="pp-empty">
            <CalendarOutlined className="pp-empty__icon" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--pp-text-md)', marginBottom: 4 }}>
                Chưa có kế hoạch
              </div>
              <div className="pp-empty__text">
                Không có kế hoạch SX cho ngày <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600 }}>{selectedDate}</span>
              </div>
            </div>
            <button
              className="pp-btn pp-btn--primary"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Spin size="small" /> : null}
              Tạo kế hoạch ngay
            </button>
          </div>
        </div>
      )}

      {/* Plan found */}
      {!isLoading && !error && actualPlan && (
        <>
          {/* Plan banner */}
          <div className="pp-plan-banner">
            <div className="pp-plan-banner__meta">
              <span style={{ fontFamily: 'var(--pp-font-display)', fontWeight: 600, fontSize: 'var(--pp-text-md)' }}>
                {actualPlan.planDate || (actualPlan as any).targetDate}
              </span>
              <StatusPill status={actualPlan.approvalStatus || actualPlan.status} />
              <DayTypeBadge type={(actualPlan as any).dayType} />
              {/* <span className="pp-plan-banner__id"># {actualPlan.id?.slice(-8)}</span> */}
              {totalItems > 0 && (
                <span style={{ fontSize: 'var(--pp-text-xs)', color: 'var(--pp-ink-3)' }}>
                  {totalItems} sản phẩm · <span style={{ fontFamily: 'var(--pp-font-mono)', fontWeight: 600, color: 'var(--pp-ink)' }}>{totalQty}</span> cái tổng
                </span>
              )}
            </div>

            <div className="pp-plan-banner__actions">
              {isDraft && (
                <>
                  <Tooltip title="Duyệt kế hoạch này">
                    <button
                      className="pp-btn pp-btn--primary"
                      onClick={() => approveMutation.mutate(actualPlan.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Spin size="small" /> : <CheckCircleOutlined />}
                      Approve
                    </button>
                  </Tooltip>
                  <Tooltip title="Từ chối kế hoạch">
                    <button
                      className="pp-btn pp-btn--danger"
                      onClick={handleRejectPrompt}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? <Spin size="small" /> : <CloseCircleOutlined />}
                      Reject
                    </button>
                  </Tooltip>
                </>
              )}
              {isRejected && (
                <Popconfirm title="Tạo lại kế hoạch mới?" onConfirm={() => regenerateMutation.mutate(actualPlan.id)}>
                  <button className="pp-btn pp-btn--ghost" disabled={regenerateMutation.isPending}>
                    {regenerateMutation.isPending ? <Spin size="small" /> : <ReloadOutlined />}
                    Tạo lại DRAFT
                  </button>
                </Popconfirm>
              )}
              {isApproved && (
                <Tooltip title="Tạo phiếu sản xuất từ kế hoạch">
                  <button
                    className="pp-btn pp-btn--ghost"
                    onClick={() => generateRequestsMutation.mutate(actualPlan.id)}
                    disabled={generateRequestsMutation.isPending}
                  >
                    {generateRequestsMutation.isPending ? <Spin size="small" /> : <ExportOutlined />}
                    Tạo phiếu SX
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Stat mini strip */}
          {totalItems > 0 && (
            <div className="pp-stats" style={{ marginBottom: 'var(--pp-space-md)', borderRadius: 'var(--pp-radius-md)', overflow: 'hidden' }}>
              <div className="pp-stat">
                <span className="pp-stat__label">Tổng sản phẩm</span>
                <span className="pp-stat__value pp-stat__value--accent">{totalItems}</span>
              </div>
              <div className="pp-stat">
                <span className="pp-stat__label">Tổng số lượng</span>
                <span className="pp-stat__value">{totalQty.toLocaleString('vi')}</span>
              </div>
              <div className="pp-stat">
                <span className="pp-stat__label">Nhóm SX</span>
                <span className="pp-stat__value">{groupedLines.grouped.length}</span>
              </div>
              <div className="pp-stat">
                <span className="pp-stat__label">Sản phẩm lẻ</span>
                <span className="pp-stat__value pp-stat__value--warn">{groupedLines.standalone.length}</span>
              </div>
            </div>
          )}

          {/* Standalone products */}
          {groupedLines.standalone.length > 0 &&
            renderGroupTable(groupedLines.standalone, `Sản phẩm lẻ (${groupedLines.standalone.length})`)}

          {/* Groups */}
          {groupedLines.grouped.map((g, idx) => (
            <div key={idx}>
              {renderGroupTable(g.lines, `Nhóm: ${g.group.name} (${g.group.key})`)}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default DailyPlan;
