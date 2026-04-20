// packages/core-types/index.js
// Shared constants and type definitions for e-WAKALA

export const ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  TENANT_ADMIN:   'TENANT_ADMIN',
  SUPERVISOR:    'SUPERVISOR',
  AGENT:          'AGENT',
}

export const WALLET_SCHEMES = {
  MPESA:    { code: 'MPESA',    name: 'M-Pesa',    color: '#00A651' },
  AIRTEL:   { code: 'AIRTEL',   name: 'Airtel Money', color: '#E40000' },
  CRDB:     { code: 'CRDB',     name: 'CRDB Bank', color: '#003580' },
  HALOPESA: { code: 'HALOPESA', name: 'HaloPesa',  color: '#FF6B00' },
  MIXX:     { code: 'MIXX',     name: 'Mixx by Yas', color: '#7B2D8B' },
}

export const TX_TYPES = {
  DEPOSIT:    'DEPOSIT',
  WITHDRAW:   'WITHDRAW',
  TRANSFER:   'TRANSFER',
  CONVERSION: 'CONVERSION',
}

export const TX_STATUS = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  REVERSED:   'REVERSED',
}

export const KYC_LEVELS = {
  0: 'Unverified',
  1: 'Basic',
  2: 'Verified',
  3: 'Business',
}

export const RISK_LEVELS = {
  LOW:    { label: 'Low Risk',    color: '#0D7A5F', bg: '#E6F5F0' },
  MEDIUM: { label: 'Medium Risk', color: '#D97706', bg: '#FEF3C7' },
  HIGH:   { label: 'High Risk',   color: '#DC2626', bg: '#FEE2E2' },
}

export const COMMISSION_RATES = {
  platform:    0.20,
  SUPERVISOR: 0.30,
  agent:       0.50,
}
