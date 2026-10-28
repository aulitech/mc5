import { HStack, VStack } from "../ui/Utility";

const MainInstructions = ({ onConnect }) => {
  return (
    <VStack
      style={{
        gap: "2rem",
        padding: "1rem 4rem",
                maxWidth: "700px",
        margin: "0 auto",
        overflowY: "auto",
      }}
    >
      <h2>MyCato Configuration Tool</h2>
      <p>
        To get started, please have Cato powered on and paired with your
        computer, then press<button onClick={onConnect}>Connect</button>
      </p>
    <p style={{ border:'1px solid var(--border)', padding: '0.5rem', borderRadius: '8px' }}  >
        Pre-Release Users: Access the older MyCato version{" "}
        <a href="https://aulitech.github.io/mc/">here</a>. We recommend updating to the latest version for the best experience and access to new features at <a href="https://AULI.TECH/support/">AULI.TECH Support</a>.
      </p>
      <details>
        <summary>
          <span style={{ fontWeight: "bold" }}>Getting Started Video</span>
        </summary>
        <video
          id="video-1469-1_html5"
          preload="metadata"
          src="https://www.auli.tech/wp-content/uploads/2025/12/Getting-Started.mp4?_=1"
          controls
          style={{
            width: "100%",
            marginTop: "1rem",
            borderRadius: "8px",
            height: "auto",
          }}
        ></video>
      </details>
    </VStack>
  );
};
export default MainInstructions;
