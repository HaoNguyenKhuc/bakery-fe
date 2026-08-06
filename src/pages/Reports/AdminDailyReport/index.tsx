import React, { useState } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space, Tag,
  message, Alert, Empty, Statistic, Row, Col,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined, LockOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import dailyReportService from '../../../api/services/dailyReportService';
import type { DailyReport } from '../../../types/dailyReport';

const { Title, Text } = Typography;

const numFmt = (v: number | undefined | null) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('vi-VN');

const DiscrepancyCell: React.FC<{ value: number | undefined | null }> = ({ value }) => {
  if (value === null || value === undefined) return <Text type="secondary">—</Text>;
  const n = Number(value);
  if (n === 0) return <Tag color="success">0</Tag>;
  return (
    <Tag color={n < 0 ? 'error' : 'warning'}>
      {n > 0 ? `+${n}` : n}
    </Tag>
  );
};

const AdminDailyReportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const dateStr = date.format('YYYY-MM-DD');

  // ── Load report by date ──────────────────────────────────────────────────────

  const { data: report, isLoading: reportLoading, refetch: refetchReport, error: reportError } = useQuery({
    queryKey: ['daily-report-by-date', dateStr],
    queryFn: () => dailyReportService.getByDate(dateStr),
    select: (raw: any) => raw?.data ?? raw,
    retry: false,
  });

  const { data: lines = [], isLoading: linesLoading, refetch: refetchLines } = useQuery({
    queryKey: ['daily-report-lines', report?.id],
    queryFn: () => dailyReportService.getLines(report!.id),
    select: (raw: any) => {
      const arr = Array.isArray(raw) ? raw : raw?.data ?? [];
      return arr;
    },
    enabled: !!report?.id,
  });

  const isLoading = reportLoading || linesLoading;
  const isFinalized = report?.status === 'FINALIZED';

  // ── Finalize mutation ────────────────────────────────────────────────────────

  const finalizeMutation = useMutation({
    mutationFn: () => dailyReportService.finalize(report!.id),
    onSuccess: () => {
      message.success('Đã chốt báo cáo!');
      queryClient.invalidateQueries({ queryKey: ['daily-report-by-date', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['daily-report-lines', report?.id] });
    },
    onError: () => message.error('Chốt báo cáo thất bại'),
  });

  const refetch = () => { refetchReport(); refetchLines(); };

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<any> = [
    {
      title: 'Sản phẩm',
      key: 'item',
      fixed: 'left' as const,
      width: 160,
      render: (_, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{row.itemName ?? row.item?.name ?? '—'}</Text>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{row.itemCode ?? row.item?.code}</Text></div>
        </div>
      ),
    },
    {
      title: 'Bánh Tồn',
      dataIndex: 'qtyRemainingOpening',
      width: 90,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Bánh Ra (Bếp)',
      dataIndex: 'qtyProduced',
      width: 100,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Bánh Ra Thực Nhận',
      dataIndex: 'qtyReceived',
      width: 120,
      align: 'right',
      render: (v) => <Text style={{ color: '#1677ff' }}>{numFmt(v)}</Text>,
    },
    {
      title: 'Chênh Lệch Bếp',
      dataIndex: 'discrepancyKitchen',
      width: 120,
      align: 'center',
      render: (v) => <DiscrepancyCell value={v} />,
    },
    {
      title: 'Bánh Bán POS',
      dataIndex: 'qtySoldPos',
      width: 100,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Bánh Bán Thực Tế',
      dataIndex: 'qtySoldImplied',
      width: 120,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Chênh Lệch POS',
      dataIndex: 'discrepancyPos',
      width: 120,
      align: 'center',
      render: (v) => <DiscrepancyCell value={v} />,
    },
    {
      title: 'Hủy Dự Kiến',
      dataIndex: 'qtySystemCancel',
      width: 100,
      align: 'right',
      render: (v) => <Text type="danger">{numFmt(v)}</Text>,
    },
    {
      title: 'Hủy Thực Tế',
      dataIndex: 'qtyCancelled',
      width: 100,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Chênh Lệch Hủy',
      dataIndex: 'discrepancyCancel',
      width: 120,
      align: 'center',
      render: (v) => <DiscrepancyCell value={v} />,
    },
    {
      title: 'Còn Lại (HT)',
      dataIndex: 'qtySystemRemaining',
      width: 100,
      align: 'right',
      render: (v) => numFmt(v),
    },
    {
      title: 'Còn Lại (NV)',
      dataIndex: 'qtyRemainingActual',
      width: 100,
      align: 'right',
      render: (v) => <Text strong>{numFmt(v)}</Text>,
    },
    {
      title: 'Chênh Lệch Còn',
      dataIndex: 'discrepancyRemaining',
      width: 120,
      align: 'center',
      render: (v) => <DiscrepancyCell value={v} />,
    },
  ];

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalDiscrepancies = lines.filter(
    (l: any) =>
      Math.abs(Number(l.discrepancyKitchen ?? 0)) > 0 ||
      Math.abs(Number(l.discrepancyPos ?? 0)) > 0 ||
      Math.abs(Number(l.discrepancyCancel ?? 0)) > 0 ||
      Math.abs(Number(l.discrepancyRemaining ?? 0)) > 0
  ).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      <Title level={4} style={{ marginBottom: 20 }}>📊 Báo Cáo Ngày — Admin</Title>

      <Card>
        {/* Header */}
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size={8}>
          <Button icon={<LeftOutlined />} onClick={() => setDate((d) => d.subtract(1, 'day'))} />
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            format="DD/MM/YYYY"
            style={{ width: 140 }}
            allowClear={false}
          />
          <Button
            icon={<RightOutlined />}
            onClick={() => setDate((d) => d.add(1, 'day'))}
            disabled={date.isSame(dayjs(), 'day')}
          />
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />

          <div style={{ flex: 1 }} />

          {report && (
            <>
              {isFinalized ? (
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ padding: '4px 10px' }}>
                  Đã chốt — {dayjs(report.finalizedAt).format('HH:mm DD/MM')}
                </Tag>
              ) : (
                <Button
                  type="primary"
                  danger
                  icon={<LockOutlined />}
                  loading={finalizeMutation.isPending}
                  onClick={() => finalizeMutation.mutate()}
                >
                  Chốt Báo Cáo
                </Button>
              )}
            </>
          )}
        </Space>

        {reportError && (
          <Alert
            type="warning"
            message="Chưa có báo cáo cho ngày này. Vui lòng upload file POS để tạo báo cáo."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Summary stats */}
        {lines.length > 0 && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic
                title="Sản phẩm"
                value={lines.length}
                suffix="loại"
              />
            </Col>
            <Col>
              <Statistic
                title="Chênh lệch"
                value={totalDiscrepancies}
                suffix="dòng"
                valueStyle={{ color: totalDiscrepancies > 0 ? '#ff4d4f' : '#52c41a' }}
                prefix={totalDiscrepancies > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
              />
            </Col>
            <Col>
              <Statistic
                title="Trạng thái"
                value={isFinalized ? 'Đã chốt' : 'Bản nháp'}
                valueStyle={{ color: isFinalized ? '#52c41a' : '#faad14' }}
              />
            </Col>
          </Row>
        )}

        <Table<any>
          dataSource={lines}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
          scroll={{ x: 1500 }}
          rowClassName={(row) => {
            const hasDisc =
              Math.abs(Number(row.discrepancyKitchen ?? 0)) > 0 ||
              Math.abs(Number(row.discrepancyPos ?? 0)) > 0 ||
              Math.abs(Number(row.discrepancyCancel ?? 0)) > 0 ||
              Math.abs(Number(row.discrepancyRemaining ?? 0)) > 0;
            return hasDisc ? 'ant-table-row-warning' : '';
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Không có dữ liệu</Text>}
              />
            ),
          }}
        />
      </Card>

      <style>{`
        .ant-table-row-warning td { background: #fffbe6 !important; }
        .ant-table-row-warning:hover td { background: #fff7cc !important; }
      `}</style>
    </div>
  );
};

export default AdminDailyReportPage;
