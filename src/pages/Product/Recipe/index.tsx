import React, { useState, useMemo } from 'react';
import {
  Table, Button, Input, Tag, Space, Typography, Tabs,
  Badge, Tooltip, Popconfirm, Divider, Alert, message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CopyOutlined, DeleteOutlined, ExperimentOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { recipeService } from '../../../api/services';
import type { Recipe } from '../../../types';

const { Title, Text } = Typography;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getProductName(recipe: Recipe): string {
  return recipe.product?.name || recipe.semiProduct?.name || '—';
}

function getProductCode(recipe: Recipe): string {
  return recipe.product?.code || recipe.semiProduct?.code || '—';
}

function getItemType(recipe: Recipe): 'PRODUCT' | 'SEMI_PRODUCT' | null {
  if (recipe.product) return 'PRODUCT';
  if (recipe.semiProduct) return 'SEMI_PRODUCT';
  return null;
}

function getIngredientSummary(recipe: Recipe): string {
  if (!recipe.lines || recipe.lines.length === 0) return '—';
  return recipe.lines.map((l) => l.item?.name || '?').join(', ');
}

function toArray<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw.content)) return raw.content as T[];
  if (raw && Array.isArray(raw.data)) return raw.data as T[];
  return [];
}

// ─── Ingredient Cell ─────────────────────────────────────────────────────────

