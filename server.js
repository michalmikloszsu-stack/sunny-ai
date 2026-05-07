const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch@2

const app = express();
const PORT = 3000;
const DB_FILE = './database.json';

// --- KONFIGURACJA TWOICH SERWERÓW GROQ ---
const GROQ_SERVERS = {
    "Serwer 1": { key: process.env.GROQ_KEY_1, active: true },
    "Serwer 2": { key: process.env.GROQ_KEY_2, active: true },
    "Serwer 3": { key: process.env.GROQ_KEY_3, active: true },
    "Serwer 4": { key: process.env.GROQ_KEY_4, active: true },
    "Serwer 5": { key: process.env.GROQ_KEY_5, active: true }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], chats: [] }));
function getData() { return JSON.parse(fs.readFileSync(DB_FILE)); }
function saveData(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// Rejestracja
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const data = getData();
    if (data.users.find(u => u.username === username)) return res.status(400).json({ detail: "Użytkownik już istnieje" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), username, password: hashedPassword };
    data.users.push(newUser);
    saveData(data);
    res.json({ user_id: newUser.id, username: newUser.username });
});

// Logowanie
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = getData().users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        return res.json({ user_id: user.id, username: user.username });
    }
    res.status(401).json({ detail: "Błędne dane logowania" });
});

// Czat
app.post('/chat', async (req, res) => {
    const { serverName, prompt, user_id } = req.body;
    const serverCfg = GROQ_SERVERS[serverName];

    if (!serverCfg || !serverCfg.active) {
        return res.status(403).json({ response: "Ten serwer jest obecnie wyłączony przez administratora." });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${serverCfg.key}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                model: "llama-3.3-70b-versatile", 
                messages: [{ role: 'user', content: prompt }] 
            })
        });

        const result = await response.json();
        const ai_res = result.choices[0].message.content;

        const data = getData();
        const entry = { id: Date.now(), user_id: parseInt(user_id), serverName, prompt, response: ai_res };
        data.chats.push(entry);
        saveData(data);
        
        res.json(entry);
    } catch (e) {
        res.status(500).json({ response: "Błąd komunikacji z Groq API." });
    }
});

app.get('/history/:user_id', (req, res) => {
    res.json(getData().chats.filter(c => c.user_id === parseInt(req.params.user_id)));
});

app.listen(PORT, () => console.log(`Sunny AI działa na porcie ${PORT}`));