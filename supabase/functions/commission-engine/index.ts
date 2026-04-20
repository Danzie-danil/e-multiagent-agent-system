// supabase/functions/commission-engine/index.ts
// Distributes transaction fees: Platform 20% / Super Agent 30% / Agent 50%

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const COMMISSION_RATES = { platform: 0.20, super_agent: 0.30, agent: 0.50 }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { transaction_id } = await req.json()

    const { data: tx } = await supabase
      .from('transactions')
      .select('*, agents!from_agent_id(id, super_agent_id, tenant_id)')
      .eq('id', transaction_id)
      .single()

    if (!tx || tx.fee === 0) {
      return new Response(JSON.stringify({ data: null, message: 'No fee to distribute' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fee           = Number(tx.fee)
    const platformFee   = Math.floor(fee * COMMISSION_RATES.platform)
    const superAgentFee = Math.floor(fee * COMMISSION_RATES.super_agent)
    const agentFee      = fee - platformFee - superAgentFee  // remainder to agent

    const { data: commission, error } = await supabase
      .from('commissions')
      .insert({
        tenant_id:       tx.tenant_id,
        transaction_id:  tx.id,
        super_agent_id:  tx.agents?.super_agent_id || null,
        agent_id:        tx.from_agent_id,
        platform_fee:    platformFee,
        super_agent_fee: superAgentFee,
        agent_fee:       agentFee,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ data: commission }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
