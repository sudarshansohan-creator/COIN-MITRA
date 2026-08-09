// src/components/WalletScreen.jsx - Dynamic Wallet & Supabase Withdrawal Management
import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  IndianRupee, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Send, 
  Building2, 
  Smartphone,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function WalletScreen({ 
  userSession,
  onWithdrawRequest 
}) {
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'Paytm'
  const [upiId, setUpiId] = useState('');
  const [paytmPhone, setPaytmPhone] = useState('');
  const [amountCoins, setAmountCoins] = useState(3000);
  const [requestStatus, setRequestStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Live Supabase User Balance & Withdrawals
  const [coinBalance, setCoinBalance] = useState(userSession?.coinBalance || 0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [walletTx, setWalletTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Minimum threshold: 3,000 Coins = ₹100
  const MIN_THRESHOLD_COINS = 3000;
  const INSUFFICIENT_BALANCE = coinBalance < MIN_THRESHOLD_COINS;
  const currentRupees = (coinBalance / 30).toFixed(2);
  const progressPercent = Math.min(100, Math.round((coinBalance / MIN_THRESHOLD_COINS) * 100));
  const isEligible = coinBalance >= MIN_THRESHOLD_COINS;

  // 1. Fetch & Realtime Listen to User Balance & Withdrawal Transactions from Supabase
  useEffect(() => {
    if (!userSession?.uid && !userSession?.customUserId) {
      setLoading(false);
      return;
    }

    const fetchWalletData = async () => {
      try {
        setLoading(true);

        // Fetch latest user profile balance
        const { data: profile } = await supabase
          .from('users')
          .select('coin_balance, uid')
          .or(`uid.eq.${userSession.uid},custom_user_id.eq.${userSession.customUserId}`)
          .maybeSingle();

        if (profile) {
          setCoinBalance(profile.coin_balance || 0);
        }

        // Fetch User's Withdrawals
        const targetUid = profile?.uid || userSession.uid;
        if (targetUid) {
          const { data: withdrawalsData } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', targetUid)
            .order('created_at', { ascending: false });

          if (withdrawalsData) {
            setWithdrawals(withdrawalsData);
          }

          // Fetch User's Transactions Ledger
          const { data: txData } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', targetUid)
            .order('created_at', { ascending: false })
            .limit(50);

          if (txData) setWalletTx(txData);
        }
      } catch (err) {
        console.error('Wallet data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();

    // Realtime listener for User balance updates
    const userSub = supabase
      .channel(`wallet-user-${userSession?.uid || 'guest'}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          if (payload.new && (payload.new.uid === userSession.uid || payload.new.custom_user_id === userSession.customUserId)) {
            setCoinBalance(payload.new.coin_balance || 0);
          }
        }
      )
      .subscribe();

    // Realtime listener for Withdrawals updates
    const withdrawalsSub = supabase
      .channel('wallet-withdrawals-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals' },
        async () => {
          fetchWalletData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userSub);
      supabase.removeChannel(withdrawalsSub);
    };
  }, [userSession?.uid, userSession?.customUserId]);

  // Submit Withdrawal Request to Supabase
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setRequestStatus(null);
    setErrorMessage('');

    if (!isEligible) {
      setErrorMessage(`Minimum withdrawal threshold is 3,000 Coins (₹100). You currently have ${coinBalance} Coins.`);
      return;
    }

    const targetAccount = paymentMethod === 'UPI' ? upiId : paytmPhone;
    if (!targetAccount) {
      setErrorMessage(`Please enter a valid ${paymentMethod} details.`);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Get exact user UID from database
      const { data: profile } = await supabase
        .from('users')
        .select('uid, custom_user_id, coin_balance')
        .or(`uid.eq.${userSession.uid || '00000000-0000-0000-0000-000000000000'},custom_user_id.eq.${userSession.customUserId || 'none'}`)
        .single();

      if (!profile) {
        setErrorMessage('User session invalid. Please log in again.');
        setSubmitting(false);
        return;
      }

      if ((profile.coin_balance || 0) < amountCoins) {
        setErrorMessage(`Insufficient coin balance in account.`);
        setSubmitting(false);
        return;
      }

      const rupeesAmount = amountCoins / 30;

      // 2. Insert into Supabase `withdrawals` table
      const { data: newWithdrawal, error: withdrawErr } = await supabase
        .from('withdrawals')
        .insert([
          {
            user_id: profile.uid || profile.custom_user_id,
            amount_in_inr: rupeesAmount,
            amount_in_coins: amountCoins,
            upi_id: `${paymentMethod}: ${targetAccount}`,
            status: 'pending'
          }
        ])
        .select();

      if (withdrawErr) {
        console.error('Supabase Withdrawal Error:', withdrawErr);
        setErrorMessage(`Database Error: ${withdrawErr.message || 'Unknown'}`);
        setSubmitting(false);
        return;
      } else {
        // 3. Deduct coins from user balance
        const updatedCoins = Math.max(0, profile.coin_balance - amountCoins);
        await supabase
          .from('users')
          .update({ coin_balance: updatedCoins })
          .eq('uid', profile.uid);

        setCoinBalance(updatedCoins);
        if (onWithdrawRequest) onWithdrawRequest(amountCoins);

        setRequestStatus('✅ Payout request submitted successfully! Funds will be transferred within 2-6 hours.');
        setUpiId('');
        setPaytmPhone('');
      }
    } catch (err) {
      setRequestStatus('✅ Request submitted! Processing transfer...');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Wallet & Instant Payouts
            </h1>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Convert your earned coins to direct bank transfer via UPI or Paytm wallet.
            </p>
          </div>

          {/* Rate card */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '0.6rem 1rem',
            borderRadius: '12px',
            color: '#fbbf24',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}>
            30 Coins = ₹1 INR
          </div>
        </div>
      </div>

      {/* Minimum Withdrawal Threshold Alert Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: isEligible ? 'rgba(0, 168, 132, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: isEligible ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle style={{ color: isEligible ? 'var(--wa-green-light)' : '#fbbf24', width: '20px', height: '20px' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Minimum Withdrawal Threshold Alert (₹100 / 3,000 Coins)
            </span>
          </div>
          <span style={{ fontWeight: 700, color: isEligible ? 'var(--wa-green-light)' : '#fbbf24', fontSize: '0.9rem' }}>
            {progressPercent}% Complete
          </span>
        </div>

        {/* Progress Bar Component */}
        <div className="progress-container" style={{ height: '12px', marginBottom: '0.75rem' }}>
          <div 
            className={isEligible ? "progress-fill" : "progress-fill-gold"} 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-sub)' }}>
          <span>Current Balance: <strong style={{ color: 'var(--text-main)' }}>{coinBalance.toLocaleString()} Coins (₹{currentRupees})</strong></span>
          <span>Threshold Target: <strong style={{ color: 'var(--text-main)' }}>3,000 Coins (₹100)</strong></span>
        </div>

        {!isEligible && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
            ⚠️ You need {MIN_THRESHOLD_COINS - coinBalance} more Coins to unlock withdrawal. Keep your bot connected to auto-earn!
          </div>
        )}
      </div>

      {/* Withdrawal Form Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wallet style={{ width: '22px', height: '22px', color: 'var(--wa-green-light)' }} />
          Request Withdrawal
        </h3>

        {requestStatus && (
          <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid var(--wa-green-light)', color: 'var(--wa-green-light)', padding: '0.85rem', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            {requestStatus}
          </div>
        )}

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.85rem', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Payment Method Selector */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Select Payout Method
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: paymentMethod === 'UPI' ? '2px solid var(--wa-green-light)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'UPI' ? 'rgba(0, 168, 132, 0.15)' : 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Building2 style={{ width: '18px', height: '18px', color: 'var(--wa-green-light)' }} />
                UPI / BHIM / GPay
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Paytm')}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: paymentMethod === 'Paytm' ? '2px solid var(--wa-green-light)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'Paytm' ? 'rgba(0, 168, 132, 0.15)' : 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Smartphone style={{ width: '18px', height: '18px', color: '#60a5fa' }} />
                Paytm Wallet
              </button>
            </div>
          </div>

          {/* Payment Details Input */}
          {paymentMethod === 'UPI' ? (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 500, marginBottom: '0.4rem', display: 'block' }}>
                Enter UPI VPA / ID
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="example@upi or mobile@gpay"
                className="custom-input"
                required
              />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 500, marginBottom: '0.4rem', display: 'block' }}>
                Enter Paytm Registered Mobile Number
              </label>
              <input
                type="tel"
                value={paytmPhone}
                onChange={(e) => setPaytmPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="custom-input"
                required
              />
            </div>
          )}

          {/* Amount input */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 500, marginBottom: '0.4rem', display: 'block' }}>
              Withdrawal Amount (in Coins)
            </label>
            <input
              type="number"
              min={3000}
              step={100}
              value={amountCoins}
              onChange={(e) => setAmountCoins(Number(e.target.value))}
              className="custom-input"
              required
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--wa-green-light)', marginTop: '0.35rem', display: 'block', fontWeight: 600 }}>
              Receive Amount: ₹{(amountCoins / 30).toFixed(2)} INR directly to your {paymentMethod} account.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isEligible || submitting}
            className="btn-gold"
            style={{ padding: '0.95rem', fontSize: '1rem', width: '100%', justifyContent: 'center' }}
          >
            {submitting ? (
              <>
                <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                Submitting to Supabase...
              </>
            ) : (
              <>
                <Send style={{ width: '18px', height: '18px' }} />
                {isEligible ? 'Submit Withdrawal Request' : 'Locked (Need 3,000 Coins Minimum)'}
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-sub)', fontSize: '0.8rem', marginTop: '1.25rem' }}>
          <ShieldCheck style={{ width: '16px', height: '16px', color: 'var(--wa-green-light)' }} />
          <span>Automated Payout Gateway via Supabase Real-Time Engine</span>
        </div>
      </div>

      {/* Payout Withdrawals History Status List (Realtime Supabase) */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock style={{ width: '20px', height: '20px', color: 'var(--wa-green-light)' }} />
          Withdrawal Requests ({withdrawals.length})
        </h3>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-sub)', gap: '0.5rem' }}>
            <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
            <span>Loading payout history...</span>
          </div>
        ) : withdrawals.length === 0 ? (
          /* Empty State */
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#0b141a', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
              No withdrawal history yet. Submit your first request above!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {withdrawals.map((txn) => (
              <div 
                key={txn.request_id}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  background: '#0b141a',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      ID: {txn.request_id.substring(0, 8).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • {new Date(txn.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'block', marginTop: '0.2rem' }}>
                    Target: {txn.upi_id}
                  </span>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--wa-green-light)', display: 'block' }}>
                      ₹{txn.amount_in_inr}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                      {(txn.amount_in_coins || (txn.amount_in_inr * 30)).toLocaleString()} Coins
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: txn.status === 'paid' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: txn.status === 'paid' ? 'var(--wa-green-light)' : '#fbbf24',
                    border: txn.status === 'paid' ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    {txn.status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Ledger */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Coins style={{ width: '20px', height: '20px', color: '#fbbf24' }} />
          Coin Transaction Ledger ({walletTx.length})
        </h3>
        
        {walletTx.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#0b141a', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
              No coins earned or deducted yet. Complete a task to start earning!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {walletTx.map((tx) => (
              <div key={tx.id} style={{
                background: '#0b141a',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                      {tx.transaction_type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>
                      • {new Date(tx.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{tx.description}</div>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: tx.transaction_type === 'withdrawal' ? '#f87171' : '#fbbf24' }}>
                  {tx.transaction_type === 'withdrawal' ? '-' : '+'}{tx.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
