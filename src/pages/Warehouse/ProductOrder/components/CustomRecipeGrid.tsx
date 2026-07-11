import React, { useState, useCallback } from 'react';
import {
  Table, Button, InputNumber, Space, Typography, Alert,
  Tooltip, Divider, Tag, message,
} from 'antd';
import {
  EditOutlined, SaveOutlined, UndoOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CustomRecipeLine, CustomRecipeUpdateRequest } from '../../../../types';
import { useAuthStore } from '../../../../store';

const { Text, Title } = Typography;

// ─── Dummy data công thức gốc (fallback khi API chưa có) ─────────────────────

const dummyBaseRecipe: CustomRecipeLine[] = [
  {
    ingredientCode: 'NL-KEM-001',
    ingredientName: 'Kem Tươi Whipping',
    unit: 'g',
    baseQuantity: 200,
    actualQuantity: 200,
  },
  {
    ingredientCode: 'NL-DUO-001',
    ingredientName: 'Đường Trắng',
    unit: 'g',
    baseQuantity: 150,
    actualQuantity: 150,
  },
  {
    ingredientCode: 'NL-BOT-001',
    ingredientName: 'Bột Mì Đa Dụng',
    unit: 'g',
    baseQuantity: 300,
    actualQuantity: 300,
  },
  {
    ingredientCode: 'NL-TRU-001',
    ingredientName: 'Trứng Gà',
    unit: 'cái',
    baseQuantity: 4,
    actualQuantity: 4,
  },
  {
    ingredientCode: 'NL-BO-001',
    ingredientName: 'Bơ Nhạt',
    unit: 'g',
    baseQuantity: 100,
    actualQuantity: 100,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomRecipeGridProps {
  orderId: string;
  orderCode: string;
  /** Dữ liệu công thức từ API — nếu chưa có dùng dummy */
  initialLines?: CustomRecipeLine[];
  onSave: (req: CustomRecipeUpdateRequest) => void;
  saving: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CustomRecipeGrid: React.FC<CustomRecipeGridProps> = ({
  orderId,
  orderCode,
  initialLines,
  onSave,
  saving,
}) => {
  const canUpdate = useAuthStore((s) => s.canOnScreen)('PRODUCTION', 'update');
  const isWarehouseRole = useAuthStore((s) => s.isWarehouseRole);
  const isBepTruong = isWarehouseRole('BEP_TRUONG');

  // Chỉ Bếp trưởng có quyền chỉnh sửa
  const canEdit = isBepTruong && canUpdate;

  const baseData = initialLines ?? dummyBaseRecipe;
  const [lines, setLines] = useState<CustomRecipeLine[]>(
    baseData.map((l) => ({ ...l }))
  );

  const hasChanges = lines.some(
    (l, i) => l.actualQuantity !== baseData[i]?.baseQuantity
  );

  const updateQuantity = useCallback((code: string, value: number | null) => {
    setLines((prev) =>
      prev.map((l) =>
        l.ingredientCode === code
          ? {
              ...l,
              actualQuantity: value ?? l.baseQuantity,
              isModified: value !== null && value !== l.baseQuantity,
            }
          : l
      )
    );
  }, []);

  const resetAll = () => {
    setLines(baseData.map((l) => ({ ...l, actualQuantity: l.baseQuantity, isModified: false })));
    message.info('Đã đặt lại tất cả về định lượng công thức gốc.');
  };

  const handleSave = () => {
    onSave({
      orderId,
      lines: lines.map((l) => ({
        ingredientCode: l.ingredientCode,
        actualQuantity: l.actualQuantity,
      })),
    });
  };

  // ─── Cột bảng ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<CustomRecipeLine> = [
    {
      title: 'Mã NL',
      dataIndex: 'ingredientCode',
      key: 'code',
      width: 120,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Nguyên Liệu',
      dataIndex: 'ingredientName',
      key: 'name',
      render: (v: string, r: CustomRecipeLine) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isModified && (
            <Tag color="gold" style={{ fontSize: 10, padding: '0 4px' }}>
              ✏️ Đã chỉnh
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
      align: 'center',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: (
        <Tooltip title="Số lượng theo công thức chuẩn — không thay đổi">
          <Space size={4}>
            Công Thức Gốc
            <InfoCircleOutlined style={{ opacity: 0.5, fontSize: 11 }} />
          </Space>
        </Tooltip>
      ),
      dataIndex: 'baseQuantity',
      key: 'base',
      width: 130,
      align: 'center',
      render: (v: number, r: CustomRecipeLine) => (
        <Text type="secondary">{v} {r.unit}</Text>
      ),
    },
    {
      title: (
        <Tooltip title={canEdit ? 'Nhấn vào số để điều chỉnh theo yêu cầu khách' : 'Chỉ Bếp trưởng mới có thể chỉnh sửa'}>
          <Space size={4}>
            <EditOutlined style={{ color: canEdit ? '#D2691E' : '#bbb' }} />
            Thực Tế (Tùy Chỉnh)
            <InfoCircleOutlined style={{ opacity: 0.5, fontSize: 11 }} />
          </Space>
        </Tooltip>
      ),
      key: 'actual',
      width: 170,
      align: 'center',
      render: (_: unknown, r: CustomRecipeLine) => (
        <InputNumber
          min={0}
          step={10}
          value={r.actualQuantity}
          onChange={(v) => updateQuantity(r.ingredientCode, v)}
          disabled={!canEdit}
          addonAfter={r.unit}
          style={{
            width: '100%',
            borderColor: r.isModified ? '#faad14' : undefined,
          }}
          status={r.isModified ? 'warning' : undefined}
          size="small"
        />
      ),
    },
    {
      title: 'Chênh lệch',
      key: 'diff',
      width: 100,
      align: 'center',
      render: (_: unknown, r: CustomRecipeLine) => {
        const diff = r.actualQuantity - r.baseQuantity;
        if (diff === 0) return <Text type="secondary">—</Text>;
        return (
          <Text style={{ color: diff > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
            {diff > 0 ? '+' : ''}{diff} {r.unit}
          </Text>
        );
      },
    },
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <Divider style={{ margin: '0 0 16px' }}>
        <Space>
          <EditOutlined style={{ color: '#D2691E' }} />
          <Title level={5} style={{ margin: 0, color: '#D2691E' }}>
            Định Lượng Nguyên Liệu Thực Tế
          </Title>
        </Space>
      </Divider>

      {/* Hướng dẫn */}
      {canEdit ? (
        <Alert
          type="warning"
          showIcon
          message={
            <Text style={{ fontSize: 12 }}>
              Bạn có thể điều chỉnh số lượng từng nguyên liệu theo yêu cầu khách.
              Đơn hàng: <Text code>{orderCode}</Text>
            </Text>
          }
          style={{ marginBottom: 12 }}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message={
            <Text style={{ fontSize: 12 }}>
              Chỉ <strong>Bếp trưởng</strong> mới có thể chỉnh sửa định lượng thực tế.
            </Text>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Table<CustomRecipeLine>
        columns={columns}
        dataSource={lines}
        rowKey="ingredientCode"
        size="small"
        pagination={false}
        rowClassName={(r) => (r.isModified ? 'recipe-row-modified' : '')}
        bordered
      />

      {/* Nút hành động */}
      {canEdit && (
        <Space style={{ marginTop: 12, justifyContent: 'flex-end', width: '100%' }}>
          <Button
            icon={<UndoOutlined />}
            onClick={resetAll}
            disabled={!hasChanges}
          >
            Đặt Lại Gốc
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
            style={{
              background: hasChanges ? '#D2691E' : undefined,
              borderColor: hasChanges ? '#D2691E' : undefined,
            }}
          >
            Lưu Công Thức Tùy Chỉnh
          </Button>
        </Space>
      )}
    </div>
  );
};

export default CustomRecipeGrid;
