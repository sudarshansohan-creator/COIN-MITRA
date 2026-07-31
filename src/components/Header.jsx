// src/components/Header.jsx - CoinMitra Brand Navbar
import React from 'react';
import { Bot, ShieldCheck, Settings, Radio, ExternalLink } from 'lucide-react';

export default function Header({ onOpenAdmin, sessionStatus }) {
  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', borderTop: 'none', padding: '1rem 2rem', marginBottom: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00a884, #00e676)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 230, 118, 0.4)'
          }}>
            <Bot size={28} color="#0b141a" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#ffffff' }}>
                COINMITRA
              </h1>
              <span className="badge badge-official" style={{ fontSize: '0.65rem' }}>
                BOT ENGINE v2.4
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
              WhatsApp Channel Auto-Follow & Subscription Automator
            </p>
          </div>
        </div>

        {/* Live Status & Admin Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <div className={`pulsing-dot ${sessionStatus === 'COMPLETED' ? '' : ''}`} style={{
              backgroundColor: sessionStatus === 'COMPLETED' ? '#00e676' : sessionStatus === 'SYNCING' ? '#f59e0b' : '#64748b'
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {sessionStatus === 'COMPLETED' ? 'BOT ONLINE & SYNCED' : sessionStatus === 'SYNCING' ? 'AUTO-FOLLOWING...' : 'WAITING FOR CONNECTION'}
            </span>
          </div>

          <button 
            onClick={onOpenAdmin}
            className="btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <Settings size={16} />
            Phase 2 Admin Panel
          </button>
        </div>

      </div>
    </header>
  );
}
