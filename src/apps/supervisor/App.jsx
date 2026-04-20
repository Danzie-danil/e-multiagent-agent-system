// src/apps/supervisor/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import SupervisorShell       from '../../pages/supervisor/SupervisorShell'
import SupervisorDashboard   from '../../pages/supervisor/SupervisorDashboard'
import SupervisorAgents      from '../../pages/supervisor/SupervisorAgents'
import SupervisorFloat       from '../../pages/supervisor/SupervisorFloat'
import SupervisorCommissions from '../../pages/supervisor/SupervisorCommissions'
import SupervisorLiquidity   from '../../pages/supervisor/SupervisorLiquidity'
import SupervisorWallets     from '../../pages/supervisor/SupervisorWallets'
import SupervisorBroadcaster from '../../pages/supervisor/SupervisorBroadcaster'
import UserProfile           from '../../pages/shared/UserProfile'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SupervisorShell />}>
        <Route index                element={<SupervisorDashboard />} />
        <Route path="agents"        element={<SupervisorAgents />} />
        <Route path="float"         element={<SupervisorFloat />} />
        <Route path="commissions"   element={<SupervisorCommissions />} />
        <Route path="liquidity"     element={<SupervisorLiquidity />} />
        <Route path="wallets"       element={<SupervisorWallets />} />
        <Route path="broadcaster"   element={<SupervisorBroadcaster />} />
        <Route path="profile"       element={<UserProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
