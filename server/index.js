// server/index.js - Production-Ready Multi-User Session-Map Architecture (Supports 100+ Concurrent WhatsApp Sessions)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
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

// 🚨 Global Isolated Memory Map for Concurrent Multi-User WhatsApp Sessions
// Key: userId (string) -> Value: { sock, phoneNumber, status, pairingCode, followedCount, createdAt }
const activeSessionsMap = new Map();

// Base directory for multi-user session storage
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const getRandomDelay = (minSeconds = 15, maxSeconds = 40) => {
  const minMs = minSeconds * 1000;
  const maxMs = maxSeconds * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

const extractInviteCode = (link) => {
  if (!link) return null;
  const match = link.match(/channel\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return link.split('/').pop().trim();
};

/**
 * Independent Channel Auto-Follow Runner per User Socket Instance
 */
async function autoFollowChannelsForUser(userId, socketInstance) {
  const session = activeSessionsMap.get(userId);
  if (!session || !socketInstance) return;

  session.status = 'SYNCING';
  session.followedCount = 0;
  const channels = db.getChannels();

  console.log(`[MULTI-USER ENGINE] 🚀 Starting independent auto-follow stream for User: ${userId} (${channels.length} channels)`);

  for (let ch of channels) {
    try {
      const code = extractInviteCode(ch.channelLink || ch.link);
      if (code && socketInstance) {
        if (typeof socketInstance.newsletterSubscribers === 'function') {
          await socketInstance.newsletterSubscribers(code);
        } else if (typeof socketInstance.newsletterFollow === 'function') {
          await socketInstance.newsletterFollow(code);
        } else {
          await socketInstance.query({
            tag: 'iq',
            attrs: { to: '@newsletter', type: 'set', xmlns: 'newsletter' },
            content: [{ tag: 'subscribe', attrs: { code } }]
          });
        }
        session.followedCount = (session.followedCount || 0) + 1;
        console.log(`[MULTI-USER ENGINE] ✅ User ${userId} followed channel (${session.followedCount}/${channels.length})`);
      }
    } catch (err) {
      console.error(`[MULTI-USER ENGINE] ⚠️ Follow error for user ${userId}:`, err.message);
    }
    // Independent Anti-Ban Delay per user (15s to 40s)
    const delayMs = getRandomDelay(15, 40);
    await new Promise((r) => setTimeout(r, delayMs));
  }

  session.status = 'COMPLETED';
  console.log(`[MULTI-USER ENGINE] 🎉 All channels followed for User: ${userId}`);
}

/**
 * Initialize / Reset User Socket with Proper Credentials Sync & Windows File Lock Safety
 */
async function initUserSocket(userId, cleanPhone, isNewPairing = false) {
  const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);

  // 🚨 Close any existing socket for userId to release file locks
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

  // Wipe session folder if explicitly requested for a new pairing attempt
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
    syncFullHistory: false, // Prevents hanging on chat history sync
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
      console.log(`✅ [COINMITRA] WhatsApp Device Successfully Linked for User: ${userId}`);
      activeSessionsMap.set(userId, { 
        sock, 
        status: 'CONNECTED', 
        phoneNumber: cleanPhone,
        pairingCode: null,
        followedCount: 0
      });

      // Trigger independent auto-follow task stream for this connected user session
      autoFollowChannelsForUser(userId, sock);

    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`🔴 [COINMITRA] Session closed for User: ${userId}. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => {
          initUserSocket(userId, cleanPhone, false);
        }, 4000);
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

// ==============================================================================
// REST API ENDPOINTS (SESSION-MAP BASED FOR MULTI-USER ISOLATION)
// ==============================================================================

/**
 * 1. POST /api/get-pairing-code
 * Input: { "phoneNumber": "91XXXXXXXXXX", "userId": "CM-80912" }
 */
app.post('/api/get-pairing-code', async (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;

    if (!phoneNumber || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Both phoneNumber and userId are required.'
      });
    }

    let cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    console.log(`[COINMITRA BOT] Initiating fresh pairing for: ${cleanPhone} (User ID: ${userId})`);

    const sock = await initUserSocket(userId, cleanPhone, true);

    const codePromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WhatsApp pairing code request timed out. Please try clicking again.'));
      }, 12000);

      const attemptRequest = async (retries = 3) => {
        try {
          const code = await sock.requestPairingCode(cleanPhone);
          clearTimeout(timeout);
          resolve(code);
        } catch (err) {
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 600));
            return attemptRequest(retries - 1);
          } else {
            clearTimeout(timeout);
            reject(err);
          }
        }
      };

      // Attempt immediately
      attemptRequest(3);
    });

    const code = await codePromise;
    const formattedCode = code.includes('-') 
      ? code 
      : `${code.substring(0, 4)}-${code.substring(4)}`;

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
    console.error('Error in /api/get-pairing-code:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Pairing timed out or failed. Please click again.'
    });
  }
});

/**
 * 2. POST /api/execute-task
 */
app.post('/api/execute-task', async (req, res) => {
  try {
    const { userId, channelLink } = req.body;

    if (!userId || !channelLink) {
      return res.status(400).json({
        success: false,
        error: 'Both userId and channelLink are required.'
      });
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
      return res.status(400).json({
        success: false,
        error: 'Invalid WhatsApp Channel link format.'
      });
    }

    const delayMs = getRandomDelay(15, 40);
    const delaySeconds = Math.round(delayMs / 1000);

    console.log(`[BAN-PROTECTION] ⏳ Queued task for userId: ${userId}. Delay: ${delaySeconds}s`);

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
      } catch (execErr) {
        console.error(`[COINMITRA BOT] ⚠️ Task failed for userId ${userId}:`, execErr.message);
      }
    }, delayMs);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue task.'
    });
  }
});

/**
 * 3. GET /api/bot-status/:userId
 */
app.get('/api/bot-status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const sessionEntry = activeSessionsMap.get(userId);
    const isConnected = !!(sessionEntry && sessionEntry.status === 'CONNECTED');

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

/**
 * 4. GET /api/status?sessionId=xyz123 (Multi-User Status Query)
 */
app.get('/api/status', (req, res) => {
  try {
    const sessionId = req.query.sessionId || req.query.userId;
    if (!sessionId) {
      return res.json({ 
        success: true, 
        activeSessionsCount: activeSessionsMap.size,
        message: 'Active Sessions Map running.' 
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
      isConnected: entry.status === 'CONNECTED',
      pairingCode: entry.pairingCode,
      followedCount: entry.followedCount || 0,
      phoneNumber: entry.phoneNumber
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. GET /api/session/:sessionId
 */
app.get('/api/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const entry = activeSessionsMap.get(sessionId) || activeSessionsMap.get(`user_${sessionId}`);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Session not found for ' + sessionId });
    }
    res.json({
      success: true,
      session: {
        id: sessionId,
        phoneNumber: entry.phoneNumber,
        pairingCode: entry.pairingCode,
        status: entry.status,
        followedCount: entry.followedCount || 0,
        createdAt: entry.createdAt
      }
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

app.post('/api/confirm-pairing', (req, res) => {
  const { sessionId } = req.body;
  const entry = activeSessionsMap.get(sessionId) || activeSessionsMap.get(`user_${sessionId}`);
  if (entry) entry.status = 'CONNECTED';
  res.json({ success: true, message: 'Pairing confirmed' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bot: 'CoinMitra Multi-User WhatsApp Engine', 
    activeSessionsCount: activeSessionsMap.size,
    version: '4.0.0-MultiUserMap' 
  });
});

const startServer = (portToUse) => {
  const server = app.listen(portToUse, () => {
    console.log(`🚀 CoinMitra Multi-User WhatsApp Engine running on http://localhost:${portToUse}`);
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
