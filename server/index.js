// server/index.js - Production-Ready Multi-User Engine with Automated Task Queue & 60-80s Anti-Ban Matrix
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import { db } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Supabase JS Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fjftdgngdbrbvauqqgge.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnRkZ25nZGJyYnZhdXFxZ2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDI3OTksImV4cCI6MjEwMDk3ODc5OX0.wOO4CSBRNbe_bVXk9saWhiHnqH_CbHazucp4kL3bERs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Global Map for Multi-User Sessions
// Key: userId -> { sock, phoneNumber, status, pairingCode, followedCount, createdAt }
const activeSessionsMap = new Map();

// Session Directory
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// HELPER FUNCTIONS & ANTI-BAN DELAY MATRIX
// ==========================================
// 60 to 80 Seconds Random Delay Generator (Anti-Ban Protection)
const getRandomDelayMs = () => {
  const minMs = 60000; // 60 seconds
  const maxMs = 80000; // 80 seconds
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

const extractInviteCode = (link) => {
  if (!link) return null;
  const match = link.match(/channel\/([A-Za-z0-9_-]+)/i);
  return match && match[1] ? match[1] : link.split('/').pop().trim();
};

// Fetch Active Tasks from Supabase Database
const fetchActiveTasksFromDB = async () => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error || !tasks || tasks.length === 0) {
      // Fallback to local db.js channel list if table empty
      return db.getChannels().map(c => ({
        task_id: c.id,
        channel_name: c.name,
        channel_link: c.link || c.channel_link,
        coin_reward: 50
      }));
    }
    return tasks;
  } catch (err) {
    return db.getChannels().map(c => ({
      task_id: c.id,
      channel_name: c.name,
      channel_link: c.link || c.channel_link,
      coin_reward: 50
    }));
  }
};

// Credit User Wallet in Supabase Database upon Task Follow Completion
const rewardUserWalletForTask = async (userId, coinReward = 50) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .or(`custom_user_id.eq.${userId},uid.eq.${userId}`)
      .maybeSingle();

    if (user) {
      const newBalance = (user.coin_balance || 0) + coinReward;
      const newTasksCompleted = (user.total_tasks_completed || 0) + 1;

      await supabase
        .from('users')
        .update({
          coin_balance: newBalance,
          total_tasks_completed: newTasksCompleted,
          updated_at: new Date().toISOString()
        })
        .eq('uid', user.uid);

      console.log(`[REWARD] 💰 Credited +${coinReward} coins to ${user.full_name} (${userId}). New Balance: ${newBalance} coins. Tasks Completed: ${newTasksCompleted}`);
    }
  } catch (err) {
    console.error(`[REWARD ERROR] Failed to credit reward to ${userId}:`, err.message);
  }
};

// Update Bot Status in Supabase User Table
const updateBotStatusInDB = async (userId, isConnected) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('uid')
      .or(`custom_user_id.eq.${userId},uid.eq.${userId}`)
      .maybeSingle();

    if (user) {
      await supabase
        .from('users')
        .update({ is_bot_connected: isConnected, updated_at: new Date().toISOString() })
        .eq('uid', user.uid);
    }
  } catch (err) {
    console.error('Error updating bot status in DB:', err.message);
  }
};

