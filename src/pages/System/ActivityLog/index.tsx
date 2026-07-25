import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Button, Form, Input, Select, DatePicker,
  Tag, Space, Card, Typography, Row, Col,
} from 'antd';
import {
  SearchOutlined, ClearOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { activityLogService } from '../../../api/services/activityLogService';
import type { ActivityLogEntry, ActivityLogParams } from '../../../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Action labels & colors (from dev-ui.html lines 4226–4235) ───────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE:   { label: 'Tạo mới',       color: '#22c55e' },
  UPDATE:   { label: 'Cập nhật',      color: '#3b82f6' },
  DELETE:   { label: 'Xoá',           color: '#ef4444' },
  APPROVE:  { label: 'Duyệt',         color: '#10b981' },
  REJECT:   { label: 'Từ chối',       color: '#f97316' },
  FINALIZE: { label: 'Chốt báo cáo', color: '#0ea5e9' },
  LOGIN:    { label: 'Đăng nhập',     color: '#14b8a6' },
  LOGOUT:   { label: 'Đăng xuất',     color: '#94a3b8' },
};

const ACTION_OPTIONS = [
  { label: 'Tất cả', value: '' },
  ...Object.entries(ACTION_META).map(([k, v]) => ({ label: v.label, value: k })),
];

const PAGE_SIZE = 50;

// ─── Component ────────────────────────────────────────────────────────────────

const ActivityLogPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [form] = Form.useForm();

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadLogs = useCallback(async (filters: ActivityLogParams, pageNum = 0) => {
    setLoading(true);
    try {
      const data = await activityLogService.getLog({
        ...filters,
        page: pageNum,
        size: PAGE_SIZE,
      });
      const entries = data?.content ?? (data as unknown as ActivityLogEntry[]) ?? [];
      setLogs(entries);
      setTotal(data?.totalElements ?? entries.length);
      setPage(pageNum);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs({}); }, [loadLogs]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    const values = form.getFieldsValue();
    const { dateRange, ...rest } = values;
    const params: ActivityLogParams = {
      actorName:   rest.actorName   || undefined,
      action:      rest.action      || undefined,
      entityName:  rest.entityName  || undefined,
      entityLabel: rest.entityLabel || undefined,
    };
    if (dateRange?.[0]) params.from = dayjs(dateRange[0]).toISOString();
    if (dateRange?.[1]) params.to   = dayjs(dateRange[1]).toISOString();
    loadLogs(params);
  };

  const handleClear = () => {
    form.resetFields();
    loadLogs({});
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<ActivityLogEntry> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (
        <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {dayjs(v).format('DD/MM/YY HH:mm:ss')}
        </Text>
      ),
    },
    {
      title: 'Người dùng',
      dataIndex: 'actorName',
      key: 'actorName',
      width: 130,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (v: string) => {
        const meta = ACTION_META[v] ?? { label: v, color: '#6b7280' };
        return (
          <Tag
            style={{
              background: `${meta.color}1a`,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: 'Màn hình',
      dataIndex: 'entityName',
      key: 'entityName',
      width: 130,
      render: (v: string) => (
        <Tag style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Đối tượng',
      dataIndex: 'entityLabel',
      key: 'entityLabel',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) =>
        v ? (
          <Text style={{ fontSize: 12, color: '#64748b' }}>{v}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>📜 Nhật ký hoạt động</Title>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" size="small" onFinish={handleSearch}>
          <Row gutter={[8, 8]} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="actorName" style={{ marginBottom: 0, width: '100%' }}>
                <Input placeholder="Người dùng" allowClear prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="action" style={{ marginBottom: 0, width: '100%' }}>
                <Select
                  placeholder="Hành động"
                  options={ACTION_OPTIONS}
                  allowClear
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="entityName" style={{ marginBottom: 0, width: '100%' }}>
                <Input placeholder="Màn hình (VD: ITEMS)" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="entityLabel" style={{ marginBottom: 0, width: '100%' }}>
                <Input placeholder="Tên đối tượng" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="dateRange" style={{ marginBottom: 0, width: '100%' }}>
                <RangePicker
                  showTime
                  format="DD/MM/YY HH:mm"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row style={{ width: '100%', marginTop: 8 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                style={{ background: '#6366f1', borderColor: '#6366f1' }}
              >
                Tìm kiếm
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={handleClear}
              >
                Xoá lọc
              </Button>
            </Space>
          </Row>
        </Form>
      </Card>

      {/* Table */}
      <Card
        size="small"
        title={
          <span>
            Kết quả: <strong>{total}</strong> bản ghi
            {loading ? ' (đang tải...)' : ''}
          </span>
        }
      >
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} bản ghi`,
            onChange: (p) => {
              const values = form.getFieldsValue();
              const { dateRange, ...rest } = values;
              const params: ActivityLogParams = {
                actorName: rest.actorName || undefined,
                action: rest.action || undefined,
                entityName: rest.entityName || undefined,
                entityLabel: rest.entityLabel || undefined,
              };
              if (dateRange?.[0]) params.from = dayjs(dateRange[0]).toISOString();
              if (dateRange?.[1]) params.to   = dayjs(dateRange[1]).toISOString();
              loadLogs(params, p - 1);
            },
          }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
};

export default ActivityLogPage;
