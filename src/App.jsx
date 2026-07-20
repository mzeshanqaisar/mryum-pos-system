import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import Toast from './components/common/Toast'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Billing from './pages/Billing'
import InventoryDashboard from './pages/InventoryDashboard'
import Reports from './pages/Reports'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Customers from './pages/Customers'
import CreditAccounts from './pages/CreditAccounts'
import CreditAccountDetail from './pages/CreditAccountDetail'
import Settings from './pages/Settings'
import Alerts from './pages/Alerts'
import AddProduct from './pages/AddProduct'
import ProductDetail from './pages/ProductDetail'
import Restock from './pages/Restock'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { startAutoSync } from './lib/sync'
import './lib/registerSyncTables'

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return children

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-body-md text-on-surface-variant">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return children
}

function RequireManager({ children }) {
  const { isManager, loading } = useAuth()
  if (loading) return null
  if (!isManager) return <Navigate to="/inventory" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/billing" replace />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/inventory" element={<InventoryDashboard />} />
        <Route
          path="/products/add"
          element={
            <RequireManager>
              <AddProduct />
            </RequireManager>
          }
        />
        <Route
          path="/products/restock"
          element={
            <RequireManager>
              <Restock />
            </RequireManager>
          }
        />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route
          path="/products/:id/edit"
          element={
            <RequireManager>
              <AddProduct />
            </RequireManager>
          }
        />
        <Route path="/reports" element={<Reports />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/credit-accounts" element={<CreditAccounts />} />
        <Route path="/credit-accounts/:customerId" element={<CreditAccountDetail />} />
        <Route
          path="/suppliers"
          element={
            <RequireManager>
              <Suppliers />
            </RequireManager>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <RequireManager>
              <SupplierDetail />
            </RequireManager>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireManager>
              <Settings />
            </RequireManager>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireManager>
              <Alerts />
            </RequireManager>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/billing" replace />} />
    </Routes>
  )
}

function App() {
  useEffect(() => startAutoSync(), [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <CartProvider>
              <AppRoutes />
              <Toast />
            </CartProvider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
