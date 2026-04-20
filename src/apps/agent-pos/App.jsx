// src/apps/agent-pos/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import AgentPOSShell from '../../pages/agent-pos/AgentPOSShell'
import AgentHome     from '../../pages/agent-pos/AgentHome'
import AgentWithdraw from '../../pages/agent-pos/AgentWithdraw'
import AgentDeposit  from '../../pages/agent-pos/AgentDeposit'
import AgentHistory  from '../../pages/agent-pos/AgentHistory'
import AgentWallets  from '../../pages/agent-pos/AgentWallets'
import AgentPayment  from '../../pages/agent-pos/AgentPayment'
import AgentReports  from '../../pages/agent-pos/AgentReports'
import UserProfile   from '../../pages/shared/UserProfile'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AgentPOSShell />}>
        <Route index           element={<AgentHome />} />
        <Route path="withdraw" element={<AgentWithdraw />} />
        <Route path="deposit"  element={<AgentDeposit />} />
        <Route path="history"  element={<AgentHistory />} />
        <Route path="wallets"  element={<AgentWallets />} />
        <Route path="pay"      element={<AgentPayment />} />
        <Route path="reports"  element={<AgentReports />} />
        <Route path="profile"  element={<UserProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