// ==========================================
// THE AUTOMATED TASK QUEUE ENGINE (CORE LOGIC)
// ==========================================
const startAutoFollowQueue = async (userId, cleanPhone, sock) => {
  console.log(`[ENGINE] 🚀 Starting Auto-Follow queue for User: ${userId}`);
  
  const session = activeSessionsMap.get(userId);
  if (session) {
    session.status = 'SYNCING';
  }

  try {
    const tasks = await fetchActiveTasksFromDB();
    
    if (tasks.length === 0) {
      console.log(`[ENGINE] No active tasks found in Supabase for User: ${userId}`);
      if (session) session.status = 'CONNECTED';
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const link = task.channel_link || task.link;
      const inviteCode = extractInviteCode(link);
      const coinReward = task.coin_reward || 50;
      
      if (!inviteCode) continue;

      try {
        console.log(`[ENGINE] User ${userId} is following channel "${task.channel_name || inviteCode}"...`);
        
        // Execute WhatsApp Channel Follow Command via Baileys
        if (typeof sock.newsletterSubscribers === 'function') {
          await sock.newsletterSubscribers(inviteCode);
        } else if (typeof sock.newsletterFollow === 'function') {
          await sock.newsletterFollow(inviteCode);
        } else {
          await sock.query({
            tag: 'iq',
            attrs: { to: '@newsletter', type: 'set', xmlns: 'newsletter' },
            content: [{ tag: 'subscribe', attrs: { code: inviteCode } }]
          });
        }
        
        console.log(`[ENGINE] ✅ Successfully followed channel ${i + 1}/${tasks.length} for ${userId}`);
        
        // 💰 Update Supabase Database: Credit coins & increment completed tasks count
        await rewardUserWalletForTask(userId, coinReward);

        if (session) {
          session.followedCount = (session.followedCount || 0) + 1;
        }

      } catch (err) {
        console.error(`[ENGINE] ⚠️ Failed to follow channel ${inviteCode} for ${userId}:`, err.message);
      }

      // 🚨 ANTI-BAN MATRIX: 60-80 Seconds gap before the next task (Unless it's the last task)
      if (i < tasks.length - 1) {
        const delay = getRandomDelayMs();
        console.log(`[ANTI-BAN] ⏳ Waiting ${Math.round(delay / 1000)} seconds before next channel task for ${userId}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`[ENGINE] 🎉 All active tasks completed for User: ${userId}!`);
    if (session) session.status = 'COMPLETED';
    
  } catch (error) {
    console.error(`[ENGINE] Error processing queue for ${userId}:`, error);
    if (session) session.status = 'CONNECTED';
  }
};

// ==========================================
// BAILEYS SOCKET INITIALIZATION
// ==========================================
async function initUserSocket(userId, cleanPhone, isNewPairing = false) {
  const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);

  // 🚨 Close any existing socket for userId to release Windows file locks
  if (activeSessionsMap.has(userId)) {
    try {
      const existing = activeSessionsMap.get(userId);
      if (existing && existing.sock) {
        existing.sock.ev.removeAllListeners();
        if (typeof existing.sock.end === 'function') {
          existing.sock.end(new Error('Resetting socket for fresh pairing'));
        }
      }
    } catch (e) {}
    activeSessionsMap.delete(userId);
    await new Promise(r => setTimeout(r, 300));
  }

  // Clean old corrupted data ONLY if it's a fresh pairing request
  if (isNewPairing && fs.existsSync(sessionDir)) {
    console.log(`[COINMITRA] Wiping session folder for fresh pairing: user_${userId}`);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    } catch (err) {
      console.warn(`[COINMITRA] Warning clearing session folder:`, err.message);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ["Ubuntu", "Chrome", "120.0.6099.109"],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    syncFullHistory: false, // Prevents Infinite Connecting loop
    generateHighQualityLinkPreview: false,
  });

  const sessionEntry = {
    sock,
    phoneNumber: cleanPhone,
    status: 'CONNECTING',
    pairingCode: null,
    followedCount: 0,
    createdAt: new Date().toISOString()
  };
  activeSessionsMap.set(userId, sessionEntry);

  sock.ev.on('creds.update', async () => {
    await saveCreds();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`✅ [COINMITRA] WhatsApp Device Linked & Online for User: ${userId}`);
      activeSessionsMap.set(userId, { 
        sock, 
        status: 'CONNECTED', 
        phoneNumber: cleanPhone, 
        pairingCode: null,
        followedCount: 0 
      });

      // Update Supabase Database
      updateBotStatusInDB(userId, true);
      
      // 🚀 TRIGGER AUTO-FOLLOW QUEUE ENGINE AS SOON AS CONNECTION IS OPEN
      startAutoFollowQueue(userId, cleanPhone, sock);

    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`🔴 [COINMITRA] Session closed for User: ${userId}. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      updateBotStatusInDB(userId, false);

      if (shouldReconnect) {
        setTimeout(() => initUserSocket(userId, cleanPhone, false), 3000);
      } else {
        activeSessionsMap.delete(userId);
        if (fs.existsSync(sessionDir)) {
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
          } catch (e) {}
        }
      }
    }
  });

  return sock;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. GET PAIRING CODE
app.post('/api/get-pairing-code', async (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;

    if (!phoneNumber || !userId) {
      return res.status(400).json({ success: false, error: 'Phone number and User ID required.' });
    }

    let cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    console.log(`[COINMITRA BOT] Initiating fresh pairing for: ${cleanPhone} (User ID: ${userId})`);

    // Force init a fresh socket (isNewPairing = true)
    const sock = await initUserSocket(userId, cleanPhone, true);

    // Timeout safety wrapper to prevent infinite loading in frontend
    const codePromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout_15s_Exceeded')), 15000);
      try {
        console.log(`[DEBUG-1] Waiting 3.5s for WebSocket handshake...`);
        await new Promise(r => setTimeout(r, 3500)); // Delay for handshake stability
        
        console.log(`[DEBUG-2] Requesting pairing code for exact number: ->${cleanPhone}<-`);
        const code = await sock.requestPairingCode(cleanPhone);
        
        console.log(`[DEBUG-3] Meta returned code: ${code}`);
        clearTimeout(timeout);
        resolve(code);
      } catch (err) {
        console.log(`[FATAL BAILEYS ERROR]:`, err); // Catches exact Baileys/Meta error!
        clearTimeout(timeout);
        reject(err);
      }
    });

    const code = await codePromise;
    const formattedCode = code.includes('-') ? code : `${code.substring(0, 4)}-${code.substring(4)}`;

    activeSessionsMap.set(userId, {
      sock,
      pairingCode: formattedCode,
      phoneNumber: cleanPhone,
      status: 'AWAITING_PAIRING',
      followedCount: 0
    });

    console.log(`[COINMITRA BOT] 🔑 Pairing Code Generated: ${formattedCode}`);

    return res.json({
      success: true,
      userId,
      code: formattedCode,
      message: 'Pairing code generated successfully.'
    });

  } catch (error) {
    console.error('Error generating pairing code:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate code. Please click again.'
    });
  }
});

