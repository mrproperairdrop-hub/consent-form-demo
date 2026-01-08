const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json({limit: '50kb'}));

app.use (express.static(path.join(__dirname, 'public')));

app.post('/api/submit', (req, res) => {
    const{name, email, consent} = req.body ?? {};

    if (!consent) return res.status(400).json({ok: false, error: 'consent required'});

    if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ok: false, error: 'Bad name'});

    if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ok: false, error: 'Bad email'});

    const entry = {
        recivedAt: new Date().toISOString,
        name: name.trim(),
        email: email.trim(),
        consent: true,
        meta:{
            ip:
                req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
                req.socket.remoteAddress,
            userAgent: req.get('user-agent') || null,
        },
    };

    fs.appendFileSync(path.join(__dirname, 'submissions.ndjson'), JSON.stringify(entry) + '\n', 'utf8');

    return res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log('server running on http://localhost:' + PORT);
});