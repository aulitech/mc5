const PracticeInstructions = ({ gestureNames }) => {
  return (
    <div style={{ marginBottom: "1.5rem", minWidth: "15rem", width: "60%" }}>
      <h3>Available gestures on this device:{" "}</h3>
      {gestureNames.map((name, index) => (
        <span key={index}>{name}{index < gestureNames.length - 1 ? ", " : ""}</span>
      ))}
    </div>
  );
};

export default PracticeInstructions;