const IngredientCell: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const full = getIngredientSummary(recipe);
  if (full === '—') return <Text type="secondary">—</Text>;
  return (
    <Tooltip title={full} placement="topLeft">
      <Text
        style={{
          display: 'block',
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        {full}
      </Text>
    </Tooltip>
  );
};

// ─── Recipe Table ─────────────────────────────────────────────────────────────

interface RecipeTableProps {
  recipes: Recipe[];
  loading: boolean;
  showApprovalActions?: boolean;
  showRejectReason?: boolean;
}

const RecipeTable: React.FC<RecipeTableProps> = ({
  recipes,
  loading,
  showApprovalActions = false,
  showRejectReason = false,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const approveMut = useMutation({
    mutationFn: recipeService.approve,
    onSuccess: () => { message.success('Đã duyệt!'); queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] }); },
    onError: () => message.error('Duyệt thất bại.'),
  });

  const rejectMut = useMutation({
    mutationFn: recipeService.reject,
    onSuccess: () => { message.success('Đã từ chối!'); queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] }); },
    onError: () => message.error('Từ chối thất bại.'),
  });

  const cloneMut = useMutation({
    mutationFn: recipeService.clone,
    onSuccess: () => { message.success('Nhân bản thành công!'); queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] }); },
    onError: () => message.error('Nhân bản thất bại.'),
  });

  const deleteMut = useMutation({
    mutationFn: recipeService.delete,
    onSuccess: () => { message.success('Đã xoá!'); queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] }); },
    onError: () => message.error('Xoá thất bại.'),
  });

  const columns: ColumnsType<Recipe> = [
    {
      title: 'Mã SP',
      key: 'code',
      width: 110,
      render: (_: unknown, record: Recipe) => (
        <Text code style={{ fontSize: 12 }}>{getProductCode(record)}</Text>
      ),
    },
    {
      title: 'Tên Sản Phẩm',
      key: 'name',
      render: (_: unknown, record: Recipe) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => navigate(`/products/recipes/${record.id}`)}
        >
          {getProductName(record)}
        </Text>
      ),
    },
    {
      title: 'Phân Loại',
      key: 'itemType',
      width: 140,
      render: (_: unknown, record: Recipe) => {
        const t = getItemType(record);
        return t === 'SEMI_PRODUCT'
          ? <Tag color="orange">Bán Thành Phẩm</Tag>
          : t === 'PRODUCT'
          ? <Tag color="blue">Sản Phẩm</Tag>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Phiên Bản',
      key: 'version',
      width: 120,
      align: 'center',
      render: (_: unknown, record: Recipe) => (
        <Space size={4}>
          <Tag color={record.active ? 'green' : 'default'}>v{record.version}</Tag>
          {record.active && <Tag color="success" style={{ fontSize: 11, padding: '0 4px' }}>Đang dùng</Tag>}
        </Space>
      ),
    },
    {
      title: 'Nguyên Liệu',
      key: 'ingredients',
      ellipsis: true,
      render: (_: unknown, record: Recipe) => <IngredientCell recipe={record} />,
    },
    ...(showRejectReason
      ? [{
          title: 'Lý Do Từ Chối',
          key: 'rejectReason',
          render: (_: unknown, record: Recipe) => (
            <Text type="danger">{(record as any).rejectedReason || '—'}</Text>
          ),
        }]
      : []),
    {
      title: 'Thao Tác',
      key: 'action',
      width: showApprovalActions ? 200 : 130,
      align: 'center',
      render: (_: unknown, record: Recipe) => (
        <Space size={4}>
          {showApprovalActions && record.approvalStatus === 'PENDING_APPROVAL' && (
            <>
              <Tooltip title="Duyệt">
                <Button
                  size="small"
                  type="primary"
                  loading={approveMut.isPending}
                  onClick={() => approveMut.mutate(record.id)}
                >
                  Duyệt
                </Button>
              </Tooltip>
              <Tooltip title="Từ chối">
                <Button
                  size="small"
                  danger
                  loading={rejectMut.isPending}
                  onClick={() => rejectMut.mutate(record.id)}
                >
                  Từ chối
                </Button>
              </Tooltip>
            </>
          )}
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: '#1677ff' }} />}
              onClick={() => navigate(`/products/recipes/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Nhân bản">
            <Button
              type="text"
              icon={<CopyOutlined />}
              loading={cloneMut.isPending}
              onClick={() => cloneMut.mutate(record.id)}
            />
          </Tooltip>
          {(record.approvalStatus === 'DRAFT' || record.approvalStatus === 'REJECTED') && (
            <Popconfirm
              title="Xoá công thức này?"
              onConfirm={() => deleteMut.mutate(record.id)}
              okText="Xoá"
              cancelText="Huỷ"
            >
              <Tooltip title="Xoá">
                <Button type="text" danger icon={<DeleteOutlined />} loading={deleteMut.isPending} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table<Recipe>
      columns={columns}
      dataSource={recipes}
      loading={loading}
      rowKey="id"
      size="middle"
      onRow={(record) => ({
        onClick: (e) => {
          // Only navigate if click is not on a button/action
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('.ant-btn') || target.closest('.ant-popconfirm')) return;
          navigate(`/products/recipes/${record.id}`);
        },
        style: { cursor: 'pointer' },
      })}
      pagination={{
        pageSize: 10,
        showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} công thức`,
      }}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RecipePage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: recipesData, isLoading, isError, refetch } = useQuery({
    queryKey: ['recipes', 'all'],
    queryFn: () => recipeService.getAll(),
    retry: 1,
  });

  const allRecipes: Recipe[] = useMemo(() => toArray<Recipe>(recipesData), [recipesData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRecipes;
    const q = search.toLowerCase();
    return allRecipes.filter(
      (r) =>
        getProductName(r).toLowerCase().includes(q) ||
        getProductCode(r).toLowerCase().includes(q),
    );
  }, [allRecipes, search]);

  const activeRecipes  = filtered.filter((r) => r.approvalStatus === 'APPROVED');
  const pendingRecipes = filtered.filter((r) => r.approvalStatus === 'PENDING_APPROVAL');
  const rejectedRecipes = filtered.filter((r) => r.approvalStatus === 'REJECTED');

  const tabItems = [
    {
      key: 'active',
      label: (
        <Space>
          Đang Active
          <Badge count={activeRecipes.length} color="#52c41a" />
        </Space>
      ),
      children: (
        <RecipeTable recipes={activeRecipes} loading={isLoading} />
      ),
    },
    {
      key: 'pending',
      label: (
        <Space>
          Chờ Duyệt
          {pendingRecipes.length > 0 && (
            <Badge count={pendingRecipes.length} style={{ backgroundColor: '#fa8c16' }} />
          )}
        </Space>
      ),
      children: (
        <RecipeTable recipes={pendingRecipes} loading={isLoading} showApprovalActions />
      ),
    },
    {
      key: 'rejected',
      label: (
        <Space>
          Bị Từ Chối
          {rejectedRecipes.length > 0 && (
            <Badge count={rejectedRecipes.length} color="#ff4d4f" />
          )}
        </Space>
      ),
      children: (
        <RecipeTable recipes={rejectedRecipes} loading={isLoading} showRejectReason />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ExperimentOutlined style={{ marginRight: 8, color: '#D2691E' }} />
            Quản Lý Công Thức
          </Title>
          <Text type="secondary">Tạo, chỉnh sửa và phê duyệt công thức cho sản phẩm / bán thành phẩm</Text>
        </div>
        <Space>
          <Input
            placeholder="Tìm theo tên hoặc mã sản phẩm..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Button
            icon={<HistoryOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Làm Mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/products/recipes/form')}
          >
            Tạo Công Thức Mới
          </Button>
        </Space>
      </div>

      {isError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách công thức."
          description="Kiểm tra kết nối đến backend."
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>}
        />
      )}

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="active" items={tabItems} />
    </div>
  );
};

export default RecipePage;
