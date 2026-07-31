// src/components/Navbar.jsx - Main Responsive Header & Bottom Mobile Bar
import React from 'react';
import { 
  Sparkles, 
  Home, 
  Radio, 
  Wallet, 
  UserPlus, 
  LogIn, 
  Coins, 
  ShieldCheck, 
  Settings,
  User,
  LogOut
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
  const isConnected = botStatus === 'CONNECTED' || botStatus === 'SYNCING';
  const balanceInRupees = (coinBalance / 20).toFixed(2);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'link', label: 'Link & Earn', icon: Radio, badge: 'CORE' },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'invite', label: 'Invite', icon: UserPlus },
    { id: 'auth', label: 'Auth', icon: LogIn }
  ];

  return (
    <>
      {/* Top Header for Desktop & Tablet */}
      <header style={{
        background: 'rgba(11, 20, 26, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 900,
        padding: '0.85rem 1.5rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          {/* Logo & Brand Name */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--wa-green), #054c3f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0, 230, 118, 0.3)'
            }}>
              <Sparkles style={{ width: '22px', height: '22px', color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                  COIN<span style={{ color: 'var(--wa-green-light)' }}>MITRA</span>
                </span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(0,168,132,0.2)', color: 'var(--wa-green-light)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 700 }}>
                  v2.0
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'block', marginTop: '-2px' }}>
                WhatsApp Earning Engine
              </span>
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          <nav className="desktop-tabs" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    padding: '0.55rem 0.9rem',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(0, 168, 132, 0.15)' : 'transparent',
                    color: isActive ? 'var(--wa-green-light)' : 'var(--text-sub)',
                    border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid transparent',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <Icon style={{ width: '16px', height: '16px' }} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize: '0.6rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Chip Area: Balance & Admin Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Coin Balance Chip */}
            <div 
              onClick={() => setActiveTab('wallet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                cursor: 'pointer'
              }}
            >
              <Coins style={{ width: '18px', height: '18px', color: '#fbbf24' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                {coinBalance.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--wa-green-light)', fontWeight: 600 }}>
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
                padding: '0.45rem 0.75rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Settings style={{ width: '16px', height: '16px' }} />
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
                  padding: '0.45rem',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                <LogOut style={{ width: '16px', height: '16px' }} />
              </button>
            )}

          </div>

        </div>
      </header>

      {/* Bottom Mobile Navigation Bar */}
      <div className="mobile-nav-bar" style={{ display: 'flex' }}>
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
