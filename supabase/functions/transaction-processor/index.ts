// supabase/functions/transaction-processor/index.ts
// ============================================================
// e-WAKALA — Transaction Processor Edge Function
// ALL financial logic lives here. NEVER in React.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransactionRequest {
  wallet_scheme_id: string
  from_agent_id:    string
  to_agent_id?:     string
  type:             'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'CONVERSION'
  amount:           number
  idempotency_key:  string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // ── Extract JWT claims ──────────────────────────────────
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const claims = user.user_metadata
    const { tenant_id, role, agent_id } = claims
    if (role !== 'AGENT') throw new Error('Only agents can process transactions')

    const body: TransactionRequest = await req.json()
    const { wallet_scheme_id, from_agent_id, type, amount, idempotency_key } = body

    if (!idempotency_key) throw new Error('idempotency_key is required')
    if (amount <= 0)       throw new Error('Amount must be positive')

    // ── 1. Idempotency guard ──────────────────────────────
    const { data: existing } = await supabase
      .from('transactions')
      .select('*')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ data: existing, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Validate wallet is enabled for tenant ──────────
    const { data: walletConfig, error: walletErr } = await supabase
      .from('tenant_wallet_schemes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('wallet_scheme_id', wallet_scheme_id)
      .single()

    if (walletErr || !walletConfig?.is_enabled) {
      throw new Error('Wallet scheme is not enabled for this tenant')
    }

    // ── 3. Check agent daily limit ────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data: todayTxs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('from_agent_id', from_agent_id)
      .eq('status', 'COMPLETED')
      .gte('created_at', today.toISOString())

    const todayTotal = (todayTxs || []).reduce((s: number, t: any) => s + t.amount, 0)
    if (todayTotal + amount > walletConfig.daily_limit) {
      throw new Error(`Daily limit exceeded. Limit: ${walletConfig.daily_limit}`)
    }

    // ── 4. Check sufficient float (for WITHDRAW) ──────────
    if (type === 'WITHDRAW') {
      const { data: wallet } = await supabase
        .from('agent_wallet_accounts')
        .select('balance')
        .eq('agent_id', from_agent_id)
        .eq('wallet_scheme_id', wallet_scheme_id)
        .single()

      if (!wallet || wallet.balance < amount) {
        throw new Error('Insufficient float balance')
      }
    }

    // ── 5. Run fraud engine check ─────────────────────────
    const fraudScore = await runFraudCheck(supabase, { agent_id: from_agent_id, amount, type, tenant_id })
    if (fraudScore > 0.9) {
      await supabase.from('fraud_events').insert({
        tenant_id,
        agent_id: from_agent_id,
        risk_score: fraudScore,
        reason: 'Auto-blocked: risk score > 0.9',
      })
      throw new Error('Transaction blocked by fraud engine')
    }

    // ── 6. Calculate fee ──────────────────────────────────
    const fee = type === 'DEPOSIT' ? 0 : Math.round(amount * Number(walletConfig.transaction_fee))

    // ── 7. Create transaction record ──────────────────────
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        tenant_id,
        wallet_scheme_id,
        from_agent_id,
        to_agent_id: body.to_agent_id || null,
        type,
        amount,
        fee,
        status: 'PROCESSING',
        idempotency_key,
      })
      .select()
      .single()

    if (txErr) throw txErr

    // ── 8. Write double-entry ledger ──────────────────────
    const ledgerEntries = buildLedgerEntries(tx, tenant_id, wallet_scheme_id)
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert(ledgerEntries)
    if (ledgerErr) {
      // Rollback: mark transaction failed
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('id', tx.id)
      throw new Error('Ledger write failed — transaction reversed')
    }

    // ── 9. Validate double-entry balance ──────────────────
    const { data: balanced } = await supabase.rpc('validate_ledger_balance', { p_transaction_id: tx.id })
    if (!balanced) {
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('id', tx.id)
      throw new Error('Ledger imbalance detected — transaction reversed')
    }

    // ── 10. Distribute commissions ────────────────────────
    if (fee > 0) {
      await supabase.from('commissions').insert({
        tenant_id,
        transaction_id: tx.id,
        agent_id: from_agent_id,
        platform_fee:    Math.round(fee * 0.20),
        super_agent_fee: Math.round(fee * 0.30),
        agent_fee:       Math.round(fee * 0.50),
      })
    }

    // ── 11. Mark COMPLETED ────────────────────────────────
    const { data: completed } = await supabase
      .from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('id', tx.id)
      .select()
      .single()

    // ── 12. Log audit event ───────────────────────────────
    await supabase.from('audit_logs').insert({
      user_id:   user.id,
      tenant_id,
      action:    'TRANSACTION_COMPLETED',
      entity:    'transactions',
      entity_id: tx.id,
      metadata:  { type, amount, fee, wallet_scheme_id },
    })

    return new Response(JSON.stringify({ data: completed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Double-entry ledger entry builder ─────────────────────────
function buildLedgerEntries(tx: any, tenant_id: string, wallet_scheme_id: string) {
  const base = { transaction_id: tx.id, tenant_id, wallet_scheme_id }

  if (tx.type === 'WITHDRAW') {
    return [
      { ...base, account_id: tx.from_agent_id,      debit: tx.amount, credit: 0 },
      { ...base, account_id: 'PLATFORM_FLOAT_POOL',  debit: 0, credit: tx.amount },
    ]
  }
  if (tx.type === 'DEPOSIT') {
    return [
      { ...base, account_id: 'PLATFORM_FLOAT_POOL',  debit: tx.amount, credit: 0 },
      { ...base, account_id: tx.from_agent_id,       debit: 0, credit: tx.amount },
    ]
  }
  if (tx.type === 'TRANSFER') {
    return [
      { ...base, account_id: tx.from_agent_id, debit: tx.amount, credit: 0 },
      { ...base, account_id: tx.to_agent_id,   debit: 0, credit: tx.amount },
    ]
  }
  return []
}

// ── Basic fraud heuristics ────────────────────────────────────
async function runFraudCheck(supabase: any, { agent_id, amount, type, tenant_id }: any): Promise<number> {
  let score = 0

  // Velocity check: >20 transactions in last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('from_agent_id', agent_id)
    .gte('created_at', oneHourAgo)

  if ((count || 0) > 20) score += 0.4
  if ((count || 0) > 40) score += 0.3

  // Unusual amount pattern: round numbers just under limits
  if (amount % 99000 < 1000) score += 0.2

  // Night-time transactions (midnight–5am EAT)
  const hour = new Date().getUTCHours() + 3  // EAT = UTC+3
  if (hour >= 0 && hour < 5) score += 0.15

  // Large single transaction
  if (amount > 5000000) score += 0.25

  return Math.min(1, score)
}
