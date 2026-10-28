const TestsTab = () => {
  return (
    <div>
      <div style={{ padding: "2rem" }}>
        <h2>Test Tools</h2>
        <p>
          These external tools can help you test and improve your pointing and
          typing skills when using Cato.
        </p>
        <p>Selecting these links will open the tools in a new browser tab. Return here to adjust settings while using the tools.</p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "0 2rem 2rem 2rem",
        }}
      >
        <a target="_blank" rel="noopener noreferrer" href="https://neuralink.com/webgrid/">
          Webgrid
        </a>
        <a target="_blank" rel="noopener noreferrer" href="https://monkeytype.com/">
          MonkeyType
        </a>
      </div>
    </div>
  );
};

export default TestsTab;
