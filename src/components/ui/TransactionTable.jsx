import { forwardRef } from 'react'
import { formatCurrencyTZS, formatRelativeTime, formatTxRef } from '../../utils/formatters'
import { WalletBadge, StatusBadge } from './Badge'
import { TruncatedText } from './TruncatedText'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RefreshCw, User } from 'lucide-react'
import './TransactionTable.css'

const TX_ICONS = {
  DEPOSIT:    { icon: ArrowDownLeft, color: 'var(--color-success)' },
  WITHDRAW:   { icon: ArrowUpRight,  color: 'var(--color-error)' },
  TRANSFER:   { icon: ArrowLeftRight,color: 'var(--color-info)' },
  CONVERSION: { icon: RefreshCw,     color: 'var(--color-warning)' },
}

export const TransactionTable = forwardRef(({ transactions = [], compact = false, emptyMessage = 'No transactions yet' }, ref) => {
  return (
    <div className="tx-table-container">
      {!transactions.length ? (
        <div className="empty-state" ref={ref}>
          <div className="empty-state__icon">
            <ArrowLeftRight size={32} aria-hidden="true" />
          </div>
          <p className="empty-state__title">{emptyMessage}</p>
          <p className="empty-state__message">Transactions will appear here once activity begins.</p>
        </div>
      ) : (
        <div className="tx-table-wrap" ref={ref}>
          <table className="tx-table" aria-label="Transactions">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Agent</th>
                <th>Wallet</th>
                <th className="tx-table__col-amount">Amount</th>
                <th className="tx-table__col-fee">Fee</th>
                <th>Status</th>
                <th className="tx-table__col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const TxIcon = TX_ICONS[tx.type]?.icon || ArrowLeftRight
                const iconColor = TX_ICONS[tx.type]?.color || 'var(--color-text-muted)'
                return (
                  <tr key={tx.id} className="tx-table__row">
                    <td>
                      <div className="tx-table__type-cell">
                        <span className="tx-table__type-icon" style={{ '--icon-color': iconColor }} aria-hidden="true">
                          <TxIcon size={15} />
                        </span>
                        <div>
                          <span className="tx-table__type-label">{tx.type}</span>
                          {!compact && (
                            <TruncatedText 
                              className="tx-table__ref" 
                              text={formatTxRef(tx.id)} 
                              title="Reference ID" 
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="agent-avatar-mini" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                          <User size={10} />
                        </div>
                        <TruncatedText 
                          text={tx.agent || 'System'} 
                          title="Agent Detail" 
                          className="tx-table__agent-name" 
                        />
                      </div>
                    </td>
                    <td><WalletBadge scheme={tx.wallet} /></td>
                    <td className="tx-table__col-amount">
                      <span className={`tx-table__amount tx-table__amount--${tx.type === 'DEPOSIT' ? 'in' : 'out'}`}>
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{formatCurrencyTZS(tx.amount)}
                      </span>
                    </td>
                    <td className="tx-table__col-fee tx-table__fee">
                      {tx.fee ? formatCurrencyTZS(tx.fee) : <span className="tx-table__no-fee">—</span>}
                    </td>
                    <td><StatusBadge status={tx.status} /></td>
                    <td className="tx-table__col-time tx-table__time">{formatRelativeTime(tx.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})

export default TransactionTable;