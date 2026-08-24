import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Space, Typography, Tag, Card, Divider,
  Popconfirm, Spin, Empty, message, Descriptions,
  Form, Input, InputNumber, Select, Table
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, CopyOutlined, ExperimentOutlined, PlusOutlined,
  CloseOutlined, SaveOutlined, UndoOutlined, SyncOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { recipeService, itemService } from '../../../api/services';
import unitService from '../../../api/services/unitService';
import type { Recipe, RecipeLineRequest, Product } from '../../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const APPROVAL_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT:            { color: 'default',    label: 'Nháp' },
  PENDING_APPROVAL: { color: 'processing', label: 'Chờ Duyệt' },
  APPROVED:         { color: 'success',    label: 'Đã Duyệt' },
  REJECTED:         { color: 'error',      label: 'Từ Chối' },
};

interface EditableLine {
  rowKey: string;
  itemId?: string;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  sortOrder: number;
}

const RecipeDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [note, setNote] = useState<string>('');
  const [yieldQuantity, setYieldQuantity] = useState<number | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: recipe, isLoading, isError } = useQuery<Recipe>({
    queryKey: ['recipe', id],
    queryFn: () => recipeService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  const { data: allItemsData } = useQuery({
    queryKey: ['items', 'all_unpaginated'],
    queryFn: () => itemService.getAllItemsUnpaginated(),
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: Product[] = useMemo(() => {
    if (Array.isArray(allItemsData)) return allItemsData;
    if (allItemsData && Array.isArray((allItemsData as any).data)) return (allItemsData as any).data;
    if (allItemsData && Array.isArray((allItemsData as any).content)) return (allItemsData as any).content;
    return [];
  }, [allItemsData]);

  const ingredientOptions = useMemo(() => {
    return allItems
      .filter((i) => i.itemType === 'INGREDIENT' || i.itemType === 'SEMI_PRODUCT')
      .map((i) => ({
        label: `[${i.code}] ${i.name}`,
        value: i.id,
        raw: i,
      }));
  }, [allItems]);

  // Map itemId → item for quick cost lookup
  const itemMap = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems]);

  // Unit conversions for KG calculation
  const { data: conversionsRaw = [] } = useQuery({
    queryKey: ['unit-conversions'],
    queryFn: () => unitService.getConversions(),
    staleTime: 60_000,
  });
  const conversions: any[] = Array.isArray(conversionsRaw) ? conversionsRaw : [];

  // Convert any unit → KG via conversion table (returns null if no path found)
  const toKg = (qty: number, unit: string): number | null => {
    if (!unit) return null;
    const u = unit.trim().toUpperCase();
    if (u === 'KG') return qty;
    const conv = conversions.find(
      (c: any) => c.fromUnit?.toUpperCase() === u && c.toUnit?.toUpperCase() === 'KG'
    );
    if (conv) return qty * Number(conv.factor);
    // Try reverse
    const rev = conversions.find(
      (c: any) => c.toUnit?.toUpperCase() === u && c.fromUnit?.toUpperCase() === 'KG'
    );
    if (rev) return qty / Number(rev.factor);
    // G → KG shortcut
    if (u === 'G') return qty / 1000;
    if (u === 'MG') return qty / 1_000_000;
    if (u === 'ML') return qty / 1000; // approx for liquids
    if (u === 'L') return qty;          // 1L ≈ 1KG
    return null;
  };

  // Computed: total cost and total KG from lines
  const { totalCost, totalKgCalc, totalKgHasGap } = useMemo(() => {
    let cost = 0;
    let kg = 0;
    let hasGap = false;
    for (const l of lines) {
      const item = itemMap.get(l.itemId || '');
      const unitCost = (item as any)?.unitCost ?? null;
      if (unitCost != null) cost += Number(unitCost) * l.quantity;
      const lineKg = toKg(l.quantity, l.unit);
      if (lineKg != null) kg += lineKg;
      else hasGap = true;
    }
    return { totalCost: cost, totalKgCalc: kg, totalKgHasGap: hasGap };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, itemMap, conversions]);

  // ── Initialize Form ──────────────────────────────────────────────────────────
  
  const initForm = (r?: Recipe) => {
    if (!r) return;
    setNote(r.note || '');
    setYieldQuantity((r as any).yieldQuantity ?? null);
    const initialLines = r.lines?.map((l, idx) => ({
      // Use random UUID for key to handle additions/deletions robustly
      rowKey: `init-${idx}-${crypto.randomUUID()}`,
      itemId: (l.item as any)?.key || (l.item as any)?.id,
      itemName: l.item?.name,
      itemCode: (l.item as any)?.code,
      quantity: l.quantity || 0,
      unit: l.unit || '',
      sortOrder: l.sortOrder ?? (idx + 1),
    })) || [];
    setLines(initialLines);
  };

  useEffect(() => {
    initForm(recipe);
  }, [recipe]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] });
  };

  const updateMut = useMutation({
    mutationFn: (data: any) => recipeService.update(id!, data),
    onSuccess: () => { 
      message.success('Lưu thay đổi thành công!'); 
      invalidate(); 
    },
    onError: () => message.error('Lưu thay đổi thất bại.'),
  });

  const approveMut = useMutation({
    mutationFn: () => recipeService.approve(id!),
    onSuccess: () => { message.success('Đã duyệt công thức!'); invalidate(); },
    onError: () => message.error('Duyệt thất bại.'),
  });

  const rejectMut = useMutation({
    mutationFn: () => recipeService.reject(id!),
    onSuccess: () => { message.success('Đã từ chối!'); invalidate(); },
    onError: () => message.error('Từ chối thất bại.'),
  });

  const activateMut = useMutation({
    mutationFn: () => recipeService.activate(id!),
    onSuccess: () => { message.success('Đã kích hoạt!'); invalidate(); },
    onError: () => message.error('Kích hoạt thất bại.'),
  });

  const cloneMut = useMutation({
    mutationFn: () => recipeService.clone(id!),
    onSuccess: (newRecipe: any) => {
      message.success('Nhân bản thành công!');
      invalidate();
      const newId = newRecipe?.id || newRecipe?.data?.id;
      if (newId) navigate(`/products/recipes/${newId}`);
    },
    onError: () => message.error('Nhân bản thất bại.'),
  });

  const deleteMut = useMutation({
    mutationFn: () => recipeService.delete(id!),
    onSuccess: () => {
      message.success('Đã xoá công thức!');
      queryClient.invalidateQueries({ queryKey: ['recipes', 'all'] });
      navigate('/products/recipes');
    },
    onError: () => message.error('Xoá thất bại.'),
  });

  const autoFillYieldMut = useMutation({
    mutationFn: () => recipeService.autoFillYield(),
    onSuccess: (res: any) => {
      message.success(`Đã tự động điền sản lượng: ${res?.filled ?? 0} công thức được cập nhật`);
      invalidate();
    },
    onError: () => message.error('Tự động điền sản lượng thất bại.'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddLine = () => {
    const nextSort = lines.length > 0 ? Math.max(...lines.map(l => l.sortOrder)) + 1 : 1;
    setLines([
      ...lines,
      { rowKey: crypto.randomUUID(), quantity: 0, unit: '', sortOrder: nextSort }
    ]);
  };

  const handleRemoveLine = (rowKey: string) => {
    setLines(lines.filter(l => l.rowKey !== rowKey));
  };

  const handleUpdateLine = (rowKey: string, field: keyof EditableLine, value: any) => {
    setLines(lines.map(l => {
      if (l.rowKey !== rowKey) return l;
      
      const updated = { ...l, [field]: value };
      
      // Auto-fill unit when selecting item
      if (field === 'itemId') {
        const itemOpt = ingredientOptions.find(o => o.value === value);
        if (itemOpt) {
          updated.itemName = itemOpt.raw.name;
          updated.itemCode = itemOpt.raw.code;
          if (!updated.unit) {
            updated.unit = itemOpt.raw.unit || '';
          }
        }
      }
      return updated;
    }));
  };

  const handleSave = () => {
    // Validate
    if (lines.some(l => !l.itemId || l.quantity <= 0)) {
      message.error('Vui lòng chọn nguyên liệu và điền số lượng > 0 cho tất cả các dòng!');
      return;
    }

    const payloadLines: RecipeLineRequest[] = lines.map(l => ({
      itemId: l.itemId!,
      quantity: l.quantity,
      unit: l.unit,
      sortOrder: l.sortOrder,
    }));

    updateMut.mutate({
      productId: recipe?.product?.id || (recipe?.product as any)?.key,
      semiProductId: recipe?.semiProduct?.id || (recipe?.semiProduct as any)?.key,
      note,
      yieldQuantity: yieldQuantity ?? undefined,
      lines: payloadLines
    });
  };

  const handleCancel = () => {
    initForm(recipe);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const lineColumns: ColumnsType<EditableLine> = [
    {
      title: 'Nguyên Liệu / BTP',
      key: 'item',
      render: (_, line) => (
        <Select
          showSearch
          style={{ width: '100%', minWidth: 250 }}
          placeholder="Chọn nguyên liệu..."
          value={line.itemId}
          onChange={(val) => handleUpdateLine(line.rowKey, 'itemId', val)}
          options={ingredientOptions}
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 150,
      render: (_, line) => (
        <InputNumber
          min={0}
          step={0.1}
          style={{ width: '100%' }}
          value={line.quantity}
          onChange={(val) => handleUpdateLine(line.rowKey, 'quantity', val || 0)}
        />
      ),
    },
    {
      title: 'Đơn vị',
      key: 'unit',
      width: 100,
      render: (_, line) => (
        <Input
          value={line.unit}
          onChange={(e) => handleUpdateLine(line.rowKey, 'unit', e.target.value)}
        />
      ),
    },
    {
      title: 'Đơn giá',
      key: 'unitPrice',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, line: EditableLine) => {
        const item = itemMap.get(line.itemId || '');
        const cost = (item as any)?.unitCost;
        if (cost == null) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Text style={{ fontSize: 12, color: '#64748b' }}>
            {Math.round(Number(cost)).toLocaleString('vi-VN')} đ
          </Text>
        );
      },
    },
    {
      title: 'Thành tiền',
      key: 'lineTotal',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, line: EditableLine) => {
        const item = itemMap.get(line.itemId || '');
        const cost = (item as any)?.unitCost;
        if (cost == null || !line.quantity) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        const total = Number(cost) * line.quantity;
        return (
          <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
            {Math.round(total).toLocaleString('vi-VN')} đ
          </Text>
        );
      },
    },
    {
      title: 'Sort',
      key: 'sortOrder',
      width: 100,
      render: (_, line) => (
        <InputNumber
          min={1}
          style={{ width: '100%' }}
          value={line.sortOrder}
          onChange={(val) => handleUpdateLine(line.rowKey, 'sortOrder', val || 1)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      align: 'center',
      render: (_, line) => (
        <Button 
          type="primary" 
          danger 
          icon={<CloseOutlined />} 
          size="small"
          onClick={() => handleRemoveLine(line.rowKey)} 
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products/recipes')} style={{ marginBottom: 16 }}>
          Quay Lại Danh Sách
        </Button>
        <Empty description="Không tìm thấy công thức hoặc đã xảy ra lỗi." />
      </div>
    );
  }

  const productName = recipe.product?.name || recipe.semiProduct?.name;
  const productCode = recipe.product?.code || recipe.semiProduct?.code;
  const itemType = recipe.product ? 'PRODUCT' : 'SEMI_PRODUCT';
  const statusCfg = APPROVAL_STATUS_CONFIG[recipe.approvalStatus || 'DRAFT'] ?? { color: 'default', label: recipe.approvalStatus };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products/recipes')}>
            Quay Lại
          </Button>
          <Divider type="vertical" />
          <ExperimentOutlined style={{ fontSize: 20, color: '#D2691E' }} />
          <Title level={4} style={{ margin: 0 }}>
            Chi Tiết Công Thức
          </Title>
          {recipe.active ? (
            <Tag icon={<CheckCircleOutlined />} color="success">Đang dùng</Tag>
          ) : (
            <Tag icon={<ClockCircleOutlined />} color="default">Không còn dùng</Tag>
          )}
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
        </Space>

        {/* Action buttons */}
        <Space>
          {recipe.approvalStatus === 'PENDING_APPROVAL' && (
            <>
              <Button type="primary" loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
                Duyệt
              </Button>
              <Button danger loading={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
                Từ Chối
              </Button>
            </>
          )}
          {recipe.approvalStatus === 'APPROVED' && !recipe.active && (
            <Button loading={activateMut.isPending} onClick={() => activateMut.mutate()}>
              Kích Hoạt
            </Button>
          )}
          <Button icon={<CopyOutlined />} loading={cloneMut.isPending} onClick={() => cloneMut.mutate()}>
            Nhân Bản
          </Button>
          {(recipe.approvalStatus === 'DRAFT' || recipe.approvalStatus === 'REJECTED') && (
            <Popconfirm
              title="Xoá công thức này?"
              onConfirm={() => deleteMut.mutate()}
              okText="Xoá"
              cancelText="Huỷ"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteMut.isPending}>
                Xoá
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      {/* Product info */}
      <Card style={{ marginBottom: 20, borderRadius: 8 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Sản Phẩm">
            <Text strong>{productName || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Mã">
            <Text code>{productCode || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Loại">
            <Tag color={itemType === 'SEMI_PRODUCT' ? 'orange' : 'blue'}>
              {itemType === 'SEMI_PRODUCT' ? 'Bán Thành Phẩm' : 'Sản Phẩm'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Phiên Bản">
            <Tag color={recipe.active ? 'green' : 'default'}>v{recipe.version}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Trạng Thái Duyệt">
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Descriptions.Item>
          {recipe.active && (
            <Descriptions.Item label="Kích hoạt">
              <Text type="success">Đang sử dụng trong sản xuất</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Editor Section */}
      <Card
        title={<Text strong>Công thức</Text>}
        style={{ borderRadius: 8 }}
      >
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Sản lượng (Yield)
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                — số lượng thành phẩm tạo ra từ 1 mẻ công thức
              </Text>
            </Text>
            <InputNumber
              min={0.001}
              step={0.1}
              style={{ width: 160 }}
              value={yieldQuantity}
              onChange={(val) => setYieldQuantity(val)}
              placeholder="VD: 1.0"
              addonAfter={(recipe?.product?.unit || recipe?.semiProduct?.unit || '')}
            />
          </div>
          <Button
            icon={<SyncOutlined />}
            loading={autoFillYieldMut.isPending}
            onClick={() => autoFillYieldMut.mutate()}
            style={{ marginTop: 28 }}
          >
            Tự động điền tất cả
          </Button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Ghi chú công thức</Text>
          <TextArea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú cho công thức này..."
          />
        </div>

        <Table<EditableLine>
          columns={lineColumns}
          dataSource={lines}
          rowKey="rowKey"
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Button icon={<PlusOutlined />} onClick={handleAddLine}>
            Thêm dòng
          </Button>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Tổng thành tiền */}
            {totalCost > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Tổng thành tiền</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#b45309' }}>
                  {Math.round(totalCost).toLocaleString('vi-VN')} đ
                </div>
              </div>
            )}

            {/* KG tự tính + haohut */}
            <div style={{
              background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
              padding: '8px 14px', minWidth: 180,
            }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>
                ⚖ Khối lượng mẻ (KG)
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Tự tính</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {totalKgCalc > 0
                      ? `${totalKgCalc.toFixed(3)} KG${totalKgHasGap ? ' ⚠' : ''}`
                      : <span style={{ color: '#94a3b8' }}>—</span>
                    }
                  </div>
                </div>
                {yieldQuantity != null && totalKgCalc > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Hao hụt</div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: (totalKgCalc - yieldQuantity) > 0.001 ? '#dc2626' : '#16a34a',
                    }}>
                      {totalKgCalc - yieldQuantity >= 0 ? '+' : ''}
                      {(totalKgCalc - yieldQuantity).toFixed(3)} KG
                      {' '}
                      <span style={{ fontWeight: 400, fontSize: 11 }}>
                        ({totalKgCalc > 0 ? (((totalKgCalc - yieldQuantity) / totalKgCalc) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <Button 
            icon={<UndoOutlined />} 
            onClick={handleCancel}
            disabled={updateMut.isPending}
          >
            Huỷ
          </Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={updateMut.isPending}
          >
            Lưu thay đổi
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RecipeDetail;
