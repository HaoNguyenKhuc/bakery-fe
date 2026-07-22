import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import RequireAuth from './components/Auth/RequireAuth';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────

const Login = React.lazy(() => import('./pages/Auth/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

// Master Data
const ProductList = React.lazy(() => import('./pages/Product/ProductList'));
const ProductForm = React.lazy(() => import('./pages/Product/ProductList/ProductForm'));
const ProductHistory = React.lazy(() => import('./pages/Product/ProductList/ProductHistory'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const ProductMapping = React.lazy(() => import('./pages/ProductMapping'));
const ItemGroupList = React.lazy(() => import('./pages/Product/ItemGroup'));

// Kế hoạch SX
const SxConfig = React.lazy(() => import('./pages/SxConfig'));
const ProductionPlanning = React.lazy(() => import('./pages/ProductionGroups'));
const ThresholdRules = React.lazy(() => import('./pages/ThresholdRules'));

// Sản xuất
const ProductionRequestList = React.lazy(() => import('./pages/ProductionRequests'));
const ProductionRequestForm = React.lazy(() => import('./pages/ProductionRequests/ProductionRequestForm'));
const KitchenDelivery = React.lazy(() => import('./pages/Production/KitchenDelivery'));
const ProdAdjustments = React.lazy(() => import('./pages/ProdAdjustments'));

// Kho
const MainWarehouse = React.lazy(() => import('./pages/Warehouse/Main'));
const GoodsTransfer = React.lazy(() => import('./pages/Warehouse/GoodsTransfer'));
const PurchaseForm = React.lazy(() => import('./pages/Warehouse/components/PurchaseForm'));
const TransferForm = React.lazy(() => import('./pages/Warehouse/components/TransferForm'));
const AdjustForm = React.lazy(() => import('./pages/Warehouse/components/AdjustForm'));

// Báo cáo
const DailyReport = React.lazy(() => import('./pages/Reports/DailyReport'));
const HuyBanh = React.lazy(() => import('./pages/Reports/HuyBanh'));
const POSSales = React.lazy(() => import('./pages/Reports/POSSales'));

// ── Suspense wrapper ───────────────────────────────────────────────────────────

const PageLoading: React.FC = () => (
  <div className="app-loading">
    <Spin size="large" tip="Đang tải..." />
  </div>
);

const Lazy: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

// ── App ────────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  return (
    <Routes>
      {/* ── Public route: Login ── */}
      <Route
        path="/login"
        element={
          <Lazy>
            <Login />
          </Lazy>
        }
      />

      {/* ── Protected routes (wrapped in RequireAuth + MainLayout) ── */}
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        {/* Default route -> redirect to products */}
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="dashboard" element={<Lazy><Dashboard /></Lazy>} />

        {/* ── Master Data ── */}
        <Route path="products" element={<Lazy><ProductList /></Lazy>} />
        <Route path="products/create" element={<Lazy><ProductForm /></Lazy>} />
        <Route path="products/edit/:id" element={<Lazy><ProductForm /></Lazy>} />
        <Route path="products/:id/history" element={<Lazy><ProductHistory /></Lazy>} />
        <Route path="suppliers" element={<Lazy><Suppliers /></Lazy>} />
        <Route path="product-mapping" element={<Lazy><ProductMapping /></Lazy>} />
        <Route path="item-groups" element={<Lazy><ItemGroupList /></Lazy>} />

        {/* ── Kế hoạch SX ── */}
        <Route path="sx-config" element={<Lazy><SxConfig /></Lazy>} />
        <Route path="prod-groups" element={<Lazy><ProductionPlanning /></Lazy>} />
        <Route path="threshold-rules" element={<Lazy><ThresholdRules /></Lazy>} />
        <Route path="prod-plans" element={<Lazy><ProductionPlanning /></Lazy>} />

        {/* ── Sản xuất ── */}
        <Route path="prod-requests" element={<Lazy><ProductionRequestList /></Lazy>} />
        <Route path="prod-requests/create" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="prod-requests/edit/:id" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="delivery" element={<Lazy><KitchenDelivery /></Lazy>} />
        <Route path="prod-adjustments" element={<Lazy><ProdAdjustments /></Lazy>} />

        {/* ── Kho ── */}
        <Route path="stock-summary" element={<Lazy><MainWarehouse /></Lazy>} />
        <Route path="inventory-requests" element={<Lazy><GoodsTransfer /></Lazy>} />
        <Route path="warehouse/main/purchase" element={<Lazy><PurchaseForm /></Lazy>} />
        <Route path="warehouse/transfer/:warehouseCode" element={<Lazy><TransferForm /></Lazy>} />
        <Route path="warehouse/adjust/:warehouseCode" element={<Lazy><AdjustForm /></Lazy>} />

        {/* ── Báo cáo ── */}
        <Route path="reports/daily" element={<Lazy><DailyReport /></Lazy>} />
        <Route path="reports/huy-banh" element={<Lazy><HuyBanh /></Lazy>} />
        <Route path="reports/pos-sales" element={<Lazy><POSSales /></Lazy>} />

        {/* Catch-all: redirect unknown paths to products */}
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
