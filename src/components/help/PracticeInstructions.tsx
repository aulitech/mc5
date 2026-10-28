const PracticeInstructions = ({ gestureNames }: { gestureNames: string[] }) => (
  <div style={{ marginBottom: "1.5rem", minWidth: "15rem", width: "60%" }}>
    <h3>Available gestures on this device:</h3>
    {gestureNames.join(", ")}
  </div>
);

export default PracticeInstructions;
