import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { db } from '../lib/db'

// Staff role management is a rare, security-sensitive admin action — promoting
// someone to manager grants real privileges, so it's kept online-only for an
// immediate, authoritative server confirmation rather than an optimistic local
// apply (there's no safe way to "queue" a privilege change: a client that
// locally believed it was promoted would see manager-only screens before the
// server ever agreed, which is exactly the kind of client/server trust gap
// that shouldn't exist for permissions). Viewing the staff list, though, is
// just informational — cached here so Settings still shows who's on staff
// with no connection, same read-cache pattern as before.
export function useStaffList() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = await db.staff_profiles.toArray()
    rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setStaff(rows)
  }, [])

  const fetchStaff = useCallback(async () => {
    await loadFromLocal()
    setLoading(false)
    if (navigator.onLine) {
      const { data } = await supabase.from('staff_profiles').select('*').order('created_at', { ascending: true })
      if (data) {
        await db.staff_profiles.bulkPut(data.map((s) => ({ ...s, sync_status: 'synced' })))
        await loadFromLocal()
      }
    }
  }, [loadFromLocal])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  return { staff, loading, refresh: fetchStaff }
}
