// src/components/PhoneForm.jsx - Phone Input with International Country Selector
import React, { useState } from 'react';
import { Phone, ShieldCheck, Zap, ArrowRight, Lock } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+1', name: 'USA / Canada', flag: '🇺🇸' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' }
];

export default function PhoneForm({ onConnect, loading }) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanNum = phoneNumber.replace(/\D/g, '');
    if (!cleanNum || cleanNum.length < 7) {
      setError('Please enter a valid phone number (at least 7 digits).');
      return;
    }
    setError('');
    const fullNumber = `${countryCode} ${cleanNum}`;
    onConnect(fullNumber);
  };

  return (
    <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        
        <div style={{
          width: '54px',
          height: '54px',
          margin: '0 auto 1rem',
          borderRadius: '50%',
          background: 'rgba(0, 168, 132, 0.15)',
          border: '1px solid var(--wa-green-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Zap size={28} className="text-wa-green" />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
          Connect <span className="text-wa-green">CoinMitra</span> WhatsApp Bot
        </h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.92rem', marginBottom: '1.75rem' }}>
          Enter your WhatsApp registered phone number to generate an official 8-digit pairing code and start auto-subscribing to targeted channels.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            
            {/* Country Selector */}
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                fontSize: '0.95rem',
                outline: 'none',
                cursor: 'pointer',
                flex: '1 1 120px'
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} ({c.name})
                </option>
              ))}
            </select>

            {/* Phone Number Input */}
            <div style={{ position: 'relative', flex: '3 1 240px' }}>
              <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  border: error ? '1px solid #ef4444' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem 0.85rem 2.75rem',
                  fontSize: '1rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'left' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {loading ? (
              <>Generating CoinMitra Pairing Security Key...</>
            ) : (
              <>
                Connect & Start Auto-Follow <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Lock size={14} />
          <span>End-to-End Encrypted Handshake protocol via CoinMitra Pair Engine</span>
        </div>

      </div>
    </section>
  );
}
