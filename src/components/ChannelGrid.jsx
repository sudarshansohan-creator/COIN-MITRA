// src/components/ChannelGrid.jsx - Targeted WhatsApp Channels Directory
import React, { useState } from 'react';
import { 
  TrendingUp, Cpu, Code, DollarSign, ShieldAlert, Radio, 
  CheckCircle, Clock, ExternalLink, Search, Sparkles, Filter 
} from 'lucide-react';

const ICON_MAP = {
  TrendingUp,
  Cpu,
  Code,
  DollarSign,
  ShieldAlert,
  Radio
};

export default function ChannelGrid({ channels = [], subscriptions = {}, isSyncing, onSyncSingle }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', ...new Set(channels.map(c => c.category))];

  const filteredChannels = channels.filter(ch => {
    const matchesCat = selectedCategory === 'All' || ch.category === selectedCategory;
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ch.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ch.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <section className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      
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
            CoinMitra automatically queues and subscribes your connected WhatsApp account to these verified channels.
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
          const isSubscribed = Boolean(subscriptions[channel.id]?.subscribed || channel.subscribed);

          return (
            <div
              key={channel.id}
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
                        {channel.name}
                      </h4>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontFamily: 'var(--font-mono)' }}>
                        {channel.handle}
                      </span>
                    </div>
                  </div>

                  {/* Badge */}
                  <span className={`badge badge-${(channel.badge || 'custom').toLowerCase()}`}>
                    {channel.badge || 'Verified'}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.83rem', color: 'var(--text-sub)', marginBottom: '1rem', lineHeight: '1.45' }}>
                  {channel.description}
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
                    👥 {channel.subscribers} followers
                  </div>

                  {/* Status Indicator */}
                  {isSubscribed ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--wa-green-light)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: 'rgba(0, 230, 118, 0.15)',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '20px',
                      border: '1px solid rgba(0, 230, 118, 0.3)'
                    }}>
                      <CheckCircle size={15} /> Subscribed ✔
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
                      <Clock size={15} /> Syncing ⏳
                    </div>
                  ) : (
                    <a
                      href={channel.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', textDecoration: 'none' }}
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
    </section>
  );
}
