require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = 3000;

// Telegram
const bot = new Telegraf(process.env.TG_BOT_TOKEN);
const CHAT_ID = process.env.TG_CHAT_ID;

// Helpers for Telegram formatting
function escMd(s = '') {
  // Escape MarkdownV2 special chars so message won't break
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function short(s, n = 120) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Quick test endpoint to verify TG works
app.get('/tg-test', async (req, res) => {
  try {
    await bot.telegram.sendMessage(CHAT_ID, '✅ TG test message. Server is working.');
    res.send('ok');
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Middleware
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Submit endpoint
app.post('/api/submit', async (req, res) => {
  const { name, email, consent, client } = req.body ?? {};

  if (!consent) return res.status(400).json({ ok: false, error: 'Consent required' });
  if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ ok: false, error: 'Bad name' });
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Bad email' });

  const xff = req.headers['x-forwarded-for']?.toString();
  const ipFromXff = xff ? xff.split(',')[0].trim() : null;
  const remoteAddress = req.socket.remoteAddress || null;

  const entry = {
    serverTime: new Date().toISOString(),

    form: {
      name: name.trim(),
      email: email.trim(),
      consent: true,
    },

    request: {
      method: req.method,
      path: req.path,
      host: req.headers.host || null,
      ip: ipFromXff || remoteAddress,
      ipFromXForwardedFor: ipFromXff,
      remoteAddress,
      referer: req.headers.referer || null,
      acceptLanguage: req.headers['accept-language'] || null,
      cfCountry: req.headers['cf-ipcountry'] || null,
    },

    client: (client && typeof client === 'object') ? client : null,

    headersSubset: {
      userAgent: req.get('user-agent') || null,
      accept: req.headers.accept || null,
      secFetchSite: req.headers['sec-fetch-site'] || null,
      secFetchMode: req.headers['sec-fetch-mode'] || null,
    },
  };

  
  fs.appendFileSync(
    path.join(__dirname, 'submissions.ndjson'),
    JSON.stringify(entry) + '\n',
    'utf8'
  );

 /* *Method:* ${escMd(entry.request.method)}
  *Path:* ${escMd(entry.request.path)}*/

  
  const msg =
`✅ *New submission*
 🕒 *Server time:* ${escMd(entry.serverTime)}

 👤 *Name:* ${escMd(short(entry.form.name, 60))}
 📧 *Email:* ${escMd(short(entry.form.email, 80))}

 🌐 *Request*
 • *Host:* ${escMd(entry.request.host || '-')}

 📍 *IP:* ${escMd(entry.request.ip || '-')}
 🗣 *Lang:* ${escMd((entry.request.acceptLanguage || '').split(',')[0] || '-')}

 🧭 *Ref:* ${escMd(short(entry.request.referer || '-', 120))}
 *UA:* ${escMd(short(entry.headersSubset.userAgent || '-', 120))}`;

  try {
    await bot.telegram.sendMessage(CHAT_ID, msg, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.log('TG send error:', e.message);
  }

  return res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
  console.log('server running on http://localhost:' + PORT);
});
