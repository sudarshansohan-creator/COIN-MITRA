// src/components/ChannelGrid.jsx - Targeted WhatsApp Channels Directory & Mode Switcher Engine
import React, { useState, useEffect, useRef } from 'react';
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
  onRefreshProfile,
  onNavigate
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // All Tasks Done Modal State
  const [showAllDonePopup, setShowAllDonePopup] = useState(false);
  
  // Ad Task State
  const [adClickTime, setAdClickTime] = useState(null);
  const [isAdVerifying, setIsAdVerifying] = useState(false);
  const [adLocks, setAdLocks] = useState({});
  const [adWaitRemaining, setAdWaitRemaining] = useState({});
  const [globalAdDelay, setGlobalAdDelay] = useState(0); // 1-5s delay between clicks
  const [clickedAdLink, setClickedAdLink] = useState(null);
  
  // Mode State: 'auto' | 'manual'
  const [taskMode, setTaskMode] = useState('manual');
  const [updatingMode, setUpdatingMode] = useState(false);

  // Completed Tasks Set (task_id or channel_link)
  const [completedTaskMap, setCompletedTaskMap] = useState({});
  const [pendingTaskMap, setPendingTaskMap] = useState({});
  const [verifyingTaskId, setVerifyingTaskId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const userId = userSession?.customUserId || userSession?.uid;

  // Retrieve or create a persistent connection ID for this session
  const getConnectionId = () => {
    let cid = localStorage.getItem('adConnectionId');
    if (!cid) {
      cid = 'conn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('adConnectionId', cid);
    }
    return cid;
  };

  // Fetch initial ad locks from database on load based on Connection ID
  const fetchLocks = async () => {
    if (!userId) return;
    
    try {
      const activeConnectionId = getConnectionId();
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('ad_link_clicks')
        .select('target_link, clicked_at')
        .eq('user_id', userId)
        .eq('connection_id', activeConnectionId)
        .gte('clicked_at', fifteenMinsAgo);
        
      if (!error && data && data.length > 0) {
        const initialLocks = {};
        data.forEach(click => {
          const expiresAt = new Date(new Date(click.clicked_at).getTime() + 15 * 60 * 1000).toISOString();
          if (!initialLocks[click.target_link] || new Date(expiresAt) > new Date(initialLocks[click.target_link])) {
            initialLocks[click.target_link] = expiresAt;
          }
        });
        setAdLocks(initialLocks);
      } else {
        setAdLocks({});
      }
    } catch (err) {
      console.error('Failed to fetch ad locks:', err);
    }
  };

  useEffect(() => {
    fetchLocks();

    // Listen for internet reconnection (e.g. toggling airplane mode)
    const handleReconnect = () => {
      // Force a new connection ID to bypass old locks
      const newCid = 'conn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('adConnectionId', newCid);
      
      // Re-fetch locks with the new connection ID (which will be empty, unlocking everything)
      fetchLocks();
      
      // Show toast
      showToast('✈️ Network reconnected! Ad locks have been cleared.');
    };

    window.addEventListener('online', handleReconnect);
    return () => {
      window.removeEventListener('online', handleReconnect);
    };
  }, [userId]);

  const adClickTimeRef = useRef(null);
  const clickedAdLinkRef = useRef(null);

  // Handle visibility/focus change for Ad Task Verification
  useEffect(() => {
    const handleReturn = async () => {
      // Only process if the page becomes active
      if (document.visibilityState !== 'visible' && !document.hasFocus()) return;
      
      // Check if there's an active ad click
      if (!adClickTimeRef.current || !clickedAdLinkRef.current) return;

      const timePassed = Date.now() - adClickTimeRef.current;
      const targetLink = clickedAdLinkRef.current;
      
      // Reset immediately to prevent multiple triggers
      adClickTimeRef.current = null;
      clickedAdLinkRef.current = null;
      setClickedAdLink(null);

      if (timePassed >= 7000) {
        // Valid ad click (>= 7 seconds)
        setIsAdVerifying(true);
        try {
          const res = await fetch('https://coin-mitra.onrender.com/api/verify-ad-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              targetLink: targetLink || 'https://omg10.com/4/11530711',
              connectionId: localStorage.getItem('adConnectionId')
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast('🎉 Awesome! +0.25 Coin added to your wallet for visiting the ad!');
            
            if (typeof onRefreshProfile === 'function') {
              onRefreshProfile();
            }
            
            setAdLocks(prev => ({
              ...prev,
              [targetLink]: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            }));
            
          } else {
            alert(data.error || 'Failed to verify ad visit.');
          }
        } catch (err) {
          console.error('Ad verification error:', err);
          alert('Network error verifying ad visit.');
        } finally {
          setIsAdVerifying(false);
          // Add random 1-5s delay for other ads AFTER verification completes
          setGlobalAdDelay(Math.floor(Math.random() * 5) + 1);
        }
      } else {
        // Invalid ad click (< 7 seconds)
        alert('You must stay on the page for at least 7 seconds to earn the coin!');
        setGlobalAdDelay(Math.floor(Math.random() * 5) + 1);
      }
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);
    
    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, [userId]); // Removed unstable dependencies to ensure reliable event firing

  // Handle countdown timer for gaps and locks
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalAdDelay(prev => prev > 0 ? prev - 1 : 0);
      
      setAdWaitRemaining(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(adLocks).forEach(([link, lockedUntil]) => {
          const lockTime = new Date(lockedUntil).getTime();
          const diff = Math.max(0, Math.floor((lockTime - Date.now()) / 1000));
          if (next[link] !== diff) {
            next[link] = diff;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      
      setAdLocks(currentLocks => {
        const updated = { ...currentLocks };
        let hasExpired = false;
        Object.entries(updated).forEach(([link, lockedUntil]) => {
          const lockTime = new Date(lockedUntil).getTime();
          if (Date.now() >= lockTime) {
             delete updated[link];
             hasExpired = true;
          }
        });
        return hasExpired ? updated : currentLocks;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adLocks]);

  // 1. Fetch User Task Mode and Task Completions
  useEffect(() => {
    if (!userId) return;

    // Fetch Ad Status
    const fetchAdStatus = async () => {
      try {
        const res = await fetch(`https://coin-mitra.onrender.com/api/ad-status/${userId}`);
        const data = await res.json();
        if (data.success) {
          setAdLocks(data.adLocks || {});
        }
      } catch (err) {
        console.error('Failed to fetch ad status:', err);
      }
    };
    fetchAdStatus();

    // Fetch Mode
    const fetchModeAndCompletions = async () => {
      try {
        const res = await fetch(`https://coin-mitra.onrender.com/api/user-mode/${userId}`);
        const data = await res.json();
        if (data.success && data.mode) {
          setTaskMode(data.mode);
        }

        // Fetch user task completions from Supabase
        const { data: completions, error: compErr } = await supabase
          .from('user_task_completions')
          .select('task_id, channel_link')
          .eq('user_id', userId);

        if (compErr) throw compErr;

        if (completions && Array.isArray(completions)) {
          const map = {};
          completions.forEach(c => {
            if (c.task_id) map[c.task_id] = true;
            if (c.channel_link) map[c.channel_link] = true;
          });
          setCompletedTaskMap(map);
        }

        // Fetch pending manual requests
        const { data: requests, error: reqErr } = await supabase
          .from('manual_task_requests')
          .select('task_id, channel_link')
          .eq('user_id', userId)
          .eq('status', 'pending');

        if (reqErr) throw reqErr;

        if (requests && Array.isArray(requests)) {
          const pMap = {};
          requests.forEach(r => {
            if (r.task_id) pMap[r.task_id] = true;
            if (r.channel_link) pMap[r.channel_link] = true;
          });
          setPendingTaskMap(pMap);
        }

      } catch (err) {
        console.error('Error fetching user mode/completions/requests:', err.message || err);
      }
    };

    fetchModeAndCompletions();
  }, [userId]);

  // Check if all tasks are completed
  useEffect(() => {
    if (channels.length > 0) {
      const allDone = channels.every(c => completedTaskMap[c.task_id || c.id] || completedTaskMap[c.channel_link || c.link]);
      if (allDone) {
        const dismissed = sessionStorage.getItem('allTasksDoneDismissed');
        if (!dismissed) {
          setShowAllDonePopup(true);
        }
      }
    }
  }, [channels, completedTaskMap]);

  const handleDismissAllDonePopup = () => {
    sessionStorage.setItem('allTasksDoneDismissed', 'true');
    setShowAllDonePopup(false);
  };

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

  const handleRequestManualVerify = async (channel) => {
    const channelId = channel.task_id || channel.id;
    const channelLink = channel.channel_link || channel.link;

    if (!userId) {
      alert('Please log in first to request verification.');
      return;
    }

    setVerifyingTaskId(channelId);

    try {
      const res = await fetch('https://coin-mitra.onrender.com/api/request-manual-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId: channelId, channelLink })
      });
      const data = await res.json();
      if (data.success) {
        setPendingTaskMap(prev => ({ ...prev, [channelId]: true, [channelLink]: true }));
        showToast(data.message || 'Request submitted successfully!');
      } else {
        alert(data.error || 'Failed to submit request.');
      }
    } catch (err) {
      console.error('Request verify error:', err);
      alert('Network error. Please try again.');
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

      {/* Add Info Banner for Airplane Mode Unlock */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3 mb-4">
        <ShieldAlert className="text-yellow-400 mt-0.5 shrink-0" size={18} />
        <div className="text-sm">
          <p className="text-yellow-100 font-medium mb-1">Ad Locked?</p>
          <p className="text-yellow-200/80">Turn Airplane Mode ON & OFF to change your IP and unlock ads instantly!</p>
        </div>
      </div>

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

      {/* Special Ad Task Cards */}
      {[
        { id: 1, url: 'https://omg10.com/4/11530711', title: 'Bonus Ad Task 1' },
        { id: 2, url: 'https://omg10.com/4/11536477', title: 'Bonus Ad Task 2' },
        { id: 3, url: 'https://omg10.com/4/11536484', title: 'Bonus Ad Task 3' },
        { id: 4, url: 'https://omg10.com/4/11536489', title: 'Bonus Ad Task 4' },
        { id: 5, url: 'https://omg10.com/4/11536479', title: 'Bonus Ad Task 5' },
        { id: 6, url: 'https://omg10.com/4/11536485', title: 'Bonus Ad Task 6' },
        { id: 7, url: 'https://omg10.com/4/11536478', title: 'Bonus Ad Task 7' },
        { id: 8, url: 'https://omg10.com/4/11536483', title: 'Bonus Ad Task 8' },
        { id: 9, url: 'https://omg10.com/4/11536481', title: 'Bonus Ad Task 9' },
        { id: 10, url: 'https://omg10.com/4/11536472', title: 'Bonus Ad Task 10' },
      ].map((ad, idx, arr) => (
        <div key={ad.id} style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: idx === arr.length - 1 ? '1.75rem' : '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {ad.title} 🎁 <span style={{ fontSize: '0.75rem', background: '#fbbf24', color: '#000', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 800 }}>+0.25 Coin</span>
              </h4>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
                Click the link and stay on the page for <strong style={{ color: '#fbbf24' }}>at least 7 seconds</strong> to claim your reward!
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (!userId) {
                alert('Please log in first.');
                return;
              }
              if (isAdVerifying || adLocks[ad.url] || adWaitRemaining[ad.url] > 0 || globalAdDelay > 0) return;
              clickedAdLinkRef.current = ad.url;
              adClickTimeRef.current = Date.now();
              setClickedAdLink(ad.url);
              window.open(ad.url, '_blank');
            }}
            disabled={isAdVerifying || !!adLocks[ad.url] || adWaitRemaining[ad.url] > 0 || globalAdDelay > 0}
            className="btn-gold"
            style={{
              padding: '0.6rem 1.25rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: (isAdVerifying || adLocks[ad.url] || adWaitRemaining[ad.url] > 0 || globalAdDelay > 0) ? 0.6 : 1,
              cursor: (isAdVerifying || adLocks[ad.url] || adWaitRemaining[ad.url] > 0 || globalAdDelay > 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {isAdVerifying && clickedAdLink === ad.url ? (
              <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</>
            ) : adLocks[ad.url] ? (
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-2"><Clock size={16} /> Locked ({Math.floor((adWaitRemaining[ad.url] || 0) / 60)}:{((adWaitRemaining[ad.url] || 0) % 60).toString().padStart(2, '0')})</span>
                <span className="text-[10px] text-yellow-500 mt-1">Airplane ON & OFF to Unlock</span>
              </div>
            ) : adWaitRemaining[ad.url] > 0 ? (
              <><Clock size={16} /> Wait {adWaitRemaining[ad.url]}s...</>
            ) : globalAdDelay > 0 ? (
              <><Clock size={16} /> Wait {globalAdDelay}s...</>
            ) : (
              <><ExternalLink size={16} /> Visit Ad Link</>
            )}
          </button>
        </div>
      ))}

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

                      {/* Request Verification Button */}
                      {pendingTaskMap[channelId] || pendingTaskMap[channelLink] ? (
                        <div style={{
                          color: '#F59E0B',
                          background: 'rgba(245, 158, 11, 0.15)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '20px',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <RefreshCw size={13} style={{ animation: 'spin 2s linear infinite' }} /> Pending
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestManualVerify(channel)}
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
                          <span className="font-semibold">+0.25</span>
                          <span className="text-xs text-yellow-400/80">Coins</span>
                          {isVerifyingThis ? (
                            <>
                              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              Requesting...
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={13} /> Request Verify
                            </>
                          )}
                        </button>
                      )}
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

      {/* All Tasks Completed Modal */}
      {showAllDonePopup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#f59e0b'
            }}>
              <TrendingUp size={30} />
            </div>
            
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
              All Tasks Completed! 🎉
            </h3>
            
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              You have completed all available tasks for now. Want to earn more Coins while waiting for new tasks? <strong style={{ color: '#fbbf24' }}>Earn +200 Coins for every friend you invite!</strong>
            </p>
            
            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              <button
                onClick={() => {
                  handleDismissAllDonePopup();
                  if (onNavigate) onNavigate('invite');
                }}
                className="btn-gold"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                <TrendingUp size={18} /> Earn More by Inviting Friends
              </button>
              
              <button
                onClick={handleDismissAllDonePopup}
                className="btn-secondary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
