// supabase/functions/fraud-engine/index.ts
// Standalone fraud scoring — called by transaction-processor or independently

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { agent_id, amount, type, tenant_id } = await req.json()

    let score = 0
    const reasons: string[] = []

    // ── Rule 1: Velocity — >20 tx/hour ───────────────────
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count: hourCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('from_agent_id', agent_id)
      .gte('created_at', oneHourAgo)

    if ((hourCount || 0) > 20) { score += 0.35; reasons.push(`Velocity spike: ${hourCount} tx/hr`) }
    if ((hourCount || 0) > 40) { score += 0.25; reasons.push('Extreme velocity') }

    // ── Rule 2: Unusual amount pattern ────────────────────
    if (amount % 99000 < 500) {
      score += 0.20
      reasons.push(`Structuring pattern: TZS ${amount}`)
    }

    // ── Rule 3: Night-time (midnight–4am EAT) ─────────────
    const hourEAT = (new Date().getUTCHours() + 3) % 24
    if (hourEAT >= 0 && hourEAT < 4) {
      score += 0.15
      reasons.push('Late-night transaction cluster')
    }

    // ── Rule 4: Large amount ──────────────────────────────
    if (amount > 5000000) { score += 0.20; reasons.push(`Large amount: TZS ${amount}`) }

    // ── Rule 5: Rapid sequential same-amount transactions ─
    const { data: recentSame } = await supabase
      .from('transactions')
      .select('amount')
      .eq('from_agent_id', agent_id)
      .eq('amount', amount)
      .gte('created_at', new Date(Date.now() - 900000).toISOString())  // 15 min

    if ((recentSame?.length || 0) >= 3) {
      score += 0.25
      reasons.push(`Repeated same amount ${recentSame?.length}x in 15min`)
    }

    const finalScore = Math.min(1, score)

    // Write fraud event if threshold crossed
    if (finalScore >= 0.45) {
      await supabase.from('fraud_events').insert({
        tenant_id,
        agent_id,
        risk_score: finalScore,
        reason: reasons.join('; '),
      })
    }

    const risk = finalScore >= 0.80 ? 'HIGH' : finalScore >= 0.45 ? 'MEDIUM' : 'LOW'

    return new Response(JSON.stringify({
      data: { score: finalScore, risk, reasons, blocked: finalScore >= 0.90 },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
