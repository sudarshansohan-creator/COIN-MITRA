import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SupportScreen({ userSession }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const userId = userSession?.customUserId || userSession?.uid;

  useEffect(() => {
    if (!userId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('support_messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (data) setMessages(data);
      } catch (err) {
        console.warn('Support table missing');
      }
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`support-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Avoid duplicate if optimistic insert already added it
          setMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // optimistic clear
    
    // Optimistic UI Update
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      user_id: userId,
      sender: 'user',
      message: messageText,
      created_at: new Date().toISOString()
    }]);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          user_id: userId,
          sender: 'user',
          message: messageText
        }])
        .select();

      if (error) {
        throw error;
      } else if (data && data.length > 0) {
        // Replace temp message with real one from DB
        setMessages(prev => prev.map(m => m.id === tempId ? data[0] : m));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove temp message if failed
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('Failed to send message. Have you run the SQL script?');
    }
  };

  return (
    <div style={{
      background: '#090e11',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 200px)',
      minHeight: '500px'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--wa-green), #054c3f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <MessageCircle size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Live Support</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--wa-green-light)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--wa-green-light)', borderRadius: '50%', display: 'inline-block' }}></span>
            Admins are online
          </span>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        padding: '1.5rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        backgroundColor: '#0b141a',
        backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-solid-dark-grey.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'overlay'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span style={{ background: '#182229', color: 'var(--text-sub)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem' }}>
            Today
          </span>
        </div>
        
        <div style={{ background: 'rgba(0, 168, 132, 0.1)', border: '1px solid rgba(0, 168, 132, 0.2)', padding: '0.85rem', borderRadius: '10px', color: 'var(--wa-green-light)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>Welcome to CoinMitra Support! Ask us anything about your tasks, withdrawals, or bot connection. We usually reply within a few minutes.</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-sub)', marginTop: '2rem' }}>Loading messages...</div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  background: isUser ? '#005c4b' : '#202c33',
                  color: '#e9edef',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '12px',
                  borderTopRightRadius: isUser ? '4px' : '12px',
                  borderTopLeftRadius: !isUser ? '4px' : '12px',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {msg.message}
                  <div style={{
                    fontSize: '0.65rem',
                    color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-sub)',
                    textAlign: 'right',
                    marginTop: '0.2rem'
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} style={{
        padding: '1rem',
        background: '#202c33',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-end'
      }}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          style={{
            flex: 1,
            background: '#2a3942',
            border: 'none',
            color: '#fff',
            padding: '0.75rem 1rem',
            borderRadius: '24px',
            fontSize: '0.9rem',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            maxHeight: '100px'
          }}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          style={{
            width: '45px',
            height: '45px',
            borderRadius: '50%',
            background: newMessage.trim() ? 'var(--wa-green)' : '#2a3942',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
            flexShrink: 0
          }}
        >
          <Send size={18} color={newMessage.trim() ? '#000' : 'var(--text-sub)'} style={{ marginLeft: '-2px' }} />
        </button>
      </form>
    </div>
  );
}
