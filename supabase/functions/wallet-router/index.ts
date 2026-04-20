// supabase/functions/wallet-router/index.ts
// Automatically selects optimal wallet for a transaction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { tenant_id, agent_id, amount, preferred_wallet } = await req.json()

    // Fetch all agent wallet accounts with balances
    const { data: wallets } = await supabase
      .from('agent_wallet_accounts')
      .select('*, wallet_schemes(code, name)')
      .eq('agent_id', agent_id)

    if (!wallets?.length) throw new Error('No wallet accounts found for agent')

    // Filter wallets that can cover the amount
    const eligible = wallets
      .filter((w: any) => w.balance >= amount)
      .sort((a: any, b: any) => b.balance - a.balance)

    // Prefer the requested wallet if eligible
    if (preferred_wallet) {
      const preferred = eligible.find((w: any) => w.wallet_schemes?.code === preferred_wallet)
      if (preferred) return new Response(JSON.stringify({ data: preferred, source: 'preferred' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Use highest-balance eligible wallet
    if (eligible.length > 0) {
      return new Response(JSON.stringify({ data: eligible[0], source: 'auto_routed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check routing rules for fallback
    const { data: rules } = await supabase
      .from('wallet_routing_rules')
      .select('*, fallback:wallet_schemes!fallback_wallet(code, name)')
      .eq('tenant_id', tenant_id)
      .order('priority', { ascending: true })

    const fallback = rules?.find((r: any) => r.fallback)
    if (fallback) {
      return new Response(JSON.stringify({ data: null, fallback: fallback.fallback, source: 'fallback' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('No eligible wallet found and no fallback configured')

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
