// supabase/functions/ussd-handler/index.ts
// Handles USSD sessions from Africa's Talking gateway
// USSD code: *150*88#

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

interface USSDRequest {
  sessionId:   string
  serviceCode: string
  phoneNumber: string
  text:        string
  networkCode: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body: USSDRequest = await req.json()
  const { sessionId, phoneNumber, text } = body
  const input = text.split('*').filter(Boolean)

  let response = ''

  // ── Root menu ─────────────────────────────────────────────
  if (text === '') {
    response = `CON e-WAKALA Agent Menu
1. Withdraw
2. Deposit
3. Check Balance
4. Mini Statement
5. Float Transfer`
    return ussdResponse(response)
  }

  const menu = input[0]

  // ── Withdraw flow ─────────────────────────────────────────
  if (menu === '1') {
    if (input.length === 1) return ussdResponse('CON Select Wallet:\n1. M-Pesa\n2. Airtel\n3. CRDB')
    if (input.length === 2) return ussdResponse('CON Enter customer phone number:')
    if (input.length === 3) return ussdResponse('CON Enter amount (TZS):')
    if (input.length === 4) return ussdResponse('CON Enter your Agent PIN:')
    if (input.length === 5) {
      const [, walletIdx, custPhone, amount, pin] = input
      const wallets = ['', 'MPESA', 'AIRTEL', 'CRDB']
      const wallet = wallets[Number(walletIdx)] || 'MPESA'

      // Look up agent by phone number
      const { data: agent } = await supabase
        .from('agents').select('id, tenant_id, status').eq('phone', phoneNumber).single()

      if (!agent || agent.status !== 'ACTIVE') {
        return ussdResponse('END Agent not found or inactive. Contact support.')
      }

      // Check balance
      const { data: walletAcc } = await supabase
        .from('agent_wallet_accounts')
        .select('balance')
        .eq('agent_id', agent.id)
        .eq('wallet_scheme_id', wallet)
        .single()

      if (!walletAcc || walletAcc.balance < Number(amount)) {
        return ussdResponse(`END Insufficient float. Balance: TZS ${walletAcc?.balance || 0}`)
      }

      // Queue transaction
      const idempotencyKey = `ussd-${sessionId}-${Date.now()}`
      await supabase.from('event_queue').insert({
        type: 'TRANSACTION',
        tenant_id: agent.tenant_id,
        payload: {
          wallet_scheme_id: wallet,
          from_agent_id: agent.id,
          type: 'WITHDRAW',
          amount: Number(amount),
          customer_phone: custPhone,
          idempotency_key: idempotencyKey,
          channel: 'USSD',
        },
      })

      return ussdResponse(`END Withdrawal processing.\nRef: ${idempotencyKey.slice(-8).toUpperCase()}\nAmount: TZS ${amount}\nCustomer: ${custPhone}\nSMS confirmation will follow.`)
    }
  }

  // ── Balance check ─────────────────────────────────────────
  if (menu === '3') {
    const { data: agent } = await supabase
      .from('agents').select('id').eq('phone', phoneNumber).single()

    if (agent) {
      const { data: wallets } = await supabase
        .from('agent_wallet_accounts')
        .select('balance, wallet_schemes(code)')
        .eq('agent_id', agent.id)

      const lines = (wallets || []).map((w: any) => `${w.wallet_schemes?.code}: TZS ${w.balance}`).join('\n')
      return ussdResponse(`END Your Balances:\n${lines || 'No wallets found'}`)
    }

    return ussdResponse('END Agent not found.')
  }

  return ussdResponse('END Invalid option. Try again with *150*88#')
})

function ussdResponse(text: string) {
  return new Response(text, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  })
}
