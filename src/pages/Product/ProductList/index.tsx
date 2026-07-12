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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
          productCategory: editProduct.productCategory,
          unit: editProduct.unit,
          sellingPrice: editProduct.sellingPrice,
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

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="productCategory"
              label="Danh Mục"
            >
              <Input placeholder="VD: Bánh Kem" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="sellingPrice"
              label="Giá Bán (VNĐ)"
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
                placeholder="VD: 50,000"
              />
            </Form.Item>
          </Col>
        </Row>
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

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const debouncedSearchText = useDebounce(searchText, 500);

  const {
    data: activeData,
    isLoading: activeLoading,
    isError: activeError,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['products', 'APPROVED', debouncedSearchText],
    queryFn: () => productService.getAllProducts({ search: debouncedSearchText, approvalStatus: 'APPROVED', page: 0, size: 500 }),
    retry: false,
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['products', 'PENDING_APPROVAL', debouncedSearchText],
    queryFn: () => productService.getAllProducts({ search: debouncedSearchText, approvalStatus: 'PENDING_APPROVAL', page: 0, size: 500 }),
    retry: false,
  });

  const {
    data: rejectedData,
    isLoading: rejectedLoading,
    isError: rejectedError,
    refetch: refetchRejected,
  } = useQuery({
    queryKey: ['products', 'REJECTED', debouncedSearchText],
    queryFn: () => productService.getAllProducts({ search: debouncedSearchText, approvalStatus: 'REJECTED', page: 0, size: 500 }),
    retry: false,
  });

  // Helper: handles direct array OR { data: [...] } envelope from backend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toArray = <T,>(raw: any): T[] => {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object' && Array.isArray(raw.content)) return raw.content as T[];
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) return raw.data as T[];
    return [];
  };

  const activeProducts = toArray<Product>(activeData);
  const pendingCommands = toArray<Product>(pendingData);
  const rejectedCommands = toArray<Product>(rejectedData);

  const handleRefreshAll = () => {
    refetchActive();
    refetchPending();
    refetchRejected();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: ProductRequest) => productService.submitCreate(data),
    onSuccess: () => {
      message.success('Tạo sản phẩm thành công.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDrawerOpen(false);
    },
    onError: () => message.error('Tạo sản phẩm thất bại. Vui lòng thử lại.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductRequest }) =>
      productService.submitUpdate(id, data),
    onSuccess: () => {
      message.success('Cập nhật sản phẩm thành công.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
    mutationFn: (id: string) => productService.approve(id),
    onSuccess: () => {
      message.success('Đã phê duyệt sản phẩm.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => message.error('Phê duyệt thất bại. Vui lòng thử lại.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productService.reject(id, reason),
    onSuccess: () => {
      message.warning('Đã từ chối sản phẩm.');
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => message.error('Từ chối thất bại. Vui lòng thử lại.'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleApprove = (product: Product) => {
    Modal.confirm({
      title: 'Phê duyệt sản phẩm',
      content: `Bạn có chắc chắn muốn phê duyệt sản phẩm "${product.name}"?`,
      onOk: () => approveMutation.mutate(product.id),
      okText: 'Phê Duyệt',
      cancelText: 'Hủy',
    });
  };

  const handleOpenRejectModal = (product: Product) => {
    setRejectTargetId(product.id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = () => {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    rejectMutation.mutate({ id: rejectTargetId, reason: rejectReason });
  };

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

  // Removed filteredActive since we rely on server side search


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

  const pendingColumns: ColumnsType<Product> = [
    {
      title: 'Tên Sản Phẩm',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Mã SP',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—',
    },
    {
      title: 'Duyệt / Từ Chối',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
            title="Duyệt"
          />
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleOpenRejectModal(record)}
            title="Từ Chối"
          />
        </Space>
      ),
    },
  ];

  // ── Rejected Tab Columns ───────────────────────────────────────────────────────

  const rejectedColumns: ColumnsType<Product> = [
    {
      title: 'Tên Sản Phẩm',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Mã SP',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Người Tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—',
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
          <Badge count={activeProducts.length} color="#52c41a" />
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
            dataSource={activeProducts}
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
        <Table<Product>
          columns={pendingColumns}
          dataSource={pendingCommands}
          loading={pendingLoading}
          rowKey="id"
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
        <Table<Product>
          columns={rejectedColumns}
          dataSource={rejectedCommands}
          loading={rejectedLoading}
          rowKey="id"
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

      <Modal
        title="Từ Chối Sản Phẩm"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => setRejectModalOpen(false)}
        confirmLoading={rejectMutation.isPending}
        okText="Gửi"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8 }}>Vui lòng nhập lý do từ chối:</div>
        <Input.TextArea
          rows={4}
          placeholder="Lý do..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

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
