// supabase/functions/reconciliation-job/index.ts
// Verifies ledger balance integrity across all transactions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    // Check all COMPLETED transactions for ledger balance
    const { data: txs } = await supabase
      .from('transactions')
      .select('id')
      .eq('status', 'COMPLETED')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())

    let imbalanced = 0
    const discrepancies: string[] = []

    for (const tx of (txs || [])) {
      const { data: entries } = await supabase
        .from('ledger_entries')
        .select('debit, credit')
        .eq('transaction_id', tx.id)

      const totalDebit  = (entries || []).reduce((s: number, e: any) => s + Number(e.debit), 0)
      const totalCredit = (entries || []).reduce((s: number, e: any) => s + Number(e.credit), 0)

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        imbalanced++
        discrepancies.push(tx.id)
        // Alert: ledger imbalance detected
        await supabase.from('audit_logs').insert({
          action: 'LEDGER_IMBALANCE_DETECTED',
          entity: 'ledger_entries',
          entity_id: tx.id,
          metadata: { total_debit: totalDebit, total_credit: totalCredit },
        })
      }
    }

    return new Response(JSON.stringify({
      checked: txs?.length || 0,
      imbalanced,
      discrepancies,
      status: imbalanced === 0 ? 'BALANCED' : 'DISCREPANCY_FOUND',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
