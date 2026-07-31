// src/components/BotTerminal.jsx - Live Bot Protocol Terminal Console
import React, { useEffect, useRef } from 'react';
import { Terminal, Shield, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

export default function BotTerminal({ logs = [], onClear, status }) {
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
      
      {/* Terminal Title Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Terminal size={18} className="text-wa-green" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px' }}>
            COINMITRA BOT PROTOCOL TERMINAL
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: status === 'SYNCING' ? '#f59e0b' : status === 'COMPLETED' ? '#00e676' : 'var(--text-sub)'
          }}>
            {status === 'SYNCING' ? '⚡ EXECUTION IN PROGRESS' : status === 'COMPLETED' ? '✔ SESSION SYNCHRONIZED' : 'READY'}
          </span>

          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem'
            }}
            title="Clear logs"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Terminal Code Window */}
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
          </div>
          <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>
            coinmitra-daemon://whatsapp-gateway/v2.4
          </div>
        </div>

        <div className="terminal-body" ref={terminalBodyRef}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
              [COINMITRA ENGINE] Idle. Enter WhatsApp phone number above to initiate pairing stream...
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id || Math.random()} style={{ display: 'flex', gap: '0.75rem', lineHeight: '1.4' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{log.timestamp}]</span>
                <span className={`log-${log.type || 'info'}`}>{log.message}</span>
              </div>
            ))
          )}

          {status === 'SYNCING' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginTop: '0.25rem' }}>
              <RefreshCw size={14} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />
              <span>[RUNNING] Subscribing next channel in queue...</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
