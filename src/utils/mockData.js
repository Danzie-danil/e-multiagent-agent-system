// utils/mockData.js — Demo data for e-WAKALA

export const mockTransactions = [
  { id: 'tx-001', type: 'WITHDRAW', amount: 250000, fee: 2500, status: 'COMPLETED', wallet: 'NMB', agent: 'Juma Hassan', phone: '0712345678', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'tx-002', type: 'DEPOSIT', amount: 500000, fee: 0, status: 'COMPLETED', wallet: 'EQUITY', agent: 'Fatuma Ally', phone: '0755123456', created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: 'tx-003', type: 'TRANSFER', amount: 150000, fee: 1500, status: 'PENDING', wallet: 'NBC', agent: 'Peter Mwangi', phone: '0768890123', created_at: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: 'tx-004', type: 'WITHDRAW', amount: 80000, fee: 800, status: 'COMPLETED', wallet: 'KCB', agent: 'Aisha Mbeki', phone: '0745678901', created_at: new Date(Date.now() - 32 * 60000).toISOString() },
  { id: 'tx-005', type: 'DEPOSIT', amount: 1200000, fee: 0, status: 'FAILED', wallet: 'MPESA', agent: 'David Ochieng', phone: '0789234567', created_at: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: 'tx-006', type: 'CONVERSION', amount: 300000, fee: 3000, status: 'COMPLETED', wallet: 'AIRTEL', agent: 'Grace Kimani', phone: '0712987654', created_at: new Date(Date.now() - 60 * 60000).toISOString() },
  { id: 'tx-007', type: 'WITHDRAW', amount: 75000, fee: 750, status: 'COMPLETED', wallet: 'NMB', agent: 'Hassan Said', phone: '0756234567', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'tx-008', type: 'DEPOSIT', amount: 900000, fee: 0, status: 'PROCESSING', wallet: 'EQUITY', agent: 'Mary Njoroge', phone: '0763456789', created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
]

export const mockAgents = [
  { id: 'ag-001', name: 'Juma Hassan', phone: '0712345678', status: 'ACTIVE', risk: 'LOW', balances: { MPESA: 480000, AIRTEL: 120000, CRDB: 0 }, txToday: 24, supervisor: 'Coastal Network SA' },
  { id: 'ag-002', name: 'Fatuma Ally', phone: '0755123456', status: 'ACTIVE', risk: 'LOW', balances: { MPESA: 280000, AIRTEL: 350000, CRDB: 90000 }, txToday: 18, supervisor: 'Coastal Network SA' },
  { id: 'ag-003', name: 'Peter Mwangi', phone: '0768890123', status: 'ACTIVE', risk: 'MEDIUM', balances: { MPESA: 50000, AIRTEL: 20000, CRDB: 400000 }, txToday: 31, supervisor: 'Central Agents Ltd' },
  { id: 'ag-004', name: 'Aisha Mbeki', phone: '0745678901', status: 'SUSPENDED', risk: 'HIGH', balances: { MPESA: 0, AIRTEL: 0, CRDB: 0 }, txToday: 0, supervisor: 'Central Agents Ltd' },
  { id: 'ag-005', name: 'David Ochieng', phone: '0789234567', status: 'ACTIVE', risk: 'LOW', balances: { MPESA: 820000, AIRTEL: 0, CRDB: 160000 }, txToday: 42, supervisor: 'Northern Float Hub' },
  { id: 'ag-006', name: 'Grace Kimani', phone: '0712987654', status: 'ACTIVE', risk: 'LOW', balances: { MPESA: 310000, AIRTEL: 275000, CRDB: 55000 }, txToday: 15, supervisor: 'Northern Float Hub' },
]

export const mockSupervisors = [
  { id: 'sa-001', name: 'Coastal Network SA', agentCount: 24, totalFloat: 8_400_000, wallets: ['MPESA', 'AIRTEL'], status: 'ACTIVE' },
  { id: 'sa-002', name: 'Central Agents Ltd', agentCount: 18, totalFloat: 5_200_000, wallets: ['CRDB', 'HALOPESA'], status: 'ACTIVE' },
  { id: 'sa-003', name: 'Northern Float Hub', agentCount: 31, totalFloat: 12_800_000, wallets: ['MPESA', 'AIRTEL', 'CRDB'], status: 'ACTIVE' },
]

export const mockFraudEvents = [
  { id: 'fr-001', agentId: 'ag-004', agentName: 'Aisha Mbeki', riskScore: 0.91, reason: 'Velocity spike: 45 transactions in 2 hours', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: 'fr-002', agentId: 'ag-003', agentName: 'Peter Mwangi', riskScore: 0.67, reason: 'Unusual amount pattern — 99,000 TZS recurring', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'fr-003', agentId: 'ag-005', agentName: 'David Ochieng', riskScore: 0.45, reason: 'Late-night transaction cluster (2:00–4:00 AM)', created_at: new Date(Date.now() - 8 * 3600000).toISOString() },
]

export const mockLiquidityData = [
  { wallet: 'NMB',      balance: 14_200_000, threshold: 5_000_000, status: 'HEALTHY' },
  { wallet: 'EQUITY',   balance: 8_900_000,  threshold: 4_000_000, status: 'HEALTHY' },
  { wallet: 'NBC',      balance: 1_200_000,  threshold: 3_000_000, status: 'CRITICAL' },
  { wallet: 'KCB',      balance: 3_150_000,  threshold: 5_000_000, status: 'LOW' },
  { wallet: 'MPESA',    balance: 5_400_000,  threshold: 5_000_000, status: 'HEALTHY' },
  { wallet: 'AIRTEL',   balance: 2_200_000,  threshold: 5_000_000, status: 'LOW' },
]

export const mockVolumeHistory = [
  { date: 'Mon', mpesa: 4200000, airtel: 2800000, crdb: 1800000 },
  { date: 'Tue', mpesa: 5100000, airtel: 3200000, crdb: 2100000 },
  { date: 'Wed', mpesa: 4800000, airtel: 2900000, crdb: 1950000 },
  { date: 'Thu', mpesa: 6200000, airtel: 3800000, crdb: 2400000 },
  { date: 'Fri', mpesa: 7400000, airtel: 4100000, crdb: 2900000 },
  { date: 'Sat', mpesa: 8100000, airtel: 4600000, crdb: 3200000 },
  { date: 'Sun', mpesa: 5900000, airtel: 3400000, crdb: 2600000 },
]

export const mockUsers = {
  platform_admin: {
    id: 'u-platform',
    name: 'Admin Safi',
    email: 'admin@ewakala.co.tz',
    role: 'PLATFORM_ADMIN',
    tenant_id: null,
    avatar: 'AS',
  },
  tenant_admin: {
    id: 'u-tenant',
    name: 'Neema Olawale',
    email: 'neema@nmb.co.tz',
    role: 'TENANT_ADMIN',
    tenant_id: 't1',
    tenant_name: 'NMB Bank',
    avatar: 'NO',
  },
  SUPERVISOR: {
    id: 'u-super',
    name: 'Baraka Mushi',
    email: 'baraka@coastal.co.tz',
    role: 'SUPERVISOR',
    tenant_id: 't1',
    SUPERVISOR_id: 'sa-001',
    SUPERVISOR_name: 'Coastal Network SA',
    avatar: 'BM',
  },
  agent: {
    id: 'u-agent',
    name: 'Juma Hassan',
    email: 'juma@agent.co.tz',
    role: 'AGENT',
    tenant_id: 't1',
    agent_id: 'ag-001',
    phone: '0712345678',
    avatar: 'JH',
  },
}
