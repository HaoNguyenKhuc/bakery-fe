import React, { useState, useMemo } from 'react';
import {
  Card, Form, Input, Button, Select, DatePicker, InputNumber,
  Typography, message, Table, Tag, Space, Modal, Row, Col, Tooltip, Alert
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, CheckCircleOutlined,
  ReloadOutlined, ArrowLeftOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { productionRequestService, itemService } from '../../api/services';
import type { ProductionRequestInput, ProductionRequestDetail } from '../../types';

const { Title } = Typography;
const { Option } = Select;

// Helper to safely extract array from API response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content && Array.isArray(data.content)) return data.content;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
};

// Status Badge helper
const renderStatusBadge = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return <Tag color="success" icon={<CheckCircleOutlined />}>Đã duyệt</Tag>;
    case 'PENDING_APPROVAL':
    case 'DRAFT':
    case 'PENDING':
      return <Tag color="warning">Chờ duyệt</Tag>;
    case 'REJECTED':
      return <Tag color="error">Từ chối</Tag>;
    case 'COMPLETED':
      return <Tag color="blue">Hoàn thành</Tag>;
    case 'IN_PROGRESS':
      return <Tag color="processing">Đang SX</Tag>;
    default:
      return <Tag color="default">{status || '—'}</Tag>;
  }
};

interface PRLineInput {
  productId: string;
  plannedQty?: number;
  sortOrder: number;
}

const ProductionRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter state
  const [dailyFilterDate, setDailyFilterDate] = useState<Dayjs>(dayjs());

  // Form states for DAILY / ORDER
  const [dailyType, setDailyType] = useState<'DAILY' | 'ORDER' | 'SEMI'>('DAILY');
  const [dailyDate, setDailyDate] = useState<Dayjs>(dayjs());
  const [dailyNote, setDailyNote] = useState<string>('');
  const [dailyLines, setDailyLines] = useState<PRLineInput[]>([
    { productId: '', plannedQty: undefined, sortOrder: 1 }
  ]);

  // 1. Fetch all items (Products & Semi Products)
  const { data: itemsRaw, isLoading: itemsLoading } = useQuery({
    queryKey: ['items-all-products-and-semi'],
    queryFn: () => itemService.getAllItemsUnpaginated({}),
    retry: false,
  });

  const allItems = useMemo(() => extractArray(itemsRaw), [itemsRaw]);

  // Filter products for DAILY / ORDER
  const productOptions = useMemo(() => {
    return allItems
      .filter((item) => item.itemType === 'PRODUCT' || item.itemType === 'SEMI_PRODUCT' || !item.itemType)
      .map((item) => ({
        value: item.id,
        label: `[${item.code || 'SP'}] ${item.name}`,
        unit: item.baseUnit || item.unit || 'cái',
        type: item.itemType
      }));
  }, [allItems]);

  // 2. Fetch Production Requests List
  const {
    data: prListRaw,
    isLoading: prListLoading,
    refetch: refetchPRs
  } = useQuery({
    queryKey: ['production-requests-list-unpaginated'],
    queryFn: () => productionRequestService.list({ size: 200 }),
    retry: false,
  });

  const allPRs: ProductionRequestDetail[] = useMemo(() => extractArray(prListRaw), [prListRaw]);

  // Filter PRs for DAILY / ORDER Table
  const dailyPRList = useMemo(() => {
    const targetDateStr = dailyFilterDate.format('YYYY-MM-DD');
    return allPRs.filter((r) => {
      const rDate = r.productionDate?.slice(0, 10);
      return rDate === targetDateStr && r.productionType !== 'SEMI';
    });
  }, [allPRs, dailyFilterDate]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Create PR Mutation
  const createMutation = useMutation({
    mutationFn: (data: ProductionRequestInput) => productionRequestService.create(data),
    onSuccess: (res) => {
      message.success(`✅ Đã tạo phiếu sản xuất (${res?.code || 'Thành công'})!`);
      queryClient.invalidateQueries({ queryKey: ['production-requests-list-unpaginated'] });
      queryClient.invalidateQueries({ queryKey: ['production-requests'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Lỗi khi tạo phiếu sản xuất!');
    }
  });

  // Approve PR Mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => productionRequestService.approve(id),
    onSuccess: () => {
      message.success('✅ Đã phê duyệt lệnh sản xuất!');
      queryClient.invalidateQueries({ queryKey: ['production-requests-list-unpaginated'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Lỗi khi duyệt lệnh sản xuất!');
    }
  });

  // Approve All Mutation
  const approveAllMutation = useMutation({
    mutationFn: (dateStr: string) => productionRequestService.approveAll(dateStr),
    onSuccess: (res) => {
      const count = Array.isArray(res) ? res.length : '';
      message.success(`✅ Đã duyệt toàn bộ ${count} lệnh sản xuất trong ngày!`);
      queryClient.invalidateQueries({ queryKey: ['production-requests-list-unpaginated'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Lỗi khi duyệt toàn bộ phiếu!');
    }
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveDaily = () => {
    const validLines = dailyLines
      .filter((l) => l.productId && (l.plannedQty ?? 0) > 0)
      .map((l, idx) => ({
        productId: l.productId,
        plannedQty: Number(l.plannedQty),
        sortOrder: l.sortOrder || idx + 1
      }));

    if (validLines.length === 0) {
      message.warning('⚠️ Vui lòng nhập ít nhất 1 dòng sản phẩm có số lượng > 0!');
      return;
    }

    createMutation.mutate({
      productionType: dailyType,
      productionDate: dailyDate.format('YYYY-MM-DD'),
      note: dailyNote || undefined,
      lines: validLines
    }, {
      onSuccess: () => {
        // Reset form
        setDailyLines([{ productId: '', plannedQty: undefined, sortOrder: 1 }]);
        setDailyNote('');
      }
    });
  };

  const handleApproveAllDaily = () => {
    const dateStr = dailyFilterDate.format('YYYY-MM-DD');
    Modal.confirm({
      title: '✅ Phê duyệt toàn bộ',
      content: `Bạn có chắc chắn muốn duyệt tất cả lệnh sản xuất trong ngày ${dailyFilterDate.format('DD/MM/YYYY')}?`,
      okText: 'Duyệt tất cả',
      cancelText: 'Hủy',
      onOk: () => approveAllMutation.mutate(dateStr)
    });
  };

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderDetailTable = (record: ProductionRequestDetail) => {
    const lines = record.lines || [];
    const hasCompleted = lines.some((l: any) => l.lineStatus === 'COMPLETED');

    return (
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        {hasCompleted && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={
              <span>
                ⚠️ Có dòng sản phẩm đã hoàn thành. Hãy vào trang{' '}
                <a onClick={() => navigate('/delivery')} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                  🚚 Giao nhận Bếp → Shop
                </a>{' '}
                để Shop xác nhận và chuyển kho (chọn ngày: <strong>{record.productionDate}</strong>).
              </span>
            }
          />
        )}
        <Table
          dataSource={lines}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Sản phẩm / BTP',
              key: 'product',
              render: (_, l: any) => <strong>{l.product?.name || l.product?.key || '—'}</strong>
            },
            {
              title: 'Đơn vị',
              key: 'unit',
              width: 80,
              render: (_, l: any) => l.unit || l.product?.unit || '—'
            },
            {
              title: 'Kế hoạch',
              key: 'plannedQty',
              align: 'right',
              width: 100,
              render: (_, l: any) => <span style={{ color: '#0284c7', fontWeight: 600 }}>{l.plannedQty}</span>
            },
            {
              title: 'Bếp làm',
              key: 'produced',
              align: 'right',
              width: 100,
              render: (_, l: any) => l.deliveryRecord?.qtyProduced ?? '—'
            },
            {
              title: 'Shop nhận',
              key: 'received',
              align: 'right',
              width: 100,
              render: (_, l: any) => l.deliveryRecord?.qtyReceived ?? '—'
            },
            {
              title: 'Trạng thái line',
              key: 'status',
              width: 120,
              render: (_, l: any) => renderStatusBadge(l.lineStatus)
            }
          ]}
        />
      </div>
    );
  };

  const dailyColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <strong style={{ color: '#0f172a' }}>{code || '—'}</strong>
    },
    {
      title: 'Ngày SX',
      dataIndex: 'productionDate',
      key: 'productionDate',
      width: 110,
      render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '—'
    },
    {
      title: 'Loại',
      dataIndex: 'productionType',
      key: 'productionType',
      width: 100,
      render: (t: string) => (
        <Tag color={t === 'DAILY' ? 'blue' : t === 'ORDER' ? 'purple' : 'cyan'}>
          {t}
        </Tag>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 120,
      render: (st: string) => renderStatusBadge(st)
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record: ProductionRequestDetail) => {
        const canApprove = record.approvalStatus === 'DRAFT' || record.approvalStatus === 'PENDING_APPROVAL' || record.approvalStatus === 'PENDING';
        return (
          <Space>
            {canApprove && (
              <Tooltip title="Phê duyệt nhanh">
                <Button
                  type="primary"
                  size="small"
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                  icon={<CheckCircleOutlined />}
                  loading={approveMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    approveMutation.mutate(record.id);
                  }}
                >
                  Duyệt
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '0 8px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/prod-requests')}>
            Quay lại danh sách
          </Button>
          <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
            📋 Phiếu Sản Xuất (DAILY / ORDER)
          </Title>
        </Space>
        <Space>
          <Button icon={<UnorderedListOutlined />} onClick={() => navigate('/prod-requests')}>
            Danh sách tổng hợp
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetchPRs()}>
            Làm mới dữ liệu
          </Button>
        </Space>
      </div>

      {/* Main Content (2-Column Layout without Tabs) */}
      <Row gutter={[20, 20]}>
        {/* Left Col: Create DAILY / ORDER Form */}
        <Col xs={24} lg={10} xl={9}>
          <Card
            title={<span style={{ fontSize: 16, color: '#1e293b' }}>✨ Tạo phiếu SX (DAILY / ORDER)</span>}
            bordered={false}
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}
          >
            <Form layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label={<span style={{ fontWeight: 600 }}>Loại lệnh *</span>}>
                    <Select
                      value={dailyType}
                      onChange={(v) => setDailyType(v)}
                      size="large"
                    >
                      <Option value="DAILY">DAILY — Theo kế hoạch</Option>
                      <Option value="ORDER">ORDER — Đơn phát sinh</Option>
                      <Option value="SEMI">SEMI — Bán thành phẩm</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<span style={{ fontWeight: 600 }}>Ngày SX *</span>}>
                    <DatePicker
                      value={dailyDate}
                      onChange={(d) => d && setDailyDate(d)}
                      format="DD/MM/YYYY"
                      size="large"
                      style={{ width: '100%' }}
                      allowClear={false}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Ghi chú">
                <Input.TextArea
                  value={dailyNote}
                  onChange={(e) => setDailyNote(e.target.value)}
                  placeholder="Nhập ghi chú lệnh sản xuất nếu có..."
                  rows={2}
                />
              </Form.Item>

              {/* Product Lines Section */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                    📦 Danh sách dòng sản phẩm ({dailyLines.length})
                  </span>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setDailyLines([...dailyLines, { productId: '', plannedQty: undefined, sortOrder: dailyLines.length + 1 }])}
                  >
                    Thêm dòng
                  </Button>
                </div>

                <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                  {dailyLines.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 100px 60px 32px',
                        gap: 8,
                        marginBottom: 10,
                        alignItems: 'center',
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9'
                      }}
                    >
                      <Select
                        showSearch
                        placeholder="Chọn sản phẩm / BTP..."
                        value={line.productId || undefined}
                        onChange={(val) => {
                          const newLines = [...dailyLines];
                          newLines[idx].productId = val;
                          setDailyLines(newLines);
                        }}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        options={productOptions}
                        loading={itemsLoading}
                      />
                      <InputNumber
                        placeholder="Số lượng"
                        min={0.5}
                        step={0.5}
                        value={line.plannedQty}
                        onChange={(val) => {
                          const newLines = [...dailyLines];
                          newLines[idx].plannedQty = val || undefined;
                          setDailyLines(newLines);
                        }}
                        style={{ width: '100%' }}
                      />
                      <InputNumber
                        placeholder="Sort"
                        min={1}
                        value={line.sortOrder}
                        onChange={(val) => {
                          const newLines = [...dailyLines];
                          newLines[idx].sortOrder = val || idx + 1;
                          setDailyLines(newLines);
                        }}
                        style={{ width: '100%' }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={dailyLines.length === 1 && idx === 0 && !line.productId}
                        onClick={() => {
                          const newLines = dailyLines.filter((_, i) => i !== idx);
                          setDailyLines(newLines.length ? newLines : [{ productId: '', plannedQty: undefined, sortOrder: 1 }]);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                block
                loading={createMutation.isPending}
                onClick={handleSaveDaily}
                style={{ marginTop: 12, height: 44, fontSize: 15, fontWeight: 600, background: '#0284c7' }}
              >
                Tạo phiếu sản xuất
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Right Col: DAILY / ORDER PR List */}
        <Col xs={24} lg={14} xl={15}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, color: '#1e293b' }}>📋 Danh sách phiếu SX trong ngày</span>
                <Space>
                  <DatePicker
                    value={dailyFilterDate}
                    onChange={(d) => d && setDailyFilterDate(d)}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
                    icon={<CheckCircleOutlined />}
                    loading={approveAllMutation.isPending}
                    onClick={handleApproveAllDaily}
                  >
                    ✅ Approve All
                  </Button>
                </Space>
              </div>
            }
            bordered={false}
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}
          >
            <Table
              dataSource={dailyPRList}
              columns={dailyColumns}
              rowKey="id"
              loading={prListLoading}
              pagination={{ pageSize: 10 }}
              expandable={{
                expandedRowRender: renderDetailTable,
                expandRowByClick: true
              }}
              locale={{ emptyText: 'Chưa có phiếu sản xuất nào trong ngày này' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductionRequestForm;
