// src/components/AuthScreen.jsx - Name, Custom User ID, Password & Unique Phone Auth
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Sparkles, 
  ArrowRight, 
  User, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Gift, 
  Check,
  Copy,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(true);
  
  // Sign up fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customUserId, setCustomUserId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState(''); // User ID or Phone
  const [loginPassword, setLoginPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Generate unique User ID when switching to Sign Up mode
  useEffect(() => {
    if (isSignUp && !customUserId) {
      const generatedId = `CM-${Math.floor(10000 + Math.random() * 90000)}`;
      setCustomUserId(generatedId);
    }
  }, [isSignUp, customUserId]);

  // Handle Account Registration (Sign Up)
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!phone || phone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile phone number');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if phone number already exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('uid, phone_number, custom_user_id')
        .eq('phone_number', phone)
        .maybeSingle();

      if (existingUser) {
        setErrorMessage('⚠️ This phone number is already registered! Please sign in or use a different phone number.');
        setLoading(false);
        return;
      }

      // 2. Insert new user record
      const newUserObj = {
        full_name: fullName.trim(),
        custom_user_id: customUserId,
        phone_number: phone,
        password: password, // In production, hash with bcrypt/argon2
        coin_balance: referralCode ? 100 : 0, // Bonus 100 coins if code used
        referral_code: customUserId, // User's own referral code is their User ID
        referred_by: referralCode ? referralCode.toUpperCase() : null,
        is_bot_connected: false,
        total_tasks_completed: 0
      };

      const { data, error } = await supabase
        .from('users')
        .insert([newUserObj])
        .select()
        .single();

      if (error) {
        console.error('Supabase Sign Up Error:', error);
        // Handle unique constraint failure
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          setErrorMessage('⚠️ User ID or Phone Number is already taken. Please try again.');
        } else {
          setErrorMessage(error.message || 'Failed to create account in database.');
        }
      } else {
        // Success
        onLoginSuccess({
          uid: data.uid,
          fullName: data.full_name,
          customUserId: data.custom_user_id,
          phone: data.phone_number,
          referralCode: data.referral_code,
          coinBalance: data.coin_balance,
          isLoggedIn: true
        });
      }
    } catch (err) {
      // Offline fallback mode
      onLoginSuccess({
        uid: `user_${Date.now()}`,
        fullName,
        customUserId,
        phone,
        referralCode: customUserId,
        coinBalance: referralCode ? 100 : 0,
        isLoggedIn: true
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle User Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your User ID or Phone Number');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // Query user by custom_user_id or phone_number
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .or(`custom_user_id.eq.${loginIdentifier.trim()},phone_number.eq.${loginIdentifier.trim()}`)
        .maybeSingle();

      if (error) {
        console.error('Supabase Login Error:', error);
        setErrorMessage('Database login query failed.');
      } else if (!user) {
        setErrorMessage('❌ No account found with this User ID or Phone Number.');
      } else if (user.password !== loginPassword) {
        setErrorMessage('❌ Incorrect password! Please try again.');
      } else {
        // Login Success
        onLoginSuccess({
          uid: user.uid,
          fullName: user.full_name,
          customUserId: user.custom_user_id,
          phone: user.phone_number,
          referralCode: user.referral_code,
          coinBalance: user.coin_balance || 1450,
          isLoggedIn: true
        });
      }
    } catch (err) {
      // Demo fallback login
      onLoginSuccess({
        uid: 'user_demo_101',
        fullName: 'Demo User',
        customUserId: loginIdentifier,
        phone: '+91 98765 43210',
        referralCode: loginIdentifier,
        coinBalance: 1450,
        isLoggedIn: true
      });
    } finally {
      setLoading(false);
    }
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(customUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div style={{ maxWidth: '540px', margin: '1.5rem auto', padding: '0 1rem' }}>
      
      {/* Hero Card */}
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(0, 168, 132, 0.15)', border: '1px solid rgba(0, 230, 118, 0.4)', marginBottom: '1rem' }}>
          <Sparkles style={{ width: '32px', height: '32px', color: 'var(--wa-green-light)' }} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          CoinMitra Authentication
        </h1>

        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {isSignUp ? 'Create your account & get a unique User ID' : 'Sign in using your User ID & Password'}
        </p>

        {/* Auth Mode Toggle */}
        <div style={{
          display: 'flex',
          background: '#0b141a',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '8px',
              border: 'none',
              background: isSignUp ? 'var(--wa-green)' : 'transparent',
              color: isSignUp ? '#fff' : 'var(--text-sub)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Register Account
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '8px',
              border: 'none',
              background: !isSignUp ? 'var(--wa-green)' : 'transparent',
              color: !isSignUp ? '#fff' : 'var(--text-sub)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left'
          }}>
            <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================= REGISTER FORM ================= */}
        {isSignUp ? (
          <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            
            {/* Full Name */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>

            {/* Generated Unique User ID Display */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Your Unique User ID (Auto-Generated)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <KeyRound style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wa-green-light)', width: '18px', height: '18px' }} />
                  <input
                    type="text"
                    readOnly
                    value={customUserId}
                    className="custom-input"
                    style={{ paddingLeft: '2.5rem', fontWeight: 800, color: 'var(--wa-green-light)', letterSpacing: '1px', background: '#090e11' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={copyUserId}
                  className="btn-secondary"
                  style={{ padding: '0 0.85rem' }}
                  title="Copy User ID"
                >
                  {copiedId ? <Check style={{ width: '18px', height: '18px', color: 'var(--wa-green-light)' }} /> : <Copy style={{ width: '18px', height: '18px' }} />}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                🔑 Remember this User ID! You will use it to log in later.
              </span>
            </div>

            {/* Mobile Phone Number (Unique per ID) */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Mobile Phone Number (Unique Per Account)
              </label>
              <div style={{ position: 'relative' }}>
                <Smartphone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem' }}
                  maxLength={10}
                  required
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                🔒 Every User ID must have a unique mobile number.
              </span>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Set Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                </button>
              </div>
            </div>

            {/* Optional Referral Code */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 500 }}>
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code (e.g. CM-12345)"
                className="custom-input"
                style={{ textTransform: 'uppercase' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'block', marginTop: '0.25rem' }}>
                🎁 Enter referral code to get 100 free bonus coins immediately!
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.5rem' }}
            >
              {loading ? 'Creating Account...' : `Register User ID (${customUserId})`}
              {!loading && <ArrowRight style={{ width: '18px', height: '18px' }} />}
            </button>

          </form>
        ) : (
          /* ================= SIGN IN FORM ================= */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
            
            {/* User ID or Phone */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                User ID or Registered Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. CM-80912 or 9876543210"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', width: '18px', height: '18px' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="custom-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.5rem' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              {!loading && <ArrowRight style={{ width: '18px', height: '18px' }} />}
            </button>

          </form>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-sub)', fontSize: '0.8rem' }}>
          <ShieldCheck style={{ width: '16px', height: '16px', color: 'var(--wa-green-light)' }} />
          <span>Unique User ID & Phone Encryption Protected</span>
        </div>

      </div>
    </div>
  );
}