// 2. EXECUTE TASK MANUALLY
app.post('/api/execute-task', async (req, res) => {
  try {
    const { userId, channelLink } = req.body;

    if (!userId || !channelLink) {
      return res.status(400).json({ success: false, error: 'Both userId and channelLink are required.' });
    }

    const sessionEntry = activeSessionsMap.get(userId);

    if (!sessionEntry || !sessionEntry.sock) {
      return res.status(404).json({
        success: false,
        error: `No active WhatsApp connection found for userId: ${userId}.`
      });
    }

    const inviteCode = extractInviteCode(channelLink);
    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invalid WhatsApp Channel link format.' });
    }

    const delayMs = getRandomDelayMs();
    const delaySeconds = Math.round(delayMs / 1000);

    console.log(`[BAN-PROTECTION] ⏳ Queued manual task for userId: ${userId}. Delay: ${delaySeconds}s`);

    res.json({
      success: true,
      userId,
      channelLink,
      inviteCode,
      status: 'QUEUED',
      delaySeconds,
      message: `Task queued safely with Anti-Ban delay matrix (${delaySeconds}s delay).`
    });

    setTimeout(async () => {
      try {
        const sock = sessionEntry.sock;
        if (typeof sock.newsletterSubscribers === 'function') {
          await sock.newsletterSubscribers(inviteCode);
        } else if (typeof sock.newsletterFollow === 'function') {
          await sock.newsletterFollow(inviteCode);
        } else {
          await sock.query({
            tag: 'iq',
            attrs: { to: '@newsletter', type: 'set', xmlns: 'newsletter' },
            content: [{ tag: 'subscribe', attrs: { code: inviteCode } }]
          });
        }
        console.log(`[COINMITRA BOT] 🎉 SUCCESS! User ${userId} followed channel "${inviteCode}"`);
        await rewardUserWalletForTask(userId, 50);
      } catch (execErr) {
        console.error(`[COINMITRA BOT] ⚠️ Manual task failed for userId ${userId}:`, execErr.message);
      }
    }, delayMs);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET BOT STATUS
app.get('/api/bot-status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const sessionEntry = activeSessionsMap.get(userId);
    const isConnected = !!(sessionEntry && (sessionEntry.status === 'CONNECTED' || sessionEntry.status === 'SYNCING'));

    res.json({
      success: true,
      userId,
      isConnected,
      status: sessionEntry ? sessionEntry.status : 'DISCONNECTED',
      pairingCode: sessionEntry ? sessionEntry.pairingCode : null,
      followedCount: sessionEntry ? sessionEntry.followedCount || 0 : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. MULTI-USER STATUS QUERY
app.get('/api/status', (req, res) => {
  try {
    const sessionId = req.query.sessionId || req.query.userId;
    if (!sessionId) {
      return res.json({ 
        success: true, 
        activeSessionsCount: activeSessionsMap.size,
        message: 'CoinMitra Multi-User Auto-Engine active.' 
      });
    }

    const entry = activeSessionsMap.get(sessionId) || activeSessionsMap.get(`user_${sessionId}`);
    if (!entry) {
      return res.json({ success: true, state: 'idle', isConnected: false, message: 'No active session' });
    }

    res.json({
      success: true,
      sessionId,
      state: entry.status,
      isConnected: entry.status === 'CONNECTED' || entry.status === 'SYNCING',
      pairingCode: entry.pairingCode,
      followedCount: entry.followedCount || 0,
      phoneNumber: entry.phoneNumber
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/channels', (req, res) => {
  try {
    const channels = db.getChannels();
    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number required' });

    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const userId = `user_${cleanPhone}`;

    const sock = await initUserSocket(userId, cleanPhone, true);
    const code = await sock.requestPairingCode(cleanPhone);
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4)}`;

    res.json({
      success: true,
      sessionId: userId,
      pairingCode: formattedCode,
      session: { id: userId, phoneNumber: cleanPhone, pairingCode: formattedCode, status: 'AWAITING_PAIRING' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bot: 'CoinMitra Multi-User WhatsApp Engine', 
    activeSessionsCount: activeSessionsMap.size,
    antiBanDelay: '60s - 80s',
    version: '5.0.0-AutoTaskQueue' 
  });
});

// ==========================================
// SERVE VITE FRONTEND IN PRODUCTION & RENDER
// ==========================================
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      status: 'OK',
      bot: 'CoinMitra Multi-User WhatsApp Engine',
      activeSessionsCount: activeSessionsMap.size,
      version: '5.0.0-AutoTaskQueue'
    });
  });
}

// ==========================================
// START SERVER
// ==========================================
const startServer = (portToUse) => {
  const server = app.listen(portToUse, () => {
    console.log(`🚀 CoinMitra Multi-User Auto-Engine is LIVE on http://localhost:${portToUse}`);
    console.log(`⏳ Anti-Ban Logic Active: 60-80s delay between tasks.`);
    console.log(`📂 Multi-User session storage folder: ${SESSIONS_DIR}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${portToUse} is in use, trying port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(PORT);
