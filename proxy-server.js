// proxy-server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = 33210;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// CORS global aktivieren für Browserzugriffe
app.use(cors({ origin: "*", methods: ["GET", "OPTIONS"], allowedHeaders: ["Content-Type"] }));

// Optional: bei TLS-Problemen aktivieren (nur wenn nötig)
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Routinen: Alte Dateien (>24 h) jede Stunde löschen
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return console.error("[Cleanup] Fehler:", err);
    for (const file of files) {
      const fp = path.join(DOWNLOAD_DIR, file);
      fs.stat(fp, (err, stats) => {
        if (!err && stats.mtimeMs < cutoff) {
          fs.unlink(fp, err => {
            if (!err) console.log(`[Cleanup] Lösche: ${file}`);
          });
        }
      });
    }
  });
}, 60 * 60 * 1000);

// Base64-Decodierungs-Handler
async function downloadHandler(req, res) {
  const b64 = req.query.b64;
  const fileName = req.query.name;
  if (!b64 || !fileName) return res.status(400).send("Missing 'b64' or 'name'");

  let targetUrl;
  try {
    targetUrl = Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return res.status(400).send("Invalid base64");
  }

  console.log(`[Proxy] Dekodierte URL: ${targetUrl}`);
  console.log(`[Proxy] Filename: ${fileName}`);

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      console.error(`[Proxy] Fetch-Fehler (${response.status}):`, response.statusText);
      return res.status(502).send("Failed to fetch file");
    }
    const buffer = await response.buffer();
    const fp = path.join(DOWNLOAD_DIR, fileName);
    fs.writeFileSync(fp, buffer);
    console.log(`[Proxy] Gespeichert: ${fileName}`);
    res.sendFile(fp);
  } catch (err) {
    console.error("[Proxy] Fehler:", err);
    res.status(500).send("Internal server error");
  }
}

app.get("/", downloadHandler);
app.get("/download", downloadHandler);

app.listen(PORT, () => {
  console.log(`✅ Proxy läuft auf Port ${PORT}`);
});
