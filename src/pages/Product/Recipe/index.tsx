import React, { useState } from 'react';
import {
  Table, Button, Select, Space, Typography, Tag,
  Form, Input, InputNumber, Divider, Badge, Alert,
  Popconfirm, Row, Col, Card, Tooltip, Modal, message,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExperimentOutlined, DeleteOutlined, SaveOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { recipeService, itemService } from '../../../api/services';
import type {
  Product, Recipe, RecipeLine, RecipeRequest, RecipeLineRequest,
  RecipeType, RecipeLineType, ProductUnit,
} from '../../../types';

const { Title, Text } = Typography;

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_TYPE_OPTIONS: { value: RecipeLineType; label: string; color: string }[] = [
  { value: 'PHOI', label: 'Phôi', color: 'blue' },
  { value: 'NHAN_CHINH', label: 'Nhân Chính', color: 'green' },
  { value: 'NHAN_PHU', label: 'Nhân Phụ', color: 'orange' },
  { value: 'TRANG_TRI', label: 'Trang Trí', color: 'purple' },
];

const LINE_TYPE_LABELS: Record<RecipeLineType, string> = {
  PHOI: 'Phôi',
  NHAN_CHINH: 'Nhân Chính',
  NHAN_PHU: 'Nhân Phụ',
  TRANG_TRI: 'Trang Trí',
};

const LINE_TYPE_COLORS: Record<RecipeLineType, string> = {
  PHOI: 'blue',
  NHAN_CHINH: 'green',
  NHAN_PHU: 'orange',
  TRANG_TRI: 'purple',
};

// ─── Dummy fallback data ──────────────────────────────────────────────────────

const dummyProducts: Product[] = [
  {
    id: '1', code: 'BM001', name: 'Bánh Mì Bơ Tỏi',
    itemType: 'PRODUCT', productType: 'STANDARD', unit: 'PCS', isActive: true,
    activeRecipe: null, status: 'ACTIVE', approvalStatus: 'APPROVED', rejectedReason: null,
    createdBy: 'admin', createdAt: '2026-01-10T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-01-10T07:00:00Z',
  },
  {
    id: '2', code: 'BK001', name: 'Bánh Kem Socola',
    itemType: 'PRODUCT', productType: 'SHEET_CAKE', unit: 'KG', isActive: true,
    activeRecipe: null, status: 'ACTIVE', approvalStatus: 'APPROVED', rejectedReason: null,
    createdBy: 'admin', createdAt: '2026-01-11T07:00:00Z',
    updatedBy: 'admin', updatedAt: '2026-01-11T07:00:00Z',
  },
];

const dummyRecipes: Recipe[] = [
  {
    id: 'r1', version: 1, isActive: true,
    effectiveDate: '2026-01-15', recipeType: 'BASE', note: 'Công thức gốc',
    lines: [
      { ingredientId: 'ing-1', ingredientCode: 'BOT01', ingredientName: 'Bột mì số 11', quantityGram: 500, lineType: 'PHOI' },
      { ingredientId: 'ing-2', ingredientCode: 'BO01', ingredientName: 'Bơ lạt Président', quantityGram: 100, lineType: 'NHAN_CHINH' },
      { ingredientId: 'ing-3', ingredientCode: 'TI01', ingredientName: 'Tỏi băm', quantityGram: 30, lineType: 'TRANG_TRI' },
    ],
  },
  {
    id: 'r2', version: 2, isActive: false,
    effectiveDate: '2026-03-01', recipeType: 'ADDON', note: 'Phiên bản tùy chỉnh cho khách đặt thêm kem',
    lines: [
      { ingredientId: 'ing-1', ingredientCode: 'BOT01', ingredientName: 'Bột mì số 11', quantityGram: 500, lineType: 'PHOI' },
      { ingredientId: 'ing-4', ingredientCode: 'KEM01', ingredientName: 'Kem tươi', quantityGram: 200, lineType: 'NHAN_CHINH' },
    ],
  },
];

// ─── RecipeLine Editor ────────────────────────────────────────────────────────

interface RecipeLineRow {
  rowKey: string;
  ingredientId?: string;
  semiProductId?: string;
  ingredientName?: string;
  quantityGram: number;
  lineType: RecipeLineType;
  note?: string;
  sourceType: 'ingredient' | 'semi-product';
}

interface RecipeLineEditorProps {
  lines: RecipeLineRow[];
  onChange: (lines: RecipeLineRow[]) => void;
}

const RecipeLineEditor: React.FC<RecipeLineEditorProps> = ({ lines, onChange }) => {
  const addLine = () => {
    onChange([
      ...lines,
      {
        rowKey: crypto.randomUUID(),
        sourceType: 'ingredient',
        quantityGram: 0,
        lineType: 'PHOI',
      },
    ]);
  };

  const removeLine = (rowKey: string) => {
    onChange(lines.filter((l) => l.rowKey !== rowKey));
  };

  const updateLine = (rowKey: string, updates: Partial<RecipeLineRow>) => {
    onChange(lines.map((l) => (l.rowKey === rowKey ? { ...l, ...updates } : l)));
  };

  const columns: ColumnsType<RecipeLineRow> = [
    {
      title: 'Nguồn',
      dataIndex: 'sourceType',
      width: 130,
      render: (v: string, record) => (
        <Select
          size="small"
          value={v}
          onChange={(val) =>
            updateLine(record.rowKey, {
              sourceType: val as 'ingredient' | 'semi-product',
              ingredientId: undefined,
              semiProductId: undefined,
              ingredientName: undefined,
            })
          }
          style={{ width: '100%' }}
        >
          <Select.Option value="ingredient">Nguyên liệu</Select.Option>
          <Select.Option value="semi-product">Bán thành phẩm</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Tên',
      dataIndex: 'ingredientName',
      render: (v: string, record) => (
        <Input
          size="small"
          placeholder={record.sourceType === 'ingredient' ? 'Tên nguyên liệu...' : 'Mã bán thành phẩm...'}
          value={v}
          onChange={(e) =>
            updateLine(record.rowKey, {
              ingredientName: e.target.value,
              ...(record.sourceType === 'ingredient'
                ? { ingredientId: e.target.value }
                : { semiProductId: e.target.value }),
            })
          }
        />
      ),
    },
    {
      title: 'Khối Lượng (g)',
      dataIndex: 'quantityGram',
      width: 140,
      render: (v: number, record) => (
        <InputNumber
          size="small"
          min={0}
          value={v}
          style={{ width: '100%' }}
          onChange={(val) => updateLine(record.rowKey, { quantityGram: val ?? 0 })}
          suffix="g"
        />
      ),
    },
    {
      title: 'Loại Dòng',
      dataIndex: 'lineType',
      width: 140,
      render: (v: RecipeLineType, record) => (
        <Select
          size="small"
          value={v}
          onChange={(val) => updateLine(record.rowKey, { lineType: val })}
          style={{ width: '100%' }}
        >
          {LINE_TYPE_OPTIONS.map((opt) => (
            <Select.Option key={opt.value} value={opt.value}>
              {opt.label}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      render: (v: string, record) => (
        <Input
          size="small"
          placeholder="Ghi chú..."
          value={v}
          onChange={(e) => updateLine(record.rowKey, { note: e.target.value })}
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_: unknown, record) => (
        <Popconfirm
          title="Xoá dòng này?"
          onConfirm={() => removeLine(record.rowKey)}
          okText="Xoá"
          cancelText="Huỷ"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Table<RecipeLineRow>
        columns={columns}
        dataSource={lines}
        rowKey="rowKey"
        pagination={false}
        size="small"
        bordered
        locale={{ emptyText: 'Chưa có nguyên liệu nào. Bấm "Thêm Dòng" để bắt đầu.' }}
      />
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addLine}
        style={{ marginTop: 8, width: '100%' }}
      >
        Thêm Dòng Nguyên Liệu
      </Button>
    </div>
  );
};

// ─── Create Recipe Modal ─────────────────────────────────────────────────────

interface CreateRecipeModalProps {
  open: boolean;
  item: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRecipeDrawer: React.FC<CreateRecipeModalProps> = ({
  open, item, onClose, onSuccess,
}) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<RecipeLineRow[]>([]);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (open) {
      form.resetFields();
      setLines([]);
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: (data: RecipeRequest) => recipeService.create(data),
    onSuccess: () => {
      message.success('Tạo phiên bản công thức mới thành công! Phiên bản cũ đã bị deactivate.');
      queryClient.invalidateQueries({ queryKey: ['recipes', item.id] });
      onSuccess();
      onClose();
    },
    onError: () => message.error('Tạo công thức thất bại.'),
  });

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (lines.length === 0) {
      message.error('Công thức phải có ít nhất 1 dòng nguyên liệu.');
      return;
    }

    const recipeLines: RecipeLineRequest[] = lines.map((l) => ({
      ingredientId: l.sourceType === 'ingredient' ? l.ingredientId : undefined,
      semiProductId: l.sourceType === 'semi-product' ? l.semiProductId : undefined,
      quantityGram: l.quantityGram,
      lineType: l.lineType,
      note: l.note,
    }));

    createMutation.mutate({
      productId: item.itemType === 'PRODUCT' ? item.id : undefined,
      semiProductId: item.itemType === 'SEMI_PRODUCT' ? item.id : undefined,
      effectiveDate: values.effectiveDate
        ? dayjs(values.effectiveDate).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD'),
      note: values.note,
      recipeType: values.recipeType || 'BASE',
      lines: recipeLines,
    });
  };

  return (
    <Modal
      title="Tạo Phiên Bản Công Thức Mới"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={<Space><SaveOutlined />Lưu Công Thức</Space>}
      cancelText="Huỷ"
      confirmLoading={createMutation.isPending}
      width={900}
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 } }}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        message="Tạo phiên bản mới sẽ tự động deactivate phiên bản đang hoạt động của cùng sản phẩm."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="recipeType" label="Loại Công Thức" initialValue="BASE">
              <Select>
                <Select.Option value="BASE">BASE (Tiêu chuẩn)</Select.Option>
                <Select.Option value="ADDON">ADDON (Tùy chỉnh)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="effectiveDate" label="Ngày Hiệu Lực">
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="note" label="Ghi Chú">
              <Input placeholder="Lý do tạo phiên bản mới..." />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider>Danh Sách Nguyên Liệu</Divider>
      <RecipeLineEditor lines={lines} onChange={setLines} />
    </Modal>
  );
};

// ─── Recipe Version List ──────────────────────────────────────────────────────

interface RecipeVersionListProps {
  recipes: Recipe[];
  unit: ProductUnit;
  productId: string;
}

const RecipeVersionList: React.FC<RecipeVersionListProps> = ({ recipes, unit, productId }) => {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(
    recipes.find((r) => r.isActive)?.id || null,
  );
  
  const queryClient = useQueryClient();

  const approveMut = useMutation({
    mutationFn: recipeService.approve,
    onSuccess: () => {
      message.success('Đã duyệt công thức!');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
    },
    onError: () => message.error('Duyệt thất bại.'),
  });

  const rejectMut = useMutation({
    mutationFn: recipeService.reject,
    onSuccess: () => {
      message.success('Đã từ chối công thức!');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
    },
    onError: () => message.error('Từ chối thất bại.'),
  });

  const activateMut = useMutation({
    mutationFn: recipeService.activate,
    onSuccess: () => {
      message.success('Đã kích hoạt công thức!');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
    },
    onError: () => message.error('Kích hoạt thất bại.'),
  });

  const cloneMut = useMutation({
    mutationFn: recipeService.clone,
    onSuccess: () => {
      message.success('Nhân bản thành công (Draft)!');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
    },
    onError: () => message.error('Nhân bản thất bại.'),
  });

  const deleteMut = useMutation({
    mutationFn: recipeService.delete,
    onSuccess: () => {
      message.success('Đã xoá!');
      queryClient.invalidateQueries({ queryKey: ['recipes', productId] });
    },
    onError: () => message.error('Xoá thất bại.'),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {recipes.map((recipe) => (
        <Card
          key={recipe.id}
          size="small"
          style={{
            border: recipe.isActive ? '2px solid #52c41a' : '1px solid #d9d9d9',
            borderRadius: 8,
          }}
          title={
            <Space>
              <Text strong>Phiên bản v{recipe.version}</Text>
              {recipe.isActive ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  Đang dùng
                </Tag>
              ) : (
                <Tag icon={<ClockCircleOutlined />} color="default">
                  Cũ
                </Tag>
              )}
              {recipe.approvalStatus && (
                <Tag color={
                  recipe.approvalStatus === 'APPROVED' ? 'success' :
                  recipe.approvalStatus === 'PENDING_APPROVAL' ? 'processing' :
                  recipe.approvalStatus === 'REJECTED' ? 'error' : 'default'
                }>
                  {recipe.approvalStatus}
                </Tag>
              )}
              {recipe.recipeType === 'ADDON' && (
                <Tag color="orange" icon={<ExperimentOutlined />}>
                  ADDON
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Hiệu lực: {dayjs(recipe.effectiveDate).format('DD/MM/YYYY')}
              </Text>
              {recipe.note && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  — {recipe.note}
                </Text>
              )}
            </Space>
          }
          extra={
            <Space>
              {recipe.approvalStatus === 'PENDING_APPROVAL' && (
                <>
                  <Button size="small" type="primary" loading={approveMut.isPending} onClick={() => approveMut.mutate(recipe.id)}>Duyệt</Button>
                  <Button size="small" danger loading={rejectMut.isPending} onClick={() => rejectMut.mutate(recipe.id)}>Từ chối</Button>
                </>
              )}
              {recipe.approvalStatus === 'APPROVED' && !recipe.isActive && (
                <Button size="small" loading={activateMut.isPending} onClick={() => activateMut.mutate(recipe.id)}>Kích hoạt</Button>
              )}
              <Button size="small" loading={cloneMut.isPending} onClick={() => cloneMut.mutate(recipe.id)}>Nhân bản</Button>
              {(recipe.approvalStatus === 'DRAFT' || recipe.approvalStatus === 'REJECTED') && (
                <Popconfirm title="Xoá bản này?" onConfirm={() => deleteMut.mutate(recipe.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} loading={deleteMut.isPending} />
                </Popconfirm>
              )}
              <Button
                type="link"
                size="small"
                onClick={() =>
                  setExpandedVersion(expandedVersion === recipe.id ? null : recipe.id)
                }
              >
                {expandedVersion === recipe.id ? 'Thu gọn' : 'Xem chi tiết'}
              </Button>
            </Space>
          }
        >
          {expandedVersion === recipe.id && (
            <Table<RecipeLine>
              dataSource={recipe.lines}
              rowKey={(_, i) => String(i)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Nguyên Liệu',
                  key: 'name',
                  render: (_: unknown, line: RecipeLine) =>
                    line.ingredientName || line.semiProductCode || '—',
                },
                {
                  title: 'Mã',
                  key: 'code',
                  width: 100,
                  render: (_: unknown, line: RecipeLine) => (
                    <Text code style={{ fontSize: 12 }}>
                      {line.ingredientCode || line.semiProductCode || '—'}
                    </Text>
                  ),
                },
                {
                  title: 'Khối Lượng',
                  dataIndex: 'quantityGram',
                  width: 120,
                  align: 'right',
                  render: (v: number) => `${v}g`,
                },
                {
                  title: 'Loại Dòng',
                  dataIndex: 'lineType',
                  width: 120,
                  render: (v: RecipeLineType) => (
                    <Tag color={LINE_TYPE_COLORS[v]}>{LINE_TYPE_LABELS[v]}</Tag>
                  ),
                },
                {
                  title: 'Loại',
                  key: 'sourceType',
                  width: 130,
                  render: (_: unknown, line: RecipeLine) =>
                    line.ingredientId ? (
                      <Tag color="blue">Nguyên liệu</Tag>
                    ) : (
                      <Tag color="geekblue">Bán thành phẩm</Tag>
                    ),
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <Text strong>Tổng ({unit})</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>
                      {recipe.lines.reduce((s, l) => s + l.quantityGram, 0)}g
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} colSpan={2} />
                </Table.Summary.Row>
              )}
            />
          )}
        </Card>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RecipePage: React.FC = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ['products', 'recipes_items'],
    queryFn: () => itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT,SEMI_PRODUCT', approvalStatus: 'APPROVED' }),
    retry: 1,
  });

  const products = Array.isArray(productsData) ? productsData : dummyProducts;

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ['recipes', selectedProductId],
    queryFn: () => {
      if (selectedProduct?.itemType === 'SEMI_PRODUCT') {
        return recipeService.getBySemiProduct(selectedProductId!);
      }
      return recipeService.getByProduct(selectedProductId!);
    },
    enabled: !!selectedProductId && !!selectedProduct,
    retry: 1,
  });

  const recipes: Recipe[] = Array.isArray(recipesData) ? recipesData : (selectedProductId === '1' ? dummyRecipes : []);

  const sortedRecipes = [...recipes].sort((a, b) => b.version - a.version);
  const activeRecipe = sortedRecipes.find((r) => r.isActive);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Quản Lý Công Thức</Title>
          <Text type="secondary">
            Xem lịch sử phiên bản và tạo công thức mới cho từng sản phẩm
          </Text>
        </div>
        <Tooltip title={!selectedProductId ? 'Chọn sản phẩm trước' : ''}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedProductId}
            onClick={() => setCreateDrawerOpen(true)}
          >
            Tạo Phiên Bản Mới
          </Button>
        </Tooltip>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      {/* Product Selector */}
      <Card size="small" style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Chọn Sản Phẩm:</Text>
          </Col>
          <Col flex={1}>
            <Select
              showSearch
              placeholder="Tìm và chọn sản phẩm/bán thành phẩm..."
              style={{ width: '100%', maxWidth: 480 }}
              value={selectedProductId}
              onChange={setSelectedProductId}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={products.map((p) => ({
                value: p.id,
                label: `[${p.code}] ${p.name} (${p.itemType === 'SEMI_PRODUCT' ? 'Bán Thành Phẩm' : 'Thành Phẩm'})`,
              }))}
            />
          </Col>
          {selectedProduct && (
            <Col>
              <Space>
                <Tag color={selectedProduct.productType === 'SHEET_CAKE' ? 'purple' : 'blue'}>
                  {selectedProduct.productType}
                </Tag>
                <Tag>{selectedProduct.unit}</Tag>
                {activeRecipe ? (
                  <Badge status="success" text={`v${activeRecipe.version} đang dùng`} />
                ) : (
                  <Badge status="error" text="Chưa có công thức" />
                )}
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      {/* Recipe Versions */}
      {!selectedProductId ? (
        <Alert
          type="info"
          showIcon
          icon={<ExperimentOutlined />}
          message="Chọn sản phẩm để xem lịch sử công thức"
          description="Mỗi sản phẩm có thể có nhiều phiên bản công thức. Phiên bản mới nhất đang active sẽ được dùng trong sản xuất."
        />
      ) : recipesLoading ? (
        <Text type="secondary">Đang tải công thức...</Text>
      ) : sortedRecipes.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`Sản phẩm "${selectedProduct?.name}" chưa có công thức nào.`}
          description='Bấm "Tạo Phiên Bản Mới" để thêm công thức đầu tiên.'
        />
      ) : (
        <RecipeVersionList
          recipes={sortedRecipes}
          unit={selectedProduct?.unit || 'PCS'}
          productId={selectedProductId}
        />
      )}

      {/* Create Drawer */}
      {selectedProduct && (
        <CreateRecipeDrawer
          open={createDrawerOpen}
          item={selectedProduct}
          onClose={() => setCreateDrawerOpen(false)}
          onSuccess={() => setCreateDrawerOpen(false)}
        />
      )}
    </div>
  );
};

export default RecipePage;
