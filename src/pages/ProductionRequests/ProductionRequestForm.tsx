import React, { useEffect } from 'react';
import {
  Form, Input, Button, Select, DatePicker, InputNumber,
  Typography, Card, message, Spin, Alert, Divider,
  Row, Col, Space, Table, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, SaveOutlined,
  DeleteOutlined, OrderedListOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { productionRequestService, itemService, recipeService } from '../../api/services';
import type { ProductionRequestInput, ProductionType } from '../../types';

const { Title, Text } = Typography;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.content && Array.isArray(data.content)) return data.content;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductionRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // ── Lookup data ───────────────────────────────────────────────────────────────

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items-all-products'],
    queryFn: () => itemService.getAllItemsUnpaginated({ itemType: 'PRODUCT' }),
    retry: false,
  });

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ['recipes-all'],
    queryFn: () => recipeService.getAll(),
    retry: false,
  });

  const itemOptions = extractArray(itemsData).map((item: { id: string; name: string; code: string }) => ({
    value: item.id,
    label: `[${item.code}] ${item.name}`,
  }));

  const recipeOptions = extractArray(recipesData).map((r: { id: string; product?: { name: string }; version?: number }) => ({
    value: r.id,
    label: `${r.product?.name || r.id} — v${r.version ?? 1}`,
  }));

  // ── Load existing when editing ────────────────────────────────────────────────

  const { data: existing, isLoading: existingLoading, isError: existingError } = useQuery({
    queryKey: ['production-request', id],
    queryFn: () => productionRequestService.getById(id!),
    enabled: isEdit,
    retry: false,
  });

  useEffect(() => {
    if (existing && isEdit) {
      form.setFieldsValue({
        productionType: existing.productionType,
        productionDate: existing.productionDate ? dayjs(existing.productionDate) : null,
        note: existing.note,
        lines: (existing.lines || []).map((l, idx) => ({
          productId: l.product?.key || '',
          recipeId: l.recipe?.key || undefined,
          plannedQty: l.plannedQty,
          sortOrder: l.sortOrder ?? idx + 1,
          note: l.note,
        })),
      });
    } else if (!isEdit) {
      form.resetFields();
    }
  }, [existing, isEdit, form]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: (data: ProductionRequestInput) =>
      isEdit
        ? productionRequestService.update(id!, data)
        : productionRequestService.create(data),
    onSuccess: (result) => {
      message.success(
        isEdit ? 'Cập nhật lệnh sản xuất thành công!' : `Tạo thành công! Mã: ${result?.code || ''}`,
      );
      queryClient.invalidateQueries({ queryKey: ['production-requests'] });
      navigate('/production/requests');
    },
    onError: () =>
      message.error(isEdit ? 'Cập nhật thất bại. Vui lòng kiểm tra lại.' : 'Tạo lệnh thất bại. Vui lòng kiểm tra lại.'),
  });

  // ── Submit ────────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFinish = (values: any) => {
    const rawLines: Record<string, unknown>[] = values.lines || [];
    if (rawLines.length === 0) {
      message.error('Vui lòng thêm ít nhất 1 dòng sản phẩm.');
      return;
    }

    const payload: ProductionRequestInput = {
      productionType: values.productionType as ProductionType,
      productionDate: (values.productionDate as dayjs.Dayjs).format('YYYY-MM-DD'),
      note: values.note as string | undefined,
      lines: rawLines.map((l, idx) => ({
        productId: l.productId as string,
        recipeId: l.recipeId as string | undefined,
        plannedQty: l.plannedQty as number,
        sortOrder: (l.sortOrder as number) ?? idx + 1,
        note: l.note as string | undefined,
      })),
    };

    mutation.mutate(payload);
  };

  // ── Loading / Error states ────────────────────────────────────────────────────

  if (isEdit && existingLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isEdit && existingError) {
    return (
      <Alert type="error" showIcon
        message="Không tải được lệnh sản xuất."
        action={<Button onClick={() => navigate('/production/requests')}>Quay Lại</Button>}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/requests')}>
            Danh Sách Lệnh Sản Xuất
          </Button>
          <Divider type="vertical" />
          <OrderedListOutlined style={{ fontSize: 20, color: '#722ed1' }} />
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? 'Chỉnh Sửa Lệnh Sản Xuất' : 'Tạo Lệnh Sản Xuất Mới'}
          </Title>
          {isEdit && existing?.code && (
            <Text type="secondary" style={{ marginLeft: 8 }}>#{existing.code}</Text>
          )}
        </Space>
        <Space>
          <Button onClick={() => navigate('/production/requests')}>Huỷ</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={mutation.isPending}
            onClick={() => form.submit()}
          >
            {isEdit ? 'Lưu Cập Nhật' : 'Tạo Lệnh Sản Xuất'}
          </Button>
        </Space>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ productionType: 'DAILY', lines: [{ sortOrder: 1 }] }}
      >
        {/* Card 1: Thông Tin Chung */}
        <Card title="Thông Tin Chung" style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="productionType"
                label="Loại Sản Xuất"
                rules={[{ required: true, message: 'Vui lòng chọn loại sản xuất' }]}
              >
                <Select placeholder="Chọn loại sản xuất">
                  <Select.Option value="DAILY">🗓 Hàng Ngày (DAILY)</Select.Option>
                  <Select.Option value="ORDER">📦 Theo Đơn (ORDER)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="productionDate"
                label="Ngày Sản Xuất"
                rules={[{ required: true, message: 'Vui lòng chọn ngày sản xuất' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="note" label="Ghi Chú">
                <Input placeholder="Ghi chú cho lệnh (không bắt buộc)..." />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Card 2: Dòng Sản Phẩm */}
        <Card
          title="🔬 Dòng Sản Phẩm"
          extra={<Text type="secondary">Thêm các sản phẩm cần sản xuất</Text>}
          style={{ marginBottom: 24 }}
        >
          <Form.List
            name="lines"
            rules={[{
              validator: async (_, names) => {
                if (!names || names.length < 1)
                  return Promise.reject(new Error('Cần ít nhất 1 dòng sản phẩm'));
              },
            }]}
          >
            {(fields, { add, remove }, { errors }) => {
              const columns = [
                {
                  title: '#',
                  dataIndex: 'name',
                  width: 50,
                  render: (_: unknown, __: unknown, idx: number) => (
                    <Text type="secondary">{idx + 1}</Text>
                  ),
                },
                {
                  title: 'Sản Phẩm *',
                  dataIndex: 'name',
                  render: (name: number, field: { key: number; name: number }) => (
                    <Form.Item
                      {...field}
                      name={[name, 'productId']}
                      rules={[{ required: true, message: 'Chọn sản phẩm' }]}
                      style={{ margin: 0 }}
                    >
                      <Select
                        size="small"
                        showSearch
                        placeholder="Tìm và chọn sản phẩm..."
                        loading={itemsLoading}
                        options={itemOptions}
                        filterOption={(input, opt) =>
                          (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent={itemsLoading ? <Spin size="small" /> : 'Không tìm thấy'}
                      />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Công Thức',
                  dataIndex: 'name',
                  width: 220,
                  render: (name: number, field: { key: number; name: number }) => (
                    <Form.Item
                      {...field}
                      name={[name, 'recipeId']}
                      style={{ margin: 0 }}
                    >
                      <Select
                        size="small"
                        showSearch
                        allowClear
                        placeholder="Chọn công thức (tuỳ chọn)"
                        loading={recipesLoading}
                        options={recipeOptions}
                        filterOption={(input, opt) =>
                          (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent="Không có công thức"
                      />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Số Lượng KH *',
                  dataIndex: 'name',
                  width: 140,
                  render: (name: number, field: { key: number; name: number }) => (
                    <Form.Item
                      {...field}
                      name={[name, 'plannedQty']}
                      rules={[
                        { required: true, message: 'Nhập số lượng' },
                        { type: 'number' as const, min: 0.001, message: 'Phải > 0' },
                      ]}
                      style={{ margin: 0 }}
                    >
                      <InputNumber size="small" min={0.001} step={1} style={{ width: '100%' }} placeholder="0" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Thứ Tự',
                  dataIndex: 'name',
                  width: 90,
                  render: (name: number, field: { key: number; name: number }) => (
                    <Form.Item {...field} name={[name, 'sortOrder']} style={{ margin: 0 }}>
                      <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="1" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Ghi Chú',
                  dataIndex: 'name',
                  render: (name: number, field: { key: number; name: number }) => (
                    <Form.Item {...field} name={[name, 'note']} style={{ margin: 0 }}>
                      <Input size="small" placeholder="Ghi chú..." />
                    </Form.Item>
                  ),
                },
                {
                  title: '',
                  width: 50,
                  dataIndex: 'name',
                  render: (name: number) => (
                    <Popconfirm
                      title="Xoá dòng này?"
                      onConfirm={() => remove(name)}
                      okText="Xoá"
                      cancelText="Huỷ"
                      disabled={fields.length === 1}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        disabled={fields.length === 1}
                      />
                    </Popconfirm>
                  ),
                },
              ];

              return (
                <>
                  <Table
                    columns={columns}
                    dataSource={fields}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    bordered
                    locale={{ emptyText: 'Chưa có dòng nào. Bấm "Thêm Dòng" để bắt đầu.' }}
                  />
                  <Form.ErrorList errors={errors} />
                  <Button
                    type="dashed"
                    onClick={() => add({ sortOrder: fields.length + 1 })}
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 8 }}
                  >
                    Thêm Dòng Sản Phẩm
                  </Button>
                </>
              );
            }}
          </Form.List>
        </Card>


      </Form>
    </div>
  );
};

export default ProductionRequestForm;
