// src/components/HomeDashboard.jsx - Dynamic Home Dashboard with Real-time Supabase Data
import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  IndianRupee, 
  Radio, 
  Users, 
  TrendingUp, 
  QrCode, 
  Wallet, 
  UserPlus, 
  CheckCircle2, 
  ArrowUpRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function HomeDashboard({ 
  userSession,
  onNavigate 
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

        // Fetch User Record
        const { data: profile, error } = await supabase
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

        // Fetch Referral Count from users table
        const refCode = profile?.custom_user_id || userSession.customUserId || userSession.referralCode;
        if (refCode) {
          const { count } = await supabase
            .from('users')
            .select('uid', { count: 'exact', head: true })
            .eq('referred_by', refCode);

          setTotalReferralsCount(count || 0);
        }

        // Fetch Active Tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

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

    // 2. Real-time Subscription for User Profile changes
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

    // Real-time Subscription for Tasks
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

  // Conversion rule: 20 coins = ₹1
  const balanceInRupees = (userData.coinBalance / 20).toFixed(2);
  const totalEarnedInRupees = (userData.coinBalance / 20).toFixed(2);
  const isConnected = userData.isBotConnected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Welcome Back, {userSession?.fullName || 'User'}! 👋
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
            User ID: <strong style={{ color: 'var(--wa-green-light)' }}>{userSession?.customUserId || 'CM-GUEST'}</strong>
          </p>
        </div>

        {/* Dynamic Bot Connection Status Indicator */}
        <div className={isConnected ? "status-badge-active" : "status-badge-disconnected"}>
          <div className={isConnected ? "pulsing-dot" : "pulsing-dot-red"} />
          <span id="bot-status">
            Bot Status: {isConnected ? "🟢 Active & Earning" : "🔴 Disconnected"}
          </span>
        </div>
      </div>

      {/* Main Grid: Dynamic Wallet Card & Overview Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        
        {/* Dynamic Wallet Card */}
        <div className="glass-panel" style={{
          padding: '1.75rem',
          background: 'linear-gradient(135deg, rgba(17, 27, 33, 0.95), rgba(5, 76, 63, 0.4))',
          border: '1px solid rgba(0, 230, 118, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle bg glow */}
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '-20px',
            width: '140px',
            height: '140px',
            background: 'var(--wa-green-glow)',
            borderRadius: '50%',
            filter: 'blur(30px)'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 500 }}>Current Coin Balance</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <Coins style={{ color: '#fbbf24', width: '28px', height: '28px' }} />
                {loading ? (
                  <span style={{ fontSize: '1.5rem', color: 'var(--text-sub)' }}>Loading...</span>
                ) : (
                  <span id="wallet-coins" style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff' }}>
                    {userData.coinBalance.toLocaleString()}
                  </span>
                )}
                <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 600, alignSelf: 'flex-end', marginBottom: '0.4rem' }}>
                  Coins
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.5rem 0.85rem',
              borderRadius: '12px',
              textAlign: 'right',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'block' }}>Equivalent INR</span>
              <span id="wallet-inr" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--wa-green-light)' }}>
                ₹{balanceInRupees}
              </span>
            </div>
          </div>

          {/* Conversion rate footnote */}
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-sub)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            width: 'fit-content'
          }}>
            <IndianRupee style={{ width: '14px', height: '14px', color: '#fbbf24' }} />
            <span>Exchange Rate: <strong>20 Coins = ₹1</strong></span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => onNavigate('wallet')}
              className="btn-gold"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}
            >
              <Wallet style={{ width: '18px', height: '18px' }} />
              Withdraw Cash
            </button>
            <button
              onClick={() => onNavigate('link')}
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}
            >
              <QrCode style={{ width: '18px', height: '18px' }} />
              {isConnected ? 'View Bot Status' : 'Connect WhatsApp'}
            </button>
          </div>
        </div>

        {/* Counter Cards Grid */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '1rem' }}>
          
          {/* Total Earned Counter */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(0, 230, 118, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-green-light)'
              }}>
                <TrendingUp style={{ width: '24px', height: '24px' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Tasks Completed / Earned</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {userData.totalTasksCompleted} Tasks <span style={{ fontSize: '0.95rem', color: 'var(--wa-green-light)', fontWeight: 600 }}>(₹{totalEarnedInRupees})</span>
                </h3>
              </div>
            </div>
            <ArrowUpRight style={{ color: 'var(--text-muted)', width: '20px', height: '20px' }} />
          </div>

          {/* Total Referrals Counter */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc'
              }}>
                <Users style={{ width: '24px', height: '24px' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Total Real Referrals</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {totalReferralsCount} Friends Joined
                </h3>
              </div>
            </div>
            <button
              onClick={() => onNavigate('invite')}
              style={{
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#c084fc',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Invite More
            </button>
          </div>

        </div>

      </div>

      {/* Dynamic Active Tasks / Channels Container */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 style={{ width: '18px', height: '18px', color: 'var(--wa-green-light)' }} />
            Active Channel Auto-Follow Tasks ({activeTasks.length})
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
            Supabase Realtime Sync 🟢
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-sub)', gap: '0.5rem' }}>
            <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
            <span>Loading active tasks from database...</span>
          </div>
        ) : activeTasks.length === 0 ? (
          /* Empty State */
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#0b141a', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            <AlertCircle style={{ width: '36px', height: '36px', color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>No active tasks right now!</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
              Check back soon for new partner channel tasks to auto-follow and earn coins.
            </p>
          </div>
        ) : (
          /* Dynamic Active Task List */
          <div id="task-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeTasks.map((task) => (
              <div 
                key={task.task_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#0b141a',
                  padding: '0.85rem 1.1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'block' }}>
                    {task.channel_name || 'WhatsApp Channel Task'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                    Progress: {task.completed_count || 0} / {task.target_count} Members
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--wa-green-light)', fontWeight: 700, fontSize: '0.95rem' }}>
                    +{task.coin_reward || 50} Coins
                  </span>
                  <a
                    href={task.channel_link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(0, 168, 132, 0.2)',
                      color: 'var(--wa-green-light)',
                      border: '1px solid rgba(0, 230, 118, 0.4)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    View Task
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
