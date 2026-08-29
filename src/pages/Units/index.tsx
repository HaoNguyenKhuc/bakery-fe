import CodeInput from '../../components/CodeInput';
import React, { useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Typography, Divider, Popconfirm, message, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SwapOutlined, CalculatorOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import unitService from '../../api/services/unitService';
import type { Unit, UnitConversion } from '../../types/unit';

const { Title, Text } = Typography;

// ─── Unit modal ───────────────────────────────────────────────────────────────

interface UnitModalProps {
  open: boolean;
  editing: Unit | null;
  onClose: () => void;
  onSave: (values: { code: string; name: string; note?: string }) => void;
  saving: boolean;
}

const UnitModal: React.FC<UnitModalProps> = ({ open, editing, onClose, onSave, saving }) => {
  const [form] = Form.useForm();
  React.useEffect(() => {
    if (open) {
      form.setFieldsValue(editing ?? { code: '', name: '', note: '' });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  return (
    <Modal
      open={open}
      title={editing ? `Sửa đơn vị: ${editing.code}` : 'Thêm đơn vị mới'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu' : 'Thêm'}
      confirmLoading={saving}
      width={420}
    >
      <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 16 }}>
        {!editing && (
          <Form.Item
            name="code"
            label="Mã đơn vị (Code)"
            rules={[{ required: true, message: 'Nhập mã đơn vị' }]}
            extra="Ví dụ: KG, G, LY, CAI... (sẽ tự động viết hoa)"
          >
            <CodeInput placeholder="KG" prefix="U" entity="unit" maxLength={20}
              style={{ textTransform: 'uppercase' }}
              onGenerate={(c) => form.setFieldValue('code', c)} />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label="Tên hiển thị"
          rules={[{ required: true, message: 'Nhập tên đơn vị' }]}
        >
          <Input placeholder="Kilogram" maxLength={100} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Tùy chọn" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Conversion modal ─────────────────────────────────────────────────────────

interface ConversionModalProps {
  open: boolean;
  editing: UnitConversion | null;
  units: Unit[];
  onClose: () => void;
  onSave: (values: { fromUnit: string; toUnit: string; factor: number; note?: string }) => void;
  saving: boolean;
}

const ConversionModal: React.FC<ConversionModalProps> = ({
  open, editing, units, onClose, onSave, saving,
}) => {
  const [form] = Form.useForm();
  const [preview, setPreview] = useState<string>('');

  React.useEffect(() => {
    if (open) {
      form.setFieldsValue(editing ?? { fromUnit: '', toUnit: '', factor: undefined, note: '' });
      if (editing) {
        setPreview(`1 ${editing.fromUnit} = ${editing.factor} ${editing.toUnit}`);
      } else {
        setPreview('');
      }
    } else {
      form.resetFields();
      setPreview('');
    }
  }, [open, editing, form]);

  const updatePreview = () => {
    const { fromUnit, toUnit, factor } = form.getFieldsValue();
    if (fromUnit && toUnit && factor) {
      setPreview(`1 ${fromUnit} = ${factor} ${toUnit}`);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? `Sửa tỉ lệ: ${editing.fromUnit} → ${editing.toUnit}` : 'Thêm tỉ lệ quy đổi'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu' : 'Thêm'}
      confirmLoading={saving}
      width={460}
    >
      <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 16 }}>
        {!editing && (
          <>
            <Form.Item
              name="fromUnit"
              label="Từ đơn vị"
              rules={[{ required: true, message: 'Chọn đơn vị nguồn' }]}
            >
              <Select
                placeholder="Chọn đơn vị nguồn..."
                showSearch
                onChange={updatePreview}
                options={units.map((u) => ({
                  value: u.code,
                  label: u.name || u.code,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="toUnit"
              label="Sang đơn vị"
              rules={[{ required: true, message: 'Chọn đơn vị đích' }]}
            >
              <Select
                placeholder="Chọn đơn vị đích..."
                showSearch
                onChange={updatePreview}
                options={units.map((u) => ({
                  value: u.code,
                  label: u.name || u.code,
                }))}
              />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="factor"
          label={
            <span>
              Hệ số
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                (1 fromUnit = hệ số × toUnit)
              </Text>
            </span>
          }
          rules={[{ required: true, message: 'Nhập hệ số' }]}
        >
          <InputNumber
            min={0}
            step={0.001}
            precision={8}
            style={{ width: '100%' }}
            placeholder="0.001"
            onChange={updatePreview}
          />
        </Form.Item>
        {preview && (
          <div style={{ background: '#f0f9ff', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
            <CalculatorOutlined style={{ marginRight: 8, color: '#0891b2' }} />
            <Text style={{ color: '#0891b2' }}>Kết quả: <b>{preview}</b></Text>
          </div>
        )}
        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Tùy chọn" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const UnitsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [editingConv, setEditingConv] = useState<UnitConversion | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => unitService.getAll(),
  });

  const { data: conversions = [], isLoading: convsLoading } = useQuery<UnitConversion[]>({
    queryKey: ['unit-conversions'],
    queryFn: () => unitService.getConversions(),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createUnit = useMutation({
    mutationFn: (v: any) => unitService.create({ ...v, code: v.code.toUpperCase() }),
    onSuccess: () => { message.success('Đã thêm đơn vị'); queryClient.invalidateQueries({ queryKey: ['units'] }); setUnitModalOpen(false); },
    onError: () => message.error('Thêm thất bại'),
  });

  const updateUnit = useMutation({
    mutationFn: (v: any) => unitService.update(editingUnit!.code, v),
    onSuccess: () => { message.success('Đã lưu'); queryClient.invalidateQueries({ queryKey: ['units'] }); setUnitModalOpen(false); },
    onError: () => message.error('Lưu thất bại'),
  });

  const deleteUnit = useMutation({
    mutationFn: (code: string) => unitService.delete(code),
    onSuccess: () => { message.success('Đã xóa'); queryClient.invalidateQueries({ queryKey: ['units'] }); },
    onError: () => message.error('Xóa thất bại — đơn vị có thể đang được sử dụng'),
  });

  const createConv = useMutation({
    mutationFn: (v: any) => unitService.createConversion({
      ...v,
      fromUnit: v.fromUnit.toUpperCase(),
      toUnit: v.toUnit.toUpperCase(),
    }),
    onSuccess: () => { message.success('Đã thêm tỉ lệ'); queryClient.invalidateQueries({ queryKey: ['unit-conversions'] }); setConvModalOpen(false); },
    onError: () => message.error('Thêm thất bại'),
  });

  const updateConv = useMutation({
    mutationFn: (v: any) => unitService.updateConversion(editingConv!.fromUnit, editingConv!.toUnit, v),
    onSuccess: () => { message.success('Đã lưu'); queryClient.invalidateQueries({ queryKey: ['unit-conversions'] }); setConvModalOpen(false); },
    onError: () => message.error('Lưu thất bại'),
  });

  const deleteConv = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => unitService.deleteConversion(from, to),
    onSuccess: () => { message.success('Đã xóa tỉ lệ'); queryClient.invalidateQueries({ queryKey: ['unit-conversions'] }); },
    onError: () => message.error('Xóa thất bại'),
  });

  // ── Unit columns ───────────────────────────────────────────────────────────

  const unitColumns: ColumnsType<Unit> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 110,
      render: (v) => <Tag style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</Tag>,
    },
    {
      title: 'Tên hiển thị',
      dataIndex: 'name',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (v) => v ? <Text type="secondary">{v}</Text> : null,
    },
    {
      title: 'Tỉ lệ',
      key: 'hasConversion',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const hasConv = conversions.some(
          (c) => c.fromUnit === r.code || c.toUnit === r.code,
        );
        return hasConv
          ? <Tooltip title="Có tỉ lệ quy đổi"><SwapOutlined style={{ color: '#2563eb' }} /></Tooltip>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingUnit(r); setUnitModalOpen(true); }}
          />
          <Popconfirm
            title={`Xóa đơn vị "${r.code}"?`}
            onConfirm={() => deleteUnit.mutate(r.code)}
            okText="Xóa"
            cancelText="Hủy"
            okType="danger"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Conversion columns ─────────────────────────────────────────────────────

  const convColumns: ColumnsType<UnitConversion> = [
    {
      title: 'Từ',
      dataIndex: 'fromUnit',
      width: 90,
      render: (v) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'Sang',
      dataIndex: 'toUnit',
      width: 90,
      render: (v) => <Tag color="green" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'Hệ số',
      dataIndex: 'factor',
      width: 120,
      align: 'right',
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: 'Ví dụ',
      dataIndex: 'example',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (v) => v ? <Text type="secondary">{v}</Text> : null,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingConv(r); setConvModalOpen(true); }}
          />
          <Popconfirm
            title={`Xóa tỉ lệ ${r.fromUnit} → ${r.toUnit}?`}
            onConfirm={() => deleteConv.mutate({ from: r.fromUnit, to: r.toUnit })}
            okText="Xóa"
            cancelText="Hủy"
            okType="danger"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>📐 Đơn vị tính</Title>

      {/* ─── Bảng đơn vị ─────────────────────────────────────────────── */}
      <Card
        title={<Text strong>Danh sách đơn vị</Text>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingUnit(null); setUnitModalOpen(true); }}
          >
            Thêm đơn vị
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          Đơn vị độc lập (Ly, Cái, Hộp, ...) — không cần tỉ lệ quy đổi.
          Đơn vị có tỉ lệ (G, KG, ML, L, ...) — khai báo tỉ lệ ở bảng bên dưới.
        </Text>
        <Table<Unit>
          dataSource={units}
          columns={unitColumns}
          rowKey="code"
          loading={unitsLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Divider />

      {/* ─── Bảng tỉ lệ quy đổi ─────────────────────────────────────── */}
      <Card
        title={
          <Space>
            <SwapOutlined />
            <Text strong>Tỉ lệ quy đổi</Text>
          </Space>
        }
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => { setEditingConv(null); setConvModalOpen(true); }}
          >
            Thêm tỉ lệ
          </Button>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          Dùng để tính giá cost nguyên liệu. Ví dụ: recipe dùng "G" nhưng giá nhập theo "KG"
          → cần khai báo G → KG với hệ số 0.001.
        </Text>
        <Table<UnitConversion>
          dataSource={conversions}
          columns={convColumns}
          rowKey={(r) => `${r.fromUnit}-${r.toUnit}`}
          loading={convsLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      <UnitModal
        open={unitModalOpen}
        editing={editingUnit}
        onClose={() => setUnitModalOpen(false)}
        onSave={(v) => editingUnit ? updateUnit.mutate(v) : createUnit.mutate(v)}
        saving={createUnit.isPending || updateUnit.isPending}
      />
      <ConversionModal
        open={convModalOpen}
        editing={editingConv}
        units={units}
        onClose={() => setConvModalOpen(false)}
        onSave={(v) => editingConv ? updateConv.mutate(v) : createConv.mutate(v)}
        saving={createConv.isPending || updateConv.isPending}
      />
    </div>
  );
};

export default UnitsPage;
