import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import RequireAuth from './components/Auth/RequireAuth';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────

const Login = React.lazy(() => import('./pages/Auth/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProductList = React.lazy(() => import('./pages/Product/ProductList'));
const ProductForm = React.lazy(() => import('./pages/Product/ProductList/ProductForm'));
const ProductHistory = React.lazy(() => import('./pages/Product/ProductList/ProductHistory'));
const ItemGroupList = React.lazy(() => import('./pages/Product/ItemGroup'));
const Recipe = React.lazy(() => import('./pages/Product/Recipe'));
const RecipeForm = React.lazy(() => import('./pages/Product/Recipe/RecipeForm'));
const RecipeDetail = React.lazy(() => import('./pages/Product/Recipe/RecipeDetail'));
const CostPrice = React.lazy(() => import('./pages/Product/CostPrice'));
const ProductionPlanning = React.lazy(() => import('./pages/ProductionGroups'));
const ProductionRequestList = React.lazy(() => import('./pages/ProductionRequests'));
const ProductionRequestForm = React.lazy(() => import('./pages/ProductionRequests/ProductionRequestForm'));
const ProductPriceForm = React.lazy(() => import('./pages/Product/CostPrice/ProductPriceForm'));
const IngredientPriceForm = React.lazy(() => import('./pages/Product/CostPrice/IngredientPriceForm'));
const MainWarehouse = React.lazy(() => import('./pages/Warehouse/Main'));
const PurchaseForm = React.lazy(() => import('./pages/Warehouse/components/PurchaseForm'));
const TransferForm = React.lazy(() => import('./pages/Warehouse/components/TransferForm'));
const AdjustForm = React.lazy(() => import('./pages/Warehouse/components/AdjustForm'));
const KitchenReturnForm = React.lazy(() => import('./pages/Warehouse/Kitchen/KitchenReturnForm'));
const StoreRequestForm = React.lazy(() => import('./pages/Warehouse/Store/StoreRequestForm'));
const KitchenWarehouse = React.lazy(() => import('./pages/Warehouse/Kitchen'));
const StoreWarehouse = React.lazy(() => import('./pages/Warehouse/Store'));
const OrderForm = React.lazy(() => import('./pages/Warehouse/ProductOrder/OrderForm'));
const OrderDetailPage = React.lazy(() => import('./pages/Warehouse/ProductOrder/OrderDetailPage'));
const UrgentProductionForm = React.lazy(() => import('./pages/Warehouse/ProductOrder/UrgentProductionForm'));
const BakeryWarehouse = React.lazy(() => import('./pages/Warehouse/Bakery'));
const GoodsTransfer = React.lazy(() => import('./pages/Warehouse/GoodsTransfer'));
const SlipDetailPage = React.lazy(() => import('./pages/Warehouse/GoodsTransfer/SlipDetailPage'));
const InventoryAdjustment = React.lazy(() => import('./pages/Warehouse/GoodsTransfer/InventoryAdjustment'));
const InventoryAdjustmentForm = React.lazy(() => import('./pages/Warehouse/GoodsTransfer/InventoryAdjustmentForm'));
const TransferSlipPrintPage = React.lazy(() => import('./pages/Warehouse/GoodsTransfer/TransferSlipPrintPage'));
const StockDetailPage = React.lazy(() => import('./pages/Warehouse/StockDetailPage'));
const ProductOrder = React.lazy(() => import('./pages/Warehouse/ProductOrder'));
const UserRoles = React.lazy(() => import('./pages/Settings/UserRoles'));
const UserProfiles = React.lazy(() => import('./pages/Settings/UserProfiles'));

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
        <Route path="products" element={<Lazy><ProductList /></Lazy>} />
        <Route path="products/groups" element={<Lazy><ItemGroupList /></Lazy>} />
        <Route path="products/create" element={<Lazy><ProductForm /></Lazy>} />
        <Route path="products/edit/:id" element={<Lazy><ProductForm /></Lazy>} />
        <Route path="products/:id/history" element={<Lazy><ProductHistory /></Lazy>} />
        <Route path="products/recipes" element={<Lazy><Recipe /></Lazy>} />
        <Route path="products/recipes/form" element={<Lazy><RecipeForm /></Lazy>} />
        <Route path="products/recipes/form/:id" element={<Lazy><RecipeForm /></Lazy>} />
        <Route path="products/recipes/:id" element={<Lazy><RecipeDetail /></Lazy>} />
        <Route path="products/cost-price" element={<Lazy><CostPrice /></Lazy>} />

        {/* Production module */}
        <Route path="production" element={<Lazy><ProductionPlanning /></Lazy>} />
        <Route path="production/plans" element={<Lazy><ProductionPlanning /></Lazy>} />
        <Route path="production/requests" element={<Lazy><ProductionRequestList /></Lazy>} />
        <Route path="production/requests/create" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="production/requests/edit/:id" element={<Lazy><ProductionRequestForm /></Lazy>} />
        <Route path="products/cost-price/product-price" element={<Lazy><ProductPriceForm /></Lazy>} />
        <Route path="products/cost-price/ingredient-price" element={<Lazy><IngredientPriceForm /></Lazy>} />

        {/* Warehouse Routes */}
        <Route path="warehouse/main" element={<Lazy><MainWarehouse /></Lazy>} />
        <Route path="warehouse/main/purchase" element={<Lazy><PurchaseForm /></Lazy>} />
        <Route path="warehouse/transfer/:warehouseCode" element={<Lazy><TransferForm /></Lazy>} />
        <Route path="warehouse/adjust/:warehouseCode" element={<Lazy><AdjustForm /></Lazy>} />
        <Route path="warehouse/kitchen" element={<Lazy><KitchenWarehouse /></Lazy>} />
        <Route path="warehouse/kitchen/return" element={<Lazy><KitchenReturnForm /></Lazy>} />
        <Route path="warehouse/store" element={<Lazy><StoreWarehouse /></Lazy>} />
        <Route path="warehouse/store/request" element={<Lazy><StoreRequestForm /></Lazy>} />
        <Route path="warehouse/stock/:warehouseCode/:itemCode" element={<Lazy><StockDetailPage /></Lazy>} />
        <Route path="warehouse/bakery" element={<Lazy><BakeryWarehouse /></Lazy>} />
        <Route path="warehouse/goods-transfer" element={<Lazy><GoodsTransfer /></Lazy>} />
        <Route path="warehouse/goods-transfer/:id" element={<Lazy><SlipDetailPage /></Lazy>} />
        <Route path="warehouse/goods-transfer/print/:id" element={<Lazy><TransferSlipPrintPage /></Lazy>} />
        <Route path="warehouse/inventory-adjustment" element={<Lazy><InventoryAdjustment /></Lazy>} />
        <Route path="warehouse/inventory-adjustment/create" element={<Lazy><InventoryAdjustmentForm /></Lazy>} />
        <Route path="warehouse/product-orders" element={<Lazy><ProductOrder /></Lazy>} />
        <Route path="warehouse/product-orders/create" element={<Lazy><OrderForm /></Lazy>} />
        <Route path="warehouse/product-orders/edit/:id" element={<Lazy><OrderForm /></Lazy>} />
        <Route path="warehouse/product-orders/urgent/create" element={<Lazy><UrgentProductionForm /></Lazy>} />
        <Route path="warehouse/product-orders/:id" element={<Lazy><OrderDetailPage /></Lazy>} />

        {/* Settings module */}
        <Route path="settings/user-roles" element={<Lazy><UserRoles /></Lazy>} />
        <Route path="settings/user-profiles" element={<Lazy><UserProfiles /></Lazy>} />

        {/* Catch-all: redirect unknown paths to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
