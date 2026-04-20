// supabase/functions/sms-gateway/index.ts
// Parses SMS commands and queues transactions
// Format: WITHDRAW 10000 255712345678 PIN123

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { from, text } = await req.json()
    const parts = text.trim().toUpperCase().split(/\s+/)

    // Format: WITHDRAW <amount> <customer_phone> <PIN>
    //     or: DEPOSIT  <amount> <customer_phone> <PIN>
    //     or: BAL (check balance)
    const command = parts[0]

    if (command === 'BAL') {
      const { data: agent } = await supabase.from('agents').select('id').eq('phone', from).single()
      if (!agent) return smsResponse('Agent not found.')

      const { data: wallets } = await supabase
        .from('agent_wallet_accounts')
        .select('balance, wallet_schemes(code)')
        .eq('agent_id', agent.id)

      const lines = (wallets || []).map((w: any) => `${w.wallet_schemes?.code}:${w.balance}`).join(' | ')
      return smsResponse(`e-WAKALA Balances: ${lines}`)
    }

    if (command === 'WITHDRAW' || command === 'DEPOSIT') {
      if (parts.length < 4) {
        return smsResponse(`Invalid format. Use: ${command} <amount> <phone> <PIN>`)
      }

      const [, amountStr, custPhone] = parts
      const amount = Number(amountStr)

      if (isNaN(amount) || amount <= 0) return smsResponse('Invalid amount.')

      const { data: agent } = await supabase.from('agents').select('id, tenant_id, status').eq('phone', from).single()
      if (!agent || agent.status !== 'ACTIVE') return smsResponse('Agent not found or suspended.')

      const idempotencyKey = `sms-${from}-${Date.now()}`

      await supabase.from('event_queue').insert({
        type: 'TRANSACTION',
        tenant_id: agent.tenant_id,
        payload: {
          type: command,
          from_agent_id: agent.id,
          amount,
          customer_phone: custPhone,
          idempotency_key: idempotencyKey,
          channel: 'SMS',
        },
      })

      return smsResponse(`e-WAKALA: ${command} TZS ${amount} queued. Ref: ${idempotencyKey.slice(-8).toUpperCase()}. Confirmation SMS to follow.`)
    }

    return smsResponse('Unknown command. Send BAL, WITHDRAW, or DEPOSIT.')

  } catch (err: any) {
    return smsResponse(`Error: ${err.message}`)
  }
})

function smsResponse(message: string) {
  return new Response(JSON.stringify({ message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
