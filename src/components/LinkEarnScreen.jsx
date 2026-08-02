// src/components/LinkEarnScreen.jsx - The Core WhatsApp Link & Earn Page
import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  KeyRound, 
  Copy, 
  Check, 
  ExternalLink, 
  Radio, 
  Clock, 
  RefreshCw
} from 'lucide-react';
import BotTerminal from './BotTerminal';

export default function LinkEarnScreen({ 
  session, 
  logs, 
  onConnect, 
  onConfirmPairing, 
  loading,
  botStatus = 'DISCONNECTED',
  livePairingCode
}) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3-minute pairing code timer
  const [showModeModal, setShowModeModal] = useState(false);

  // Format 8-char pairing code (from session, prop, or fallback)
  const pairingCode = session?.pairingCode || livePairingCode || 'ABCD-1234';
  const isConnected = botStatus === 'CONNECTED' || botStatus === 'COMPLETED';
  const isSyncing = botStatus === 'SYNCING';
  const isConnecting = botStatus === 'CONNECTING' || botStatus === 'AWAITING_PAIRING';

  // Timer countdown
  useEffect(() => {
    if (!pairingCode || pairingCode === 'ABCD-1234') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingCode]);

  const handleGenerateCode = (e) => {
    e.preventDefault();
    if (!phoneRaw || phoneRaw.length < 7) {
      alert('Please enter a valid phone number with country code');
      return;
    }
    setShowModeModal(true);
  };

  const handleModeSelection = (selectedMode) => {
    setShowModeModal(false);
    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`;
    onConnect(fullPhone, selectedMode);
    setTimeLeft(180);
  };

  const handleCopyAndOpenWhatsApp = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    window.open('https://web.whatsapp.com', '_blank');
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderStatusBadge = () => {
    if (isSyncing) {
      return (
        <div className="status-badge-active" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
          <div className="pulsing-dot" style={{ backgroundColor: '#fbbf24', boxShadow: '0 0 10px #fbbf24' }} />
          <span>⚡ Auto-Following Channels</span>
        </div>
      );
    }
    if (isConnecting) {
      return (
        <div className="status-badge-active" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
          <div className="pulsing-dot" style={{ backgroundColor: '#fbbf24', boxShadow: '0 0 10px #fbbf24' }} />
          <span>🟡 Awaiting Code Input...</span>
        </div>
      );
    }
    if (isConnected) {
      return (
        <div className="status-badge-active">
          <div className="pulsing-dot" />
          <span>🟢 Connected & Earning</span>
        </div>
      );
    }
    return (
      <div className="status-badge-disconnected">
        <div className="pulsing-dot-red" />
        <span>🔴 Disconnected</span>
      </div>
    );
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

          {renderStatusBadge()}
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

        {/* Pairing Code Display Box */}
        {(session || livePairingCode) && (
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
          </div>
        )}

      </div>

      {/* Terminal Log Output Window */}
      <BotTerminal logs={logs} isConnected={isConnected} />

      {/* Connection Mode Selection Modal */}
      {showModeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0b141a', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', position: 'relative' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>
              Select Operation Mode
            </h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              How do you want CoinMitra to complete tasks for you?
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={() => handleModeSelection('automatic')}
                style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid #00e676', borderRadius: '12px', padding: '1rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 230, 118, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 230, 118, 0.1)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00e676', fontWeight: 700, marginBottom: '0.3rem' }}>
                  <Radio size={18} /> Automatic Mode
                </div>
                <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>Bot will automatically join channels and verify tasks for you in the background.</div>
              </button>
              
              <button 
                onClick={() => handleModeSelection('manual')}
                style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #fbbf24', borderRadius: '12px', padding: '1rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.3rem' }}>
                  <Smartphone size={18} /> Manual Mode
                </div>
                <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>You will manually click 'Follow Channel' and 'Verify' for each task. Safer for strict accounts.</div>
              </button>
            </div>
            
            <button 
              onClick={() => setShowModeModal(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', width: '100%', marginTop: '1.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
