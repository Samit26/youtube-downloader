const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));
const ytDlpPath = "/usr/local/bin/yt-dlp";
// Track the active download process and the unique filename base.
let downloadProcess = null;
let currentDownloadBaseFile = null;

// Helper function to kill the child process (cross-platform).
function killDownloadProcess(child) {
  return new Promise((resolve) => {
    if (!child) {
      return resolve();
    }

    const pid = child.pid;
    console.log("Attempting to kill process with PID:", pid);

    // Windows-specific approach
    if (process.platform === "win32") {
      exec(`taskkill /PID ${pid} /T /F`, (err) => {
        if (err) {
          console.error("Failed to kill process via taskkill:", err);
        } else {
          console.log(`Process ${pid} killed successfully via taskkill.`);
        }
        resolve();
      });
    } else {
      // Unix-like systems can use signals reliably
      child.kill("SIGTERM");
      // Wait for the process to actually exit
      child.on("exit", () => {
        console.log(`Process ${pid} exited after SIGTERM.`);
        resolve();
      });
    }
  });
}

// Helper to delete partial files that start with our base filename
function cleanupFiles() {
  if (!currentDownloadBaseFile) return;

  const downloadsDir = path.join(__dirname, "downloads");
  console.log("Looking for files to delete in:", downloadsDir);

  // Let's see what's actually in the folder
  const allFiles = fs.readdirSync(downloadsDir);
  console.log("All files in downloads folder:", allFiles);

  const filesToDelete = allFiles.filter((file) =>
    file.startsWith(currentDownloadBaseFile)
  );
  console.log("Matching files to delete:", filesToDelete);

  filesToDelete.forEach((file) => {
    const filePath = path.join(downloadsDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log("Deleted file:", filePath);
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  });

  currentDownloadBaseFile = null;
}

// --------------- Routes ---------------

app.get("/download", (req, res) => {
  const videoUrl = req.query.url;
  let quality = req.query.quality;
  let format = req.query.format;

  if (!videoUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  // Remove trailing "p" (e.g. "360p" -> "360")
  if (quality && quality.toLowerCase().endsWith("p")) {
    quality = quality.slice(0, -1);
  }

  // Default to 1080 mp4 if not provided or invalid
  if (!quality || isNaN(parseInt(quality, 10))) {
    quality = "1080";
  }
  if (!format || (format !== "mp3" && format !== "mp4")) {
    format = "mp4";
  }

  // Ensure a downloads directory
  const downloadsDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  // Generate a unique base filename
  const baseFileName = `download_${Date.now()}`;
  currentDownloadBaseFile = baseFileName;

  // Let yt-dlp pick the correct extension
  const outputFilePath = path.join(downloadsDir, `${baseFileName}.%(ext)s`);

  // Construct the command
  let command = "";
  if (format === "mp3") {
    command = `${ytDlpPath} --cookies --audio-format mp3 -o "${outputFilePath}" "${videoUrl}"`;
  } else {
    const height = parseInt(quality, 10);
    const formatSelection = `bestvideo[height<=${height}]+bestaudio/best`;
    const cookiesPath = path.join(__dirname, "public", "cookies.txt");
    // On Windows, be sure to escape backslashes in the path if you do it manually.
    command = `${ytDlpPath} --cookies "${cookiesPath}" -f "${formatSelection}" -o "${outputFilePath}" "${videoUrl}"`;
  }

  console.log("Running command:", command);

  // SSE setup
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Spawn the download
  downloadProcess = exec(command);

  // Listen for progress from stdout
  downloadProcess.stdout.on("data", (data) => {
    const progressMatch = data.match(/(\d+\.\d+)%/);
    if (progressMatch) {
      const progress = parseFloat(progressMatch[1]);
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    }
  });

  // Listen for errors from stderr
  downloadProcess.stderr.on("data", (data) => {
    console.error(`yt-dlp error: ${data}`);
  });

  // When the process closes, send final info or error
  downloadProcess.on("close", (code) => {
    if (code === 0) {
      const downloadableFile = fs
        .readdirSync(downloadsDir)
        .find((file) => file.startsWith(baseFileName));

      if (downloadableFile) {
        const finalFilePath = path.join(downloadsDir, downloadableFile);
        res.write(
          `data: ${JSON.stringify({
            progress: 100,
            file: downloadableFile,
            finalPath: finalFilePath,
          })}\n\n`
        );
        console.log("Download complete:", finalFilePath);
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: "File not found after download",
          })}\n\n`
        );
        cleanupFiles();
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: "Download failed" })}\n\n`);
      cleanupFiles();
    }

    res.end();
    // Cleanup the process reference
    downloadProcess = null;
    currentDownloadBaseFile = null;
  });
});

app.get("/download-file", (req, res) => {
  const finalFilePath = req.query.finalFilePath;
  const downloadableFile = req.query.downloadableFile;
  if (!finalFilePath || !downloadableFile) {
    return res.status(404).json({ error: "File not available for download" });
  }

  res.download(finalFilePath, downloadableFile, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      return res.status(500).json({ error: "Failed to send file" });
    }
    // Delete file after sending
    fs.unlink(finalFilePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      } else {
        console.log("File deleted successfully:", finalFilePath);
      }
    });
  });
});

// --------------- CANCEL ROUTE ---------------
app.get("/cancel", async (req, res) => {
  // 1. Kill the process (cross-platform).
  await killDownloadProcess(downloadProcess);
  downloadProcess = null;

  // 2. Clean up any partial files that start with currentDownloadBaseFile.
  cleanupFiles();

  // If we found and deleted files, or if there was nothing to delete,
  // respond with a success message. If you want a more specific
  // message, you can modify cleanupFiles() to return a boolean or
  // count of how many files it deleted.
  return res.json({ message: "Download canceled and cleanup attempted" });
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
