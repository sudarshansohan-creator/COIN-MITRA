// src/components/AdminPanel.jsx - Secure Admin Console with Admin Auth & Super Admin Create Admin Feature
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Shield, 
  Radio, 
  Database, 
  ExternalLink, 
  Sparkles, 
  Check, 
  DollarSign, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  Save,
  Coins,
  Lock,
  User,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminPanel({ isOpen, onClose }) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  // Admin Auth Form State
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'payouts' | 'tasks' | 'add_task' | 'create_admin'
  
  // Pricing & Settings State
  const [pricing, setPricing] = useState({
    coins_per_rupee: 20,
    min_withdrawal_coins: 2000,
    min_withdrawal_rupees: 100,
    referral_bonus_referrer: 200,
    referral_bonus_referee: 100,
    default_task_reward: 50
  });

  // Data Collections
  const [withdrawals, setWithdrawals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [adminList, setAdminList] = useState([]);

  // Forms State
  const [taskForm, setTaskForm] = useState({
    channel_name: '',
    channel_link: '',
    target_count: 1000,
    coin_reward: 50
  });

  const [newAdminForm, setNewAdminForm] = useState({
    full_name: '',
    admin_id: '',
    password: '',
    role: 'super_admin'
  });

  const [loading, setLoading] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Check saved Admin Session in SessionStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedAdmin = sessionStorage.getItem('coinmitra_admin_auth');
      if (savedAdmin) {
        const parsed = JSON.parse(savedAdmin);
        if (parsed && parsed.isAdminLoggedIn) {
          setIsAdminLoggedIn(true);
          setAdminUser(parsed);
        }
      }
    } catch (err) {
      console.error('Error reading admin session:', err);
    }
  }, [isOpen]);

  // Fetch Data when Admin Panel opens and Admin is authenticated
  useEffect(() => {
    if (!isOpen || !isAdminLoggedIn) return;

    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Pricing Settings
        const { data: pricingData } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (pricingData) setPricing(pricingData);

        // 2. Fetch Payouts
        const { data: payoutsData } = await supabase
          .from('withdrawals')
          .select('*')
          .order('created_at', { ascending: false });

        if (payoutsData) setWithdrawals(payoutsData);

        // 3. Fetch Tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (tasksData) setTasks(tasksData);

        // 4. Fetch Admin List
        const { data: adminsData } = await supabase
          .from('admin_users')
          .select('id, admin_id, full_name, role, created_at')
          .order('created_at', { ascending: false });

        if (adminsData) setAdminList(adminsData);
      } catch (err) {
        console.error('Admin data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [isOpen, isAdminLoggedIn]);

  if (!isOpen) return null;

  // Handle Admin Login Verification
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!adminIdInput.trim() || !adminPasswordInput.trim()) {
      setAuthError('Please enter Admin User ID and Password');
      setAuthLoading(false);
      return;
    }

    try {
      // Query admin_users table in Supabase
      const { data: adminRecord, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('admin_id', adminIdInput.trim())
        .maybeSingle();

      if (error) {
        console.error('Admin Auth Query Error:', error);
        setAuthError('Database query failed.');
      } else if (!adminRecord) {
        // Hardcoded Master Admin fallback if DB table empty
        if (adminIdInput.trim() === 'ADMIN-COINMITRA' && adminPasswordInput === 'admin123') {
          const sessionObj = {
            admin_id: 'ADMIN-COINMITRA',
            full_name: 'Master Admin Owner',
            role: 'super_admin',
            isAdminLoggedIn: true
          };
          setIsAdminLoggedIn(true);
          setAdminUser(sessionObj);
          sessionStorage.setItem('coinmitra_admin_auth', JSON.stringify(sessionObj));
        } else {
          setAuthError('❌ Invalid Admin User ID or Password.');
        }
      } else if (adminRecord.password !== adminPasswordInput) {
        setAuthError('❌ Incorrect Admin Password.');
      } else {
        // Login Successful
        const sessionObj = {
          admin_id: adminRecord.admin_id,
          full_name: adminRecord.full_name,
          role: adminRecord.role,
          isAdminLoggedIn: true
        };
        setIsAdminLoggedIn(true);
        setAdminUser(sessionObj);
        sessionStorage.setItem('coinmitra_admin_auth', JSON.stringify(sessionObj));
      }
    } catch (err) {
      setAuthError('Error authenticating admin.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('coinmitra_admin_auth');
    setIsAdminLoggedIn(false);
    setAdminUser(null);
  };

  // Create New Admin Account in Supabase
  const handleCreateNewAdmin = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    if (!newAdminForm.admin_id || !newAdminForm.password) return;

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .insert([
          {
            admin_id: newAdminForm.admin_id.trim(),
            password: newAdminForm.password,
            full_name: newAdminForm.full_name.trim() || 'Co-Admin',
            role: newAdminForm.role
          }
        ])
        .select()
        .single();

      if (error) {
        alert('Failed to create new admin: ' + error.message);
      } else {
        setAdminList([data, ...adminList]);
        setSuccessMsg(`✅ New Admin "${newAdminForm.admin_id}" created successfully!`);
        setNewAdminForm({ full_name: '', admin_id: '', password: '', role: 'super_admin' });
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert('Error creating new admin account.');
    }
  };

  // Save Pricing Settings to Supabase
  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert([
          {
            id: 1,
            coins_per_rupee: Number(pricing.coins_per_rupee),
            min_withdrawal_coins: Number(pricing.min_withdrawal_coins),
            min_withdrawal_rupees: Number(pricing.min_withdrawal_rupees),
            referral_bonus_referrer: Number(pricing.referral_bonus_referrer),
            referral_bonus_referee: Number(pricing.referral_bonus_referee),
            default_task_reward: Number(pricing.default_task_reward),
            updated_at: new Date().toISOString()
          }
        ]);

      if (error) {
        alert('Failed to update pricing settings: ' + error.message);
      } else {
        setSuccessMsg('✅ Platform Pricing & Exchange Rates updated successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert('Error updating platform settings.');
    } finally {
      setSavingPricing(false);
    }
  };

  // Update Payout Status (Approve / Reject)
  const handleUpdateWithdrawalStatus = async (requestId, newStatus) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);

      if (!error) {
        setWithdrawals(prev => prev.map(w => w.request_id === requestId ? { ...w, status: newStatus } : w));
      }
    } catch (err) {
      console.error('Update withdrawal status error:', err);
    }
  };

  // Add New Task
  const handleAddTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.channel_name || !taskForm.channel_link) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            channel_name: taskForm.channel_name,
            channel_link: taskForm.channel_link,
            target_count: Number(taskForm.target_count),
            coin_reward: Number(taskForm.coin_reward),
            status: 'active'
          }
        ])
        .select()
        .single();

      if (!error && data) {
        setTasks([data, ...tasks]);
        setSuccessMsg(`Channel "${taskForm.channel_name}" added successfully!`);
        setTaskForm({ channel_name: '', channel_link: '', target_count: 1000, coin_reward: 50 });
        setTimeout(() => { setSuccessMsg(''); setActiveTab('tasks'); }, 1500);
      }
    } catch (err) {
      alert('Failed to add task.');
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('task_id', taskId);
      if (!error) {
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
      }
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Close button */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24'
            }}>
              <Shield size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
                CoinMitra Master Admin Console
              </h3>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                {isAdminLoggedIn ? `Logged in as ${adminUser?.full_name} (${adminUser?.admin_id})` : 'Restricted Access — Admin Authentication Required'}
              </p>
            </div>
          </div>

          {isAdminLoggedIn && (
            <button
              onClick={handleAdminLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <LogOut size={14} /> Exit Admin
            </button>
          )}
        </div>

        {/* ================= ADMIN AUTHENTICATION FORM ================= */}
        {!isAdminLoggedIn ? (
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
            
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: '12px', fontSize: '0.85rem', color: '#fbbf24' }}>
              🔒 <strong>Master Admin Login Required:</strong> Only authorized admins can access platform settings, pricing, and payouts.
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> {authError}
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Admin User ID
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  placeholder="e.g. ADMIN-COINMITRA"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type={showAdminPassword ? "text" : "password"}
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                >
                  {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="btn-gold"
              style={{ padding: '0.9rem', fontSize: '1rem', justifyContent: 'center' }}
            >
              {authLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying Admin Credentials...
                </>
              ) : (
                <>
                  <KeyRound size={18} /> Unlock Admin Console
                </>
              )}
            </button>
          </form>
        ) : (
          /* ================= AUTHENTICATED ADMIN CONSOLE ================= */
          <>
            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('pricing')}
                className={activeTab === 'pricing' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              >
                <DollarSign size={16} /> Pricing & Rates
              </button>

              <button
                onClick={() => setActiveTab('payouts')}
                className={activeTab === 'payouts' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              >
                <Wallet size={16} /> Payout Approvals ({withdrawals.filter(w => w.status === 'pending').length})
              </button>

              <button
                onClick={() => setActiveTab('tasks')}
                className={activeTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              >
                <Radio size={16} /> Manage Tasks ({tasks.length})
              </button>

              <button
                onClick={() => setActiveTab('add_task')}
                className={activeTab === 'add_task' ? 'btn-gold' : 'btn-secondary'}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              >
                <Plus size={16} /> Add Task
              </button>

              <button
                onClick={() => setActiveTab('create_admin')}
                className={activeTab === 'create_admin' ? 'btn-gold' : 'btn-secondary'}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              >
                <UserPlus size={16} /> Create Co-Admin
              </button>
            </div>

            {/* ================= TAB 1: PRICING & RATES CONTROL ================= */}
            {activeTab === 'pricing' && (
              <form onSubmit={handleSavePricing} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {successMsg && (
                  <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid #00e676', color: '#00e676', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                    {successMsg}
                  </div>
                )}

                <div style={{ background: '#090e11', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: 'var(--wa-green-light)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Coins size={18} /> Coin Exchange & Conversion Rate
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        Coins per ₹1 INR (Exchange Rate)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pricing.coins_per_rupee}
                        onChange={(e) => setPricing({ ...pricing, coins_per_rupee: e.target.value })}
                        className="custom-input"
                        required
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                        Current Rule: {pricing.coins_per_rupee} Coins = ₹1 INR
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        Default Task Reward (Coins)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pricing.default_task_reward}
                        onChange={(e) => setPricing({ ...pricing, default_task_reward: e.target.value })}
                        className="custom-input"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: '#090e11', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wallet size={18} /> Withdrawal Threshold Limits
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        Min Withdrawal Coins Threshold
                      </label>
                      <input
                        type="number"
                        min={100}
                        value={pricing.min_withdrawal_coins}
                        onChange={(e) => setPricing({ 
                          ...pricing, 
                          min_withdrawal_coins: e.target.value,
                          min_withdrawal_rupees: Number(e.target.value) / pricing.coins_per_rupee
                        })}
                        className="custom-input"
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        Equivalent Min Withdrawal (₹ INR)
                      </label>
                      <input
                        type="number"
                        value={pricing.min_withdrawal_rupees}
                        readOnly
                        className="custom-input"
                        style={{ background: '#111b21', color: 'var(--wa-green-light)', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: '#090e11', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: '#c084fc', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={18} /> Referral Bonuses & Rewards
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        Referrer Bonus (Coins given on 10 Tasks)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={pricing.referral_bonus_referrer}
                        onChange={(e) => setPricing({ ...pricing, referral_bonus_referrer: e.target.value })}
                        className="custom-input"
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem', display: 'block' }}>
                        New User Signup Bonus (Coins)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={pricing.referral_bonus_referee}
                        onChange={(e) => setPricing({ ...pricing, referral_bonus_referee: e.target.value })}
                        className="custom-input"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPricing}
                  className="btn-gold"
                  style={{ padding: '0.85rem', fontSize: '0.95rem', justifyContent: 'center' }}
                >
                  {savingPricing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> Save Pricing & Global Platform Settings
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ================= TAB 2: PAYOUT APPROVALS ================= */}
            {activeTab === 'payouts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {withdrawals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-sub)' }}>
                    No withdrawal requests found.
                  </div>
                ) : (
                  withdrawals.map((w) => (
                    <div
                      key={w.request_id}
                      style={{
                        background: '#090e11',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                            ₹{w.amount_in_inr} INR
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                            ({w.amount_in_coins || (w.amount_in_inr * 20)} Coins)
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            background: w.status === 'paid' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: w.status === 'paid' ? 'var(--wa-green-light)' : '#fbbf24',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}>
                            {w.status}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginTop: '0.2rem' }}>
                          Target: {w.upi_id} • User ID: {w.user_id ? w.user_id.substring(0, 8) : 'User'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {w.status !== 'paid' && (
                          <button
                            onClick={() => handleUpdateWithdrawalStatus(w.request_id, 'paid')}
                            className="btn-primary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                          >
                            <CheckCircle2 size={14} /> Approve & Pay
                          </button>
                        )}
                        {w.status !== 'rejected' && (
                          <button
                            onClick={() => handleUpdateWithdrawalStatus(w.request_id, 'rejected')}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ================= TAB 3: MANAGE TASKS ================= */}
            {activeTab === 'tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tasks.map((task) => (
                  <div
                    key={task.task_id}
                    style={{
                      background: '#090e11',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <h5 style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600 }}>{task.channel_name}</h5>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                        {task.channel_link} • Reward: {task.coin_reward || 50} Coins
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <a
                        href={task.channel_link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ padding: '0.4rem' }}
                      >
                        <ExternalLink size={14} />
                      </a>

                      <button
                        onClick={() => handleDeleteTask(task.task_id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ================= TAB 4: ADD TASK ================= */}
            {activeTab === 'add_task' && (
              <form onSubmit={handleAddTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {successMsg && (
                  <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid #00e676', color: '#00e676', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                    {successMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>WhatsApp Channel Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CoinMitra VIP Signals"
                    value={taskForm.channel_name}
                    onChange={e => setTaskForm({ ...taskForm, channel_name: e.target.value })}
                    className="custom-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>WhatsApp Channel Link *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://whatsapp.com/channel/..."
                    value={taskForm.channel_link}
                    onChange={e => setTaskForm({ ...taskForm, channel_link: e.target.value })}
                    className="custom-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Target Followers Count</label>
                    <input
                      type="number"
                      required
                      value={taskForm.target_count}
                      onChange={e => setTaskForm({ ...taskForm, target_count: e.target.value })}
                      className="custom-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Coin Reward per Follow</label>
                    <input
                      type="number"
                      required
                      value={taskForm.coin_reward}
                      onChange={e => setTaskForm({ ...taskForm, coin_reward: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', padding: '0.85rem', justifyContent: 'center' }}>
                  <Plus size={16} /> Save Task to Supabase Database
                </button>
              </form>
            )}

            {/* ================= TAB 5: CREATE CO-ADMIN ================= */}
            {activeTab === 'create_admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <form onSubmit={handleCreateNewAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#090e11', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={18} /> Create New Admin Account
                  </h4>

                  {successMsg && (
                    <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid #00e676', color: '#00e676', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                      {successMsg}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Admin Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Co-Admin Manager"
                        value={newAdminForm.full_name}
                        onChange={e => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
                        className="custom-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>New Admin User ID *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ADMIN-MANAGER2"
                        value={newAdminForm.admin_id}
                        onChange={e => setNewAdminForm({ ...newAdminForm, admin_id: e.target.value.toUpperCase() })}
                        className="custom-input"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Set Admin Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Password for new admin"
                      value={newAdminForm.password}
                      onChange={e => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                      className="custom-input"
                    />
                  </div>

                  <button type="submit" className="btn-gold" style={{ padding: '0.85rem', justifyContent: 'center' }}>
                    <UserPlus size={16} /> Create Co-Admin Account in Database
                  </button>
                </form>

                {/* List of Existing Admins */}
                <div>
                  <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Existing System Admins ({adminList.length})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {adminList.map((adm) => (
                      <div
                        key={adm.id || adm.admin_id}
                        style={{
                          background: '#090e11',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{adm.admin_id}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginLeft: '0.5rem' }}>({adm.full_name || 'Admin'})</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                          {adm.role || 'super_admin'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
}
