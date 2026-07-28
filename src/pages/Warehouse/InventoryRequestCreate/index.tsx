import React from 'react';
import { Typography, Space, Button, Breadcrumb } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useWarehouseStore } from '../../../store';
import CreateTab from '../InventoryRequests/components/CreateTab';

const { Title } = Typography;

const InventoryRequestCreate: React.FC = () => {
  const navigate = useNavigate();
  const { type = 'kho-chinh' } = useParams<{ type: string }>();

  const getKhoTong = useWarehouseStore((s) => s.getKhoTong);
  const getKhoBep = useWarehouseStore((s) => s.getKhoBep);
  const getStores = useWarehouseStore((s) => s.getStores);

  const khoTong = getKhoTong();
  const khoBeps = getKhoBep();
  const stores = getStores();

  let warehouseFilter = khoTong;
  let warehouseName = 'Kho Chính';

  if (type === 'kho-bep') {
    warehouseFilter = khoBeps.length > 0 ? khoBeps[0] : undefined;
    warehouseName = 'Kho Bếp';
  } else if (type === 'cua-hang') {
    warehouseFilter = stores.length > 0 ? stores[0] : undefined;
    warehouseName = 'Cửa Hàng';
  }

  const handleBack = () => {
    navigate(`/warehouse/${type}?tab=phieu-kho`);
  };

  return (
    <div className="pp-page" style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Space><HomeOutlined /><span>Kho</span></Space> },
          { title: <span style={{ cursor: 'pointer' }} onClick={handleBack}>{warehouseName}</span> },
          { title: <span style={{ cursor: 'pointer' }} onClick={handleBack}>Phiếu Kho</span> },
          { title: 'Tạo phiếu mới' }
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            Quay lại danh sách
          </Button>
          <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
            ➕ Tạo Phiếu Kho Mới - {warehouseName}
          </Title>
        </Space>
      </div>

      <CreateTab
        warehouseFilter={warehouseFilter}
        onSuccess={handleBack}
        onCancel={handleBack}
      />
    </div>
  );
};

export default InventoryRequestCreate;
