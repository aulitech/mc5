import { useState } from "react";
import RadioGroup from "../tools/RadioGroup";
import ota from "../../device/ota";
import { notify } from "../../lib/notify";
import { HStack, VStack, Ring } from "./Utility";

const Update = ({ releases, setReleases }) => {
  const [asset, setAsset] = useState(
    releases.length > 0 ? releases[0].assets[0] : [],
  );
  const [loading, setLoading] = useState(false);

  if (!releases || releases.length === 0) {
    return (
      <div
        style={{
          maxWidth: "800px",
          marginTop: "2rem",
          padding: "2rem",
          color: "var(--color-card)",
        }}
      >
        <h3>Update Completed</h3>
      </div>
    );
  }

  const handleDownload = async (asset) => {
    try {
      setLoading(true);
      ota.send("reboot uf2").catch(() => {}); // Put the device into bootloader mode before downloading the firmware

      // 1. Fetch the data from your Proxy (to avoid CORS)
      // If public: You can fetch directly from the GitHub API

      // If private: You need to use a server-side proxy that adds the Authorization header with your token and then fetches the asset from GitHub, returning it to your frontend.  cc

      // setup on Cloudflare Workers, see: https://developers.cloudflare.com/workers/examples/proxying-api-requests/#example-proxying-github-api-requests-to-avoid-cors-issues

      // cloudflare credentials: google auth: spero@auli.tech

      const PROXY_URL = `https://get-asset.spero.workers.dev/?assetId=${asset.id}&fileName=${asset.name}`;

      const response = await fetch(PROXY_URL);
      if (!response.ok) throw new Error("Network response was not ok");

      // Get the data as a Blob (binary large object)
      const blob = await response.blob();

      // 2. Check if the browser supports the File System Access API

      try {
        // Open the "Save As" dialog
        const handle = await window.showSaveFilePicker({
          suggestedName: asset.name,
          types: [
            {
              description: "Cato Firmware",
              accept: { "application/octet-stream": [".uf2"] },
            },
          ],
        });

        // Create a writable stream to the file
        const writable = await handle.createWritable();

        // Write the blob data
        await writable.write(blob);

        // Close the file
        await writable.close();
      } catch (err) {
        // User cancelled the picker or an error occurred
        if (err.name !== "AbortError") {
          console.error("SaveFilePicker error:", err);
        }
      }
    } catch (error) {
      console.error("Download failed:", error);
      notify.error("Failed to download the firmware file.");
    } finally {
      setLoading(false);
      setReleases([]);
    }
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        marginTop: "2rem",
        padding: "2rem",
        color: "var(--color-card)",
      }}
    >
      <h3>Updates Available</h3>
      <p>Please select a version:</p>
      <RadioGroup choices={releases[0].assets} setChoice={setAsset} />
      <div
        style={{
          maxWidth: "800px",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p>
          To update Cato please make sure it is connected to your computer via
          USB, then click the "Update" button below. This will download the
          latest firmware version to your computer. Once downloaded, you must
          authorize instalation by selecting the "AULI-UPDAT" or "XIAO-SENSE"
          folders in the Save File box that appears.
        </p>
        <p>
          Please do not unplug it until the update is complete. Cato should
          automatically reboot and pair in about 30 seconds after pressing
          "Save". You can then reconnect myCato.
        </p>
        {loading ? (
          <Ring color="var(--led-blue)" />
        ) : (
          <button
            style={{
              marginTop: "1rem",
              justifyContent: "center",
              display: "flex",
              padding: "0.5rem 1rem",
              border: "1px solid var(--color-input)",
              borderRadius: "0.25rem",
            }}
            onClick={() => handleDownload(asset)}
            disabled={loading}
          >
            Update
          </button>
        )}
      </div>
    </div>
  );
};

export default Update;
