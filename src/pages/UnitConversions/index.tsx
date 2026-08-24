import React, { useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Typography, Popconfirm, message, Tag, Tooltip,
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
                options={units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))}
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
                options={units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))}
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

const UnitConversionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [editingConv, setEditingConv] = useState<UnitConversion | null>(null);
  const [search, setSearch] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => unitService.getAll(),
  });

  const { data: conversions = [], isLoading: convLoading } = useQuery<UnitConversion[]>({
    queryKey: ['unit-conversions'],
    queryFn: () => unitService.getAllConversions(),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateConv = () => {
    queryClient.invalidateQueries({ queryKey: ['unit-conversions'] });
  };

  const createConvMut = useMutation({
    mutationFn: (data: { fromUnit: string; toUnit: string; factor: number; note?: string }) =>
      unitService.createConversion(data),
    onSuccess: () => {
      message.success('Đã thêm tỉ lệ quy đổi!');
      setConvModalOpen(false);
      invalidateConv();
    },
    onError: () => message.error('Thêm thất bại.'),
  });

  const updateConvMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { factor: number; note?: string } }) =>
      unitService.updateConversion(id, data),
    onSuccess: () => {
      message.success('Đã cập nhật!');
      setConvModalOpen(false);
      setEditingConv(null);
      invalidateConv();
    },
    onError: () => message.error('Cập nhật thất bại.'),
  });

  const deleteConvMut = useMutation({
    mutationFn: (id: string) => unitService.deleteConversion(id),
    onSuccess: () => {
      message.success('Đã xoá!');
      invalidateConv();
    },
    onError: () => message.error('Xoá thất bại.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleConvSave = (values: { fromUnit: string; toUnit: string; factor: number; note?: string }) => {
    if (editingConv) {
      updateConvMut.mutate({ id: editingConv.id, data: { factor: values.factor, note: values.note } });
    } else {
      createConvMut.mutate(values);
    }
  };

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredConversions = conversions.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.fromUnit.toLowerCase().includes(q) ||
      c.toUnit.toLowerCase().includes(q) ||
      (c.note || '').toLowerCase().includes(q)
    );
  });

  // ── Columns ────────────────────────────────────────────────────────────────

  const convColumns: ColumnsType<UnitConversion> = [
    {
      title: 'Từ đơn vị',
      dataIndex: 'fromUnit',
      width: 130,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '',
      width: 40,
      render: () => <SwapOutlined style={{ color: '#94a3b8' }} />,
    },
    {
      title: 'Sang đơn vị',
      dataIndex: 'toUnit',
      width: 130,
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Hệ số',
      dataIndex: 'factor',
      width: 160,
      render: (v: number, row: UnitConversion) => (
        <Text>
          1 <Tag color="blue" style={{ margin: '0 4px' }}>{row.fromUnit}</Tag>
          = <b style={{ marginLeft: 4 }}>{v}</b>
          <Tag color="purple" style={{ marginLeft: 4 }}>{row.toUnit}</Tag>
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: unknown, row: UnitConversion) => (
        <Space size={4}>
          <Tooltip title="Sửa hệ số">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => { setEditingConv(row); setConvModalOpen(true); }}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá tỉ lệ quy đổi này?"
            onConfirm={() => deleteConvMut.mutate(row.id)}
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteConvMut.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <SwapOutlined style={{ fontSize: 20, color: '#7c3aed' }} />
          <Title level={4} style={{ margin: 0 }}>Quy Đổi Đơn Vị Tính</Title>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingConv(null); setConvModalOpen(true); }}
        >
          Thêm tỉ lệ
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Tìm theo đơn vị hoặc ghi chú..."
            allowClear
            style={{ maxWidth: 360 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Text type="secondary" style={{ marginLeft: 16, fontSize: 13 }}>
            {filteredConversions.length} / {conversions.length} tỉ lệ
          </Text>
        </div>

        <Table<UnitConversion>
          columns={convColumns}
          dataSource={filteredConversions}
          rowKey="id"
          loading={convLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          bordered
        />
      </Card>

      <ConversionModal
        open={convModalOpen}
        editing={editingConv}
        units={units}
        onClose={() => { setConvModalOpen(false); setEditingConv(null); }}
        onSave={handleConvSave}
        saving={createConvMut.isPending || updateConvMut.isPending}
      />
    </div>
  );
};

export default UnitConversionsPage;
