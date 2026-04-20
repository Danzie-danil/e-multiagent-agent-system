// supabase/functions/settlement-engine/index.ts
// Runs daily to calculate net positions per wallet scheme per tenant

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1)

    // Get all active tenants
    const { data: tenants } = await supabase.from('tenants').select('id').eq('status', 'ACTIVE')

    const results = []

    for (const tenant of (tenants || [])) {
      // Get all completed transactions for this tenant today
      const { data: txs } = await supabase
        .from('transactions')
        .select('wallet_scheme_id, type, amount, fee')
        .eq('tenant_id', tenant.id)
        .eq('status', 'COMPLETED')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      // Group by wallet scheme
      const walletMap: Record<string, { total_in: number; total_out: number }> = {}
      for (const tx of (txs || [])) {
        if (!walletMap[tx.wallet_scheme_id]) walletMap[tx.wallet_scheme_id] = { total_in: 0, total_out: 0 }
        if (tx.type === 'DEPOSIT')  walletMap[tx.wallet_scheme_id].total_in  += tx.amount
        if (tx.type === 'WITHDRAW') walletMap[tx.wallet_scheme_id].total_out += tx.amount
      }

      // Write settlement records
      for (const [wallet_scheme_id, { total_in, total_out }] of Object.entries(walletMap)) {
        const { data: settlement } = await supabase
          .from('settlements')
          .upsert({
            tenant_id: tenant.id,
            wallet_scheme_id,
            start_time:   startOfDay.toISOString(),
            end_time:     endOfDay.toISOString(),
            total_in,
            total_out,
            net_position: total_in - total_out,
            status:       'COMPLETED',
          })
          .select()
          .single()

        results.push(settlement)
      }
    }

    return new Response(JSON.stringify({ data: results, count: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
