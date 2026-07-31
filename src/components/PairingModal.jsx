// src/components/PairingModal.jsx - Dynamic Pairing Code Modal for CoinMitra
import React, { useState } from 'react';
import { X, Copy, Check, QrCode, ExternalLink, ShieldCheck, Sparkles, Smartphone } from 'lucide-react';

export default function PairingModal({ session, onClose, onConfirm }) {
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(session.pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: '0.25rem'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(0, 168, 132, 0.15)',
            border: '1px solid rgba(0, 230, 118, 0.4)',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            color: 'var(--wa-green-light)',
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '0.75rem'
          }}>
            <Sparkles size={14} /> COINMITRA BOT PAIRING GATEWAY
          </div>
          <h3 style={{ fontSize: '1.4rem', color: '#ffffff', fontWeight: 700 }}>
            WhatsApp Link Code
          </h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Session for <strong style={{ color: 'var(--text-main)' }}>{session.phoneNumber}</strong>
          </p>
        </div>

        {/* 8-Digit Pairing Code Card */}
        <div className="code-display">
          {session.pairingCode}
        </div>

        {/* Copy & WhatsApp Web Action */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleCopy}
            className="btn-secondary"
            style={{ flex: 1, padding: '0.65rem' }}
          >
            {copied ? <Check size={16} color="#00e676" /> : <Copy size={16} />}
            {copied ? 'Code Copied!' : 'Copy Code'}
          </button>
          
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ flex: 1, textDecoration: 'none', padding: '0.65rem' }}
          >
            <ExternalLink size={16} />
            Open WhatsApp Web
          </a>
        </div>

        {/* Visual QR & Step Instructions */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          {/* Simulated QR Code Visual SVG Grid */}
          <div style={{
            width: '84px',
            height: '84px',
            background: '#ffffff',
            padding: '6px',
            borderRadius: '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            flexShrink: 0
          }}>
            {Array.from({ length: 49 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: (i * 7 + 13) % 3 === 0 || (i % 8 === 0) ? '#0b141a' : '#00a884',
                  borderRadius: '1px'
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
            <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Smartphone size={14} className="text-wa-green" /> How to pair on your phone:
            </div>
            <ol style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li>Open WhatsApp on phone</li>
              <li>Go to <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
              <li>Tap <strong>Link with Phone Number instead</strong> and enter <strong>{session.pairingCode}</strong></li>
            </ol>
          </div>
        </div>

        {/* Confirm Handshake Action */}
        <button
          onClick={onConfirm}
          className="btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
        >
          <ShieldCheck size={18} />
          Confirm Pairing & Auto-Follow Channels
        </button>

      </div>
    </div>
  );
}
