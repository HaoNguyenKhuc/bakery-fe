import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, DatePicker, Select, Space, Alert } from 'antd';
import dayjs from 'dayjs';
import prodAdjustmentService from '../../api/services/prodAdjustmentService';
import type { ProdAdjustment } from '../../types';

const ProdAdjustmentsPage: React.FC = () => {
  const [adjustments, setAdjustments] = useState<ProdAdjustment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [adjType, setAdjType] = useState<string>('ALL');

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const data = await prodAdjustmentService.getList({
        productionDate: selectedDate,
        adjustmentType: adjType === 'ALL' ? undefined : (adjType as any),
      });
      setAdjustments(data || []);
    } catch {
      // Stub endpoint fallback if not implemented on backend yet
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
  }, [selectedDate, adjType]);

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => (val ? dayjs(val).format('DD/MM/YYYY HH:mm') : '—'),
    },
    {
      title: 'Loại điều chỉnh',
      dataIndex: 'adjustmentType',
      key: 'adjustmentType',
      render: (type: string) => {
        if (type === 'INGREDIENT_VARIANCE') {
          return <Tag color="orange">Chênh lệch nguyên liệu</Tag>;
        }
        if (type === 'PRODUCTION_WASTAGE') {
          return <Tag color="volcano">Hao hụt sản xuất</Tag>;
        }
        return <Tag>{type || 'Khác'}</Tag>;
      },
    },
    {
      title: 'Số lượng lệch',
      dataIndex: 'qtyDifference',
      key: 'qtyDifference',
      render: (qty: number) => (
        <span style={{ color: qty < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          {qty > 0 ? `+${qty}` : qty}
        </span>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      render: (r: string) => r || '—',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (n: string) => n || '—',
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="⚠️ Điều chỉnh sản xuất"
        extra={
          <Space>
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : '')}
              format="DD/MM/YYYY"
            />
            <Select
              value={adjType}
              onChange={setAdjType}
              style={{ width: 200 }}
              options={[
                { value: 'ALL', label: 'Tất cả loại' },
                { value: 'INGREDIENT_VARIANCE', label: 'Chênh lệch NL' },
                { value: 'PRODUCTION_WASTAGE', label: 'Hao hụt sản xuất' },
              ]}
            />
          </Space>
        }
      >
        <Alert
          message="Ghi nhận điều chỉnh khi sản xuất thực tế có chênh lệch so với lệnh sản xuất ban đầu (do hao hụt hoặc thay đổi định lượng nguyên liệu)."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={adjustments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ProdAdjustmentsPage;
