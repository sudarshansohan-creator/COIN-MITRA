// src/components/HomeDashboard.jsx - Dynamic Mobile-Responsive Home Dashboard
import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  IndianRupee, 
  Users, 
  TrendingUp, 
  QrCode, 
  Wallet, 
  CheckCircle2, 
  ArrowUpRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ChannelGrid from './ChannelGrid';

export default function HomeDashboard({ 
  userSession,
  onNavigate,
  botStatus = 'DISCONNECTED'
}) {
  const [userData, setUserData] = useState({
    coinBalance: userSession?.coinBalance || 0,
    totalTasksCompleted: userSession?.totalTasksCompleted || 0,
    isBotConnected: userSession?.isBotConnected || false,
    referredBy: userSession?.referredBy || null
  });
  const [totalReferralsCount, setTotalReferralsCount] = useState(0);
  const [activeTasks, setActiveTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch & Realtime Listen for User Profile & Referrals
  useEffect(() => {
    if (!userSession?.uid && !userSession?.customUserId) {
      setLoading(false);
      return;
    }

    const fetchProfileAndReferrals = async () => {
      try {
        setLoading(true);

        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .or(`uid.eq.${userSession.uid},custom_user_id.eq.${userSession.customUserId}`)
          .maybeSingle();

        if (profile) {
          setUserData({
            coinBalance: profile.coin_balance || 0,
            totalTasksCompleted: profile.total_tasks_completed || 0,
            isBotConnected: profile.is_bot_connected || false,
            referredBy: profile.referred_by
          });
        }

        const refCode = profile?.custom_user_id || userSession.customUserId || userSession.referralCode;
        if (refCode) {
          const { count } = await supabase
            .from('users')
            .select('uid', { count: 'exact', head: true })
            .eq('referred_by', refCode);

          setTotalReferralsCount(count || 0);
        }

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'active');

        if (tasksData) {
          setActiveTasks(tasksData);
        }
      } catch (err) {
        console.error('HomeDashboard data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndReferrals();

    const userChannel = supabase
      .channel(`home-user-${userSession?.uid || 'guest'}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users',
          filter: userSession?.uid ? `uid=eq.${userSession.uid}` : undefined 
        },
        (payload) => {
          if (payload.new) {
            setUserData((prev) => ({
              ...prev,
              coinBalance: payload.new.coin_balance ?? prev.coinBalance,
              totalTasksCompleted: payload.new.total_tasks_completed ?? prev.totalTasksCompleted,
              isBotConnected: payload.new.is_bot_connected ?? prev.isBotConnected
            }));
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('home-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async () => {
          const { data } = await supabase.from('tasks').select('*').eq('status', 'active');
          if (data) setActiveTasks(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [userSession?.uid, userSession?.customUserId]);

  const balanceInRupees = (userData.coinBalance / 20).toFixed(2);
  const totalEarnedInRupees = (userData.coinBalance / 20).toFixed(2);
  
  // Dynamic Live Connection Status Logic across all states
  const isConnected = botStatus === 'CONNECTED' || botStatus === 'SYNCING' || botStatus === 'COMPLETED' || userData.isBotConnected;
  const isSyncing = botStatus === 'SYNCING';
  const isConnecting = botStatus === 'CONNECTING' || botStatus === 'AWAITING_PAIRING';

  const renderStatusBadge = () => {
    if (isSyncing) {
      return (
        <div className="status-badge-active" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
          <div className="pulsing-dot" style={{ backgroundColor: '#fbbf24', boxShadow: '0 0 10px #fbbf24' }} />
          <span id="bot-status">Bot Status: ⚡ Auto-Following Channels</span>
        </div>
      );
    }
    if (isConnecting) {
      return (
        <div className="status-badge-active" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
          <div className="pulsing-dot" style={{ backgroundColor: '#fbbf24', boxShadow: '0 0 10px #fbbf24' }} />
          <span id="bot-status">Bot Status: 🟡 Connecting...</span>
        </div>
      );
    }
    if (isConnected) {
      return (
        <div className="status-badge-active">
          <div className="pulsing-dot" />
          <span id="bot-status">Bot Status: 🟢 Active & Earning</span>
        </div>
      );
    }
    return (
      <div className="status-badge-disconnected">
        <div className="pulsing-dot-red" />
        <span id="bot-status">Bot Status: 🔴 Disconnected</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.65rem)', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.25 }}>
            Welcome Back, {userSession?.fullName || 'User'}! 👋
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            User ID: <strong style={{ color: 'var(--wa-green-light)' }}>{userSession?.customUserId || 'CM-GUEST'}</strong>
          </p>
        </div>

        {/* Dynamic Live Unified Bot Connection Status Badge */}
        {renderStatusBadge()}
      </div>

      {/* Main Grid: Dynamic Wallet Card & Overview Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* Dynamic Wallet Card */}
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(17, 27, 33, 0.95), rgba(5, 76, 63, 0.4))',
          border: '1px solid rgba(0, 230, 118, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            background: 'var(--wa-green-glow)',
            borderRadius: '50%',
            filter: 'blur(30px)'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 500 }}>Current Coin Balance</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                <Coins style={{ color: '#fbbf24', width: '26px', height: '26px', flexShrink: 0 }} />
                {loading ? (
                  <span style={{ fontSize: '1.25rem', color: 'var(--text-sub)' }}>Loading...</span>
                ) : (
                  <span id="wallet-coins" style={{ fontSize: 'clamp(1.75rem, 6vw, 2.25rem)', fontWeight: 800, color: '#ffffff' }}>
                    {userData.coinBalance.toLocaleString()}
                  </span>
                )}
                <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600, alignSelf: 'flex-end', marginBottom: '0.2rem' }}>
                  Coins
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.4rem 0.75rem',
              borderRadius: '12px',
              textAlign: 'right',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block' }}>Equivalent INR</span>
              <span id="wallet-inr" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--wa-green-light)' }}>
                ₹{balanceInRupees}
              </span>
            </div>
          </div>

          {/* Conversion rate footnote */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-sub)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1.25rem',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '0.35rem 0.65rem',
            borderRadius: '8px',
            width: 'fit-content'
          }}>
            <IndianRupee style={{ width: '13px', height: '13px', color: '#fbbf24' }} />
            <span>Exchange Rate: <strong>20 Coins = ₹1</strong></span>
          </div>

          {/* Action Buttons (Stacked on Mobile) */}
          <div className="wallet-card-actions">
            <button
              onClick={() => onNavigate('wallet')}
              className="btn-gold"
              style={{ flex: 1, padding: '0.7rem' }}
            >
              <Wallet style={{ width: '16px', height: '16px' }} />
              Withdraw Cash
            </button>
            <button
              onClick={() => onNavigate('link')}
              className="btn-primary"
              style={{ flex: 1, padding: '0.7rem' }}
            >
              <QrCode style={{ width: '16px', height: '16px' }} />
              {isConnected ? 'View Bot Status' : 'Connect WhatsApp'}
            </button>
          </div>
        </div>

        {/* Counter Cards Grid */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '1rem' }}>
          
          {/* Total Earned Counter */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(0, 230, 118, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-green-light)',
                flexShrink: 0
              }}>
                <TrendingUp style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', display: 'block' }}>Total Lifetime Earned</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  {userData.coinBalance.toLocaleString()} Coins <span style={{ fontSize: '0.8rem', color: 'var(--wa-green-light)' }}>(₹{totalEarnedInRupees})</span>
                </span>
              </div>
            </div>
          </div>

          {/* Total Referrals Counter */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(192, 132, 252, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
                flexShrink: 0
              }}>
                <Users style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', display: 'block' }}>Total Real Referrals</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  {totalReferralsCount} Friends Joined
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('invite')}
              style={{
                background: 'rgba(192, 132, 252, 0.15)',
                border: '1px solid rgba(192, 132, 252, 0.3)',
                color: '#c084fc',
                padding: '0.4rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Invite More
            </button>
          </div>

        </div>

      </div>

      {/* Active Tasks Directory with Auto vs Manual Mode Switcher */}
      <ChannelGrid
        channels={activeTasks.map(t => ({
          id: t.task_id,
          task_id: t.task_id,
          name: t.channel_name,
          channel_name: t.channel_name,
          link: t.channel_link,
          channel_link: t.channel_link,
          coin_reward: t.coin_reward || 50,
          category: 'WhatsApp Channel',
          handle: `@${(t.channel_name || 'channel').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          badge: 'Verified',
          description: 'Follow this verified partner channel on WhatsApp to complete your task and claim coin rewards.'
        }))}
        userSession={userSession}
        isSyncing={botStatus === 'SYNCING'}
        onNavigate={onNavigate}
      />

    </div>
  );
}
