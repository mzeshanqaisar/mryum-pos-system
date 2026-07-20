import { useMemo } from 'react'
import { useSuppliers } from './useSuppliers'
import { useProducts } from './useProducts'
import { buildSupplierSummaries, buildAlertFeed } from '../lib/supplierAlerts'

export function useSupplierAlerts() {
  const { suppliers, loading: suppliersLoading } = useSuppliers()
  const { products, loading: productsLoading } = useProducts()

  const summaries = useMemo(() => buildSupplierSummaries(suppliers, products), [suppliers, products])
  const alerts = useMemo(() => buildAlertFeed(summaries), [summaries])

  return { summaries, alerts, loading: suppliersLoading || productsLoading }
}
