import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { MobileNavProvider } from '../../context/MobileNavContext'

export default function Layout() {
  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        {/* Caps content width on very large monitors so pages don't stretch into
            sparse, hard-to-scan rows — everything below this still scales freely. */}
        <div className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-[1920px] flex flex-col">
            <Outlet />
          </div>
        </div>
      </div>
    </MobileNavProvider>
  )
}
