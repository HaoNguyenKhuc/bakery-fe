import React from 'react';
import { Modal, Button, Spin, Alert, message, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService } from '../../../api/services';
import type { RecipeCostCalculation, RecipeCostBreakdownLine, RecipePriceSource } from '../../../types';

const { Text } = Typography;

interface CostCalculationModalProps {
  open: boolean;
  itemId: string | null;
  itemName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const formatVND = (v?: number | null) => {
  if (v == null) return '—';
  return Number(v).toLocaleString('vi-VN') + 'đ';
};

const renderPriceSourceBadge = (source?: RecipePriceSource) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    CATALOG: { bg: '#dcfce7', color: '#16a34a', label: 'Catalog' },
    STOCK_LOT_AVG: { bg: '#dbeafe', color: '#1d4ed8', label: 'Tồn kho TB' },
    RECIPE_CALCULATED: { bg: '#f3e8ff', color: '#7c3aed', label: 'BTP' },
    MISSING: { bg: '#fee2e2', color: '#dc2626', label: 'Thiếu giá' },
    UNIT_MISMATCH: { bg: '#fef3c7', color: '#d97706', label: 'Lỗi đvt' },
  };

  const config = (source && map[source]) || { bg: '#f1f5f9', color: '#64748b', label: source || '—' };

  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      {config.label}
    </span>
  );
};

export const CostCalculationModal: React.FC<CostCalculationModalProps> = ({
  open,
  itemId,
  itemName,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<RecipeCostCalculation>({
    queryKey: ['recipe-cost', itemId],
    queryFn: () => recipeService.calculateCost(itemId!),
    enabled: open && !!itemId,
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => recipeService.applyCost(id),
    onSuccess: (res) => {
      const formattedCost = formatVND(res?.totalCostPerUnit ?? data?.totalCostPerUnit);
      message.success(`✓ Đã lưu giá vốn: ${formattedCost}`);
      queryClient.invalidateQueries({ queryKey: ['items-paged'] });
      queryClient.invalidateQueries({ queryKey: ['items-all-type'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || err?.message || 'Không thể lưu giá vốn');
    },
  });

  const handleApply = () => {
    if (!itemId) return;
    applyMutation.mutate(itemId);
  };

  const renderLines = (lines: RecipeCostBreakdownLine[], depth = 0): React.ReactNode => {
    return lines.map((l, index) => {
      const rowKey = `${l.itemId || l.itemCode || index}-${depth}`;
      return (
        <React.Fragment key={rowKey}>
          <tr
            style={{
              background: depth > 0 ? '#f8fafc' : '#fff',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <td style={{ padding: '8px 12px', fontSize: 13 }}>
              {depth > 0 && (
                <span style={{ marginLeft: (depth - 1) * 16, marginRight: 6, color: '#94a3b8' }}>
                  └
                </span>
              )}
              <span>{l.itemName}</span>
              {l.itemCode && (
                <Text code style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>
                  {l.itemCode}
                </Text>
              )}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13 }}>
              {Number(l.quantity).toLocaleString('vi-VN')} {l.unit}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13 }}>
              {formatVND(l.unitPrice)}
            </td>
            <td
              style={{
                padding: '8px 12px',
                textAlign: 'right',
                fontSize: 13,
                fontWeight: depth === 0 ? 600 : 400,
                color: depth === 0 ? '#0f172a' : '#475569',
              }}
            >
              {formatVND(l.lineCost)}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
              {renderPriceSourceBadge(l.priceSource)}
            </td>
          </tr>
          {l.subBreakdown && l.subBreakdown.length > 0 && renderLines(l.subBreakdown, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      destroyOnClose
      styles={{
        body: { padding: '8px 0 0' },
      }}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            💰 Tính giá cost
          </div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
            {itemName}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, fontSize: 13 }}>⏳ Đang tính toán giá cost...</div>
        </div>
      ) : isError ? (
        <div style={{ padding: '16px 0' }}>
          <Alert
            type="error"
            showIcon
            message="Không thể tính giá cost"
            description={(error as any)?.message || 'Vui lòng kiểm tra lại công thức và kết nối backend.'}
            action={
              <Button size="small" onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        </div>
      ) : data ? (
        <div>
          {/* Summary Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              padding: '4px 0',
            }}
          >
            <div>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                {formatVND(data.totalCostPerUnit)}
              </span>
              <span style={{ color: '#64748b', fontSize: 13, marginLeft: 8 }}>
                / đơn vị sản xuất
              </span>
            </div>
            <div>
              {data.complete ? (
                <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                  ✓ Đủ dữ liệu
                </span>
              ) : (
                <span style={{ color: '#d97706', fontSize: 13, fontWeight: 600 }}>
                  ⚠ Thiếu giá một số NL
                </span>
              )}
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Nguyên liệu
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Số lượng
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Đơn giá
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Thành tiền
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Nguồn giá
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown && data.breakdown.length > 0 ? (
                  renderLines(data.breakdown)
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      Không có chi tiết nguyên liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              {!data.complete && (
                <span style={{ color: '#d97706', fontSize: 13 }}>
                  Không thể lưu vì thiếu giá một số NL — vui lòng nhập giá trước.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {data.complete && (
                <Button
                  type="primary"
                  loading={applyMutation.isPending}
                  onClick={handleApply}
                  style={{ background: '#2563eb' }}
                >
                  💾 Áp dụng giá vốn {formatVND(data.totalCostPerUnit)}
                </Button>
              )}
              <Button onClick={onClose}>Đóng</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default CostCalculationModal;
