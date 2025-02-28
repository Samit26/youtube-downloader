// Select DOM elements
const downloadBtn = document.getElementById("downloadBtn");
const videoUrlInput = document.getElementById("videoUrl");
const qualitySelect = document.getElementById("quality");
const formatSelect = document.getElementById("format");
const loader = document.getElementById("loader");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

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
  progressContainer.classList.remove("hidden");

  const eventSource = new EventSource(
    `/download?url=${encodeURIComponent(
      videoUrl
    )}&quality=${quality}&format=${format}`
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.error) {
      console.error(data.error);
      eventSource.close();
      loader.classList.add("hidden");
      progressContainer.classList.add("hidden");
      return;
    }

    // Update progress if available
    if (data.progress !== undefined) {
      progressBar.style.width = `${data.progress}%`;
      progressText.textContent = `${data.progress}%`;
    }

    // Trigger file download only when the file property is present
    if (data.file) {
      eventSource.close();
      loader.classList.add("hidden");
      progressContainer.classList.add("hidden");

      const link = document.createElement("a");
      link.href = `/download-file`;
      link.download = data.file; // This now correctly uses the provided file name
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  eventSource.onerror = (error) => {
    console.error("EventSource failed:", error);
    eventSource.close();
    loader.classList.add("hidden");
    progressContainer.classList.add("hidden");
  };
});

//   try {
//     // Make a fetch request to your Express backend
//     const response = await fetch(
//       `/download?url=${encodeURIComponent(
//         videoUrl
//       )}&quality=${quality}&format=${format}`
//     );

//     if (!response.ok) {
//       // If server returned an error (e.g., 500)
//       throw new Error(
//         `Download failed: ${response.status} ${response.statusText}`
//       );
//     }

//     const blob = new Blob(chunks);
//     // Convert response data to a Blob
//     // const blob = await response.blob();

//     // Create a temporary URL for the blob
//     const downloadUrl = URL.createObjectURL(blob);

//     // Create an anchor element and simulate a click to trigger download
//     const link = document.createElement("a");
//     link.href = downloadUrl;

//     // Decide the file name based on format
//     if (format === "mp3") {
//       link.download = "audio.mp3";
//     } else {
//       link.download = "video.mp4";
//     }

//     document.body.appendChild(link);
//     link.click();

//     // Cleanup: remove the link and revoke the blob URL
//     link.remove();
//     URL.revokeObjectURL(downloadUrl);
//   } catch (error) {
//     console.error(error);
//     alert("An error occurred while downloading. Check console for details.");
//   } finally {
//     // Hide loader
//     loader.classList.add("hidden");
//     progressContainer.classList.add("hidden");
//   }
// });
