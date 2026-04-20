// pages/agent-pos/AgentTransaction.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, CreditCard, Store, ShieldCheck, Lock, ShieldAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { validateForm, validators } from '../../utils/validators'
import { formatCurrencyTZS, formatPhoneTZ, generateIdempotencyKey } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import './AgentTransaction.css'

const WALLETS = [] // Now fetched from DB exclusively

const STEPS = ['wallet', 'phone', 'amount', 'pin', 'success']

const WALLET_META = {
  MPESA:    { name: 'M-Pesa',       color: '#00A651', bg: 'rgba(0,166,81,0.12)' },
  AIRTEL:   { name: 'Airtel Money', color: '#E40000', bg: 'rgba(228,0,0,0.10)' },
  CRDB:     { name: 'CRDB Bank',    color: '#003580', bg: 'rgba(0,53,128,0.12)' },
  HALOPESA: { name: 'HaloPesa',     color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  MIXX:     { name: 'Mixx by Yas',  color: '#7B2FBE', bg: 'rgba(123,47,190,0.12)' },
  NMB:      { name: 'NMB Bank',     color: '#00897B', bg: 'rgba(0,137,123,0.12)' },
  EQUITY:   { name: 'Equity Bank',  color: '#D32F2F', bg: 'rgba(211,47,47,0.12)' },
  NBC:      { name: 'NBC Bank',     color: '#1565C0', bg: 'rgba(21,101,192,0.12)' },
  KCB:      { name: 'KCB Bank',     color: '#2E7D32', bg: 'rgba(46,125,50,0.12)' },
}

export default function AgentTransaction({ type }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error } = useToast()
  const isWithdraw = type === 'WITHDRAW'

  const [wallets, setWallets]   = useState([])
  const [loadingWallets, setLoadingWallets] = useState(true)
  const [hasPin, setHasPin]       = useState(true)
  const [confirmPin, setConfirmPin] = useState('')
  const [agentId, setAgentId]       = useState(null)

  // Fetch provisioned wallets for this agent and check security status
  useEffect(() => {
    async function loadData() {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('agent_id')
          .eq('id', user.id)
          .maybeSingle()

        if (userData?.agent_id) {
          setAgentId(userData.agent_id)

          // 1. Fetch Wallets
          const { data: wData } = await supabase
            .from('agent_wallet_accounts')
            .select('*, wallet_schemes(code, name)')
            .eq('agent_id', userData.agent_id)
            .order('balance', { ascending: false })

          setWallets((wData || []).map(w => ({
            id: w.id,
            key: w.wallet_schemes.code,
            name: WALLET_META[w.wallet_schemes.code]?.name || w.wallet_schemes.name,
            color: WALLET_META[w.wallet_schemes.code]?.color || '#888',
            bg: WALLET_META[w.wallet_schemes.code]?.bg || 'rgba(128,128,128,0.1)',
            balance: w.balance,
            cash_balance: w.cash_balance,
            till_number: w.till_number || ''
          })))

          // 2. Check PIN existence
          const { data: agentRecord } = await supabase
            .from('agents')
            .select('pin_hash')
            .eq('id', userData.agent_id)
            .single()
          
          setHasPin(!!agentRecord?.pin_hash)
        }
      } catch (err) {
        console.error("Initialization error:", err)
      } finally {
        setLoadingWallets(false)
      }
    }
    if (user?.id) loadData()
  }, [user])

  const [step, setStep] = useState(0)
  const [wallet, setWallet] = useState(null)
  const [phone, setPhone] = useState('')        // customer phone (withdraw/deposit) OR merchant number (payment)
  const [merchantRef, setMerchantRef] = useState('') // payment reference/bill number
  const [amount, setAmount] = useState('')
  const [pin, setPin]  = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [txRef, setTxRef] = useState('')

  const isPayment  = type === 'PAYMENT'
  const selectedWallet = wallets.find(w => w.key === wallet)
  const fee = amount ? (isPayment ? 0 : Math.round(Number(amount) * 0.01)) : 0

  const goBack = () => {
    if (step === 0) navigate('/agent')
    else setStep(s => s - 1)
  }

  const validateStep = () => {
    if (step === 1) {
      if (isPayment) {
        const { errors: e, isValid } = validateForm({ phone }, { phone: [validators.required] })
        setErrors(e); return isValid
      }
      const { errors: e, isValid } = validateForm({ phone }, { phone: [validators.required, validators.phone] })
      setErrors(e); return isValid
    }
    if (step === 2) {
      const { errors: e, isValid } = validateForm({ amount }, { amount: [validators.required, (v) => validators.amount(v, 1000, selectedWallet?.balance || 10000000)] })
      setErrors(e); return isValid
    }
    if (step === 3) {
      const { errors: e, isValid } = validateForm({ pin }, { pin: [validators.required, validators.pin] })
      if (!isValid) { setErrors(e); return false }
      
      if (!hasPin) {
        if (pin !== confirmPin) { setErrors({ pin: 'PINs do not match' }); return false }
      }
      return true
    }
    return true
  }

  const handleNext = async () => {
    if (!validateStep()) return
    if (step === 3) {
      setLoading(true)
      try {
        const { data: userData } = await supabase.from('users').select('agent_id').eq('id', user.id).single()
        if (!userData?.agent_id) throw new Error("Agent ID missing")

        if (!hasPin) {
          // 0. Initialize Transaction PIN for the first time
          const { error: setPinErr } = await supabase.rpc('set_agent_pin', {
            p_agent_id: userData.agent_id,
            p_pin: pin
          })
          if (setPinErr) throw setPinErr
          success(' PIN Created', 'Your security PIN has been set successfully.')
        } else {
          // 0. Verify Transaction PIN before proceeding
          const { data: isPinValid, error: pinErr } = await supabase.rpc('verify_agent_pin', {
            p_agent_id: userData.agent_id,
            p_pin: pin
          })

          if (pinErr) throw pinErr
          if (!isPinValid) {
            setErrors({ pin: 'Invalid secure PIN' })
            setLoading(false)
            return
          }
        }

        const txIdempotency = generateIdempotencyKey()
        const txAmount = Number(amount)
        const txFee = fee

        // 0.5 Pre-flight Balance Check (prevent constraint errors)
        const totalImpact = txAmount + (type === 'DEPOSIT' ? txFee : 0)
        if (type === 'WITHDRAW') {
          if ((selectedWallet?.cash_balance || 0) < txAmount) {
            error('Insufficient Cash', 'You have insufficient Cash Balance to fulfill this withdrawal.')
            setLoading(false)
            return
          }
        } else {
          if ((selectedWallet?.balance || 0) < totalImpact) {
            error('Insufficient Float', 'You have insufficient Float Balance for this transaction.')
            setLoading(false)
            return
          }
        }

        // 1. Record the transaction in Supabase
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .insert({
            from_agent_id: userData.agent_id,
            wallet_scheme_id: (await supabase.from('wallet_schemes').select('id').eq('code', wallet).single()).data.id,
            type: type,
            amount: txAmount,
            fee: txFee,
            status: 'COMPLETED',
            idempotency_key: txIdempotency,
            metadata: { 
              phone: phone, 
              merchant_ref: merchantRef || undefined,
              processed_at: new Date().toISOString()
            }
          })
          .select()
          .single()

        if (txError) throw txError

        // e-Wakala Dual-Balance Physics:
        // DEPOSIT (Cash In): Agent takes cash (+Cash), gives digital (-Float)
        // WITHDRAW (Cash Out): Agent gives cash (-Cash), takes digital (+Float)
        // PAYMENT: Agent settled bill digital (-Float), takes cash (+Cash)
        
        let floatChange = 0
        let cashChange = 0
        
        if (type === 'WITHDRAW') {
          floatChange = txAmount
          cashChange = -txAmount
        } else if (type === 'DEPOSIT') {
          floatChange = -(txAmount + txFee)
          cashChange = txAmount
        } else if (type === 'PAYMENT') {
          floatChange = -txAmount
          cashChange = txAmount
        }

        const { error: balError } = await supabase.rpc('adjust_wallet_balances', {
          p_agent_id: userData.agent_id,
          p_wallet_code: wallet,
          p_float_change: floatChange,
          p_cash_change: cashChange
        })

        if (balError) throw balError

        setTxRef(txIdempotency.slice(0, 8).toUpperCase())

        // 3. Record Commission Entry
        const v_agent_comm = Math.round(txAmount * 0.005)
        const v_super_comm = Math.round(txAmount * 0.002)
        
        const { data: profile } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        
        await supabase.from('commissions').insert({
          transaction_id: tx.id,
          agent_id: userData.agent_id,
          supervisor_id: profile?.supervisor_id,
          agent_fee: v_agent_comm,
          super_agent_fee: v_super_comm,
          platform_fee: 0,
          type: 'TRANSACTION',
          wallet_scheme_id: tx.wallet_scheme_id
        })

        setStep(4)
      } catch (err) {
        error('Transaction Failed', err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
      return
    }
    setStep(s => s + 1)
    setErrors({})
  }

  const handleDone = () => {
    success('Transaction Complete', `${type} of ${formatCurrencyTZS(Number(amount))} processed successfully.`)
    navigate('/agent')
  }

  const stepLabels = isPayment
    ? ['Select Wallet', 'Merchant Details', 'Enter Amount', 'Confirm PIN', 'Receipt']
    : ['Select Wallet', 'Customer Phone', 'Enter Amount', 'Confirm PIN', 'Receipt']

  return (
    <div className="agent-tx animate-fadeIn">
      {/* Header */}
      <div className="agent-tx__header">
        {step < 4 && (
          <button className="agent-tx__back" onClick={goBack} aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="agent-tx__title-block">
          <div className={`agent-tx__type-icon agent-tx__type-icon--${isWithdraw ? 'out' : isPayment ? 'pay' : 'in'}`}>
            {isWithdraw ? <ArrowUpRight size={18}/> : isPayment ? <CreditCard size={18}/> : <ArrowDownLeft size={18}/>}
          </div>
          <h1 className="agent-tx__title">{isWithdraw ? 'Withdrawal' : isPayment ? 'Payment' : 'Deposit'}</h1>
        </div>
        <span className="agent-tx__step-label">{step < 4 ? `Step ${step + 1} of 4` : 'Done'}</span>
      </div>

      {/* Progress bar */}
      {step < 4 && (
        <div className="agent-tx__progress">
          {[0,1,2,3].map(i => (
            <div key={i} className={`agent-tx__progress-seg ${i <= step ? 'agent-tx__progress-seg--done' : ''}`} />
          ))}
        </div>
      )}

      <div className="agent-tx__body">
        {/* Step 0: Wallet Selection */}
        {step === 0 && (
          <div className="agent-tx__step animate-slideUp">
            <p className="agent-tx__step-hint">Choose the wallet scheme for this transaction</p>
            <style>{`
              .wallet-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: var(--space-4); }
              @media (max-width: 640px) { .wallet-grid { grid-template-columns: repeat(4, 1fr); } }
              .wallet-grid-card {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: 6px; padding: 12px 6px; border-radius: var(--radius-xl);
                border: 2px solid var(--color-border); background: var(--color-surface);
                cursor: pointer; transition: all 0.15s ease; text-align: center;
                position: relative; overflow: hidden;
              }
              .wallet-grid-card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--card-color); background: var(--card-bg); }
              .wallet-grid-card--active { border-color: var(--card-color) !important; background: var(--card-bg) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--card-color) 20%, transparent); }
              .wallet-grid-card--empty { opacity: 0.4; cursor: not-allowed; }
              .wallet-grid-card__dot { width: 28px; height: 28px; border-radius: 50%; background: var(--card-bg); border: 2px solid var(--card-color); display: flex; align-items: center; justify-content: center; }
              .wallet-grid-card__dot-inner { width: 12px; height: 12px; border-radius: 50%; background: var(--card-color); }
              .wallet-grid-card__name { font-size: 10px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
              .wallet-grid-card__balance { font-size: 9px; font-family: var(--font-mono); color: var(--color-text-muted); }
              .wallet-grid-card__nofloat { position: absolute; top: 4px; right: 4px; font-size: 8px; background: var(--color-error-bg); color: var(--color-error); padding: 1px 4px; border-radius: 4px; font-weight: 700; }
            `}</style>
            {loadingWallets ? (
              <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>Loading your wallets...</div>
            ) : wallets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                <WalletIcon size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No wallets provisioned</div>
                <div style={{ fontSize: 12 }}>Ask your supervisor to configure wallets for your account, or set them up from My Wallets.</div>
              </div>
            ) : (
              <div className="wallet-grid">
                {wallets.map(w => (
                  <button
                    key={w.key}
                    className={`wallet-grid-card ${wallet === w.key ? 'wallet-grid-card--active' : ''} ${isWithdraw && w.balance === 0 ? 'wallet-grid-card--empty' : ''}`}
                    onClick={() => {
                      setWallet(w.key)
                      // For payments: auto-fill merchant field with the wallet's saved till number
                      if (isPayment && w.till_number) setPhone(w.till_number)
                      setTimeout(() => setStep(1), 150)
                    }}
                    disabled={isWithdraw && w.balance === 0}
                    style={{ '--card-color': w.color, '--card-bg': w.bg }}
                  >
                    {isWithdraw && w.balance === 0 && <span className="wallet-grid-card__nofloat">Empty</span>}
                    <div className="wallet-grid-card__dot">
                      <div className="wallet-grid-card__dot-inner" />
                    </div>
                    <span className="wallet-grid-card__name">{w.name}</span>
                    <span className="wallet-grid-card__balance">{formatCurrencyTZS(w.balance)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Phone Number */}
        {step === 1 && (
          <div className="agent-tx__step animate-slideUp">
            {isPayment ? (
              <>
                <p className="agent-tx__step-hint">Enter the merchant or business till number</p>
                <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <Input
                    id="merchant-number-input"
                    name="merchant-number"
                    label="Merchant / Till Number"
                    placeholder="e.g. 888200 or 0712 345 678"
                    type="text"
                    required
                    readOnly={!!selectedWallet?.till_number}
                    disabled={!!selectedWallet?.till_number}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    error={errors.phone}
                    autoComplete="off"
                    data-lpignore="true"
                    size="lg"
                    prefix={<Store size={16} />}
                    hint={selectedWallet?.till_number ? "Locked by supervisor" : "Enter business till number"}
                  />
                  <Input
                    id="payment-ref-input"
                    name="payment-ref"
                    label="Reference / Bill Number (optional)"
                    placeholder="e.g. INVOICE-2024-001"
                    type="text"
                    value={merchantRef}
                    onChange={e => setMerchantRef(e.target.value)}
                    size="lg"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="agent-tx__step-hint">Enter the customer's phone number</p>
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <Input
                    id="customer-phone-agent-input"
                    name="customer-phone-agent"
                    label="Customer Phone Number"
                    placeholder="0712 345 678"
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    error={errors.phone}
                    autoComplete="tel"
                    size="lg"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 2 && (
          <div className="agent-tx__step animate-slideUp">
            <p className="agent-tx__step-hint">
              {isPayment ? 'How much is the payment to this merchant?' : `How much does the customer want to ${isWithdraw ? 'withdraw' : 'deposit'}?`}
            </p>
            <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                id="tx-amount-agent-input"
                name="tx-amount-agent"
                label={`Amount (TZS) — Balance: ${formatCurrencyTZS(selectedWallet?.balance || 0)}`}
                placeholder="0"
                type="number"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                error={errors.amount}
                prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
                size="lg"
              />
              {amount && Number(amount) > 0 && (
                <div className="agent-tx__fee-summary">
                  <div className="agent-tx__fee-row"><span>Amount</span><span>{formatCurrencyTZS(Number(amount))}</span></div>
                  <div className="agent-tx__fee-row"><span>Fee {isPayment ? '(Merchants pay no fee)' : '(1%)'}</span><span>{formatCurrencyTZS(fee)}</span></div>
                  <div className="agent-tx__fee-row agent-tx__fee-row--total"><span>Total</span><span>{formatCurrencyTZS(Number(amount) + (isWithdraw ? fee : 0))}</span></div>
                </div>
              )}
              {/* Quick amount buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                {[50000, 100000, 200000, 500000, 1000000, 2000000].map(v => (
                  <button key={v} type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setAmount(String(v))}>
                    {formatCurrencyTZS(v).replace('TZS ', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: PIN */}
        {step === 3 && (
          <div className="agent-tx__step animate-slideUp">
            <div className="agent-tx__confirm-summary">
              <div className="agent-tx__confirm-row"><span>Type</span><strong>{type}</strong></div>
              <div className="agent-tx__confirm-row"><span>Wallet</span><strong>{wallet}</strong></div>
              {isPayment
                ? <>
                    <div className="agent-tx__confirm-row"><span>Merchant</span><strong className="mono">{phone}</strong></div>
                    {merchantRef && <div className="agent-tx__confirm-row"><span>Reference</span><strong className="mono">{merchantRef}</strong></div>}
                  </>
                : <div className="agent-tx__confirm-row"><span>Phone</span><strong>{formatPhoneTZ(phone)}</strong></div>
              }
              <div className="agent-tx__confirm-row"><span>Amount</span><strong>{formatCurrencyTZS(Number(amount))}</strong></div>
              <div className="agent-tx__confirm-row"><span>Fee</span><strong>{formatCurrencyTZS(fee)}</strong></div>
            </div>

            {!hasPin && (
              <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#F5A623', marginBottom: 'var(--space-2)' }}>
                  <ShieldAlert size={16} />
                  <strong style={{ fontSize: 13 }}>Security Setup Required</strong>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  You haven't set a transaction PIN yet. Please create a 4-digit PIN to authorize this and future transactions.
                </p>
              </div>
            )}

            <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                id="agent-pin-input"
                name="agent-pin-code"
                label={hasPin ? "Confirm with your Agent PIN" : "Create 4-Digit Security PIN"}
                placeholder="• • • •"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={4}
                required
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                error={errors.pin}
                data-lpignore="true"
                size="lg"
                style={{ WebkitTextSecurity: 'disc', textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
              />

              {!hasPin && (
                <Input
                  id="agent-pin-confirm-input"
                  name="agent-pin-confirm-code"
                  label="Confirm New PIN"
                  placeholder="• • • •"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  data-lpignore="true"
                  size="lg"
                  style={{ WebkitTextSecurity: 'disc', textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                />
              )}
            </div>
          </div>
        )}

        {/* Step 4: Success Receipt */}
        {step === 4 && (
          <div className="agent-tx__success animate-scaleIn">
            <div className="agent-tx__success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="agent-tx__success-title">Transaction Complete!</h2>
            <p className="agent-tx__success-amount">{formatCurrencyTZS(Number(amount))}</p>
            <div className="agent-tx__receipt">
              <div className="agent-tx__receipt-row"><span>Reference</span><strong className="mono">#{txRef}</strong></div>
              <div className="agent-tx__receipt-row"><span>Type</span><strong>{type}</strong></div>
              <div className="agent-tx__receipt-row"><span>Wallet</span><strong>{wallet}</strong></div>
              {isPayment
                ? <>
                    <div className="agent-tx__receipt-row"><span>Merchant</span><strong className="mono">{phone}</strong></div>
                    {merchantRef && <div className="agent-tx__receipt-row"><span>Reference</span><strong className="mono">{merchantRef}</strong></div>}
                  </>
                : <div className="agent-tx__receipt-row"><span>Customer</span><strong className="mono">{formatPhoneTZ(phone)}</strong></div>
              }
              <div className="agent-tx__receipt-row"><span>Amount</span><strong>{formatCurrencyTZS(Number(amount))}</strong></div>
              <div className="agent-tx__receipt-row"><span>Fee</span><strong>{formatCurrencyTZS(fee)}</strong></div>
              <div className="agent-tx__receipt-row"><span>Status</span><strong style={{ color: 'var(--color-success)' }}>COMPLETED ✓</strong></div>
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Float Impact</span>
                  <span style={{ color: (type === 'WITHDRAW' ? 'var(--color-success)' : 'var(--color-error)') }}>
                    {type === 'WITHDRAW' ? '+' : '-'}{formatCurrencyTZS(type === 'WITHDRAW' ? Number(amount) : (Number(amount) + (type === 'DEPOSIT' ? fee : 0)))}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span>Cash Impact</span>
                  <span style={{ color: (type === 'WITHDRAW' ? 'var(--color-error)' : 'var(--color-success)') }}>
                    {type === 'WITHDRAW' ? '-' : '+'}{formatCurrencyTZS(Number(amount))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="agent-tx__footer">
        {step < 4 ? (
          <Button
            id={`next-tx-step-${step}.button.agent-tx`}
            label={step === 3 ? (loading ? 'Processing…' : 'Confirm & Process') : step === 0 ? 'Select Wallet' : 'Continue'}
            fullWidth
            size="xl"
            loading={loading}
            disabled={step === 0 && !wallet}
            onClick={handleNext}
            variant={isWithdraw ? 'danger' : isPayment ? 'primary' : 'success'}
          />
        ) : (
          <Button
            id="done-tx.button.agent-receipt"
            label="Back to Home"
            fullWidth
            size="xl"
            onClick={handleDone}
          />
        )}
      </div>
    </div>
  )
}
