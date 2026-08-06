import React, { useState, useCallback } from 'react';
import {
  Card, Button, DatePicker, Table, Typography, Space, Tag,
  InputNumber, Input, message, Empty, Alert,
} from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import cancelRecordService from '../../api/services/cancelRecordService';
import type { CancelRecordRow } from '../../types/cancelRecord';

const { Title, Text } = Typography;

const CANCEL_TYPE_LABEL: Record<string, string> = {
  EXPIRED: 'Hết Hạn',
  DAMAGED: 'Hỏng',
  OTHER: 'Khác',
};

const CANCEL_TYPE_COLOR: Record<string, string> = {
  EXPIRED: 'red',
  DAMAGED: 'orange',
  OTHER: 'default',
};

// ── Grouped data helper ──────────────────────────────────────────────────────

interface GroupedRow extends CancelRecordRow {
  _groupSpan: number;   // rowSpan cho cột Loại Bánh
  _itemSpan: number;    // rowSpan cho cột Sản Phẩm
}

function buildGrouped(records: CancelRecordRow[]): GroupedRow[] {
  const sorted = [...records].sort((a, b) => {
    const g = (a.itemGroupName ?? '').localeCompare(b.itemGroupName ?? '', 'vi');
    if (g !== 0) return g;
    const n = (a.itemName ?? '').localeCompare(b.itemName ?? '', 'vi');
    if (n !== 0) return n;
    return (a.productionDate ?? '').localeCompare(b.productionDate ?? '');
  });

  return sorted.map((row, idx, arr) => {
    const prev = arr[idx - 1];
    const sameGroup = prev?.itemGroupName === row.itemGroupName;
    const sameItem = sameGroup && prev?.itemName === row.itemName;

    let groupSpan = 0;
    if (!sameGroup) {
      let j = idx;
      while (j < arr.length && arr[j].itemGroupName === row.itemGroupName) j++;
      groupSpan = j - idx;
    }

    let itemSpan = 0;
    if (!sameItem) {
      let j = idx;
      while (
        j < arr.length &&
        arr[j].itemGroupName === row.itemGroupName &&
        arr[j].itemName === row.itemName
      ) j++;
      itemSpan = j - idx;
    }

    return { ...row, _groupSpan: groupSpan, _itemSpan: itemSpan };
  });
}

// ── Component ────────────────────────────────────────────────────────────────

const CancelListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const dateStr = date.format('YYYY-MM-DD');

  // local edits: id → { qty, note }
  const [edits, setEdits] = useState<Record<string, { qty?: number | null; note?: string }>>({});

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['cancel-records', dateStr],
    queryFn: () => cancelRecordService.getByDate(dateStr),
    select: (raw: any) => Array.isArray(raw) ? raw : raw?.data ?? [],
    retry: false,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const confirmMutation = useMutation({
    mutationFn: ({ id, qty, note }: { id: string; qty?: number | null; note?: string }) =>
      cancelRecordService.confirm(id, qty ?? undefined, note),
    onSuccess: (_, { id }) => {
      message.success('Đã lưu!');
      setEdits((p) => { const n = { ...p }; delete n[id]; return n; });
      queryClient.invalidateQueries({ queryKey: ['cancel-records', dateStr] });
    },
    onError: () => message.error('Lưu thất bại'),
  });


  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = useCallback((row: CancelRecordRow) => {
    const edit = edits[row.id];
    if (!edit) return; // không có thay đổi → không gọi API
    const qty = edit.qty !== undefined ? edit.qty : (row.qtyCancelActual ?? row.qtyCancelExpected);
    const note = edit.note !== undefined ? edit.note : row.note;
    confirmMutation.mutate({ id: row.id, qty, note });
  }, [edits, confirmMutation]);

  const setQty = (id: string, qty: number | null) =>
    setEdits((p) => ({ ...p, [id]: { ...p[id], qty } }));

  const setNote = (id: string, note: string) =>
    setEdits((p) => ({ ...p, [id]: { ...p[id], note } }));

  // ── Table ────────────────────────────────────────────────────────────────

  const grouped = buildGrouped(records as CancelRecordRow[]);

  const columns: ColumnsType<GroupedRow> = [
    {
      title: 'Loại Bánh',
      key: 'group',
      width: 120,
      onCell: (row) => ({ rowSpan: row._groupSpan }),
      render: (_, row) =>
        row._groupSpan > 0 ? (
          <Text strong>{row.itemGroupName ?? '—'}</Text>
        ) : null,
    },
    {
      title: 'Sản Phẩm',
      key: 'item',
      width: 160,
      onCell: (row) => ({ rowSpan: row._itemSpan }),
      render: (_, row) =>
        row._itemSpan > 0 ? (
          <div>
            <Text>{row.itemName ?? '—'}</Text>
            {row.itemCode && (
              <div><Text type="secondary" style={{ fontSize: 11 }}>{row.itemCode}</Text></div>
            )}
          </div>
        ) : null,
    },
    {
      title: 'Mã EX',
      dataIndex: 'exCode',
      width: 110,
      render: (v) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ngày SX',
      dataIndex: 'productionDate',
      width: 95,
      align: 'center',
      render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Loại hủy',
      dataIndex: 'cancelType',
      width: 90,
      align: 'center',
      render: (v) =>
        v ? (
          <Tag color={CANCEL_TYPE_COLOR[v] ?? 'default'} style={{ margin: 0 }}>
            {CANCEL_TYPE_LABEL[v] ?? v}
          </Tag>
        ) : null,
    },
    {
      title: 'Dự kiến',
      dataIndex: 'qtyCancelExpected',
      width: 75,
      align: 'right',
      render: (v) =>
        Number(v) > 0 ? (
          <Text strong style={{ color: '#ff4d4f' }}>{Number(v)}</Text>
        ) : (
          <Text type="secondary">0</Text>
        ),
    },
    {
      title: 'Hủy thực tế',
      key: 'actual',
      width: 120,
      align: 'center',
      render: (_, row) => {
        const editQty = edits[row.id]?.qty;
        const displayQty =
          editQty !== undefined
            ? editQty
            : row.confirmed
            ? (row.qtyCancelActual ?? null)
            : null;

        return (
          <Space size={4}>
            <InputNumber
              size="small"
              min={0}
              value={displayQty ?? undefined}
              placeholder="0"
              style={{
                width: 70,
                borderColor: edits[row.id]?.qty !== undefined ? '#faad14' : undefined,
              }}
              onChange={(v) => setQty(row.id, v)}
              onPressEnter={() => handleSave(row)}
              onBlur={() => handleSave(row)}
            />
            {row.confirmed && edits[row.id] === undefined && (
              <Text style={{ color: '#52c41a', fontSize: 14 }}>✓</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Ghi chú',
      key: 'note',
      render: (_, row) => {
        const editNote = edits[row.id]?.note;
        return (
          <Input
            size="small"
            value={editNote !== undefined ? editNote : (row.note ?? '')}
            placeholder="..."
            onChange={(e) => setNote(row.id, e.target.value)}
            onPressEnter={() => handleSave(row)}
            onBlur={() => handleSave(row)}
          />
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>🗑️ Danh Sách Hủy Bánh</Title>

      <Card bodyStyle={{ padding: '12px 16px' }}>
        <Space style={{ marginBottom: 12, width: '100%' }} size={6}>
          <Button
            icon={<LeftOutlined />}
            size="small"
            onClick={() => setDate((d) => d.subtract(1, 'day'))}
          />
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            format="DD/MM/YYYY"
            size="small"
            style={{ width: 130 }}
            allowClear={false}
          />
          <Button
            icon={<RightOutlined />}
            size="small"
            onClick={() => setDate((d) => d.add(1, 'day'))}
            disabled={date.isSame(dayjs(), 'day')}
          />
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => refetch()}
            loading={isLoading}
          />
        </Space>

        {records.length === 0 && !isLoading && (
          <Alert
            type="info"
            message="Chưa có dữ liệu. Hệ thống tạo danh sách sau khi Admin khởi tạo báo cáo ngày."
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        <Table<GroupedRow>
          dataSource={grouped}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 820 }}
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

    </div>
  );
};

export default CancelListPage;
