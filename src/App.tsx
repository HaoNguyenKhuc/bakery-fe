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
const UnitsPage = React.lazy(() => import('./pages/Units'));

// Kế hoạch SX
const SxConfig = React.lazy(() => import('./pages/SxConfig'));
const ProdGroups = React.lazy(() => import('./pages/ProdGroups'));
const ThresholdRules = React.lazy(() => import('./pages/ThresholdRules'));
const ProdPlans = React.lazy(() => import('./pages/ProdPlans'));

// Sản xuất
const ProductionRequestList = React.lazy(() => import('./pages/ProductionRequests'));
const ProductionRequestForm = React.lazy(() => import('./pages/ProductionRequests/ProductionRequestForm'));
const KitchenDelivery = React.lazy(() => import('./pages/Production/KitchenDelivery'));
const ProdAdjustments = React.lazy(() => import('./pages/ProdAdjustments'));

// Kho
const MainWarehouse = React.lazy(() => import('./pages/Warehouse/Main'));
const InventoryRequests = React.lazy(() => import('./pages/Warehouse/InventoryRequests'));
const InventoryRequestCreate = React.lazy(() => import('./pages/Warehouse/InventoryRequestCreate'));

// Báo cáo
const ReportsPage = React.lazy(() => import('./pages/Reports'));

// Hệ thống
const Users = React.lazy(() => import('./pages/System/Users'));
const Roles = React.lazy(() => import('./pages/System/Roles'));
const ActivityLog = React.lazy(() => import('./pages/System/ActivityLog'));

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
        <Route path="units" element={<Lazy><UnitsPage /></Lazy>} />

        {/* ── Kế hoạch SX ── */}
        <Route path="sx-config" element={<Lazy><SxConfig /></Lazy>} />
        <Route path="prod-groups" element={<Lazy><ProdGroups /></Lazy>} />
        <Route path="threshold-rules" element={<Lazy><ThresholdRules /></Lazy>} />
        <Route path="prod-plans" element={<Lazy><ProdPlans /></Lazy>} />

        {/* ── Sản xuất ── */}
        <Route path="prod-requests" element={<Lazy><ProductionRequestList /></Lazy>} />
        <Route path="prod-requests/create" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="prod-requests/edit/:id" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="delivery" element={<Lazy><KitchenDelivery /></Lazy>} />
        <Route path="prod-adjustments" element={<Lazy><ProdAdjustments /></Lazy>} />

        {/* ── Kho ── */}
        <Route path="warehouse/:type/phieu-kho/create" element={<Lazy><InventoryRequestCreate /></Lazy>} />
        <Route path="warehouse/:type" element={<Lazy><MainWarehouse /></Lazy>} />
        <Route path="stock-summary" element={<Navigate to="/warehouse/kho-chinh" replace />} />
        <Route path="inventory-requests" element={<Lazy><InventoryRequests /></Lazy>} />

        {/* ── Báo cáo ── */}
        <Route path="reports" element={<Lazy><ReportsPage /></Lazy>} />

        {/* ── Hệ thống ── */}
        <Route path="users"        element={<Lazy><Users /></Lazy>} />
        <Route path="roles"        element={<Lazy><Roles /></Lazy>} />
        <Route path="activity-log" element={<Lazy><ActivityLog /></Lazy>} />

        {/* Catch-all: redirect unknown paths to products */}
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
