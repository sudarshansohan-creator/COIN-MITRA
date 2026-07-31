// src/App.jsx - Main Application Container with Unified Live Status Polling & Global Realtime Sync
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import HomeDashboard from './components/HomeDashboard';
import LinkEarnScreen from './components/LinkEarnScreen';
import WalletScreen from './components/WalletScreen';
import InviteEarnScreen from './components/InviteEarnScreen';
import PairingModal from './components/PairingModal';
import AdminPanel from './components/AdminPanel';
import { supabase } from './lib/supabase';

export default function App() {
  const [userSession, setUserSession] = useState(null);
  const [activeTab, setActiveTab] = useState('auth'); // Default to auth until session is checked
  const [channels, setChannels] = useState([]);
  const [session, setSession] = useState(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [initializing, setInitializing] = useState(true);

  // Global Unified Live Bot Status across all tabs & screens
  const [liveBotStatus, setLiveBotStatus] = useState('DISCONNECTED');
  const [livePairingCode, setLivePairingCode] = useState(null);

  // 1. Check LocalStorage Cache Memory for Saved User Session on App Load
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('coinmitra_user_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.isLoggedIn) {
          setUserSession(parsed);
          setActiveTab('dashboard'); // Redirect to dashboard if logged in
        } else {
          setUserSession(null);
          setActiveTab('auth'); // Prompt login if session invalid
        }
      } else {
        setUserSession(null);
        setActiveTab('auth'); // Prompt login if no cache memory found
      }
    } catch (err) {
      console.error('Error reading session from cache memory:', err);
      setUserSession(null);
      setActiveTab('auth');
    } finally {
      setInitializing(false);
    }
  }, []);

  // 2. Global Realtime Listener for User Balance & Status from Supabase
  useEffect(() => {
    if (!userSession?.uid && !userSession?.customUserId) return;

    const syncLiveProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('coin_balance, is_bot_connected, total_tasks_completed')
          .or(`uid.eq.${userSession.uid},custom_user_id.eq.${userSession.customUserId}`)
          .maybeSingle();

        if (profile) {
          setUserSession((prev) => (prev ? {
            ...prev,
            coinBalance: profile.coin_balance || 0,
            totalTasksCompleted: profile.total_tasks_completed || 0,
            isBotConnected: profile.is_bot_connected || false
          } : null));
        }
      } catch (err) {
        console.error('Global profile sync error:', err);
      }
    };

    syncLiveProfile();

    // Supabase Real-Time Channel for User Updates
    const profileChannel = supabase
      .channel(`app-global-user-${userSession.uid || userSession.customUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          if (payload.new && (payload.new.uid === userSession.uid || payload.new.custom_user_id === userSession.customUserId)) {
            setUserSession((prev) => (prev ? {
              ...prev,
              coinBalance: payload.new.coin_balance || 0,
              totalTasksCompleted: payload.new.total_tasks_completed || 0,
              isBotConnected: payload.new.is_bot_connected || false
            } : null));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [userSession?.uid, userSession?.customUserId]);

  // 3. Global Live Backend Bot Status Polling (Syncs Home, Link & Earn, Header instantly!)
  useEffect(() => {
    const userId = userSession?.customUserId || userSession?.uid;
    if (!userId) return;

    const pollLiveBotStatus = async () => {
      try {
        const res = await fetch(`/api/bot-status/${userId}`);
        const data = await res.json();
        if (data.success) {
          const currentStatus = data.status || (data.isConnected ? 'CONNECTED' : 'DISCONNECTED');
          setLiveBotStatus(currentStatus);

          if (data.pairingCode) {
            setLivePairingCode(data.pairingCode);
          }

          // Keep userSession.isBotConnected in sync
          setUserSession((prev) => (prev ? { ...prev, isBotConnected: data.isConnected } : null));

          // Also update session state if active
          if (session) {
            setSession(prev => prev ? { ...prev, status: currentStatus, pairingCode: data.pairingCode || prev.pairingCode } : null);
          }
        }
      } catch (err) {
        // Quiet catch for network polling
      }
    };

    pollLiveBotStatus();
    const interval = setInterval(pollLiveBotStatus, 2000);
    return () => clearInterval(interval);
  }, [userSession?.customUserId, userSession?.uid]);

  // Fetch target channel list on load
  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
      }
    } catch (err) {
      console.error('Failed to fetch channels from Express API:', err);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  // Handle Login & Save Session to Cache Memory
  const handleLoginSuccess = (sessionData) => {
    const fullSession = {
      ...sessionData,
      coinBalance: sessionData.coinBalance || 0,
      isLoggedIn: true
    };
    setUserSession(fullSession);
    try {
      localStorage.setItem('coinmitra_user_session', JSON.stringify(fullSession));
    } catch (err) {
      console.error('Failed to save session to cache memory:', err);
    }
    setActiveTab('dashboard');
  };

  // Handle Logout & Clear Cache Memory
  const handleLogout = () => {
    try {
      localStorage.removeItem('coinmitra_user_session');
    } catch (err) {
      console.error('Failed to clear session from cache memory:', err);
    }
    setUserSession(null);
    setActiveTab('auth');
  };

  // Tab Navigation Guard (Prevents accessing app screens if not logged in)
  const handleTabChange = (tabId) => {
    if (!userSession || !userSession.isLoggedIn) {
      setActiveTab('auth');
    } else {
      setActiveTab(tabId);
    }
  };

  // Connect Phone & Create Pairing Session via Baileys API
  const handleConnect = async (phoneNumber) => {
    setLoading(true);
    const userId = userSession?.customUserId || userSession?.uid || `user_${phoneNumber.replace(/\D/g, '')}`;

    try {
      const res = await fetch('/api/get-pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber, 
          userId 
        })
      });
      const data = await res.json();
      if (data.success) {
        const sessionObj = {
          id: data.userId || userId,
          phoneNumber,
          pairingCode: data.code,
          status: 'AWAITING_PAIRING',
          logs: [
            `[${new Date().toLocaleTimeString()}] Baileys Socket initialized for User: ${userId}`,
            `[${new Date().toLocaleTimeString()}] Generated 8-digit pairing code: ${data.code}. Ready for WhatsApp input.`
          ]
        };
        setSession(sessionObj);
        setLogs(sessionObj.logs);
        setLivePairingCode(data.code);
        setLiveBotStatus('AWAITING_PAIRING');
        setShowPairingModal(true);
      } else {
        alert(data.error || 'Failed to initiate CoinMitra pairing session.');
      }
    } catch (err) {
      console.error('Pairing error:', err);
      alert('Network error connecting to Baileys engine. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Handshake & Start Syncing
  const handleConfirmPairing = async () => {
    setShowPairingModal(false);
    setLiveBotStatus('CONNECTING');
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Pairing code entered in WhatsApp. Waiting for connection handshake...`
    ]);
  };

  const handleAddChannel = async (channelData) => {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelData)
      });
      const data = await res.json();
      if (data.success) fetchChannels();
    } catch (err) {
      console.error('Failed to add channel:', err);
    }
  };

  const handleDeleteChannel = async (id) => {
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchChannels();
    } catch (err) {
      console.error('Failed to delete channel:', err);
    }
  };

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b141a', color: 'var(--text-sub)' }}>
        <span>Checking authentication session...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Responsive Header & Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        coinBalance={userSession?.coinBalance || 0}
        botStatus={liveBotStatus}
        userSession={userSession}
        onOpenAdmin={() => setShowAdminPanel(true)}
        onLogout={handleLogout}
      />

      {/* Main Screen Container */}
      <main style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '1.5rem 1rem 3rem', flex: 1 }}>
        
        {/* Unauthenticated View Guard */}
        {(!userSession || !userSession.isLoggedIn || activeTab === 'auth') ? (
          <AuthScreen
            onLoginSuccess={handleLoginSuccess}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <HomeDashboard
                userSession={userSession}
                onNavigate={handleTabChange}
                botStatus={liveBotStatus}
              />
            )}

            {activeTab === 'link' && (
              <LinkEarnScreen
                session={session}
                logs={logs}
                onConnect={handleConnect}
                onConfirmPairing={handleConfirmPairing}
                loading={loading}
                botStatus={liveBotStatus}
                livePairingCode={livePairingCode}
              />
            )}

            {activeTab === 'wallet' && (
              <WalletScreen
                userSession={userSession}
                onWithdrawRequest={(coins) => {
                  setUserSession(prev => (prev ? {
                    ...prev,
                    coinBalance: Math.max(0, (prev?.coinBalance || 0) - coins)
                  } : null));
                }}
              />
            )}

            {activeTab === 'invite' && (
              <InviteEarnScreen
                userSession={userSession}
              />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '1.25rem',
        color: 'var(--text-sub)',
        fontSize: '0.8rem',
        borderTop: '1px solid var(--border-color)',
        background: '#090e11'
      }}>
        <div>CoinMitra WhatsApp Bot Engine © 2026. Built with React, Vite, Supabase Realtime & REST API.</div>
      </footer>

      {/* Pairing Code Modal */}
      {showPairingModal && (
        <PairingModal
          session={session}
          onClose={() => setShowPairingModal(false)}
          onConfirm={handleConfirmPairing}
        />
      )}

      {/* Phase 2 Admin Console Modal */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        channels={channels}
        onAddChannel={handleAddChannel}
        onDeleteChannel={handleDeleteChannel}
      />

    </div>
  );
}
