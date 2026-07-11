import React, { useState } from 'react';
import {
  Button, Typography, Tabs, Card, Statistic, Alert,
  Tag, Space, Row, Col, Divider, Progress, Table,
  Upload, DatePicker, message, Badge,
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, FileExcelOutlined,
  CloudUploadOutlined, BarChartOutlined, InboxOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { batchService } from '../../../api/services';
import type { BatchResult, UploadResult } from '../../../types';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

// ─── Dummy fallback data ──────────────────────────────────────────────────────

const dummyBatchResult: BatchResult = {
  date: dayjs().format('YYYY-MM-DD'),
  totalProducts: 12,
  okCount: 9,
  overCount: 2,
  underCount: 1,
  discrepancyCount: 3,
  batchRunId: 'batch-run-demo-001',
  completedAt: dayjs().subtract(2, 'hour').toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadZoneProps {
  title: string;
  description: string;
  accept?: string;
  status: UploadStatus;
  result: UploadResult | null;
  onUpload: (file: File) => void;
  loading: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  title, description, status, result, onUpload, loading,
}) => {
  const statusIcon = () => {
    if (status === 'success') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
    if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />;
    return <CloudUploadOutlined style={{ color: '#1890ff', fontSize: 24 }} />;
  };

  const borderColor = {
    idle: '#d9d9d9',
    uploading: '#1890ff',
    success: '#52c41a',
    error: '#ff4d4f',
  }[status];

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      onUpload(file);
      return false; // prevent auto upload — we handle manually
    },
  };

  return (
    <Card
      style={{
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        transition: 'border-color 0.3s',
      }}
      styles={{ body: { padding: '16px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Space>
          {statusIcon()}
          <div>
            <Text strong>{title}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {description}
            </Text>
          </div>
        </Space>

        <Dragger {...uploadProps} disabled={loading} style={{ padding: '8px 0' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
            <UploadOutlined style={{ marginRight: 4 }} />
            {loading ? 'Đang upload...' : 'Kéo file vào đây hoặc click để chọn (.xlsx)'}
          </p>
        </Dragger>

        {result && (
          <Alert
            type={result.success ? 'success' : 'error'}
            showIcon
            message={
              result.success
                ? `✅ Thành công: ${result.processedRows} dòng được xử lý`
                : `❌ Lỗi: ${result.errorRows} dòng lỗi`
            }
            description={
              result.errors && result.errors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.errors.slice(0, 3).map((e, i) => (
                    <li key={i} style={{ fontSize: 12 }}>{e}</li>
                  ))}
                  {result.errors.length > 3 && (
                    <li style={{ fontSize: 12 }}>...và {result.errors.length - 3} lỗi khác</li>
                  )}
                </ul>
              ) : undefined
            }
          />
        )}
      </Space>
    </Card>
  );
};

// ─── Tab 1: Opening Stock ─────────────────────────────────────────────────────

const OpeningStockTab: React.FC = () => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => batchService.uploadOpeningStock(file),
    onMutate: () => setStatus('uploading'),
    onSuccess: (data) => {
      setStatus('success');
      setResult(data as unknown as UploadResult);
      message.success('Upload tồn kho ban đầu thành công!');
    },
    onError: () => {
      setStatus('error');
      message.error('Upload thất bại.');
    },
  });

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Upload file Excel tồn kho ban đầu (Chỉ làm 1 lần khi khởi động hệ thống)"
        description={
          <Space direction="vertical" size={4}>
            <Text>Format file: cột <Text code>EX_CODE</Text> và <Text code>QUANTITY</Text></Text>
            <Text>Ví dụ:</Text>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #d9d9d9', padding: '2px 8px', background: '#fafafa' }}>EX_CODE</th>
                  <th style={{ border: '1px solid #d9d9d9', padding: '2px 8px', background: '#fafafa' }}>QUANTITY</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #d9d9d9', padding: '2px 8px' }}>BM1234</td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '2px 8px' }}>10</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #d9d9d9', padding: '2px 8px' }}>BM5678</td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '2px 8px' }}>5</td>
                </tr>
              </tbody>
            </table>
          </Space>
        }
        style={{ marginBottom: 20 }}
      />

      <Row justify="center">
        <Col xs={24} md={16} lg={12}>
          <UploadZone
            title="Tồn Kho Ban Đầu"
            description="opening-stock.xlsx — EX_CODE + QUANTITY"
            status={status}
            result={result}
            onUpload={(file) => uploadMutation.mutate(file)}
            loading={uploadMutation.isPending}
          />
        </Col>
      </Row>
    </div>
  );
};

// ─── Tab 2: Daily Uploads ─────────────────────────────────────────────────────

interface SingleUpload {
  status: UploadStatus;
  result: UploadResult | null;
}

const DailyUploadsTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [pos, setPos] = useState<SingleUpload>({ status: 'idle', result: null });
  const [report, setReport] = useState<SingleUpload>({ status: 'idle', result: null });
  const [kitchenExport, setKitchenExport] = useState<SingleUpload>({ status: 'idle', result: null });

  const makeUploadHandler = (
    mutationFn: (file: File, date: string) => Promise<unknown>,
    setter: React.Dispatch<React.SetStateAction<SingleUpload>>,
  ) => {
    return (file: File) => {
      setter({ status: 'uploading', result: null });
      mutationFn(file, selectedDate)
        .then((data) => {
          setter({ status: 'success', result: data as UploadResult });
          message.success('Upload thành công!');
        })
        .catch(() => {
          setter({ status: 'error', result: null });
          message.error('Upload thất bại.');
        });
    };
  };

  const allSuccess =
    pos.status === 'success' &&
    report.status === 'success' &&
    kitchenExport.status === 'success';

  const uploadCount = [pos, report, kitchenExport].filter((u) => u.status === 'success').length;

  return (
    <div>
      {/* Date Picker */}
      <Card size="small" style={{ marginBottom: 20 }}>
        <Space align="center">
          <Text strong>Ngày xử lý:</Text>
          <DatePicker
            defaultValue={dayjs()}
            format="DD/MM/YYYY"
            onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
            allowClear={false}
          />
          <Badge
            count={`${uploadCount}/3 file`}
            style={{ backgroundColor: uploadCount === 3 ? '#52c41a' : '#fa8c16' }}
          />
        </Space>
      </Card>

      {allSuccess && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Đã upload đủ 3 file cho ngày này! Vào tab Kết Quả Đối Chiếu để xem báo cáo."
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* POS Report */}
        <Col xs={24} md={8}>
          <UploadZone
            title="📊 Báo Cáo POS"
            description={`BaoCaoPOS_${dayjs(selectedDate).format('DDMMYYYY')}.xlsx`}
            status={pos.status}
            result={pos.result}
            onUpload={makeUploadHandler(
              (file, date) => batchService.uploadPOS(file, date),
              setPos,
            )}
            loading={pos.status === 'uploading'}
          />
        </Col>

        {/* Staff Daily Report */}
        <Col xs={24} md={8}>
          <UploadZone
            title="📋 Báo Cáo Ngày Nhân Viên"
            description={`BaoCaoNgay_${dayjs(selectedDate).format('DDMMYYYY')}.xlsx`}
            status={report.status}
            result={report.result}
            onUpload={makeUploadHandler(
              (file, date) => batchService.uploadDailyReport(file, date),
              setReport,
            )}
            loading={report.status === 'uploading'}
          />
        </Col>

        {/* Kitchen Export */}
        <Col xs={24} md={8}>
          <UploadZone
            title="🍞 Bếp Xuất Thực Tế"
            description={`BanhRaNgay_${dayjs(selectedDate).format('DDMMYYYY')}.xlsx`}
            status={kitchenExport.status}
            result={kitchenExport.result}
            onUpload={makeUploadHandler(
              (file, date) => batchService.uploadKitchenExport(file, date),
              setKitchenExport,
            )}
            loading={kitchenExport.status === 'uploading'}
          />
        </Col>
      </Row>

      {/* Progress */}
      <Card size="small" style={{ marginTop: 20 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>Tiến Độ Upload Hôm Nay</Text>
          <Progress
            percent={Math.round((uploadCount / 3) * 100)}
            strokeColor={uploadCount === 3 ? '#52c41a' : '#1890ff'}
            format={(p) => `${uploadCount}/3 file (${p}%)`}
          />
        </Space>
      </Card>
    </div>
  );
};

// ─── Tab 3: Batch Results ─────────────────────────────────────────────────────

interface BatchDetailRow {
  key: string;
  status: string;
  count: number;
  color: string;
  description: string;
}

const BatchResultsTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['batch-result', selectedDate],
    queryFn: () => batchService.getBatchResult(selectedDate),
    retry: 1,
    enabled: !!selectedDate,
  });

  const result: BatchResult | null = data
    ? (data as unknown as BatchResult)
    : (selectedDate === dayjs().format('YYYY-MM-DD') ? dummyBatchResult : null);

  const okRate = result
    ? Math.round((result.okCount / Math.max(result.totalProducts, 1)) * 100)
    : 0;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await batchService.exportBatchReport(selectedDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCaoDoiChieu_${dayjs(selectedDate).format('DDMMYYYY')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Đã tải xuống báo cáo Excel!');
    } catch {
      message.error('Tải xuống thất bại.');
    } finally {
      setIsDownloading(false);
    }
  };

  const detailRows: BatchDetailRow[] = result
    ? [
        {
          key: 'ok',
          status: '✅ Khớp',
          count: result.okCount,
          color: '#52c41a',
          description: 'Số lượng thực tế = Số lượng theo báo cáo',
        },
        {
          key: 'over',
          status: '⬆️ Thừa',
          count: result.overCount,
          color: '#fa8c16',
          description: 'Sản xuất nhiều hơn mức bán',
        },
        {
          key: 'under',
          status: '⬇️ Thiếu',
          count: result.underCount,
          color: '#ff4d4f',
          description: 'Sản xuất ít hơn mức bán — cần kiểm tra',
        },
        {
          key: 'disc',
          status: '⚠️ Chênh Lệch',
          count: result.discrepancyCount,
          color: '#722ed1',
          description: 'Có sự khác biệt giữa các nguồn dữ liệu',
        },
      ]
    : [];

  const detailColumns: ColumnsType<BatchDetailRow> = [
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (v: string, r: BatchDetailRow) => <Tag color={r.color}>{v}</Tag>,
    },
    {
      title: 'Số Sản Phẩm',
      dataIndex: 'count',
      key: 'count',
      align: 'center',
      render: (v: number, r: BatchDetailRow) => (
        <Text strong style={{ color: r.color, fontSize: 18 }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Mô Tả',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
  ];

  return (
    <div>
      {/* Controls */}
      <Card size="small" style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Ngày đối chiếu:</Text>
          </Col>
          <Col>
            <DatePicker
              defaultValue={dayjs()}
              format="DD/MM/YYYY"
              onChange={(date) =>
                setSelectedDate(date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))
              }
              allowClear={false}
            />
          </Col>
          <Col>
            <Button onClick={() => refetch()} loading={isLoading}>
              Tải lại
            </Button>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              disabled={!result}
              loading={isDownloading}
              onClick={handleDownload}
            >
              Tải Excel
            </Button>
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <Card loading />
      ) : !result ? (
        <Alert
          type="info"
          showIcon
          icon={<InboxOutlined />}
          message="Chưa có dữ liệu đối chiếu cho ngày này."
          description="Upload đủ 3 file trong tab Tải File Hàng Ngày để tạo kết quả đối chiếu."
        />
      ) : (
        <>
          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderTop: '3px solid #262626' }}>
                <Statistic
                  title="Tổng Sản Phẩm"
                  value={result.totalProducts}
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
                <Statistic
                  title="Khớp ✅"
                  value={result.okCount}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderTop: '3px solid #fa8c16' }}>
                <Statistic
                  title="Thừa ⬆️"
                  value={result.overCount}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderTop: '3px solid #ff4d4f' }}>
                <Statistic
                  title="Thiếu ⬇️"
                  value={result.underCount}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Progress bar */}
          <Card size="small" style={{ marginBottom: 20 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Space>
                <Text strong>Tỷ lệ khớp:</Text>
                <Text
                  strong
                  style={{
                    color: okRate >= 90 ? '#52c41a' : okRate >= 70 ? '#fa8c16' : '#ff4d4f',
                    fontSize: 18,
                  }}
                >
                  {okRate}%
                </Text>
                {result.discrepancyCount === 0 ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Khớp hoàn toàn
                  </Tag>
                ) : (
                  <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                    {result.discrepancyCount} sản phẩm có chênh lệch
                  </Tag>
                )}
              </Space>
              <Progress
                percent={okRate}
                strokeColor={
                  okRate >= 90 ? '#52c41a' : okRate >= 70 ? '#fa8c16' : '#ff4d4f'
                }
              />
            </Space>
          </Card>

          {/* Detail Table */}
          <Table<BatchDetailRow>
            columns={detailColumns}
            dataSource={detailRows}
            pagination={false}
            size="middle"
            rowKey="key"
          />

          {/* Meta */}
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Batch Run ID: <Text code>{result.batchRunId}</Text>
              {' · '}
              Hoàn thành: {dayjs(result.completedAt).format('HH:mm DD/MM/YYYY')}
            </Text>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BakeryWarehouse: React.FC = () => {
  const tabItems = [
    {
      key: 'opening-stock',
      label: (
        <Space>
          <InboxOutlined />
          Tồn Kho Ban Đầu
        </Space>
      ),
      children: <OpeningStockTab />,
    },
    {
      key: 'daily-uploads',
      label: (
        <Space>
          <FileExcelOutlined />
          Tải File Hàng Ngày
        </Space>
      ),
      children: <DailyUploadsTab />,
    },
    {
      key: 'batch-results',
      label: (
        <Space>
          <BarChartOutlined />
          Kết Quả Đối Chiếu
        </Space>
      ),
      children: <BatchResultsTab />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Kho Bánh</Title>
        <Text type="secondary">
          Upload file POS, báo cáo ngày, bếp xuất và xem kết quả đối chiếu 3 tầng
        </Text>
      </div>

      <Divider style={{ margin: '0 0 20px' }} />

      <Tabs defaultActiveKey="daily-uploads" items={tabItems} />
    </div>
  );
};

export default BakeryWarehouse;
