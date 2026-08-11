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
const rewardUserWalletForTask = async (userId, coinReward = 50, taskDescription = 'Reward for completing WhatsApp task', taskId = null) => {
  const safeUserId = String(userId);
  const cleanPhone = safeUserId.replace(/\D/g, '');
  let query = supabase.from('users').select('*, daily_earnings');
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safeUserId);
  let orConditions = [`custom_user_id.eq.${safeUserId}`];
  if (isUUID) orConditions.push(`uid.eq.${safeUserId}`);
  if (cleanPhone && cleanPhone.length >= 10) orConditions.push(`phone_number.ilike.%${cleanPhone.slice(-10)}%`);
  
  query = query.or(orConditions.join(','));

  const { data: user, error: userErr } = await query.maybeSingle();
  if (userErr) throw new Error(`Failed to fetch user: ${userErr.message}`);

  if (user) {
    const newBalance = parseFloat(user.coin_balance || 0) + parseFloat(coinReward);
    const newTasksCompleted = parseInt(user.total_tasks_completed || 0) + 1;

    // --- Streak Logic ---
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date());
    
    let currentStreak = user.current_streak || 0;
    let longestStreak = user.longest_streak || 0;
    let lastTaskDate = user.last_task_date;
    let dailyEarnings = parseFloat(user.daily_earnings || 0);

    if (lastTaskDate !== todayStr) {
      if (!lastTaskDate) {
        currentStreak = 1;
      } else {
        const yesterday = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatter.format(yesterday);
        
        if (lastTaskDate === yesterdayStr) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      lastTaskDate = todayStr;
      dailyEarnings = parseFloat(coinReward); // Reset daily earnings
    } else {
      dailyEarnings += parseFloat(coinReward); // Add to existing daily earnings
    }
    // --------------------

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        coin_balance: parseFloat(newBalance.toFixed(2)),
        total_tasks_completed: newTasksCompleted,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_task_date: lastTaskDate,
        daily_earnings: parseFloat(dailyEarnings.toFixed(2)),
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
        description: taskDescription,
        task_id: taskId
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
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone_number.ilike.%${cleanPhone.slice(-10)}%`);
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
    await rewardUserWalletForTask(userId, coinReward, `Reward for completing task: ${channelLink}`, taskId);
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
  if (!userId) return 'manual';
  if (userTaskModesMap.has(userId)) {
    return userTaskModesMap.get(userId);
  }
  try {
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('task_mode');
    if (cleanPhone && cleanPhone.length >= 10) {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId},phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    } else {
      query = query.or(`custom_user_id.eq.${userId},uid.eq.${userId}`);
    }
    const { data } = await query.maybeSingle();
    const mode = data?.task_mode || 'manual';
    userTaskModesMap.set(userId, mode);
    return mode;
  } catch (err) {
    return 'manual';
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
    const { phoneNumber, userId, mode } = req.body;

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
      followedCount: 0,
      mode: mode || 'automatic'
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
        
        let coinReward = 50;
        const { data: tData } = await supabase.from('tasks').select('coin_reward').ilike('channel_link', `%${inviteCode}%`).maybeSingle();
        if (tData && tData.coin_reward) coinReward = tData.coin_reward;

        await rewardUserWalletForTask(userId, coinReward);
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
    const { userId, amount, description, admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized. Admin ID required.' });
    
    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser) return res.status(403).json({ success: false, error: 'Unauthorized. Invalid Admin ID.' });

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

// User API: Auto Sync Missing Rewards on App Load
app.post('/api/user/sync-rewards', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required.' });

    // 0. Robustly find user avoiding UUID cast errors
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('uid, custom_user_id');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let orConditions = [`custom_user_id.eq.${userId}`];
    if (isUUID) orConditions.push(`uid.eq.${userId}`);
    if (cleanPhone && cleanPhone.length >= 10) orConditions.push(`phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    
    query = query.or(orConditions.join(','));
    const { data: userRecord } = await query.maybeSingle();
    
    if (!userRecord) return res.json({ success: true, message: 'User not found in DB.' });
    const userIds = [userRecord.uid];
    if (userRecord.custom_user_id) userIds.push(userRecord.custom_user_id);
    const userIdList = `(${userIds.join(',')})`;

    const { data: completions, error: compErr } = await supabase
      .from('user_task_completions')
      .select('*')
      .filter('user_id', 'in', userIdList);
      
    if (compErr) throw compErr;
    if (!completions || completions.length === 0) {
      return res.json({ success: true, message: 'No completed tasks found.' });
    }

    const { data: transactions, error: transErr } = await supabase
      .from('wallet_transactions')
      .select('*')
      .filter('user_id', 'in', userIdList)
      .eq('transaction_type', 'task_reward');
      
    if (transErr) throw transErr;
    
    let coinsAdded = 0;
    let missingCount = 0;
    const promises = [];

    for (const comp of completions) {
      let hasTransaction = false;
      if (comp.task_id) {
        hasTransaction = transactions?.some(t => t.task_id === comp.task_id);
      } else {
        hasTransaction = transactions?.some(t => t.description && t.description.includes(comp.channel_link));
      }

      if (!hasTransaction) {
        const reward = comp.coins_awarded || 50;
        promises.push(rewardUserWalletForTask(userId, reward, `Reward for completing task: ${comp.channel_link}`, comp.task_id));
        coinsAdded += reward;
        missingCount++;
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    res.json({ success: true, message: `Synced ${missingCount} rewards.` });
  } catch (error) {
    console.error('Auto Sync Rewards Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin API: Sync Missing Rewards
app.post('/api/admin/sync-missing-rewards', async (req, res) => {
  try {
    const { targetUserId, admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized. Admin ID required.' });
    
    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser) return res.status(403).json({ success: false, error: 'Unauthorized. Invalid Admin ID.' });

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Target User ID is required.' });
    }

    // 0. Robustly find user avoiding UUID cast errors
    const cleanPhone = targetUserId.replace(/\D/g, '');
    let query = supabase.from('users').select('uid, custom_user_id');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    let orConditions = [`custom_user_id.eq.${targetUserId}`];
    if (isUUID) orConditions.push(`uid.eq.${targetUserId}`);
    if (cleanPhone && cleanPhone.length >= 10) orConditions.push(`phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    
    query = query.or(orConditions.join(','));
    const { data: userRecord } = await query.maybeSingle();
    
    if (!userRecord) return res.json({ success: false, error: 'Target User not found in DB.' });
    const userIds = [userRecord.uid];
    if (userRecord.custom_user_id) userIds.push(userRecord.custom_user_id);
    const userIdList = `(${userIds.join(',')})`;

    // 1. Get all completions for this user
    const { data: completions, error: compErr } = await supabase
      .from('user_task_completions')
      .select('*')
      .filter('user_id', 'in', userIdList);
      
    if (compErr) throw compErr;
    if (!completions || completions.length === 0) {
      return res.json({ success: true, message: 'No completed tasks found for this user.' });
    }

    // 2. Get all task reward transactions for this user
    const { data: transactions, error: transErr } = await supabase
      .from('wallet_transactions')
      .select('*')
      .filter('user_id', 'in', userIdList)
      .eq('transaction_type', 'task_reward');
      
    if (transErr) throw transErr;
    
    let coinsAdded = 0;
    let missingCount = 0;
    const promises = [];

    // 3. Find completions that don't have a matching transaction
    for (const comp of completions) {
      // Use task_id for accurate matching instead of string matching
      let hasTransaction = false;
      if (comp.task_id) {
        hasTransaction = transactions?.some(t => t.task_id === comp.task_id);
      } else {
        // Fallback for very old completions before task_id was consistently used
        hasTransaction = transactions?.some(t => t.description && t.description.includes(comp.channel_link));
      }

      if (!hasTransaction) {
        const reward = comp.coins_awarded || 50;
        promises.push(rewardUserWalletForTask(targetUserId, reward, `Reward for completing task: ${comp.channel_link}`, comp.task_id));
        coinsAdded += reward;
        missingCount++;
      }
    }

    // Execute all missing rewards concurrently for better performance
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    res.json({ 
      success: true, 
      message: missingCount > 0 
        ? `Successfully synced! Added ${coinsAdded} coins for ${missingCount} missing rewards.` 
        : `All rewards are already synced for this user.`
    });

  } catch (error) {
    console.error('Sync Missing Rewards Error:', error);
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
// MANUAL TASK REQUESTS APIS
// ==========================================

// User API: Request Manual Verification
app.post('/api/request-manual-verify', async (req, res) => {
  try {
    const { userId, taskId, channelLink } = req.body;
    if (!userId || !taskId || !channelLink) {
      return res.status(400).json({ success: false, error: 'User ID, Task ID, and Channel Link are required.' });
    }

    // Check if a request already exists
    const { data: existing, error: existErr } = await supabase
      .from('manual_task_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ success: false, error: 'You already have a pending request for this task.' });
      }
      if (existing.status === 'approved') {
        return res.status(400).json({ success: false, error: 'This task is already approved.' });
      }
      // If rejected, they can try again, so we'll update it to pending
      if (existing.status === 'rejected') {
        await supabase.from('manual_task_requests').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', existing.id);
        return res.json({ success: true, message: 'Re-submitted manual verification request.' });
      }
    }

    const { error: insertErr } = await supabase.from('manual_task_requests').insert([{
      user_id: userId,
      task_id: taskId,
      channel_link: channelLink,
      status: 'pending'
    }]);

    if (insertErr) throw insertErr;

    res.json({ success: true, message: 'Verification request submitted. Admin will review it shortly.' });
  } catch (error) {
    console.error('Request manual verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin API: Fetch Pending Requests
app.get('/api/admin/manual-requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('manual_task_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, requests: data });
  } catch (error) {
    console.error('Fetch manual requests error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin API: Approve Manual Request
app.post('/api/admin/approve-manual-request', async (req, res) => {
  try {
    const { requestId, admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized.' });

    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser) return res.status(403).json({ success: false, error: 'Unauthorized. Invalid Admin ID.' });

    // Fetch Request
    const { data: request, error: reqErr } = await supabase.from('manual_task_requests').select('*').eq('id', requestId).maybeSingle();
    if (reqErr || !request) return res.status(404).json({ success: false, error: 'Request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'Request is no longer pending.' });

    // Update Status
    await supabase.from('manual_task_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', requestId);

    // Get task reward
    let reward = 50;
    if (request.task_id) {
      const { data: tData } = await supabase.from('tasks').select('coin_reward').eq('task_id', request.task_id).maybeSingle();
      if (tData && tData.coin_reward) reward = tData.coin_reward;
    }

    // Reward Wallet & Record Completion
    await rewardUserWalletForTask(request.user_id, reward, `Reward for completing WhatsApp task: ${request.channel_link}`, request.task_id);
    await supabase.from('user_task_completions').upsert([{
      user_id: request.user_id,
      task_id: request.task_id,
      channel_link: request.channel_link,
      coins_awarded: reward,
      completed_at: new Date().toISOString()
    }], { onConflict: 'user_id,task_id' });

    res.json({ success: true, message: 'Request approved and coins awarded.' });
  } catch (error) {
    console.error('Approve manual request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin API: Reject Manual Request
app.post('/api/admin/reject-manual-request', async (req, res) => {
  try {
    const { requestId, admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized.' });

    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser) return res.status(403).json({ success: false, error: 'Unauthorized. Invalid Admin ID.' });

    await supabase.from('manual_task_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId);

    res.json({ success: true, message: 'Request rejected.' });
  } catch (error) {
    console.error('Reject manual request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// LEADERBOARD API (Lazy Evaluated with IST)
// ==========================================
app.get('/api/leaderboard/daily', async (req, res) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date());

    const { data: users, error } = await supabase
      .from('users')
      .select('custom_user_id, full_name, daily_earnings')
      .eq('last_task_date', todayStr)
      .gt('daily_earnings', 0)
      .order('daily_earnings', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      user_id: u.custom_user_id,
      name: u.full_name,
      amount: parseFloat(u.daily_earnings || 0).toFixed(2)
    }));

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Daily leaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leaderboard/streak', async (req, res) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayStr = formatter.format(today);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatter.format(yesterday);

    const { data: users, error } = await supabase
      .from('users')
      .select('custom_user_id, full_name, current_streak')
      .in('last_task_date', [todayStr, yesterdayStr])
      .gt('current_streak', 0)
      .order('current_streak', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      user_id: u.custom_user_id,
      name: u.full_name,
      current_streak: u.current_streak
    }));

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Streak leaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AD TASK VERIFICATION API (With Limits & Locks)
// ==========================================
app.get('/api/ad-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('ad_watch_count, ad_locked_until');
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let orConditions = [`custom_user_id.eq.${userId}`];
    if (isUUID) orConditions.push(`uid.eq.${userId}`);
    if (cleanPhone && cleanPhone.length >= 10) orConditions.push(`phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    
    query = query.or(orConditions.join(','));
    const { data: user, error } = await query.maybeSingle();

    if (error || !user) return res.status(404).json({ success: false, error: 'User not found' });
    
    // Fetch per-ad locks from ad_link_clicks
    const lockTimeLimit = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentClicks } = await supabase
      .from('ad_link_clicks')
      .select('target_link, clicked_at')
      .eq('user_id', userId)
      .gte('clicked_at', lockTimeLimit);

    const adLocks = {};
    if (recentClicks) {
      recentClicks.forEach(click => {
        const lockExpiration = new Date(new Date(click.clicked_at).getTime() + 15 * 60 * 1000).toISOString();
        if (!adLocks[click.target_link] || new Date(lockExpiration) > new Date(adLocks[click.target_link])) {
          adLocks[click.target_link] = lockExpiration;
        }
      });
    }

    res.json({ success: true, adLocks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/verify-ad-click', async (req, res) => {
  try {
    const { userId, targetLink } = req.body;
    if (!userId || !targetLink) {
      return res.status(400).json({ success: false, error: 'Missing userId or targetLink.' });
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Identify user
    const cleanPhone = userId.replace(/\D/g, '');
    let query = supabase.from('users').select('uid, ad_watch_count, ad_locked_until');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let orConditions = [`custom_user_id.eq.${userId}`];
    if (isUUID) orConditions.push(`uid.eq.${userId}`);
    if (cleanPhone && cleanPhone.length >= 10) orConditions.push(`phone_number.ilike.%${cleanPhone.slice(-10)}%`);
    
    const { data: user, error: fetchErr } = await query.or(orConditions.join(',')).maybeSingle();
    if (fetchErr || !user) return res.status(404).json({ success: false, error: 'User not found.' });

    // Check if this specific ad is currently locked
    const lockTimeLimit = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentClick } = await supabase
      .from('ad_link_clicks')
      .select('clicked_at')
      .eq('user_id', userId)
      .eq('target_link', targetLink)
      .eq('ip_address', clientIp)
      .gte('clicked_at', lockTimeLimit)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentClick) {
      return res.status(403).json({ success: false, error: 'This ad is locked for this IP address. Turn Airplane Mode ON/OFF to change IP and unlock instantly!' });
    }

    // 1. Reward the user (0.25 coin for this specific ad task)
    await rewardUserWalletForTask(userId, 0.25, `Ad Link Visit Bonus: ${targetLink}`, null);

    // 2. Track the click in ad_link_clicks table (this implicitly sets the lock for this ad and IP)
    const { error: insertErr } = await supabase.from('ad_link_clicks').insert([{
      user_id: userId,
      target_link: targetLink,
      coins_awarded: 0.25,
      ip_address: clientIp
    }]);

    if (insertErr) {
      console.error('Failed to track ad click in DB:', insertErr);
      throw new Error('Database Error: ad_link_clicks table might be missing. Admin needs to run the SQL script.');
    }

    res.json({ 
      success: true, 
      message: 'Verified! +0.25 Coin added to your wallet.'
    });
  } catch (error) {
    console.error('Verify ad click error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// LEADERBOARD APIs
// ==========================================

// Admin API: Reset Daily Leaderboard
app.post('/api/admin/reset-leaderboard', async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized.' });

    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser) return res.status(403).json({ success: false, error: 'Unauthorized. Invalid Admin ID.' });

    // Update platform_settings
    const { error } = await supabase
      .from('platform_settings')
      .update({ leaderboard_last_reset: new Date().toISOString() })
      .eq('id', 1);

    if (error) throw error;

    res.json({ success: true, message: 'Leaderboard reset successfully!' });
  } catch (error) {
    console.error('Reset leaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Daily Leaderboard
app.get('/api/leaderboard/daily', async (req, res) => {
  try {
    // 🚨 TIMEZONE FIX: Indian Standard Time (IST) অনুযায়ী আজকের তারিখ বের করা
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    const todayStr = formatter.format(new Date()); // Format: YYYY-MM-DD (IST)

    // IST-এর রাত ১২টা থেকে রাত ১১:৫৯ পর্যন্ত টাইম ফ্রেম তৈরি করে UTC-তে কনভার্ট করা (Supabase-এর জন্য)
    const startOfDay = new Date(`${todayStr}T00:00:00+05:30`).toISOString();
    const endOfDay = new Date(`${todayStr}T23:59:59.999+05:30`).toISOString();
    
    // Fetch leaderboard_last_reset from platform_settings
    let actualStartOfDay = startOfDay;
    const { data: settings } = await supabase.from('platform_settings').select('leaderboard_last_reset').eq('id', 1).maybeSingle();
    if (settings && settings.leaderboard_last_reset) {
      const resetTime = new Date(settings.leaderboard_last_reset).getTime();
      const startOfDayTime = new Date(startOfDay).getTime();
      if (resetTime > startOfDayTime) {
        actualStartOfDay = new Date(resetTime).toISOString();
      }
    }

    // Fetch today's transactions for task_reward and referral_bonus
    const { data: txData, error } = await supabase
      .from('wallet_transactions')
      .select('user_id, amount')
      .in('transaction_type', ['task_reward', 'referral_bonus'])
      .gte('created_at', actualStartOfDay) // আপডেট করা টাইম বা রিসেট টাইম
      .lte('created_at', endOfDay);  // আপডেট করা টাইম

    if (error) throw error;

    // Aggregate by user_id
    const userEarnings = {};
    for (const tx of (txData || [])) {
      if (!userEarnings[tx.user_id]) userEarnings[tx.user_id] = 0;
      userEarnings[tx.user_id] += tx.amount;
    }

    // Sort and get top 10
    const sorted = Object.entries(userEarnings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const leaderboard = [];
    for (let i = 0; i < sorted.length; i++) {
      const [user_id, amount] = sorted[i];
      // Try to fetch user name safely
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
      let query = supabase.from('users').select('full_name, phone_number');
      
      let orConditions = [`custom_user_id.eq.${user_id}`];
      if (isUUID) orConditions.push(`uid.eq.${user_id}`);
      
      const { data: userData } = await query.or(orConditions.join(',')).maybeSingle();
      
      let name = userData?.full_name || 'Anonymous User';
      if (name === 'Anonymous User' && userData?.phone_number) {
         name = `User ${userData.phone_number.slice(-4)}`;
      }

      leaderboard.push({
        rank: i + 1,
        user_id,
        name,
        amount
      });
    }

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Streak Leaderboard
app.get('/api/leaderboard/streak', async (req, res) => {
  try {
    // Fetch users ordered by current_streak then longest_streak
    const { data: users, error } = await supabase
      .from('users')
      .select('uid, full_name, phone_number, current_streak, longest_streak')
      .gt('current_streak', 0)
      .order('current_streak', { ascending: false })
      .order('longest_streak', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboard = users.map((u, i) => {
      let name = u.full_name || 'Anonymous User';
      if (name === 'Anonymous User' && u.phone_number) {
        name = `User ${u.phone_number.slice(-4)}`;
      }
      return {
        rank: i + 1,
        user_id: u.uid,
        name,
        current_streak: u.current_streak,
        longest_streak: u.longest_streak
      };
    });

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error('Streak leaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API: Distribute Leaderboard Rewards
app.post('/api/admin/distribute-leaderboard-rewards', async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(403).json({ success: false, error: 'Unauthorized.' });

    // Verify Admin
    const { data: adminUser } = await supabase.from('admin_users').select('admin_id').eq('admin_id', admin_id).maybeSingle();
    if (!adminUser && admin_id !== 'ADMIN-COINMITRA') return res.status(403).json({ success: false, error: 'Unauthorized.' });

    // Fetch settings for bonuses
    const { data: settings } = await supabase.from('platform_settings').select('rank1_bonus, rank2_bonus, rank3_bonus').eq('id', 1).single();
    const bonuses = [
      settings?.rank1_bonus || 1000,
      settings?.rank2_bonus || 500,
      settings?.rank3_bonus || 200
    ];

    // Fetch leaderboard
    // 🚨 TIMEZONE FIX: Indian Standard Time (IST)
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    const todayStr = formatter.format(new Date()); 
    const startOfDay = new Date(`${todayStr}T00:00:00+05:30`).toISOString();
    const endOfDay = new Date(`${todayStr}T23:59:59.999+05:30`).toISOString();

    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('user_id, amount')
      .in('transaction_type', ['task_reward', 'referral_bonus'])
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const userEarnings = {};
    for (const tx of (txData || [])) {
      if (!userEarnings[tx.user_id]) userEarnings[tx.user_id] = 0;
      userEarnings[tx.user_id] += tx.amount;
    }

    const sorted = Object.entries(userEarnings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // top 3 only

    if (sorted.length === 0) {
      return res.json({ success: false, error: 'No earnings recorded today. Cannot distribute rewards.' });
    }

    let distributedCount = 0;
    for (let i = 0; i < sorted.length; i++) {
      const [user_id] = sorted[i];
      const bonus = bonuses[i];
      if (bonus > 0) {
        await rewardUserWalletForTask(user_id, bonus, `Daily Leaderboard Bonus (Rank ${i + 1})`, null);
        distributedCount++;
      }
    }

    res.json({ success: true, message: `Successfully distributed leaderboard rewards to top ${distributedCount} users!` });
  } catch (err) {
    console.error('Distribute leaderboard rewards error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// VITE SPA FALLBACK
// ==========================================
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
