import React, { useState } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Modal, Form, Select, InputNumber, Divider, Alert,
  Tooltip, Popconfirm, Badge, Row, Col, Timeline,
  message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, CheckOutlined, CloseOutlined,
  HistoryOutlined, EyeOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { productService } from '../../../api/services';
import type {
  Product, ProductRequest, ProductCommand, ProductHistory,
  ProductType, ProductUnit,
} from '../../../types';

const { Title, Text } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  STANDARD: 'Theo cái',
  SHEET_CAKE: 'Theo kg',
};

const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  PCS: 'PCS (cái)',
  KG: 'KG',
};

// ─── (Dummy data removed — page now uses live API) ───────────────────────────

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

interface ProductModalProps {
  open: boolean;
  editProduct?: Product | null;
  onClose: () => void;
  onSubmit: (values: ProductRequest) => void;
  submitting: boolean;
}

const ProductDrawer: React.FC<ProductModalProps> = ({
  open, editProduct, onClose, onSubmit, submitting,
}) => {
  const [form] = Form.useForm<ProductRequest>();

  React.useEffect(() => {
    if (open) {
      if (editProduct) {
        form.setFieldsValue({
          code: editProduct.code,
          name: editProduct.name,
          productType: editProduct.productType,
          unit: editProduct.unit,
          toleranceRate: editProduct.toleranceRate,
          isActive: editProduct.isActive,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editProduct, form]);

  const handleFinish = (values: ProductRequest) => {
    onSubmit(values);
  };

  return (
    <Modal
      title={editProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editProduct ? 'Gửi Cập Nhật' : 'Gửi Tạo Mới'}
      cancelText="Huỷ"
      confirmLoading={submitting}
      width={540}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message="Lệnh sẽ ở trạng thái Chờ Duyệt cho đến khi Admin phê duyệt."
        style={{ marginBottom: 20 }}
      />
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="code"
          label="Mã Sản Phẩm (IN-CODE)"
          rules={[
            { required: true, message: 'Vui lòng nhập mã sản phẩm' },
            { max: 50, message: 'Tối đa 50 ký tự' },
          ]}
        >
          <Input placeholder="VD: BM001" disabled={!!editProduct} />
        </Form.Item>

        <Form.Item
          name="name"
          label="Tên Sản Phẩm"
          rules={[
            { required: true, message: 'Vui lòng nhập tên sản phẩm' },
            { max: 200, message: 'Tối đa 200 ký tự' },
          ]}
        >
          <Input placeholder="VD: Bánh Mì Bơ Tỏi" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="productType"
              label="Loại Sản Phẩm"
              rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
            >
              <Select placeholder="Chọn loại">
                <Select.Option value="STANDARD">STANDARD (Theo cái)</Select.Option>
                <Select.Option value="SHEET_CAKE">SHEET_CAKE (Theo kg)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="unit"
              label="Đơn Vị"
              rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}
            >
              <Select placeholder="Chọn đơn vị">
                <Select.Option value="PCS">PCS (cái)</Select.Option>
                <Select.Option value="KG">KG</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="toleranceRate"
          label="Tỷ Lệ Chênh Lệch Cho Phép"
          tooltip="Tỷ lệ phần trăm chênh lệch. VD: 0.05 = 5%"
        >
          <InputNumber
            min={0} max={1} step={0.01}
            placeholder="0.05"
            style={{ width: '100%' }}
            formatter={(v) => `${((Number(v) || 0) * 100).toFixed(0)}%`}
            parser={(v) => Number((v || '0').replace('%', '')) / 100}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── History Modal ────────────────────────────────────────────────────────────

interface HistoryModalProps {
  open: boolean;
  productId: string | null;
  onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ open, productId, onClose }) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: () => productService.getHistory(productId!),
    enabled: open && !!productId,
  });

  const historyData = Array.isArray(history) ? history : [];

  return (
    <Modal
      title="Lịch Sử Thay Đổi"
      open={open}
      onCancel={onClose}
      footer={null}
      width={580}
    >
      {isLoading ? (
        <Text type="secondary">Đang tải...</Text>
      ) : historyData.length === 0 ? (
        <Alert type="info" message="Chưa có lịch sử thay đổi." showIcon />
      ) : (
        <Timeline
          items={historyData.map((h: ProductHistory) => ({
            color: h.action === 'CREATE' ? 'green' : h.action === 'DELETE' ? 'red' : 'blue',
            children: (
              <div>
                <Text strong>{h.action}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {dayjs(h.createdAt).format('HH:mm DD/MM/YYYY')} — {h.createdBy}
                </Text>
              </div>
            ),
          }))}
        />
      )}
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: activeData,
    isLoading: activeLoading,
    isError: activeError,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => productService.getActive(),
    retry: false,
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['products', 'pending'],
    queryFn: () => productService.getPending(),
    retry: false,
  });

  const {
    data: rejectedData,
    isLoading: rejectedLoading,
    isError: rejectedError,
    refetch: refetchRejected,
  } = useQuery({
    queryKey: ['products', 'rejected'],
    queryFn: () => productService.getRejected(),
    retry: false,
  });

  // Helper: handles direct array OR { data: [...] } envelope from backend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toArray = <T,>(raw: any): T[] => {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) return raw.data as T[];
    return [];
  };

  const activeProducts   = toArray<Product>(activeData);
  const pendingCommands  = toArray<ProductCommand>(pendingData);
  const rejectedCommands = toArray<ProductCommand>(rejectedData);


  const handleRefreshAll = () => {
    refetchActive();
    refetchPending();
    refetchRejected();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: ProductRequest) => productService.submitCreate(data),
    onSuccess: () => {
      message.success('Đã gửi lệnh tạo sản phẩm. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['products', 'pending'] });
      setDrawerOpen(false);
    },
    onError: () => message.error('Gửi lệnh thất bại. Vui lòng thử lại.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductRequest }) =>
      productService.submitUpdate(id, data),
    onSuccess: () => {
      message.success('Đã gửi lệnh cập nhật. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['products', 'pending'] });
      setDrawerOpen(false);
      setEditProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.submitDelete(id),
    onSuccess: () => {
      message.success('Đã gửi lệnh xoá. Chờ Admin phê duyệt.');
      queryClient.invalidateQueries({ queryKey: ['products', 'pending'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (commandId: string) => productService.approve(commandId),
    onSuccess: () => {
      message.success('Đã phê duyệt lệnh.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (commandId: string) => productService.reject(commandId),
    onSuccess: () => {
      message.warning('Đã từ chối lệnh.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleDrawerSubmit = (values: ProductRequest) => {
    if (editProduct) {
      updateMutation.mutate({ id: editProduct.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filteredActive = activeProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      p.code.toLowerCase().includes(searchText.toLowerCase()),
  );

  // ── Active Tab Columns ─────────────────────────────────────────────────────────

  const activeColumns: ColumnsType<Product> = [
    {
      title: 'Mã SP',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Tên Sản Phẩm',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Loại',
      dataIndex: 'productType',
      key: 'productType',
      width: 140,
      render: (v: ProductType) => (
        <Tag color={v === 'SHEET_CAKE' ? 'purple' : 'blue'}>
          {PRODUCT_TYPE_LABELS[v]}
        </Tag>
      ),
      filters: [
        { text: 'Theo cái', value: 'STANDARD' },
        { text: 'Theo kg', value: 'SHEET_CAKE' },
      ],
      onFilter: (value, record) => record.productType === value,
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      render: (v: ProductUnit) => <Tag>{PRODUCT_UNIT_LABELS[v]}</Tag>,
    },
    {
      title: 'Tỷ Lệ Chênh Lệch',
      dataIndex: 'toleranceRate',
      key: 'toleranceRate',
      width: 150,
      align: 'center',
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: 'Công Thức',
      key: 'activeRecipe',
      width: 120,
      align: 'center',
      render: (_: unknown, record: Product) => (
        record.activeRecipe
          ? <Tag color="green">Có</Tag>
          : <Tag color="red">Chưa có</Tag>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_: unknown, record: Product) => (
        <Space size={4}>
          <Tooltip title="Xem lịch sử">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => setHistoryProductId(record.id)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá sản phẩm"
            description={`Lệnh xoá "${record.name}" sẽ được gửi đến Admin để phê duyệt.`}
            onConfirm={() => handleDelete(record.id)}
            okText="Gửi Lệnh Xoá"
            cancelText="Huỷ"
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          >
            <Tooltip title="Xoá">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Pending Tab Columns ────────────────────────────────────────────────────────

  const pendingColumns: ColumnsType<ProductCommand> = [
    {
      title: 'Command ID',
      dataIndex: 'commandId',
      key: 'commandId',
      width: 230,
      ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Hành Động',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (v: string) => {
        const colors: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red' };
        return <Tag color={colors[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: 'Tên Sản Phẩm',
      key: 'name',
      render: (_: unknown, r: ProductCommand) => r.payload.name,
    },
    {
      title: 'Mã SP',
      key: 'code',
      width: 100,
      render: (_: unknown, r: ProductCommand) => <Text code>{r.payload.code}</Text>,
    },
    {
      title: 'Người Gửi',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 150,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Duyệt / Từ Chối',
      key: 'approve',
      width: 160,
      align: 'center',
      render: (_: unknown, record: ProductCommand) => (
        <Space>
          <Tooltip title="Phê duyệt">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => approveMutation.mutate(record.commandId)}
              loading={approveMutation.isPending}
            >
              Duyệt
            </Button>
          </Tooltip>
          <Tooltip title="Từ chối">
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => rejectMutation.mutate(record.commandId)}
              loading={rejectMutation.isPending}
            >
              Từ Chối
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ── Rejected Tab Columns ───────────────────────────────────────────────────────

  const rejectedColumns: ColumnsType<ProductCommand> = [
    {
      title: 'Hành Động',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (v: string) => {
        const colors: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red' };
        return <Tag color={colors[v]}>{v}</Tag>;
      },
    },
    {
      title: 'Tên Sản Phẩm',
      key: 'name',
      render: (_: unknown, r: ProductCommand) => r.payload.name,
    },
    {
      title: 'Người Gửi',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YYYY'),
    },
    {
      title: 'Lý Do Từ Chối',
      dataIndex: 'rejectedReason',
      key: 'rejectedReason',
      render: (v: string) => <Text type="danger">{v || '—'}</Text>,
    },
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'active',
      label: (
        <Space>
          Đang Active
          <Badge count={filteredActive.length} color="#52c41a" />
        </Space>
      ),
      children: (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Input
              placeholder="Tìm theo tên hoặc mã sản phẩm..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 380 }}
            />
          </div>
          <Table<Product>
            columns={activeColumns}
            dataSource={filteredActive}
            loading={activeLoading}
            rowKey="id"
            size="middle"
            pagination={{
              pageSize: 8,
              showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} sản phẩm`,
            }}
          />
        </>
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingCommands.length > 0 && (
            <Badge count={pendingCommands.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <Table<ProductCommand>
          columns={pendingColumns}
          dataSource={pendingCommands}
          loading={pendingLoading}
          rowKey="commandId"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
    {
      key: 'rejected',
      label: (
        <Space>
          Bị Từ Chối
          {rejectedCommands.length > 0 && (
            <Badge count={rejectedCommands.length} color="#ff4d4f" />
          )}
        </Space>
      ),
      children: (
        <Table<ProductCommand>
          columns={rejectedColumns}
          dataSource={rejectedCommands}
          loading={rejectedLoading}
          rowKey="commandId"
          size="middle"
          pagination={{ pageSize: 8 }}
        />
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Quản Lý Sản Phẩm</Title>
          <Text type="secondary">Tạo, chỉnh sửa và phê duyệt sản phẩm theo quy trình duyệt lệnh</Text>
        </div>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            onClick={handleRefreshAll}
            loading={activeLoading || pendingLoading || rejectedLoading}
          >
            Làm Mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditProduct(null); setDrawerOpen(true); }}
          >
            Thêm Sản Phẩm
          </Button>
        </Space>
      </div>

      {/* API Error banners */}
      {activeError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách sản phẩm active."
          description="Kiểm tra kết nối đến backend (http://localhost:8080)."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchActive()}>Thử lại</Button>}
        />
      )}
      {pendingError && (
        <Alert
          type="warning"
          showIcon
          message="Không tải được danh sách lệnh chờ duyệt."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchPending()}>Thử lại</Button>}
        />
      )}
      {rejectedError && (
        <Alert
          type="warning"
          showIcon
          message="Không tải được danh sách lệnh bị từ chối."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetchRejected()}>Thử lại</Button>}
        />
      )}

      <Divider style={{ margin: '0 0 20px' }} />

      {/* Tabs */}
      <Tabs defaultActiveKey="active" items={tabItems} />

      {/* Drawer */}
      <ProductDrawer
        open={drawerOpen}
        editProduct={editProduct}
        onClose={() => { setDrawerOpen(false); setEditProduct(null); }}
        onSubmit={handleDrawerSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* History Modal */}
      <HistoryModal
        open={!!historyProductId}
        productId={historyProductId}
        onClose={() => setHistoryProductId(null)}
      />
    </div>
  );
};

export default ProductList;
