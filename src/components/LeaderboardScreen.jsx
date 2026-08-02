import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Crown, Loader } from 'lucide-react';

export default function LeaderboardScreen({ userSession }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://coin-mitra.onrender.com/api/leaderboard/daily');
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderRankIcon = (rank) => {
    if (rank === 1) return <Crown size={24} style={{ color: '#F59E0B' }} />;
    if (rank === 2) return <Medal size={24} style={{ color: '#94A3B8' }} />;
    if (rank === 3) return <Award size={24} style={{ color: '#D97706' }} />;
    return <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{rank}</div>;
  };

  return (
    <div className="fade-in" style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.05) 100%)',
          marginBottom: '1rem',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          <Trophy size={32} style={{ color: '#F59E0B' }} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>Daily Leaderboard</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Top earners of the day! Rankings reset every night.
          <br/>The Top 3 users get huge bonus coins!
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Loader size={32} className="spin" style={{ marginBottom: '1rem' }} />
          <span>Fetching ranks...</span>
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😴</div>
          <h3 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>No earnings yet!</h3>
          <p style={{ color: 'var(--text-sub)' }}>Be the first to complete tasks today and claim the #1 spot.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {leaderboard.map((user) => {
            const isMe = userSession && (user.user_id === userSession.uid || user.user_id === userSession.customUserId);
            
            return (
              <div 
                key={user.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  background: isMe ? 'rgba(0, 168, 132, 0.08)' : 'var(--bg-card)',
                  border: isMe ? '1px solid var(--wa-green-light)' : '1px solid var(--border-color)',
                  borderRadius: '16px',
                  boxShadow: user.rank <= 3 ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                  transition: 'transform 0.2s ease',
                  transform: 'translateY(0)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                    {renderRankIcon(user.rank)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: isMe ? 'var(--wa-green-light)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.name}
                      {isMe && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--wa-green)', color: '#000', borderRadius: '12px' }}>YOU</span>}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {user.user_id.substring(0, 8)}...</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F59E0B' }}>
                    {user.amount}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 600 }}>COINS</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
