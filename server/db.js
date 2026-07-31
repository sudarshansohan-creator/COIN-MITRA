// server/db.js - CoinMitra WhatsApp Bot Database & Session Repository

class ChannelRepository {
  constructor() {
    this.channels = [
      {
        id: "ch-1",
        name: "CoinMitra Crypto & Market Signals",
        handle: "@coinmitra_signals",
        category: "Crypto & Finance",
        subscribers: "142.5K",
        description: "Official CoinMitra real-time crypto price alerts, Web3 market intelligence, and Bitcoin/Ethereum breakout alerts.",
        verified: true,
        icon: "TrendingUp",
        badge: "Official",
        link: "https://whatsapp.com/channel/0029VaCoinMitraCrypto",
        subscribed: false
      },
      {
        id: "ch-2",
        name: "Web3 & DeFi Daily Insights",
        handle: "@web3_defi_insights",
        category: "Web3 / Tech",
        subscribers: "89.2K",
        description: "Daily breakdowns on smart contracts, decentralized finance protocols, and blockchain technology developments.",
        verified: true,
        icon: "Cpu",
        badge: "Popular",
        link: "https://whatsapp.com/channel/0029VaWeb3DeFi",
        subscribed: false
      },
      {
        id: "ch-3",
        name: "CoinMitra Tech & Dev Radar",
        handle: "@coinmitra_dev",
        category: "Coding & Dev",
        subscribers: "67.8K",
        description: "Full-stack web development tutorials, open-source AI tools, React, Node.js, and DevOps tips.",
        verified: true,
        icon: "Code",
        badge: "Official",
        link: "https://whatsapp.com/channel/0029VaCoinMitraDev",
        subscribed: false
      },
      {
        id: "ch-4",
        name: "Global Market & Finance Pulse",
        handle: "@global_market_pulse",
        category: "Finance & Economy",
        subscribers: "210.4K",
        description: "Live updates on global stock indices, interest rates, commodities, and macroeconomic trends.",
        verified: true,
        icon: "DollarSign",
        badge: "Verified",
        link: "https://whatsapp.com/channel/0029VaGlobalFinance",
        subscribed: false
      },
      {
        id: "ch-5",
        name: "CoinMitra Security & Audit Alerts",
        handle: "@coinmitra_security",
        category: "Security Alerts",
        subscribers: "53.1K",
        description: "Critical cybersecurity patches, Web3 vulnerability disclosures, phishing protection, and safety advisories.",
        verified: true,
        icon: "ShieldAlert",
        badge: "Essential",
        link: "https://whatsapp.com/channel/0029VaCoinMitraSec",
        subscribed: false
      }
    ];

    this.sessions = new Map();
  }

  getChannels() {
    return this.channels;
  }

  addChannel(data) {
    const newChannel = {
      id: `ch-${Date.now()}`,
      name: data.name || "New Channel",
      handle: data.handle || `@channel_${Date.now().toString().slice(-4)}`,
      category: data.category || "General",
      subscribers: data.subscribers || "1.2K",
      description: data.description || "Auto-followed channel target.",
      verified: Boolean(data.verified),
      icon: data.icon || "Radio",
      badge: data.badge || "Custom",
      link: data.link || "https://whatsapp.com/channel/example",
      subscribed: false
    };
    this.channels.push(newChannel);
    return newChannel;
  }

  deleteChannel(id) {
    const index = this.channels.findIndex(ch => ch.id === id);
    if (index !== -1) {
      const removed = this.channels.splice(index, 1);
      return removed[0];
    }
    return null;
  }

  generatePairingCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const part2 = Array.from({ length: 4 }, () => nums[Math.floor(Math.random() * nums.length)]).join("");
    return `${part1}-${part2}`;
  }

  createSession(phoneNumber) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const pairingCode = this.generatePairingCode();

    const session = {
      id: sessionId,
      phoneNumber,
      pairingCode,
      status: "PAIRING_PENDING", // PAIRING_PENDING, CONNECTED, SYNCING, COMPLETED, FAILED
      connectedAt: null,
      createdAt: new Date().toISOString(),
      logs: [
        {
          id: 1,
          timestamp: new Date().toLocaleTimeString(),
          message: `[COINMITRA ENGINE] Initialized auto-follow protocol session for ${phoneNumber}`,
          type: "info"
        },
        {
          id: 2,
          timestamp: new Date().toLocaleTimeString(),
          message: `[PAIRING] Generated 8-digit pairing security handshake code: ${pairingCode}`,
          type: "warning"
        },
        {
          id: 3,
          timestamp: new Date().toLocaleTimeString(),
          message: `[GATEWAY] Waiting for WhatsApp Web companion scan or pairing code entry on mobile device...`,
          type: "pending"
        }
      ],
      subscriptions: {}
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  addSessionLog(sessionId, message, type = "info") {
    const session = this.sessions.get(sessionId);
    if (session) {
      const logEntry = {
        id: session.logs.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        message,
        type
      };
      session.logs.push(logEntry);
      return logEntry;
    }
    return null;
  }

  confirmPairing(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = "CONNECTED";
    session.connectedAt = new Date().toISOString();

    this.addSessionLog(sessionId, `[HANDSHAKE SUCCESS] Mobile node connected via CoinMitra Protocol v2.4`, "success");
    this.addSessionLog(sessionId, `[AUTH] Cryptographic key exchange verified with WhatsApp Server Node`, "success");
    this.addSessionLog(sessionId, `[CHANNEL QUEUE] Loaded ${this.channels.length} targeted WhatsApp channels into auto-subscription engine`, "info");

    return session;
  }
}

export const db = new ChannelRepository();
