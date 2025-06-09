// proxy-server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const app = express();
const PORT = 30000;

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// Middleware: CORS deaktivieren
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Download-Endpunkt
app.get("/download", async (req, res) => {
  const fileUrl = req.query.url;
  const fileName = req.query.name;

  if (!fileUrl || !fileName || !fileUrl.startsWith("http")) {
    return res.status(400).send("Missing or invalid parameters.");
  }

  const filePath = path.join(DOWNLOAD_DIR, fileName);

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to fetch file.");

    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);

    console.log(`Downloaded: ${fileName}`);

    // Zeitstempel speichern für automatische Löschung
    fs.utimesSync(filePath, new Date(), new Date());

    res.json({ success: true, file: `/files/${fileName}` });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Download failed.");
  }
});

// Statische Datei-Ausgabe
app.use("/files", express.static(DOWNLOAD_DIR));

// Cleanup-Job: Alle 1 Stunde prüfen, ob Dateien älter als 24h sind
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return console.error("Cleanup error:", err);

    files.forEach(file => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (stats.mtimeMs < cutoff) {
          fs.unlink(filePath, err => {
            if (!err) console.log(`Deleted expired file: ${file}`);
          });
        }
      });
    });
  });
}, 60 * 60 * 1000); // alle Stunde

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
