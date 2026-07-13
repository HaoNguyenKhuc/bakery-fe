import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Typography, Table, Row, Col, Divider, Button, Space, Card } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { GoodsTransferSlip } from '../../../types';

const { Title, Text } = Typography;

const WAREHOUSE_LABEL: Record<string, string> = {
  MAIN: 'Kho Tổng',
  KITCHEN: 'Kho Bếp',
  STORE: 'Cửa Hàng',
};

// Dummy data for testing
const dummySlip: GoodsTransferSlip = {
  slipId: 'ts-001',
  slipCode: 'TR-20260706-001',
  fromWarehouse: 'MAIN',
  toWarehouse: 'KITCHEN',
  status: 'COMPLETED',
  createdBy: 'nguyen.kho',
  createdAt: '2026-07-06T08:00:00Z',
  completedBy: 'bep1.staff',
  completedAt: '2026-07-06T10:30:00Z',
  lines: [
    { ingredientCode: 'NL001', ingredientName: 'Bột Mì Đa Dụng', quantity: 50, unit: 'KG' },
    { ingredientCode: 'NL002', ingredientName: 'Đường Tinh Luyện', quantity: 20, unit: 'KG' },
    { ingredientCode: 'NL003', ingredientName: 'Bơ Nhạt', quantity: 15, unit: 'KG' },
  ]
};

const TransferSlipPrintPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: slip, isLoading } = useQuery({
    queryKey: ['transfer-slip', id],
    queryFn: async () => {
      // Giả lập delay
      return new Promise<GoodsTransferSlip>((resolve) => {
        setTimeout(() => resolve({ ...dummySlip, slipId: id!, slipCode: `TR-${id}` }), 400);
      });
    },
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <Card loading={true} style={{ minHeight: '60vh' }} />;
  if (!slip) return <div style={{ textAlign: 'center', padding: 50 }}>Không tìm thấy phiếu</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      {/* ── Các nút hành động, sẽ bị ẩn khi in (thông qua CSS @media print) ── */}
      <div className="no-print" style={{ marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Quay Lại
          </Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Tiến Hành In
          </Button>
        </Space>
      </div>

      {/* ── Nội dung in ── */}
      <Card id="printable-area" bordered={false} style={{ boxShadow: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Title level={3} style={{ margin: 0, textTransform: 'uppercase' }}>
            Phiếu Xuất Kho
          </Title>
          <Text type="secondary">Mã Phiếu: {slip.slipCode}</Text>
        </div>

        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Space direction="vertical" size={2}>
              <Text><b>Từ Kho:</b> {WAREHOUSE_LABEL[slip.fromWarehouse] ?? slip.fromWarehouse}</Text>
              <Text><b>Đến Kho:</b> {WAREHOUSE_LABEL[slip.toWarehouse] ?? slip.toWarehouse} {slip.toBranchCode && `(${slip.toBranchCode})`}</Text>
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space direction="vertical" size={2} style={{ textAlign: 'right' }}>
              <Text><b>Ngày Lập:</b> {dayjs(slip.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
              <Text><b>Người Lập:</b> {slip.createdBy}</Text>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        <Table
          dataSource={slip.lines}
          rowKey="ingredientCode"
          pagination={false}
          size="small"
          bordered
          columns={[
            {
              title: 'STT',
              key: 'index',
              width: 50,
              align: 'center',
              render: (_: any, __: any, index: number) => index + 1,
            },
            {
              title: 'Mã NL',
              dataIndex: 'ingredientCode',
              key: 'ingredientCode',
              width: 100,
            },
            {
              title: 'Tên Nguyên Liệu',
              dataIndex: 'ingredientName',
              key: 'ingredientName',
            },
            {
              title: 'ĐVT',
              dataIndex: 'unit',
              key: 'unit',
              width: 80,
              align: 'center',
            },
            {
              title: 'Số Lượng',
              dataIndex: 'quantity',
              key: 'quantity',
              width: 100,
              align: 'right',
              render: (val: number) => val.toLocaleString('vi-VN'),
            },
            {
              title: 'Ghi Chú',
              dataIndex: 'note',
              key: 'note',
            }
          ]}
        />

        <Row style={{ marginTop: 40 }} gutter={16}>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Title level={5}>Người Lập Phiếu</Title>
            <Text type="secondary">(Ký & ghi rõ họ tên)</Text>
            <div style={{ height: 80 }}></div>
            <Text>{slip.createdBy}</Text>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Title level={5}>Thủ Kho Giao Hàng</Title>
            <Text type="secondary">(Ký & ghi rõ họ tên)</Text>
            <div style={{ height: 80 }}></div>
            <Text>{slip.readyBy ?? ''}</Text>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Title level={5}>Người Nhận Hàng</Title>
            <Text type="secondary">(Ký & ghi rõ họ tên)</Text>
            <div style={{ height: 80 }}></div>
            <Text>{slip.completedBy ?? ''}</Text>
          </Col>
        </Row>
      </Card>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TransferSlipPrintPage;