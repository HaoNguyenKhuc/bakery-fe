import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import RequireAuth from './components/Auth/RequireAuth';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────

const Login           = React.lazy(() => import('./pages/Auth/Login'));
const Dashboard       = React.lazy(() => import('./pages/Dashboard'));
const ProductList     = React.lazy(() => import('./pages/Product/ProductList'));
const Recipe          = React.lazy(() => import('./pages/Product/Recipe'));
const CostPrice       = React.lazy(() => import('./pages/Product/CostPrice'));
const MainWarehouse    = React.lazy(() => import('./pages/Warehouse/Main'));
const KitchenWarehouse = React.lazy(() => import('./pages/Warehouse/Kitchen'));
const StoreWarehouse   = React.lazy(() => import('./pages/Warehouse/Store'));
const BakeryWarehouse  = React.lazy(() => import('./pages/Warehouse/Bakery'));
const GoodsTransfer   = React.lazy(() => import('./pages/Warehouse/GoodsTransfer'));
const InventoryAdjustment = React.lazy(() => import('./pages/Warehouse/GoodsTransfer/InventoryAdjustment'));
const ProductOrder         = React.lazy(() => import('./pages/Warehouse/ProductOrder'));
const UserRoles       = React.lazy(() => import('./pages/Settings/UserRoles'));
const UserProfiles    = React.lazy(() => import('./pages/Settings/UserProfiles'));

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
        {/* Dashboard (index) */}
        <Route index element={<Lazy><Dashboard /></Lazy>} />

        {/* Product module */}
        <Route path="products"               element={<Lazy><ProductList /></Lazy>} />
        <Route path="products/recipes"       element={<Lazy><Recipe /></Lazy>} />
        <Route path="products/cost-price"    element={<Lazy><CostPrice /></Lazy>} />

        {/* Warehouse module */}
        <Route path="warehouse/main"              element={<Lazy><MainWarehouse /></Lazy>} />
        <Route path="warehouse/kitchen"           element={<Lazy><KitchenWarehouse /></Lazy>} />
        <Route path="warehouse/store"             element={<Lazy><StoreWarehouse /></Lazy>} />
        <Route path="warehouse/bakery"            element={<Lazy><BakeryWarehouse /></Lazy>} />
        <Route path="warehouse/goods-transfer"    element={<Lazy><GoodsTransfer /></Lazy>} />
        <Route path="warehouse/inventory-adjustment" element={<Lazy><InventoryAdjustment /></Lazy>} />
        <Route path="warehouse/product-orders"    element={<Lazy><ProductOrder /></Lazy>} />

        {/* Settings module */}
        <Route path="settings/user-roles"    element={<Lazy><UserRoles /></Lazy>} />
        <Route path="settings/user-profiles" element={<Lazy><UserProfiles /></Lazy>} />

        {/* Catch-all: redirect unknown paths to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
