import React, { useState } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space, Tag,
  message, Alert, Empty, Tooltip, Badge,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import cancelRecordService from '../../../api/services/cancelRecordService';
import type { CancelRecordRow } from '../../../types/cancelRecord';

const { Title, Text } = Typography;

const CANCEL_TYPE_COLOR: Record<string, string> = {
  EXPIRED: 'red',
  DAMAGED: 'orange',
  OTHER: 'default',
};

const CANCEL_TYPE_LABEL: Record<string, string> = {
  EXPIRED: 'Hết HSD',
  DAMAGED: 'Hỏng/Mốc',
  OTHER: 'Khác',
};

const numFmt = (v: number | undefined | null) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('vi-VN');

const DailyReportNVPage: React.FC = () => {
  const [date, setDate] = useState<Dayjs>(dayjs());
  const dateStr = date.format('YYYY-MM-DD');

  const { data: records = [], isLoading, refetch, error } = useQuery({
    queryKey: ['cancel-records', dateStr],
    queryFn: () => cancelRecordService.getByDate(dateStr),
    select: (raw: any) => Array.isArray(raw) ? raw : raw?.data ?? [],
    retry: false,
  });

  const confirmedCount = records.filter((r: CancelRecordRow) => r.confirmed).length;

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<CancelRecordRow> = [
    {
      title: 'Mã Bánh',
      dataIndex: 'exCode',
      width: 130,
      fixed: 'left' as const,
      render: (v, row) => (
        <Space direction="vertical" size={2}>
          <Text code style={{ fontSize: 12 }}>{v}</Text>
          <Tag color={CANCEL_TYPE_COLOR[row.cancelType]} style={{ fontSize: 10, margin: 0 }}>
            {CANCEL_TYPE_LABEL[row.cancelType] ?? row.cancelType}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Sản phẩm',
      key: 'item',
      render: (_, row) => (
        <div>
          <Text style={{ fontSize: 13 }}>{row.itemName ?? '—'}</Text>
          {row.itemCode && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>{row.itemCode}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày SX',
      dataIndex: 'productionDate',
      width: 90,
      align: 'center',
      render: (v) => v ? (
        <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM')}</Text>
      ) : '—',
    },
    {
      title: 'Tồn hôm trước',
      dataIndex: 'qtyOpening',
      width: 110,
      align: 'right',
      render: (v) => <Text>{numFmt(v)}</Text>,
    },
    {
      title: 'Bánh Ra Thực Nhận',
      dataIndex: 'qtyReceived',
      width: 130,
      align: 'right',
      render: (v) => (
        <Text style={{ color: v > 0 ? '#1677ff' : undefined }}>{numFmt(v)}</Text>
      ),
    },
    {
      title: 'SL Hủy Dự Kiến',
      dataIndex: 'qtyCancelExpected',
      width: 115,
      align: 'right',
      render: (v, row) =>
        row.cancelType === 'EXPIRED'
          ? <Text type={v > 0 ? 'danger' : 'secondary'}>{numFmt(v)}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Hủy Thực Tế',
      key: 'cancelActual',
      width: 110,
      align: 'right',
      render: (_, row) => {
        const actual = row.qtyCancelActual ?? row.qtyCancelExpected;
        const diff = (row.qtyCancelActual ?? 0) - row.qtyCancelExpected;
        return (
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
            <Space>
              {row.confirmed && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
              <Text strong={row.confirmed}>{numFmt(actual)}</Text>
            </Space>
            {row.confirmed && Math.abs(diff) > 0 && (
              <Text style={{ fontSize: 10, color: diff > 0 ? '#ff4d4f' : '#52c41a' }}>
                {diff > 0 ? `+${diff}` : diff}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Còn Lại',
      dataIndex: 'qtyRemaining',
      width: 90,
      align: 'right',
      render: (v) => (
        <Text strong style={{ color: v < 0 ? '#ff4d4f' : undefined }}>
          {numFmt(v)}
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v ?? ''}</Text>,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      <Title level={4} style={{ marginBottom: 20 }}>📋 Báo Cáo Ngày — Nhân Viên</Title>

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
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} />

          <div style={{ flex: 1 }} />

          {records.length > 0 && (
            <>
              {confirmedCount > 0 && (
                <Tag color="success" style={{ padding: '4px 10px' }}>
                  <CheckCircleOutlined /> Đã xác nhận ({confirmedCount}/{records.length})
                </Tag>
              )}
              {confirmedCount < records.length && (
                <Badge count={records.length - confirmedCount} size="small">
                  <Tag color="warning" style={{ padding: '4px 10px' }}>
                    <ClockCircleOutlined /> Chờ xác nhận
                  </Tag>
                </Badge>
              )}
            </>
          )}
        </Space>

        {error && (
          <Alert
            type="warning"
            message="Chưa có dữ liệu cho ngày này. Vui lòng yêu cầu Admin upload file POS để tạo báo cáo."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {records.length === 0 && !isLoading && !error && (
          <Alert
            type="info"
            message="Không có dữ liệu hủy bánh cho ngày này."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table<CancelRecordRow>
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 900 }}
          rowClassName={(row) =>
            row.confirmed ? 'ant-table-row-confirmed' : ''
          }
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Không có dữ liệu</Text>}
              />
            ),
          }}
          summary={(pageData) => {
            if (!pageData.length) return null;
            const totals = pageData.reduce(
              (acc, row) => ({
                opening: acc.opening + Number(row.qtyOpening || 0),
                received: acc.received + Number(row.qtyReceived || 0),
                expected: acc.expected + Number(row.qtyCancelExpected || 0),
                actual: acc.actual + Number(row.qtyCancelActual ?? row.qtyCancelExpected ?? 0),
                remaining: acc.remaining + Number(row.qtyRemaining || 0),
              }),
              { opening: 0, received: 0, expected: 0, actual: 0, remaining: 0 }
            );
            return (
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={3}>Tổng cộng</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{totals.opening.toLocaleString('vi-VN')}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right" style={{ color: '#1677ff' }}>{totals.received.toLocaleString('vi-VN')}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right" style={{ color: '#ff4d4f' }}>{totals.expected.toLocaleString('vi-VN')}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">{totals.actual.toLocaleString('vi-VN')}</Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right" style={{ fontWeight: 700 }}>{totals.remaining.toLocaleString('vi-VN')}</Table.Summary.Cell>
                <Table.Summary.Cell index={8} />
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default DailyReportNVPage;
