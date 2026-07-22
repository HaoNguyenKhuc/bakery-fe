import React, { useEffect, useState } from 'react';
import { Card, Table, DatePicker, Tag, Space, Stat, Alert, Row, Col, Typography } from 'antd';
import dayjs from 'dayjs';
import dailyReportService from '../../../api/services/dailyReportService';
import type { DailyReportLine } from '../../../types/dailyReport';

const { Title, Text } = Typography;

const HuyBanhReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [disposalLines, setDisposalLines] = useState<DailyReportLine[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [reportStatus, setReportStatus] = useState<string>('DRAFT');

  const loadHuyBanhData = async () => {
    setLoading(true);
    try {
      const report = await dailyReportService.init(selectedDate);
      if (report && report.id) {
        setReportStatus(report.status || 'DRAFT');
        const lines = await dailyReportService.getLines(report.id);
        // Filter lines that have disposed quantity
        const filtered = (lines || []).filter(
          (line) => (line.qtyDisposedActual || line.qtyDisposedExpected || 0) > 0
        );
        setDisposalLines(filtered);
      } else {
        setDisposalLines([]);
      }
    } catch {
      setDisposalLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHuyBanhData();
  }, [selectedDate]);

  const totalDisposed = disposalLines.reduce(
    (acc, item) => acc + (item.qtyDisposedActual ?? item.qtyDisposedExpected ?? 0),
    0
  );

  const columns = [
    {
      title: 'Mã bánh',
      dataIndex: ['item', 'key'],
      key: 'code',
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: ['item', 'value'],
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      render: (u: string) => u || 'cái',
    },
    {
      title: 'Số lượng hủy (Dự kiến)',
      dataIndex: 'qtyDisposedExpected',
      key: 'qtyDisposedExpected',
      align: 'right' as const,
      render: (val: number) => val ?? 0,
    },
    {
      title: 'Số lượng hủy (Thực tế)',
      dataIndex: 'qtyDisposedActual',
      key: 'qtyDisposedActual',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {val ?? 0}
        </span>
      ),
    },
    {
      title: 'Ghi chú / Lý do',
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => note || '—',
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="🗑️ Báo cáo Hủy Bánh"
        extra={
          <Space>
            <Text>Chọn ngày:</Text>
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : '')}
              format="DD/MM/YYYY"
            />
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <div className="stat">
              <div className="stat-label">Tổng sản phẩm bị hủy</div>
              <div className="stat-value" style={{ color: '#ff4d4f' }}>
                {totalDisposed} <small style={{ fontSize: 14, color: '#64748b' }}>cái</small>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div className="stat">
              <div className="stat-label">Trạng thái Báo cáo Ngày</div>
              <div style={{ marginTop: 6 }}>
                <Tag color={reportStatus === 'FINALIZED' ? 'success' : 'processing'}>
                  {reportStatus}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>

        <Table
          dataSource={disposalLines}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default HuyBanhReportPage;
