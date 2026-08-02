// server/index.js - Production 1-to-N Multi-User Engine with Automated Task Queue & 60-80s Anti-Ban Matrix
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
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://fjftdgngdbrbvauqqgge.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnRkZ25nZGJyYnZhdXFxZ2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDI3OTksImV4cCI6MjEwMDk3ODc5OX0.wOO4CSBRNbe_bVXk9saWhiHnqH_CbHazucp4kL3bERs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Global Map for Multi-User Multi-Device Sessions (1-to-N Architecture)
// Key: sessionId (`${userId}_${cleanPhone}`) -> { sock, sessionId, userId, phoneNumber, status, pairingCode, followedCount, createdAt }
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

// Fetch Active Tasks from Live Supabase Database
const fetchActiveTasksFromDB = async () => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error("[DATABASE] Error fetching active tasks:", error.message);
      return [];
    }

    if (!tasks || tasks.length === 0) {
      console.log("[DATABASE] No active tasks found in Supabase table.");
      return [];
    }

    console.log(`[DATABASE] Successfully fetched ${tasks.length} active task(s) from Supabase panel.`);
    return tasks;
  } catch (err) {
    console.error("[DATABASE] Connection Failed:", err);
    return [];
  }
};

// Credit User Wallet in Supabase Database upon Task Follow Completion
const rewardUserWalletForTask = async (userId, coinReward = 50, taskDescription = 'Reward for completing WhatsApp task') => {
  const cleanPhone = userId.replace(/\D/g, '');
  let query = supabase.from('users').select('*');

  if (cleanPhone && cleanPhone.length >= 10) {
    query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone.ilike.%${cleanPhone.slice(-10)}%`);
  } else {
    query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId}`);
  }

  const { data: user, error: userErr } = await query.maybeSingle();
  if (userErr) throw new Error(`Failed to fetch user: ${userErr.message}`);

  if (user) {
    const newBalance = (user.coin_balance || 0) + coinReward;
    const newTasksCompleted = (user.total_tasks_completed || 0) + 1;

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        coin_balance: newBalance,
        total_tasks_completed: newTasksCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('uid', user.uid);

    if (updateErr) {
      console.error(`[REWARD ERROR] Failed updating balance for ${user.full_name}:`, updateErr.message);
      throw new Error(`Failed to update user wallet: ${updateErr.message}`);
    } else {
      console.log(`[REWARD] 💰 Credited +${coinReward} coins to ${user.full_name} (${user.custom_user_id}). New Balance: ${newBalance} coins.`);
      
      // Log transaction
      await supabase.from('wallet_transactions').insert([{
        user_id: user.uid,
        amount: coinReward,
        transaction_type: 'task_reward',
        description: taskDescription
      }]);
    }
  } else {
    console.warn(`[REWARD WARNING] Could not find user matching ID/phone: ${userId} in Supabase users table.`);
    throw new Error(`User not found in database: ${userId}`);
  }
};

