// proxy-server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = 33210;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

// Download-Verzeichnis anlegen, falls nicht vorhanden
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// CORS aktivieren für alle Routen
app.use(cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

// Cleanup-Funktion: lösche Dateien älter als 24 Stunden
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return console.error("Cleanup error:", err);
    files.forEach(file => {
      const fp = path.join(DOWNLOAD_DIR, file);
      fs.stat(fp, (err, stats) => {
        if (!err && stats.mtimeMs < cutoff) {
          fs.unlink(fp, err => !err && console.log(`Deleted old file: ${file}`));
        }
      });
    });
  });
}, 60 * 60 * 1000);

// Download-Handler für "/" und "/download"
const downloadHandler = async (req, res) => {
  let rawUrl = req.query.url;
  const fileName = req.query.name;
  if (!rawUrl || !fileName) return res.status(400).send("Missing 'url' or 'name'");

  try {
    // Doppelte Kodierung entfernen
    while (rawUrl.includes("%25")) rawUrl = decodeURIComponent(rawUrl);
    const targetUrl = decodeURIComponent(rawUrl);

    const response = await fetch(targetUrl);
    if (!response.ok) return res.status(502).send("Failed to fetch file");

    const buffer = await response.buffer();
    const fp = path.join(DOWNLOAD_DIR, fileName);
    fs.writeFileSync(fp, buffer);
    console.log(`Downloaded: ${fileName}`);
    res.sendFile(fp);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Server error");
  }
};

// Route registrieren
app.get("/", downloadHandler);
app.get("/download", downloadHandler);

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
