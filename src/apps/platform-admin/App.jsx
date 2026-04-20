// src/apps/platform-admin/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import PlatformAdminShell  from '../../pages/platform-admin/PlatformAdminShell'
import PlatformDashboard   from '../../pages/platform-admin/PlatformDashboard'
import PlatformTenants     from '../../pages/platform-admin/PlatformTenants'
import PlatformTransactions from '../../pages/platform-admin/PlatformTransactions'
import PlatformFraud       from '../../pages/platform-admin/PlatformFraud'
import PlatformAudit       from '../../pages/platform-admin/PlatformAudit'
import PlatformSettlement  from '../../pages/platform-admin/PlatformSettlement'
import PlatformHealth      from '../../pages/platform-admin/PlatformHealth'
import PlatformBroadcasts  from '../../pages/platform-admin/PlatformBroadcasts'
import UserProfile         from '../../pages/shared/UserProfile'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PlatformAdminShell />}>
        <Route index            element={<PlatformDashboard />} />
        <Route path="agents"    element={<PlatformTenants />} />
        <Route path="transactions" element={<PlatformTransactions />} />
        <Route path="fraud"     element={<PlatformFraud />} />
        <Route path="audit"     element={<PlatformAudit />} />
        <Route path="settlement" element={<PlatformSettlement />} />
        <Route path="health"    element={<PlatformHealth />} />
        <Route path="broadcasts" element={<PlatformBroadcasts />} />
        <Route path="profile"    element={<UserProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