// Update Bot Status in Supabase User Table
const updateBotStatusInDB = async (userId, isConnected) => {
  try {
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('uid');

    if (cleanPhone && cleanPhone.length >= 10) {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone.ilike.%${cleanPhone.slice(-10)}%`);
    } else {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId}`);
    }

    const { data: user } = await query.maybeSingle();

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

// Check if user has already completed this specific channel task
const isTaskCompletedByUser = async (userId, taskId, channelLink) => {
  try {
    let query = supabase.from('user_task_completions').select('id').eq('user_id', userId);
    
    if (taskId) {
      query = query.eq('task_id', taskId);
    } else if (channelLink) {
      query = query.eq('channel_link', channelLink);
    } else {
      return false;
    }

    const { data } = await query.maybeSingle();
    return !!data;
  } catch (err) {
    return false;
  }
};

// Record completion in user_task_completions table & award wallet coins
const recordTaskCompletionAndReward = async (userId, taskId, channelLink, coinReward = 50) => {
  try {
    // 1. Record completion entry in user_task_completions table
    if (taskId || channelLink) {
      const { error } = await supabase.from('user_task_completions').upsert([
        {
          user_id: userId,
          task_id: taskId || null,
          channel_link: channelLink || '',
          coins_awarded: coinReward,
          completed_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id,task_id' });
      if (error) throw new Error(`Failed to save task completion: ${error.message}`);
    }

    // 2. Increment task completed_count in tasks table
    if (taskId) {
      const { data: task } = await supabase.from('tasks').select('completed_count').eq('task_id', taskId).maybeSingle();
      if (task) {
        const { error: tErr } = await supabase.from('tasks').update({ completed_count: (task.completed_count || 0) + 1 }).eq('task_id', taskId);
        if (tErr) console.error("Error updating tasks count:", tErr.message);
      }
    }

    // 3. Credit user wallet
    await rewardUserWalletForTask(userId, coinReward, `Reward for completing task: ${channelLink}`);
  } catch (err) {
    console.error(`[COMPLETION ERROR] Record task failed for ${userId}:`, err.message);
  }
};

// Multi-layer Baileys Newsletter Channel Follow Executor
const executeChannelFollow = async (sock, rawCodeOrLink) => {
  const inviteCode = extractInviteCode(rawCodeOrLink);
  if (!inviteCode) throw new Error('Invalid channel invite link format');

  console.log(`[NEWSLETTER] 📡 Resolving newsletter metadata for code: ${inviteCode}...`);

  let newsletterJid = null;

  // Step 1: Try fetching newsletter metadata by invite code
  try {
    if (typeof sock.newsletterMetadata === 'function') {
      const meta = await sock.newsletterMetadata('invite', inviteCode);
      if (meta && meta.id) {
        newsletterJid = meta.id;
        console.log(`[NEWSLETTER] Found Newsletter JID: ${newsletterJid} for "${meta.name || inviteCode}"`);
      }
    }
  } catch (metaErr) {
    console.warn(`[NEWSLETTER] Metadata fetch note: ${metaErr.message}`);
  }

  const targetId = newsletterJid || (inviteCode.endsWith('@newsletter') ? inviteCode : inviteCode);

  // Step 2: Perform follow using Baileys methods or direct IQ query
  if (typeof sock.newsletterFollow === 'function') {
    return await sock.newsletterFollow(targetId);
  } else if (typeof sock.newsletterSubscribers === 'function') {
    return await sock.newsletterSubscribers(targetId);
  } else {
    return await sock.query({
      tag: 'iq',
      attrs: { to: newsletterJid || '@newsletter', type: 'set', xmlns: 'newsletter' },
      content: [{ tag: 'subscribe', attrs: { code: inviteCode } }]
    });
  }
};

// User Task Modes Cache (auto | manual)
const userTaskModesMap = new Map();

const getUserTaskMode = async (userId) => {
  if (!userId) return 'auto';
  if (userTaskModesMap.has(userId)) {
    return userTaskModesMap.get(userId);
  }
  try {
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('task_mode');
    if (cleanPhone && cleanPhone.length >= 10) {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone.ilike.%${cleanPhone.slice(-10)}%`);
    } else {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId}`);
    }
    const { data } = await query.maybeSingle();
    const mode = data?.task_mode || 'auto';
    userTaskModesMap.set(userId, mode);
    return mode;
  } catch (err) {
    return 'auto';
  }
};

// ==========================================
// THE AUTOMATED TASK QUEUE ENGINE (1-to-N MULTI-DEVICE SUPPORT)
// ==========================================
const startAutoFollowQueue = async (userId, cleanPhone, sock) => {
  const sessionId = `${userId}_${cleanPhone}`;
  console.log(`[ENGINE] 🚀 Checking Task Mode & Auto-Follow queue for User: ${userId} | Phone: ${cleanPhone}`);
  
  const session = activeSessionsMap.get(sessionId);

  // 🚨 CHECK USER TASK MODE (Auto vs Manual)
  const taskMode = await getUserTaskMode(userId);
  if (taskMode === 'manual') {
    console.log(`[ENGINE] 🖐️ User Task Mode is set to MANUAL for User: ${userId}. Skipping auto-follow queue.`);
    if (session) session.status = 'CONNECTED';
    return;
  }

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

    console.log(`[ENGINE] Found ${tasks.length} active channel task(s) to process for User: ${userId}`);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const link = task.channel_link || task.link;
      const inviteCode = extractInviteCode(link);
      const coinReward = task.coin_reward || 50;
      
      if (!inviteCode) continue;

      // 🚨 Deduplication Check: Check if user already completed this task!
      const alreadyDone = await isTaskCompletedByUser(userId, task.task_id, link);
      if (alreadyDone) {
        console.log(`[ENGINE] ⏩ Task "${task.channel_name || inviteCode}" already completed by user ${userId}. Skipping to prevent duplicate coins.`);
        continue;
      }

      try {
        console.log(`[ENGINE] User ${userId} (${cleanPhone}) following channel ${i + 1}/${tasks.length}: "${task.channel_name || inviteCode}"...`);
        
        // Execute Channel Follow via robust executeChannelFollow helper
        await executeChannelFollow(sock, inviteCode);
        
        console.log(`[ENGINE] ✅ Successfully followed channel ${i + 1}/${tasks.length} for User ${userId} (${cleanPhone})!`);
        
        // 💰 Record completion entry and Credit Coins to user wallet in Supabase
        await recordTaskCompletionAndReward(userId, task.task_id, link, coinReward);

        if (session) {
          session.followedCount = (session.followedCount || 0) + 1;
        }

      } catch (err) {
        console.error(`[ENGINE] ⚠️ Failed to follow channel ${inviteCode} for ${userId} (${cleanPhone}):`, err.message);
      }

      // 🚨 ANTI-BAN MATRIX: 60-80 Seconds gap before the next task
      if (i < tasks.length - 1) {
        const delay = getRandomDelayMs();
        console.log(`[ANTI-BAN] ⏳ Waiting ${Math.round(delay / 1000)} seconds before next channel task for ${userId} (${cleanPhone})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`[ENGINE] 🎉 All active tasks completed for User: ${userId} (${cleanPhone})!`);
    if (session) session.status = 'COMPLETED';
    
  } catch (error) {
    console.error(`[ENGINE] Error processing queue for ${userId} (${cleanPhone}):`, error);
    if (session) session.status = 'CONNECTED';
  }
};

// ==========================================
// BAILEYS SOCKET INITIALIZATION (1-to-N ARCHITECTURE)
// ==========================================
async function initUserSocket(userId, cleanPhone, isNewPairing = false) {
  // 🔑 Unique Session ID: userId + phoneNumber (1-to-N Architecture)
  const sessionId = `${userId}_${cleanPhone}`;
  const sessionDir = path.join(SESSIONS_DIR, `session_${sessionId}`);

  // 🚨 Close any existing socket for THIS SPECIFIC PHONE NUMBER to release file locks
  if (activeSessionsMap.has(sessionId)) {
    console.log(`[COINMITRA] Re-initiating socket in memory for session: ${sessionId}`);
    try {
      const existing = activeSessionsMap.get(sessionId);
      if (existing && existing.sock) {
        existing.sock.ev.removeAllListeners();
        if (existing.sock.ws && typeof existing.sock.ws.close === 'function') {
          existing.sock.ws.close();
        } else if (typeof existing.sock.end === 'function') {
          existing.sock.end(new Error('Resetting socket for fresh pairing'));
        }
      }
    } catch (e) {}
    activeSessionsMap.delete(sessionId);
    await new Promise(r => setTimeout(r, 500));
  }

  // Clean old corrupted data ONLY if it's a fresh pairing request for this number
  if (isNewPairing && fs.existsSync(sessionDir)) {
    console.log(`[COINMITRA] Wiping specific session folder: ${sessionId}`);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    } catch (err) {
      console.warn(`[COINMITRA] Warning clearing session folder ${sessionId}:`, err.message);
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
    sessionId,
    userId,
    phoneNumber: cleanPhone,
    status: 'CONNECTING',
    pairingCode: null,
    followedCount: 0,
    createdAt: new Date().toISOString()
  };
  activeSessionsMap.set(sessionId, sessionEntry);

  sock.ev.on('creds.update', async () => {
    await saveCreds();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`✅ [COINMITRA] Device Linked for User: ${userId} | Phone: ${cleanPhone}`);
      activeSessionsMap.set(sessionId, { 
        sock, 
        sessionId,
        userId,
        status: 'CONNECTED', 
        phoneNumber: cleanPhone, 
        pairingCode: null,
        followedCount: 0 
      });

      // Update Supabase Database
      updateBotStatusInDB(userId, true);
      
      // 🚀 TRIGGER AUTO-FOLLOW QUEUE ENGINE FOR THIS DEVICE
      startAutoFollowQueue(userId, cleanPhone, sock);

    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`🔴 [COINMITRA] Session closed for User: ${userId} (${cleanPhone}). StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => initUserSocket(userId, cleanPhone, false), 3000);
      } else {
        activeSessionsMap.delete(sessionId);
        if (fs.existsSync(sessionDir)) {
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
          } catch (e) {}
        }

        // Check if user has any other active connected devices
        const userHasOtherConnectedDevices = Array.from(activeSessionsMap.values())
          .some(s => s.userId === userId && s.status === 'CONNECTED');
        updateBotStatusInDB(userId, userHasOtherConnectedDevices);
      }
    }
  });

  return sock;
}

