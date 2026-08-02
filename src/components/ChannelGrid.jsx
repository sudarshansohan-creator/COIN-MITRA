// src/components/ChannelGrid.jsx - Targeted WhatsApp Channels Directory & Mode Switcher Engine
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Cpu, Code, DollarSign, ShieldAlert, Radio, 
  CheckCircle, Clock, ExternalLink, Search, Sparkles, Filter,
  Zap, Hand, CheckCircle2, Loader2, ShieldCheck, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ICON_MAP = {
  TrendingUp,
  Cpu,
  Code,
  DollarSign,
  ShieldAlert,
  Radio
};

export default function ChannelGrid({ 
  channels = [], 
  subscriptions = {}, 
  isSyncing, 
  userSession,
  onRefreshProfile
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mode State: 'auto' | 'manual'
  const [taskMode, setTaskMode] = useState('auto');
  const [updatingMode, setUpdatingMode] = useState(false);

  // Completed Tasks Set (task_id or channel_link)
  const [completedTaskMap, setCompletedTaskMap] = useState({});
  const [verifyingTaskId, setVerifyingTaskId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const userId = userSession?.customUserId || userSession?.uid;

  // 1. Fetch User Task Mode and Task Completions
  useEffect(() => {
    if (!userId) return;

    // Fetch Mode
    const fetchModeAndCompletions = async () => {
      try {
        const res = await fetch(`/api/user-mode/${userId}`);
        const data = await res.json();
        if (data.success && data.mode) {
          setTaskMode(data.mode);
        }

        // Fetch user task completions from Supabase
        const { data: completions, error } = await supabase
          .from('user_task_completions')
          .select('task_id, channel_link')
          .eq('user_id', userId);

        if (error) throw error;

        if (completions && Array.isArray(completions)) {
          const map = {};
          completions.forEach(c => {
            if (c.task_id) map[c.task_id] = true;
            if (c.channel_link) map[c.channel_link] = true;
          });
          setCompletedTaskMap(map);
        }
      } catch (err) {
        // এবার যেকোনো ডাটাবেস এরর ঠিকঠাক এখানে ধরা পড়বে!
        console.error('Error fetching user mode/completions:', err.message || err);
      }
    };

    fetchModeAndCompletions();
  }, [userId]);

  // 2. Handle Task Mode Switch
  const handleModeSwitch = async (newMode) => {
    if (newMode === taskMode || updatingMode || !userId) return;

    setUpdatingMode(true);
    try {
      const res = await fetch('https://coin-mitra.onrender.com/api/update-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: newMode })
      });
      const data = await res.json();

      if (data.success) {
        setTaskMode(newMode);
        showToast(newMode === 'manual' 
          ? '🖐️ Manual Mode Activated: Click "Follow Channel" then "Verify Task"!'
          : '⚡ Automatic Mode Activated: Bot will auto-follow active channels!'
        );
      } else {
        alert(data.error || 'Failed to update mode');
      }
    } catch (err) {
      console.error('Mode update error:', err);
    } finally {
      setUpdatingMode(false);
    }
  };

  // 3. Handle Manual Task Verification
  const handleVerifyTask = async (channel) => {
    const channelId = channel.task_id || channel.id;
    const channelLink = channel.channel_link || channel.link;

    if (!userId) {
      alert('Please log in first to verify tasks.');
      return;
    }

    setVerifyingTaskId(channelId);

    try {
      const res = await fetch('https://coin-mitra.onrender.com/api/verify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          taskId: channel.task_id || null,
          channelLink,
          phoneNumber: userSession?.phone || userSession?.phoneNumber
        })
      });

      const data = await res.json();

      if (data.success && data.verified) {
        // Mark completed locally
        setCompletedTaskMap(prev => ({
          ...prev,
          [channelId]: true,
          [channelLink]: true
        }));

        showToast(data.message || `🎉 Verified! +${data.coinsAwarded || 50} Coins added to your wallet!`);
        
        // Refresh balance on parent if available
        if (typeof onRefreshProfile === 'function') {
          onRefreshProfile();
        }
      } else {
        alert(data.message || data.error || 'Channel not followed yet on WhatsApp. Please join the channel first!');
      }
    } catch (err) {
      console.error('Verify task error:', err);
      alert('Failed to connect to verification server. Please check your internet connection.');
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const categories = ['All', ...new Set(channels.map(c => c.category))];

  const filteredChannels = channels.filter(ch => {
    const matchesCat = selectedCategory === 'All' || ch.category === selectedCategory;
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (ch.handle && ch.handle.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (ch.description && ch.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <section className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', position: 'relative' }}>
      
      {/* Feedback Toast Banner */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #054c3f, #111b21)',
          border: '1px solid var(--wa-green-light)',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 230, 118, 0.3)',
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.3s ease'
        }}>
          <Sparkles size={18} color="#00e676" />
          {toastMsg}
        </div>
      )}

      {/* Mode Switcher Control Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(17, 27, 33, 0.9), rgba(5, 76, 63, 0.3))',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--wa-green-light)' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
              WhatsApp Follow Mode (টাস্ক মোড নির্বাচন করুন)
            </h4>
          </div>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {taskMode === 'auto' 
              ? '⚡ Automatic Mode: বট স্বয়ংক্রিয়ভাবে চ্যানেল ফলো করে ওয়ালেটে কয়েন পয়েন্ট যোগ করবে।'
              : '🖐️ Manual Mode: লিঙ্ক থেকে চ্যানেলটি ফলো করার পর "Verify Task" বাটনে চাপ দিন।'}
          </p>
        </div>

        {/* Toggle Switch */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '30px',
          padding: '0.25rem',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            type="button"
            onClick={() => handleModeSwitch('auto')}
            disabled={updatingMode}
            style={{
              background: taskMode === 'auto' ? 'var(--wa-green)' : 'transparent',
              color: taskMode === 'auto' ? '#ffffff' : 'var(--text-sub)',
              border: 'none',
              borderRadius: '25px',
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.25s ease'
            }}
          >
            <Zap size={14} /> Automatic (অটো)
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('manual')}
            disabled={updatingMode}
            style={{
              background: taskMode === 'manual' ? '#fbbf24' : 'transparent',
              color: taskMode === 'manual' ? '#000000' : 'var(--text-sub)',
              border: 'none',
              borderRadius: '25px',
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.25s ease'
            }}
          >
            <Hand size={14} /> Manual (ম্যানুয়াল)
          </button>
        </div>
      </div>

      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} className="text-wa-green" />
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff' }}>
              Target WhatsApp Channels
            </h3>
          </div>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Select verified channels to earn +50 Coins per successful channel subscription.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.55rem 0.85rem 0.55rem 2.4rem',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? 'var(--wa-green)' : 'var(--bg-elevated)',
              color: selectedCategory === cat ? '#ffffff' : 'var(--text-sub)',
              border: '1px solid',
              borderColor: selectedCategory === cat ? 'var(--wa-green-light)' : 'var(--border-color)',
              borderRadius: '20px',
              padding: '0.35rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Channels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {filteredChannels.map((channel) => {
          const IconComp = ICON_MAP[channel.icon] || Radio;
          const channelId = channel.task_id || channel.id;
          const channelLink = channel.channel_link || channel.link;

          const isDoneInMap = Boolean(completedTaskMap[channelId] || completedTaskMap[channelLink]);
          const isSubscribed = Boolean(isDoneInMap || subscriptions[channel.id]?.subscribed || channel.subscribed);

          const isVerifyingThis = verifyingTaskId === channelId;

          return (
            <div
              key={channelId}
              style={{
                background: isSubscribed ? 'rgba(0, 168, 132, 0.06)' : 'var(--bg-card)',
                border: isSubscribed ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isSubscribed ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSubscribed ? 'var(--wa-green-light)' : 'var(--text-main)'
                    }}>
                      <IconComp size={22} />
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                        {channel.name || channel.channel_name}
                      </h4>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontFamily: 'var(--font-mono)' }}>
                        {channel.handle || `@channel_${(channel.name || '').toLowerCase().replace(/\s+/g, '')}`}
                      </span>
                    </div>
                  </div>

                  {/* Badge */}
                  <span className={`badge badge-${(channel.badge || 'custom').toLowerCase()}`}>
                    +{channel.coin_reward || 50} Coins
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.83rem', color: 'var(--text-sub)', marginBottom: '1rem', lineHeight: '1.45' }}>
                  {channel.description || 'Follow this official WhatsApp channel to complete your earning task.'}
                </p>
              </div>

              {/* Bottom Meta Bar & Subscription Status */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    👥 {channel.subscribers || '10K+'} followers
                  </div>

                  {/* Status Indicator / Actions */}
                  {isSubscribed ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--wa-green-light)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: 'rgba(0, 230, 118, 0.15)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      border: '1px solid rgba(0, 230, 118, 0.3)'
                    }}>
                      <CheckCircle size={15} /> Verified ✔ (+{channel.coin_reward || 50})
                    </div>
                  ) : taskMode === 'manual' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Follow Channel Link */}
                      <a
                        href={channelLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.78rem',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <ExternalLink size={13} /> Follow ↗
                      </a>

                      {/* Verify Button */}
                      <button
                        type="button"
                        onClick={() => handleVerifyTask(channel)}
                        disabled={isVerifyingThis}
                        className="btn-gold"
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        {isVerifyingThis ? (
                          <>
                            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={13} /> Verify Task
                          </>
                        )}
                      </button>
                    </div>
                  ) : isSyncing ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#f59e0b',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}>
                      <Clock size={15} /> Auto-Syncing ⏳
                    </div>
                  ) : (
                    <a
                      href={channelLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', textDecoration: 'none' }}
                    >
                      <ExternalLink size={13} /> View Channel
                    </a>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
