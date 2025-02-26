// Select DOM elements
const downloadBtn = document.getElementById("downloadBtn");
const videoUrlInput = document.getElementById("videoUrl");
const qualitySelect = document.getElementById("quality");
const formatSelect = document.getElementById("format");
const loader = document.getElementById("loader");

// Download logic
downloadBtn.addEventListener("click", async () => {
  const videoUrl = videoUrlInput.value.trim();
  const quality = qualitySelect.value;
  const format = formatSelect.value;

  if (!videoUrl) {
    alert("Please enter a valid YouTube link.");
    return;
  }

  // Show loader
  loader.classList.remove("hidden");

  try {
    // Make a fetch request to your Express backend
    const response = await fetch(
      `/download?url=${encodeURIComponent(
        videoUrl
      )}&quality=${quality}&format=${format}`
    );

    if (!response.ok) {
      // If server returned an error (e.g., 500)
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    // Convert response data to a Blob
    const blob = await response.blob();

    // Create a temporary URL for the blob
    const downloadUrl = URL.createObjectURL(blob);

    // Create an anchor element and simulate a click to trigger download
    const link = document.createElement("a");
    link.href = downloadUrl;

    // Decide the file name based on format
    if (format === "mp3") {
      link.download = "audio.mp3";
    } else {
      link.download = "video.mp4";
    }

    document.body.appendChild(link);
    link.click();

    // Cleanup: remove the link and revoke the blob URL
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error(error);
    alert("An error occurred while downloading. Check console for details.");
  } finally {
    // Hide loader
    loader.classList.add("hidden");
  }
});
