// src/components/Navbar.jsx - Main Responsive Header & Bottom Mobile Bar
import React from 'react';
import { 
  Sparkles, 
  Home, 
  Radio, 
  Wallet, 
  UserPlus, 
  Coins, 
  Settings,
  LogOut,
  Trophy,
  LogIn,
  MessageCircle
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  coinBalance = 0, 
  botStatus = 'DISCONNECTED',
  userSession,
  onOpenAdmin,
  onLogout
}) {
  const balanceInRupees = (coinBalance / 30).toFixed(2);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'link', label: 'Link & Earn', icon: Radio, badge: 'CORE' },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'invite', label: 'Invite', icon: UserPlus },
    { id: 'leaderboard', label: 'Leaders', icon: Trophy },
    { id: 'support', label: 'Support', icon: MessageCircle },
    { id: 'auth', label: 'Auth', icon: LogIn }
  ];

  return (
    <>
      {/* Top Header for Desktop & Mobile */}
      <header style={{
        background: 'rgba(11, 20, 26, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 900,
        padding: '0.6rem 1rem'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          
          {/* Logo & Brand Name */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--wa-green), #054c3f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0, 230, 118, 0.3)',
              flexShrink: 0
            }}>
              <Sparkles style={{ width: '20px', height: '20px', color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                  COIN<span style={{ color: 'var(--wa-green-light)' }}>MITRA</span>
                </span>
                <span className="brand-version" style={{ fontSize: '0.6rem', background: 'rgba(0,168,132,0.2)', color: 'var(--wa-green-light)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                  v2.0
                </span>
              </div>
              <span className="brand-subtext" style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block', marginTop: '-2px' }}>
                WhatsApp Earning Engine
              </span>
            </div>
          </div>

          {/* Desktop Nav Tabs (Hidden on Mobile < 768px) */}
          <nav className="desktop-tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.8rem',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(0, 168, 132, 0.15)' : 'transparent',
                    color: isActive ? 'var(--wa-green-light)' : 'var(--text-sub)',
                    border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid transparent',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon style={{ width: '16px', height: '16px' }} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize: '0.6rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Header Area: Balance & Admin Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            
            {/* Coin Balance Chip */}
            <div 
              onClick={() => setActiveTab('wallet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.35rem 0.65rem',
                borderRadius: '18px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <Coins style={{ width: '16px', height: '16px', color: '#fbbf24', flexShrink: 0 }} />
              <span style={{ fontWeight: 800, color: '#ffffff' }}>
                {coinBalance.toLocaleString()}
              </span>
              <span style={{ color: 'var(--wa-green-light)', fontWeight: 600, fontSize: '0.75rem' }}>
                (₹{balanceInRupees})
              </span>
            </div>

            {/* Admin Console Trigger */}
            <button
              onClick={onOpenAdmin}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-sub)',
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                flexShrink: 0
              }}
            >
              <Settings style={{ width: '15px', height: '15px' }} />
              Admin
            </button>

            {userSession && (
              <button
                onClick={onLogout}
                title="Logout"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '0.4rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <LogOut style={{ width: '15px', height: '15px' }} />
              </button>
            )}

          </div>

        </div>
      </header>

      {/* Bottom Mobile Navigation Bar (Active on Mobile < 768px) */}
      <div className="mobile-nav-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon style={{ width: '20px', height: '20px' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
