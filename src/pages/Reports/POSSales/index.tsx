import React, { useState, useCallback } from 'react';
import {
  Row, Col, Card, Button, DatePicker, Upload, Table, Typography,
  Space, Tag, message, Statistic, Empty, Divider,
} from 'antd';
import {
  UploadOutlined, ReloadOutlined, FileExcelOutlined,
  InboxOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import posSaleService from '../../../api/services/posSaleService';
import type { PosDailySale } from '../../../types/posSale';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ─── Constants ───────────────────────────────────────────────────────────────

const TODAY = dayjs();

// ─── Component ───────────────────────────────────────────────────────────────

const POSSales: React.FC = () => {
  const queryClient = useQueryClient();

  // Upload panel state
  const [uploadDate, setUploadDate] = useState<Dayjs>(TODAY);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // View panel state
  const [viewDate, setViewDate] = useState<Dayjs>(TODAY);

  // ── Fetch POS data ──────────────────────────────────────────────────────────

  const {
    data: posData = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['pos-sales', viewDate.format('YYYY-MM-DD')],
    queryFn: () => posSaleService.getBySaleDate(viewDate.format('YYYY-MM-DD')),
  });

  // ── Upload mutation ─────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: ({ date, file }: { date: string; file: File }) =>
      posSaleService.upload(date, file),
    onSuccess: (result) => {
      message.success(
        `Upload thành công: ${result.successCount} dòng${result.errorCount > 0 ? `, ${result.errorCount} lỗi` : ''}`,
      );
      setFileList([]);
      // Sync view date to upload date and refresh data
      setViewDate(uploadDate);
      queryClient.invalidateQueries({ queryKey: ['pos-sales'] });
    },
    onError: () => {
      message.error('Upload thất bại. Vui lòng kiểm tra lại file.');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUpload = useCallback(() => {
    if (fileList.length === 0) {
      message.warning('Vui lòng chọn file Excel (.xlsx)');
      return;
    }
    const file = fileList[0].originFileObj;
    if (!file) return;
    uploadMutation.mutate({
      date: uploadDate.format('YYYY-MM-DD'),
      file,
    });
  }, [fileList, uploadDate, uploadMutation]);

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls',
    maxCount: 1,
    fileList,
    beforeUpload: () => false, // prevent auto-upload
    onChange: ({ fileList: newList }) => setFileList(newList),
    onRemove: () => setFileList([]),
  };

  // ── Totals ──────────────────────────────────────────────────────────────────

  const totalQty = posData.reduce((sum, row) => sum + (row.qtyBan ?? 0), 0);
  const mappedCount = posData.filter((r) => r.itemName).length;

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns: ColumnsType<PosDailySale> = [
    {
      title: 'STT',
      width: 50,
      align: 'center',
      render: (_v, _r, idx) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{idx + 1}</Text>
      ),
    },
    {
      title: 'EX_CODE',
      dataIndex: 'exCode',
      width: 140,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Tên SP (POS)',
      dataIndex: 'itemName',
      render: (v: string | undefined) =>
        v ? (
          <Text>{v}</Text>
        ) : (
          <Text type="secondary" style={{ fontStyle: 'italic' }}>
            — chưa mapping
          </Text>
        ),
    },
    {
      title: 'Qty bán',
      dataIndex: 'qtyBan',
      align: 'right',
      width: 90,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      width: 160,
      render: (v: string | undefined) =>
        v ? <Text type="secondary">{v}</Text> : <Text type="secondary">—</Text>,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px' }}>
      <Title level={4} style={{ marginBottom: 20 }}>
        <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        POS Sales
      </Title>

      <Row gutter={24}>
        {/* ─── LEFT: Upload panel ─────────────────────────────────────── */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <UploadOutlined />
                Upload file POS Excel
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Date selector */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Ngày bán <Text type="danger">*</Text>
                </Text>
                <DatePicker
                  value={uploadDate}
                  onChange={(d) => d && setUploadDate(d)}
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  disabledDate={(d) => d.isAfter(TODAY)}
                />
              </div>

              {/* File upload area */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  File Excel (.xlsx) <Text type="danger">*</Text>
                </Text>
                <Dragger {...uploadProps} style={{ padding: '8px 0' }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#1677ff' }} />
                  </p>
                  <p className="ant-upload-text">
                    Kéo thả hoặc click để chọn file
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                    Chỉ hỗ trợ file .xlsx / .xls từ hệ thống POS
                  </p>
                </Dragger>
              </div>

              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploadMutation.isPending}
                onClick={handleUpload}
                disabled={fileList.length === 0}
                block
                size="large"
              >
                Upload dữ liệu POS
              </Button>

              {uploadMutation.isSuccess && (
                <Tag
                  icon={<CheckCircleOutlined />}
                  color="success"
                  style={{ padding: '4px 12px', fontSize: 13 }}
                >
                  Upload thành công
                </Tag>
              )}
            </Space>
          </Card>
        </Col>

        {/* ─── RIGHT: View panel ──────────────────────────────────────── */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                Doanh số POS đã nhập
              </Space>
            }
            extra={
              <Space>
                <DatePicker
                  value={viewDate}
                  onChange={(d) => d && setViewDate(d)}
                  format="DD/MM/YYYY"
                  disabledDate={(d) => d.isAfter(TODAY)}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => refetch()}
                  loading={isLoading}
                />
              </Space>
            }
          >
            {/* Summary stats */}
            {posData.length > 0 && (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="Tổng dòng"
                      value={posData.length}
                      suffix="dòng"
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Tổng qty bán"
                      value={totalQty}
                      suffix="cái"
                      valueStyle={{ fontSize: 20, color: '#1677ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Đã mapping"
                      value={mappedCount}
                      suffix={`/ ${posData.length}`}
                      valueStyle={{
                        fontSize: 20,
                        color: mappedCount === posData.length ? '#52c41a' : '#faad14',
                      }}
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: '0 0 12px' }} />
              </>
            )}

            <Table<PosDailySale>
              dataSource={posData}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Text type="secondary">
                        Không có dữ liệu POS cho ngày{' '}
                        <Text strong>{viewDate.format('DD/MM/YYYY')}</Text>
                      </Text>
                    }
                  />
                ),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default POSSales;
