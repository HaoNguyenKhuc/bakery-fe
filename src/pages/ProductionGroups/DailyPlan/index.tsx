import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, DatePicker, Row, Col, Typography,
  Space, message, Spin, Empty, Badge, Tag, InputNumber, Popconfirm
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import productionService from '../../../api/services/productionService';
import type { ProductionPlan, ProductionPlanLine } from '../../../types';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const getStatusBadge = (status?: string) => {
  if (status === 'DRAFT') return <Badge status="warning" text="DRAFT" />;
  if (status === 'APPROVED') return <Badge status="success" text="APPROVED" />;
  if (status === 'REJECTED') return <Badge status="error" text="REJECTED" />;
  return <Badge status="default" text={status || 'UNKNOWN'} />;
};

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

  // Extract actual plan from response (axios interceptor might unwrap)
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
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productionService.rejectPlan(id, reason),
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
  const handleGenerate = () => {
    generateMutation.mutate(selectedDate);
  };

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

  // ── Render Helpers ──────────────────────────────────────────────────────────
  const isDraft = actualPlan?.approvalStatus === 'DRAFT' || actualPlan?.status === 'DRAFT';
  const isApproved = actualPlan?.approvalStatus === 'APPROVED' || actualPlan?.status === 'APPROVED';
  const isRejected = actualPlan?.approvalStatus === 'REJECTED' || actualPlan?.status === 'REJECTED';

  const lines = actualPlan?.lines || [];

  const groupedLines = useMemo(() => {
    const grouped = new Map<string, { group: any, lines: ProductionPlanLine[] }>();
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

  const renderTable = (dataSource: ProductionPlanLine[], title?: string) => (
    <Card size="small" style={{ marginBottom: 16 }} title={title ? <Text strong>{title}</Text> : undefined}>
      <Table
        size="small"
        dataSource={dataSource}
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: 'Sản phẩm',
            dataIndex: 'itemName',
            render: (text, record) => (
              <>
                <div>{text || record.productName || record.item?.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{record.itemCode || record.productCode || record.item?.key}</Text>
              </>
            ),
          },
          {
            title: 'Gợi ý (HT tính)',
            dataIndex: 'suggestedQty',
            render: (val, record) => val ?? record.plannedQty ?? '—',
            align: 'right',
          },
          {
            title: 'Chốt',
            dataIndex: 'adjustedQty',
            align: 'right',
            render: (val, record) => {
              const displayVal = val ?? record.suggestedQty ?? record.plannedQty ?? 0;
              if (isDraft) {
                const currentEdit = adjustingLines[record.id];
                return (
                  <Space>
                    <InputNumber
                      size="small"
                      value={currentEdit !== undefined ? currentEdit : displayVal}
                      onChange={(v) => handleAdjustChange(record.id, v)}
                      onPressEnter={() => submitAdjust(record.id)}
                      onBlur={() => submitAdjust(record.id)}
                      style={{ width: 80 }}
                    />
                  </Space>
                );
              }
              return <Text strong>{displayVal}</Text>;
            },
          },
          {
            title: 'Đơn vị',
            dataIndex: 'unit',
            render: (val, record) => val || record.item?.unit || '—',
          }
        ]}
      />
    </Card>
  );

  return (
    <div style={{ padding: '8px 0' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small">
            <Space align="end" size="large">
              <div>
                <div style={{ marginBottom: 4 }}><Text type="secondary">Xem theo ngày</Text></div>
                <DatePicker
                  allowClear={false}
                  value={dayjs(selectedDate)}
                  onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : '')}
                />
              </div>
              <Button type="primary" ghost onClick={() => queryClient.invalidateQueries({ queryKey: ['production-plans', 'by-date', selectedDate] })}>
                Tải lại
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={24}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : !actualPlan ? (
            <Card size="small">
              <Empty
                description={<Text type="secondary">Chưa có kế hoạch cho ngày {selectedDate}</Text>}
                style={{ padding: '40px 0' }}
              >
                <Button type="primary" onClick={handleGenerate} loading={generateMutation.isPending}>
                  Tạo kế hoạch ngay
                </Button>
              </Empty>
            </Card>
          ) : (
            <div>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size="large">
                      <Title level={5} style={{ margin: 0 }}>Kế hoạch {actualPlan.planDate || actualPlan.targetDate}</Title>
                      {getStatusBadge(actualPlan.approvalStatus || actualPlan.status)}
                      <Tag color="blue">{actualPlan.dayType || 'WEEKDAY'}</Tag>
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      {isDraft && (
                        <>
                          <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => approveMutation.mutate(actualPlan.id)}
                            loading={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={handleRejectPrompt}
                            loading={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {isRejected && (
                        <Popconfirm
                          title="Tạo lại kế hoạch mới?"
                          onConfirm={() => regenerateMutation.mutate(actualPlan.id)}
                        >
                          <Button icon={<ReloadOutlined />} loading={regenerateMutation.isPending}>Tạo lại DRAFT</Button>
                        </Popconfirm>
                      )}
                      {isApproved && (
                        <Button
                          icon={<ExportOutlined />}
                          onClick={() => generateRequestsMutation.mutate(actualPlan.id)}
                          loading={generateRequestsMutation.isPending}
                        >
                          Tạo phiếu SX
                        </Button>
                      )}
                    </Space>
                  </Col>
                </Row>
              </Card>

              {groupedLines.standalone.length > 0 && renderTable(groupedLines.standalone, 'Sản phẩm lẻ')}
              
              {groupedLines.grouped.map((g, idx) => (
                <div key={idx}>
                  {renderTable(g.lines, `Nhóm: ${g.group.name} (${g.group.key})`)}
                </div>
              ))}
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default DailyPlan;