// ==========================================
// REST API ENDPOINTS (1-to-N MULTI-DEVICE SUPPORT)
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

    const sessionId = `${userId}_${cleanPhone}`;
    console.log(`[COINMITRA BOT] Initiating fresh pairing for: ${cleanPhone} (User ID: ${userId} | Session: ${sessionId})`);

    // Force init a fresh socket for this specific phone number (isNewPairing = true)
    const sock = await initUserSocket(userId, cleanPhone, true);

    // Timeout safety wrapper to prevent infinite loading in frontend
    const codePromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout_15s_Exceeded')), 15000);
      try {
        console.log(`[DEBUG-1] Waiting 3.5s for WebSocket handshake...`);
        await new Promise(r => setTimeout(r, 3500));
        
        console.log(`[DEBUG-2] Requesting pairing code for exact number: ->${cleanPhone}<-`);
        const code = await sock.requestPairingCode(cleanPhone);
        
        console.log(`[DEBUG-3] Meta returned code: ${code}`);
        clearTimeout(timeout);
        resolve(code);
      } catch (err) {
        console.log(`[FATAL BAILEYS ERROR]:`, err);
        clearTimeout(timeout);
        reject(err);
      }
    });

    const code = await codePromise;
    const formattedCode = code.includes('-') ? code : `${code.substring(0, 4)}-${code.substring(4)}`;

    activeSessionsMap.set(sessionId, {
      sock,
      sessionId,
      userId,
      pairingCode: formattedCode,
      phoneNumber: cleanPhone,
      status: 'AWAITING_PAIRING',
      followedCount: 0
    });

    console.log(`[COINMITRA BOT] 🔑 Pairing Code Generated: ${formattedCode} for ${cleanPhone}`);

    return res.json({
      success: true,
      userId,
      phoneNumber: cleanPhone,
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
    const { userId, channelLink, phoneNumber } = req.body;

    if (!userId || !channelLink) {
      return res.status(400).json({ success: false, error: 'Both userId and channelLink are required.' });
    }

    // Find active session by sessionId or search user's connected sessions
    let sessionEntry = null;
    if (phoneNumber) {
      let cleanPhone = phoneNumber.toString().replace(/\D/g, '');
      if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
      sessionEntry = activeSessionsMap.get(`${userId}_${cleanPhone}`);
    }

    if (!sessionEntry) {
      sessionEntry = Array.from(activeSessionsMap.values())
        .find(s => s.userId === userId && (s.status === 'CONNECTED' || s.status === 'SYNCING'));
    }

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

    console.log(`[BAN-PROTECTION] ⏳ Queued manual task for userId: ${userId} (${sessionEntry.phoneNumber}). Delay: ${delaySeconds}s`);

    res.json({
      success: true,
      userId,
      phoneNumber: sessionEntry.phoneNumber,
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
        console.log(`[COINMITRA BOT] 🎉 SUCCESS! User ${userId} (${sessionEntry.phoneNumber}) followed channel "${inviteCode}"`);
        await rewardUserWalletForTask(userId, 50);
      } catch (execErr) {
        console.error(`[COINMITRA BOT] ⚠️ Manual task failed for userId ${userId}:`, execErr.message);
      }
    }, delayMs);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2b. UPDATE USER TASK MODE (Auto vs Manual)
app.post('/api/update-mode', async (req, res) => {
  try {
    const { userId, mode } = req.body;
    if (!userId || !mode || !['auto', 'manual'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Valid userId and mode (auto/manual) required.' });
    }

    userTaskModesMap.set(userId, mode);

    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('uid');
    if (cleanPhone && cleanPhone.length >= 10) {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    } else {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId}`);
    }

    const { data: user } = await query.maybeSingle();
    if (user) {
      await supabase.from('users').update({ task_mode: mode }).eq('uid', user.uid);
    }

    console.log(`[USER MODE] 🔄 User ${userId} task mode updated to: ${mode.toUpperCase()}`);

    return res.json({
      success: true,
      userId,
      mode,
      message: `Task mode updated to ${mode === 'auto' ? 'Automatic' : 'Manual'} successfully.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2c. GET USER TASK MODE
app.get('/api/user-mode/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const mode = await getUserTaskMode(userId);
    res.json({ success: true, userId, mode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2d. VERIFY TASK MANUALLY BY CHECKING WHATSAPP CHANNEL MEMBERSHIP
app.post('/api/verify-task', async (req, res) => {
  try {
    const { userId, taskId, channelLink, phoneNumber } = req.body;

    // যদি নম্বর বা আইডি না থাকে
    if (!userId || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'User ID and Phone Number are required.' });
    }

    if (!channelLink) {
      return res.status(400).json({ success: false, error: 'Both userId and channelLink are required.' });
    }

    // 1. Check if user has already completed this task
    const alreadyDone = await isTaskCompletedByUser(userId, taskId, channelLink);
    if (alreadyDone) {
      return res.json({
        success: true,
        verified: true,
        alreadyCompleted: true,
        message: 'Task is already completed and coins have been awarded!'
      });
    }

    // 🚨 [FIX]: cleanPhone তৈরি করা হলো
    let cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

    // ১. ইউজারের চলমান WhatsApp সেশন (socket) খুঁজে বের করা
    let sessionEntry = activeSessionsMap.get(`${userId}_${cleanPhone}`);

    if (!sessionEntry || !sessionEntry.sock) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp bot is not connected. Please link your WhatsApp first.'
      });
    }

    const sock = sessionEntry.sock;
    const inviteCode = extractInviteCode(channelLink);
    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invalid channel link format.' });
    }

    console.log(`[VERIFY] 🔍 Verifying channel membership for user: ${userId} (${sessionEntry.phoneNumber}), Channel: ${inviteCode}...`);

    let isFollowed = false;
    let channelTitle = inviteCode;

    try {
      if (typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode);
        if (meta) {
          channelTitle = meta.name || inviteCode;
          const role = meta.viewer_metadata?.role || meta.role;
          console.log(`[VERIFY] Newsletter metadata retrieved for "${channelTitle}": role=${role}, state=${meta.viewer_metadata?.state || meta.state}`);
          
          if (role === 'SUBSCRIBER' || role === 'ADMIN' || role === 'OWNER' || meta.subscribed === true) {
            isFollowed = true;
          }
        }
      }
    } catch (metaErr) {
      console.warn(`[VERIFY WARNING] Could not fetch newsletter metadata: ${metaErr.message}`);
    }

    // Fallback: Check newsletterSubscribed list if available
    if (!isFollowed) {
      try {
        if (typeof sock.newsletterSubscribed === 'function') {
          const list = await sock.newsletterSubscribed();
          if (Array.isArray(list)) {
            const found = list.find(n => n.invite === inviteCode || n.id?.includes(inviteCode));
            if (found) isFollowed = true;
          }
        }
      } catch (subErr) {}
    }

    if (isFollowed) {
      // Get task reward
      let coinReward = 50;
      if (taskId) {
        const { data: tData } = await supabase.from('tasks').select('coin_reward').eq('task_id', taskId).maybeSingle();
        if (tData && tData.coin_reward) coinReward = tData.coin_reward;
      }

      await recordTaskCompletionAndReward(userId, taskId, channelLink, coinReward);
      console.log(`[VERIFY] 🎉 VERIFIED! User ${userId} is following "${channelTitle}". Awarded ${coinReward} coins!`);

      return res.json({
        success: true,
        verified: true,
        coinsAwarded: coinReward,
        message: `🎉 Verified! You are following "${channelTitle}". +${coinReward} Coins credited to your account.`
      });
    } else {
      console.log(`[VERIFY] ❌ NOT FOLLOWED! User ${userId} has not followed "${channelTitle}" yet.`);

      return res.json({
        success: true,
        verified: false,
        message: `❌ You have not followed "${channelTitle}" yet on WhatsApp. Please click "Follow Channel", join on WhatsApp, and click Verify again!`
      });
    }

  } catch (error) {
    console.error('[VERIFY ERROR]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET BOT STATUS (Multi-Account Aware)
app.get('/api/bot-status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find all sessions registered under this userId
    const userSessions = Array.from(activeSessionsMap.values())
      .filter(s => s.userId === userId || s.sessionId.startsWith(`${userId}_`));

    const connectedSessions = userSessions.filter(s => s.status === 'CONNECTED' || s.status === 'SYNCING');
    const isConnected = connectedSessions.length > 0;

    const latestSession = userSessions[userSessions.length - 1] || null;

    res.json({
      success: true,
      userId,
      isConnected,
      connectedDevicesCount: connectedSessions.length,
      totalDevicesCount: userSessions.length,
      status: isConnected ? 'CONNECTED' : (latestSession ? latestSession.status : 'DISCONNECTED'),
      pairingCode: latestSession ? latestSession.pairingCode : null,
      linkedAccounts: userSessions.map(s => ({
        phoneNumber: s.phoneNumber,
        status: s.status,
        followedCount: s.followedCount || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. MULTI-USER & MULTI-DEVICE STATUS QUERY
app.get('/api/status', (req, res) => {
  try {
    const queryId = req.query.sessionId || req.query.userId;
    if (!queryId) {
      return res.json({ 
        success: true, 
        activeSessionsCount: activeSessionsMap.size,
        message: 'CoinMitra 1-to-N Multi-User Engine active.' 
      });
    }

    // Try exact sessionId match or find all matching userId
    let entry = activeSessionsMap.get(queryId);
    if (!entry) {
      entry = Array.from(activeSessionsMap.values())
        .find(s => s.userId === queryId || s.sessionId.startsWith(`${queryId}_`));
    }

    if (!entry) {
      return res.json({ success: true, state: 'idle', isConnected: false, message: 'No active session' });
    }

    res.json({
      success: true,
      sessionId: entry.sessionId,
      userId: entry.userId,
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

// Admin API: Manual Coin Reward
app.post('/api/admin/manual-reward', async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, error: 'User ID and amount are required.' });
    }

    // Reuse the robust wallet updater
    await rewardUserWalletForTask(userId, parseInt(amount), description || 'Manual Coin Reward by Admin');
    
    res.json({ success: true, message: `Successfully added ${amount} coins to ${userId}.` });
  } catch (error) {
    console.error('Manual Reward Error:', error);
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
    const { phoneNumber, userId: rawUserId } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number required' });

    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const userId = rawUserId || `user_${cleanPhone}`;

    const sock = await initUserSocket(userId, cleanPhone, true);
    const code = await sock.requestPairingCode(cleanPhone);
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4)}`;

    res.json({
      success: true,
      sessionId: `${userId}_${cleanPhone}`,
      pairingCode: formattedCode,
      session: { id: `${userId}_${cleanPhone}`, phoneNumber: cleanPhone, pairingCode: formattedCode, status: 'AWAITING_PAIRING' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bot: 'CoinMitra 1-to-N Multi-User Engine', 
    activeSessionsCount: activeSessionsMap.size,
    antiBanDelay: '60s - 80s',
    version: '6.0.0-1toN-MultiDevice' 
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
      bot: 'CoinMitra 1-to-N Multi-User Engine',
      activeSessionsCount: activeSessionsMap.size,
      version: '6.0.0-1toN-MultiDevice'
    });
  });
}

// ==========================================
// START SERVER
// ==========================================
const startServer = (portToUse) => {
  const server = app.listen(portToUse, () => {
    console.log(`🚀 CoinMitra 1-to-N Multi-User Engine is LIVE on http://localhost:${portToUse}`);
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
