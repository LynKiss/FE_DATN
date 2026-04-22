import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/app.layout';
import AdminLayout from '../layouts/admin.layout';
import ClientLayout from '../layouts/client.layout';
import NotFound from '../components/shared/NotFound';
import ProtectedAdminRoute from '../components/shared/ProtectedAdminRoute';
import { ROUTE_PATHS } from './route-names';

// Admin pages
const DashboardPage = lazy(() => import('../features/admin/dashboard/page'));
const ProductsPage = lazy(() => import('../features/admin/products/page'));
const ProductCreatePage = lazy(() => import('../features/admin/products-create/page'));
const ProductImportPage = lazy(() => import('../features/admin/products-import/page'));
const ProductInventoryTransactionsPage = lazy(() => import('../features/admin/products-inventory/page'));
const ProductDiscountsPage = lazy(() => import('../features/admin/products-discounts/page'));
const ProductInventoryDamagePage = lazy(() => import('../features/admin/products-damage/page'));
const ProductInventoryLowStockPage = lazy(() => import('../features/admin/products-lowstock/page'));
const CategoriesPage = lazy(() => import('../features/admin/categories/page'));
const SubcategoriesPage = lazy(() => import('../features/admin/subcategories/page'));
const OrdersPage = lazy(() => import('../features/admin/orders/page'));
const CustomersPage = lazy(() => import('../features/admin/customers/page'));
const ReportsPage = lazy(() => import('../features/admin/reports/page'));
const InterfacePage = lazy(() => import('../features/admin/interface/page'));
const SecurityPage = lazy(() => import('../features/admin/security/page'));
const PermissionsPage = lazy(() => import('../features/admin/permissions/page'));
const SettingsPage = lazy(() => import('../features/admin/settings/page'));
const OriginsPage = lazy(() => import('../features/admin/origins/page'));
const TagsPage = lazy(() => import('../features/admin/tags/page'));
const NewsPage = lazy(() => import('../features/admin/news/page'));
const ReviewsPage = lazy(() => import('../features/admin/reviews/page'));
const PaymentsPage = lazy(() => import('../features/admin/payments/page'));
const NewsletterPage = lazy(() => import('../features/admin/newsletter/page'));
const NewsCommentsPage = lazy(() => import('../features/admin/news-comments/page'));

// Client pages
const ClientHomePage = lazy(() => import('../features/client/home/page'));
const ClientProductsPage = lazy(() => import('../features/client/products/page'));
const ClientProductDetailPage = lazy(() => import('../features/client/product-detail/page'));
const ClientCartPage = lazy(() => import('../features/client/cart/page'));
const ClientCheckoutPage = lazy(() => import('../features/client/checkout/page'));
const ClientPaymentPage = lazy(() => import('../features/client/payment/page'));
const ClientNewsListPage = lazy(() => import('../features/client/news/page'));
const ClientNewsDetailPage = lazy(() => import('../features/client/news-detail/page'));
const ClientLoginPage = lazy(() => import('../features/client/login/page'));
const ClientRegisterPage = lazy(() => import('../features/client/register/page'));
const ClientAccountPage = lazy(() => import('../features/client/account/page'));
const ClientOrdersPage = lazy(() => import('../features/client/orders/page'));
const ClientOrderDetailPage = lazy(() => import('../features/client/order-detail/page'));
const ClientWishlistPage = lazy(() => import('../features/client/wishlist/page'));
const ClientAddressesPage = lazy(() => import('../features/client/addresses/page'));

const LoginPage = lazy(() => import('../pages/Login'));

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading...</div>}>{element}</Suspense>
);

const clientSuspense = (element: ReactNode) => (
  <Suspense fallback={
    <div className="flex min-h-[40vh] items-center justify-center" style={{ background: '#f2f0eb' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
    </div>
  }>
    {element}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: ROUTE_PATHS.root,
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Navigate to={ROUTE_PATHS.admin} replace /> },
      {
        element: <ProtectedAdminRoute />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: withSuspense(<DashboardPage />) },
              { path: 'products', element: withSuspense(<ProductsPage />) },
              { path: 'products/new', element: withSuspense(<ProductCreatePage />) },
              { path: 'products/import', element: withSuspense(<ProductImportPage />) },
              { path: 'products/inventory-transactions', element: withSuspense(<ProductInventoryTransactionsPage />) },
              { path: 'products/inventory-damage', element: withSuspense(<ProductInventoryDamagePage />) },
              { path: 'products/inventory-lowstock', element: withSuspense(<ProductInventoryLowStockPage />) },
              { path: 'products/discounts', element: withSuspense(<ProductDiscountsPage />) },
              { path: 'categories', element: withSuspense(<CategoriesPage />) },
              { path: 'subcategories', element: withSuspense(<SubcategoriesPage />) },
              { path: 'origins', element: withSuspense(<OriginsPage />) },
              { path: 'tags', element: withSuspense(<TagsPage />) },
              { path: 'orders', element: withSuspense(<OrdersPage />) },
              { path: 'customers', element: withSuspense(<CustomersPage />) },
              { path: 'news', element: withSuspense(<NewsPage />) },
              { path: 'news-comments', element: withSuspense(<NewsCommentsPage />) },
              { path: 'reviews', element: withSuspense(<ReviewsPage />) },
              { path: 'payments', element: withSuspense(<PaymentsPage />) },
              { path: 'newsletter', element: withSuspense(<NewsletterPage />) },
              { path: 'reports', element: withSuspense(<ReportsPage />) },
              { path: 'permissions', element: withSuspense(<PermissionsPage />) },
              { path: 'interface', element: withSuspense(<InterfacePage />) },
              { path: 'security', element: withSuspense(<SecurityPage />) },
              { path: 'settings', element: withSuspense(<SettingsPage />) },
            ],
          },
        ],
      },
      {
        path: 'client',
        element: <ClientLayout />,
        children: [
          { index: true, element: clientSuspense(<ClientHomePage />) },
          { path: 'products', element: clientSuspense(<ClientProductsPage />) },
          { path: 'products/:id', element: clientSuspense(<ClientProductDetailPage />) },
          { path: 'cart', element: clientSuspense(<ClientCartPage />) },
          { path: 'checkout', element: clientSuspense(<ClientCheckoutPage />) },
          { path: 'payment', element: clientSuspense(<ClientPaymentPage />) },
          { path: 'news', element: clientSuspense(<ClientNewsListPage />) },
          { path: 'news/:slug', element: clientSuspense(<ClientNewsDetailPage />) },
          { path: 'login', element: clientSuspense(<ClientLoginPage />) },
          { path: 'register', element: clientSuspense(<ClientRegisterPage />) },
          { path: 'account', element: clientSuspense(<ClientAccountPage />) },
          { path: 'orders', element: clientSuspense(<ClientOrdersPage />) },
          { path: 'orders/:id', element: clientSuspense(<ClientOrderDetailPage />) },
          { path: 'wishlist', element: clientSuspense(<ClientWishlistPage />) },
          { path: 'account/addresses', element: clientSuspense(<ClientAddressesPage />) },
        ],
      },
      { path: 'login', element: withSuspense(<LoginPage />) },
    ],
  },
]);
