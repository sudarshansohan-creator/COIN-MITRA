// src/components/LinkEarnScreen.jsx - The Core WhatsApp Link & Earn Page
import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  KeyRound, 
  Copy, 
  Check, 
  ExternalLink, 
  Radio, 
  ShieldAlert, 
  Clock, 
  RefreshCw, 
  Send, 
  Terminal as TerminalIcon 
} from 'lucide-react';
import BotTerminal from './BotTerminal';

export default function LinkEarnScreen({ session, logs, onConnect, onConfirmPairing, loading }) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3-minute pairing code timer

  // Format 8-char pairing code (e.g., ABCD-1234 or session.pairingCode)
  const pairingCode = session?.pairingCode || 'ABCD-1234';
  const isConnected = session?.status === 'CONNECTED';
  const isSyncing = session?.status === 'SYNCING';

  // Timer countdown
  useEffect(() => {
    if (!session?.pairingCode) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.pairingCode]);

  const handleGenerateCode = (e) => {
    e.preventDefault();
    if (!phoneRaw || phoneRaw.length < 7) {
      alert('Please enter a valid phone number with country code');
      return;
    }
    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`;
    onConnect(fullPhone);
    setTimeLeft(180);
  };

  const handleCopyAndOpenWhatsApp = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Deep link to WhatsApp Web linked devices or open alert with guidance
    window.open('https://web.whatsapp.com', '_blank');
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Info */}
      <div className="glass-panel" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--wa-green-light)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>
              <Radio style={{ width: '16px', height: '16px' }} />
              <span>THE CORE PAGE</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Link WhatsApp & Start Earning</h1>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Generate an 8-digit pairing code to securely link your WhatsApp account without QR scanning.
            </p>
          </div>

          <div className={isConnected ? "status-badge-active" : "status-badge-disconnected"}>
            <div className={isConnected ? "pulsing-dot" : "pulsing-dot-red"} />
            <span>{isConnected ? "🟢 Connected & Earning" : "🔴 Not Linked"}</span>
          </div>
        </div>
      </div>

      {/* Main Core Form & Pairing Display Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        
        <form onSubmit={handleGenerateCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>
              Enter WhatsApp Phone Number (with Country Code)
            </label>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {/* Country Code Select */}
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="custom-input"
                style={{ width: '110px', fontWeight: 600 }}
              >
                <option value="+91">🇮🇳 +91 (IN)</option>
                <option value="+880">🇧🇩 +880 (BD)</option>
                <option value="+1">🇺🇸 +1 (US)</option>
                <option value="+44">🇬🇧 +44 (UK)</option>
                <option value="+92">🇵🇰 +92 (PK)</option>
                <option value="+971">🇦🇪 +971 (UAE)</option>
              </select>

              {/* Raw Phone Number Input */}
              <div style={{ flex: 1, position: 'relative' }}>
                <Smartphone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type="tel"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  placeholder="9876543210"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              💡 Example: Select country code +91 and type your 10-digit mobile number.
            </span>
          </div>

          {/* Generate Pairing Code Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0.95rem', fontSize: '1rem', width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                Generating Pairing Code...
              </>
            ) : (
              <>
                <KeyRound style={{ width: '20px', height: '20px' }} />
                Generate Pairing Code
              </>
            )}
          </button>
        </form>

        {/* Pairing Code Display Box (Shown when session exists or generated) */}
        {session && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#090e11',
            borderRadius: '16px',
            border: '1px solid var(--border-highlight)',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
              <Clock style={{ width: '16px', height: '16px', color: '#fbbf24' }} />
              <span>Pairing Code Expires in: <strong style={{ color: '#fbbf24' }}>{formatTimer(timeLeft)}</strong></span>
            </div>

            {/* 8-Character Pairing Code Box */}
            <div className="code-display">
              {pairingCode}
            </div>

            {/* Direct CTA Button: Copy Code & Open WhatsApp Linked Devices */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handleCopyAndOpenWhatsApp}
                className="btn-gold"
                style={{ padding: '1rem', fontSize: '1rem', justifyContent: 'center', width: '100%' }}
              >
                {copied ? (
                  <>
                    <Check style={{ width: '20px', height: '20px' }} />
                    Copied! Opening WhatsApp Linked Devices...
                  </>
                ) : (
                  <>
                    <Copy style={{ width: '20px', height: '20px' }} />
                    Copy Code & Open WhatsApp Linked Devices
                    <ExternalLink style={{ width: '18px', height: '18px' }} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onConfirmPairing}
                className="btn-secondary"
                style={{ padding: '0.75rem', fontSize: '0.9rem', justifyContent: 'center' }}
              >
                I have entered code in WhatsApp → Confirm Connection
              </button>
            </div>

            {/* Step-by-Step Guidance */}
            <div style={{
              marginTop: '1.5rem',
              textAlign: 'left',
              background: 'rgba(0, 168, 132, 0.08)',
              border: '1px solid rgba(0, 230, 118, 0.2)',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '0.85rem'
            }}>
              <strong style={{ color: 'var(--wa-green-light)', display: 'block', marginBottom: '0.5rem' }}>
                📲 How to Link in WhatsApp:
              </strong>
              <ol style={{ paddingLeft: '1.2rem', color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>Open WhatsApp on your phone.</li>
                <li>Tap <strong>Settings (or Menu)</strong> → <strong>Linked Devices</strong>.</li>
                <li>Tap <strong>Link a Device</strong> → Select <strong>Link with phone number instead</strong>.</li>
                <li>Paste or enter the 8-character code: <strong style={{ color: 'var(--text-main)' }}>{pairingCode}</strong></li>
              </ol>
            </div>
          </div>
        )}

      </div>

      {/* Live Bot Terminal Section */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TerminalIcon style={{ width: '20px', height: '20px', color: 'var(--wa-green-light)' }} />
          Live WhatsApp Session Logs
        </h3>
        <BotTerminal logs={logs} status={session?.status} />
      </div>

    </div>
  );
}
