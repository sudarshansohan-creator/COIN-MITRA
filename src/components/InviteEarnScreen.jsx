// src/components/InviteEarnScreen.jsx - Dynamic Invite & Realtime Referral Progress Tracker
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Share2, 
  Gift, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  UserPlus,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InviteEarnScreen({ userSession }) {
  const [copied, setCopied] = useState(false);
  const referralCode = userSession?.customUserId || userSession?.referralCode || 'CM-98765';
  const referralLink = `https://thecoinmitra.com?ref=${referralCode}`;

  const [referredFriends, setReferredFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Pricing State
  const [referralBonus, setReferralBonus] = useState(200);
  const [coinsPerRupee, setCoinsPerRupee] = useState(30);

  // Fetch Pricing settings from Supabase
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('referral_bonus_referrer, coins_per_rupee')
          .eq('id', 1)
          .maybeSingle();
        if (data) {
          if (data.referral_bonus_referrer) setReferralBonus(data.referral_bonus_referrer);
          if (data.coins_per_rupee) setCoinsPerRupee(data.coins_per_rupee);
        }
      } catch (err) {
        console.error('Fetch pricing error:', err);
      }
    };
    fetchPricing();
  }, []);

  // Fetch & Realtime Listen for Referred Friends from Supabase `users` table
  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      return;
    }

    const fetchReferredFriends = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('uid, full_name, phone_number, total_tasks_completed, referral_bonus_claimed, created_at')
          .eq('referred_by', referralCode)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setReferredFriends(data);
        }
      } catch (err) {
        console.error('Fetch referred friends error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferredFriends();

    // Realtime Listener for new user referrals or task completion updates
    const referralChannel = supabase
      .channel(`referrals-${referralCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: `referred_by=eq.${referralCode}` },
        () => fetchReferredFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(referralChannel);
    };
  }, [referralCode]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🎁 Join CoinMitra WhatsApp Bot & Earn ₹${(referralBonus / coinsPerRupee).toFixed(0)} Daily auto-following channels!\n\n` +
      `Use my User ID / Referral code *${referralCode}* or link below to claim free bonus coins:\n` +
      `${referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const maskPhone = (ph) => {
    if (!ph || ph.length < 7) return '******';
    return `${ph.substring(0, 3)}****${ph.substring(ph.length - 2)}`;
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Header */}
      <div className="glass-panel" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(17, 27, 33, 0.95), rgba(139, 92, 246, 0.25))', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <Gift style={{ width: '16px', height: '16px' }} />
              <span>UNLIMITED REFERRAL BONUSES</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Invite Friends & Earn {referralBonus} Coins Each</h1>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Earn {referralBonus} Coins (₹{(referralBonus / coinsPerRupee).toFixed(0)}) when your invited friend completes 10 channel auto-follow tasks!
            </p>
          </div>

          <div style={{
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            padding: '0.65rem 1.1rem',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'block' }}>Your Referral Code</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc', letterSpacing: '1px' }}>
              {referralCode}
            </span>
          </div>
        </div>
      </div>

      {/* Share Link Card */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Share2 style={{ width: '20px', height: '20px', color: 'var(--wa-green-light)' }} />
          Your Unique Referral Link
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            readOnly
            value={referralLink}
            className="custom-input"
            style={{ flex: 1, minWidth: '260px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--wa-green-light)' }}
          />

          <button
            onClick={handleCopyLink}
            className="btn-secondary"
            style={{ padding: '0.85rem 1.25rem' }}
          >
            {copied ? (
              <>
                <Check style={{ width: '18px', height: '18px', color: 'var(--wa-green-light)' }} />
                Copied!
              </>
            ) : (
              <>
                <Copy style={{ width: '18px', height: '18px' }} />
                Copy Link
              </>
            )}
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="btn-primary"
            style={{ padding: '0.85rem 1.25rem' }}
          >
            <Share2 style={{ width: '18px', height: '18px' }} />
            Share on WhatsApp
          </button>
        </div>
      </div>

      {/* Friend Progress Tracker (10/10 Tasks Completed Tracker) */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users style={{ width: '20px', height: '20px', color: '#c084fc' }} />
              Friend Progress Tracker (10/10 Tasks)
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
              Supabase Real-time Referral Tracker
            </span>
          </div>

          <span style={{ fontSize: '0.85rem', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontWeight: 600 }}>
            {referredFriends.length} Joined
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-sub)', gap: '0.5rem' }}>
            <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
            <span>Loading referrals data...</span>
          </div>
        ) : referredFriends.length === 0 ? (
          /* Empty State */
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#0b141a', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <AlertCircle style={{ width: '36px', height: '36px', color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>No friends invited yet!</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
              Share your referral link on WhatsApp to start earning 200 coins per active friend.
            </p>
          </div>
        ) : (
          /* Dynamic Friend List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {referredFriends.map((friend) => {
              const tasksDone = Math.min(10, friend.total_tasks_completed || 0);
              const taskPercent = Math.round((tasksDone / 10) * 100);
              const isCompleted = tasksDone >= 10;
              const bonusCoins = isCompleted ? 200 : tasksDone * 30;

              return (
                <div 
                  key={friend.uid}
                  style={{
                    background: '#0b141a',
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {friend.full_name || 'Invited Friend'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginLeft: '0.5rem' }}>
                        ({maskPhone(friend.phone_number)})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--wa-green-light)' }}>
                        +{bonusCoins} Coins (₹{(bonusCoins/30).toFixed(2)})
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '12px',
                        background: isCompleted ? 'rgba(0, 230, 118, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isCompleted ? 'var(--wa-green-light)' : '#fbbf24',
                        border: isCompleted ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        {isCompleted ? '✓ 10/10 Completed' : `⏳ ${tasksDone}/10 Tasks`}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar per friend */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                      <span>Auto-follow Progress</span>
                      <span>{tasksDone} / 10 Channels Followed</span>
                    </div>
                    <div className="progress-container" style={{ height: '8px' }}>
                      <div 
                        className={isCompleted ? "progress-fill" : "progress-fill-gold"} 
                        style={{ width: `${taskPercent}%` }} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
