// proxy-server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = 33210;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

// Initialisierung
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// CORS global aktivieren
app.use(cors({ origin: "*", methods: ["GET", "OPTIONS"], allowedHeaders: ["Content-Type"] }));

// Optional: Falls TLS-Fehler mit Azure – unsicher, nur bei Bedarf aktivieren
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Aufräumroutine jede Stunde
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return console.error("[Cleanup] Fehler:", err);
    for (const file of files) {
      const fp = path.join(DOWNLOAD_DIR, file);
      fs.stat(fp, (err, stats) => {
        if (!err && stats.mtimeMs < cutoff) {
          fs.unlink(fp, err => {
            if (!err) console.log(`[Cleanup] Alte Datei gelöscht: ${file}`);
          });
        }
      });
    }
  });
}, 60 * 60 * 1000);

// Download-Handler für "/" und "/download"
async function downloadHandler(req, res) {
  try {
    let raw = req.query.url;
    const fileName = req.query.name;
    if (!raw || !fileName) return res.status(400).send("Fehlende Parameter 'url' oder 'name'.");

    // Doppelt-dekodieren
    while (raw.includes("%25")) raw = decodeURIComponent(raw);
    const targetUrl = decodeURIComponent(raw);

    console.log(`[Proxy] Ziel-URL: ${targetUrl}`);
    console.log(`[Proxy] Speicherpfad: ${fileName}`);

    const response = await fetch(targetUrl);
    if (!response.ok) {
      console.error(`[Proxy] Fetch-Fehler (${response.status}): ${response.statusText}`);
      return res.status(502).send("Failed to fetch file.");
    }

    const buffer = await response.buffer();
    const fp = path.join(DOWNLOAD_DIR, fileName);
    fs.writeFileSync(fp, buffer);
    console.log(`[Proxy] Datei gespeichert: ${fileName}`);

    res.sendFile(fp);
  } catch (err) {
    console.error("[Proxy] Unerwarteter Fehler:", err);
    res.status(500).send("Serverfehler.");
  }
}

app.get("/", downloadHandler);
app.get("/download", downloadHandler);

app.listen(PORT, () => {
  console.log(`✅ Proxy läuft auf Port ${PORT}`);
});
