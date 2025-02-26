const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/download", (req, res) => {
  const videoUrl = req.query.url;
  let quality = req.query.quality;
  let format = req.query.format;

  if (!videoUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  // If quality is provided as "360p", remove the trailing "p"
  if (quality && quality.toLowerCase().endsWith("p")) {
    quality = quality.slice(0, -1);
  }

  // Set default values if missing or invalid
  if (!quality || isNaN(parseInt(quality, 10))) {
    quality = "1080"; // Default quality
  }
  if (!format || (format !== "mp3" && format !== "mp4")) {
    format = "mp4"; // Default format
  }

  // Ensure a downloads directory exists
  const downloadsDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  // Generate a unique base filename
  const baseFileName = `download_${Date.now()}`;
  // Use %(ext)s so that yt-dlp sets the correct extension (.mp4, .webm, .mp3, etc.)
  const outputFilePath = path.join(downloadsDir, `${baseFileName}.%(ext)s`);

  let command = "";

  if (format === "mp3") {
    // Download and extract audio
    command = `yt-dlp -x --audio-format mp3 -o "${outputFilePath}" "${videoUrl}"`;
  } else {
    // For video: build format selection using the parsed quality
    const height = parseInt(quality, 10);
    const formatSelection = `bestvideo[height<=${height}]+bestaudio/best`;
    const cookiesPath = path.join(__dirname, "public", "cookies.txt");
    command = `yt-dlp --cookies "${cookiesPath}" -f "${formatSelection}" -o "${outputFilePath}" "${videoUrl}"`;
  }

  console.log("Running command:", command);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`yt-dlp error: ${stderr}`);
      return res.status(500).json({ error: "Download failed" });
    }

    // Look for the downloaded file (yt-dlp will replace %(ext)s with the correct extension)
    const downloadedFile = fs
      .readdirSync(downloadsDir)
      .find((file) => file.startsWith(baseFileName));

    if (!downloadedFile) {
      return res.status(500).json({ error: "File not found after download" });
    }

    const finalFilePath = path.join(downloadsDir, downloadedFile);
    console.log("Download complete, sending file:", finalFilePath);

    res.download(finalFilePath, downloadedFile, (err) => {
      if (err) {
        console.error("Error sending file:", err);
      }

      // Delete file after sending
      fs.unlink(finalFilePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        else console.log("File deleted successfully:", finalFilePath);
      });
    });
  });
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
