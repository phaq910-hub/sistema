// WhatsApp Web bridge (Baileys, unofficial). Spawned by the FastAPI backend; listens on 127.0.0.1:WA_PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const pino = require("pino");
const baileys = require("@whiskeysockets/baileys");

const makeWASocket = baileys.default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;
const AUTH = process.env.WA_AUTH_DIR || path.join(__dirname, "auth");
const PORT = Number(process.env.WA_PORT || 8002);

let sock = null;
let status = "disconnected"; // disconnected | connecting | qr | connected
let qr = null;
let me = null;
let lastError = null;
let wanted = false;
let starting = false;

async function start() {
  if (starting || sock) return;
  starting = true;
  wanted = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {}
    status = "connecting";
    qr = null;
    const s = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Techline"),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    sock = s;
    s.ev.on("creds.update", saveCreds);
    s.ev.on("connection.update", async (u) => {
      if (u.qr) {
        qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 });
        lastError = null;
        status = "qr";
      }
      if (u.connection === "open") {
        status = "connected";
        qr = null;
        me = s.user || null;
        lastError = null;
      }
      if (u.connection === "close") {
        const code = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output ? u.lastDisconnect.error.output.statusCode : undefined;
        const wasQr = status === "qr";
        sock = null;
        qr = null;
        lastError = code ? `code ${code}` : null;
        if (code === DisconnectReason.loggedOut) {
          fs.rmSync(AUTH, { recursive: true, force: true });
          wanted = false;
          me = null;
          status = "disconnected";
        } else if (wasQr && code === DisconnectReason.timedOut) {
          wanted = false; // QR expired without being scanned
          status = "disconnected";
          lastError = "QR Code expirou — clique em conectar novamente";
        } else if (wanted) {
          status = "connecting";
          setTimeout(start, 2500);
        } else {
          status = "disconnected";
        }
      }
    });
  } catch (e) {
    lastError = String(e);
    status = "disconnected";
    sock = null;
  } finally {
    starting = false;
  }
}

async function logout() {
  wanted = false;
  try {
    if (sock) await sock.logout();
  } catch {}
  sock = null;
  qr = null;
  me = null;
  status = "disconnected";
  fs.rmSync(AUTH, { recursive: true, force: true });
}

async function send(phone, text) {
  if (status !== "connected" || !sock) throw new Error("WhatsApp não conectado");
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (digits.length < 10) throw new Error("Telefone inválido");
  const results = await sock.onWhatsApp(digits);
  const res = results && results[0];
  if (!res || !res.exists) throw new Error("Número não encontrado no WhatsApp");
  await sock.sendMessage(res.jid, { text });
  return res.jid;
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      if (req.method === "GET" && req.url === "/status") {
        return json(res, 200, { status, qr, me: me ? { id: me.id, name: me.name || null } : null, error: lastError });
      }
      if (req.method === "POST" && req.url === "/connect") {
        await start();
        return json(res, 200, { ok: true, status });
      }
      if (req.method === "POST" && req.url === "/logout") {
        await logout();
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && req.url === "/send") {
        const jid = await send(body.phone, body.text);
        return json(res, 200, { ok: true, jid });
      }
      json(res, 404, { error: "not found" });
    } catch (e) {
      json(res, 400, { error: e.message || String(e) });
    }
  });
});

server.on("error", (e) => {
  console.error("wa server error", e.message);
  process.exit(e.code === "EADDRINUSE" ? 0 : 1);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log("whatsapp bridge on", PORT);
  if (fs.existsSync(path.join(AUTH, "creds.json"))) start(); // resume saved session
});
