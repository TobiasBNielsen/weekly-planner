const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const express = require("express");
const compression = require("compression");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, "docs");
const SCHEDULE_FILE = path.join(PUBLIC_DIR, "schedule.json");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "plan123";
const activeTokens = new Set();

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body || {};
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Ugyldige login-oplysninger" });
    }
    const token = crypto.randomUUID();
    activeTokens.add(token);
    res.json({ token });
});

app.post("/api/logout", (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token && activeTokens.has(token)) {
        activeTokens.delete(token);
    }
    res.json({ ok: true });
});

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || !activeTokens.has(token)) {
        return res.status(401).json({ error: "Login kræves" });
    }
    req.token = token;
    return next();
}

app.post("/api/schedule", requireAuth, async (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Ugyldigt dataformat" });
    }
    try {
        await fs.writeFile(SCHEDULE_FILE, JSON.stringify(payload, null, 2), "utf-8");
        res.json({ ok: true });
    } catch (error) {
        console.error("Kunne ikke skrive schedule:", error);
        res.status(500).json({ error: "Kunne ikke gemme skemaet" });
    }
});

app.get("*", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const server = app.listen(PORT, () => {
    console.log(`Ugeplanen kører nu på http://localhost:${PORT}`);
});

module.exports = server;
