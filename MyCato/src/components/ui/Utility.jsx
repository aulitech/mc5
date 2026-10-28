// ui utility components
const Progress = ({
  label,
  value,
  color = "blue",
  bgColor = "gray",
  width = "100%",
  gap = "1rem",
  ...props
}) => (
  <div // progress bar with label component
    onClick={props.onClick}
    style={{
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      width: width,
      cursor: "pointer",
      gap: gap,
    }}
  >
    <div
      style={{
        display: "flex",
        flex: "1",
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <div
        style={{
          // progress bar container - set min width to prevent collapse
          minWidth: "8rem",
          width: "25%",
          height: "100%",
          backgroundColor: bgColor,
          ...props.trackStyle,
        }}
      >
        <div
          style={{
            width: `${value}%`,
            backgroundColor: color,
            height: "100%",
            ...props.barStyle,
          }}
        ></div>
      </div>
    </div>
    <span
      style={{
        display: "flex",
        flex: "1",
        justifyContent: "flex-start",
      }}
    >
      {label}
    </span>
  </div>
);

const CommandButton = ({ label, ...props }) => (
  <button
    onClick={props.onClick}
    title={props.tip || ""}
    style={{
      ...props.style,
    }}
  >
    {label}
  </button>
);

const HStack = ({ children, ...props }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      ...props.style,
    }}
  >
    {children}
  </div>
);

const VStack = ({ children, ...props }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      ...props.style,
    }}
  >
    {children}
  </div>
);

const Stack = ({ children, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", ...props.style }}>
    {children}
  </div>
);
const Text = ({
  fontSize = "medium",
  fontWeight = "normal",
  color = "white",
  children,
  ...props
}) => (
  <span
    style={{
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      ...props.style,
    }}
  >
    {children}
  </span>
);

const Code = ({
  background = "gray",
  padding = "1rem",
  children,
  ...props
}) => (
  <pre
    style={{
      background: background,
      padding: padding,
      ...props.style,
    }}
  >
    {children}
  </pre>
);

const Mark = ({ children, ...props }) => (
  <mark
    style={{
      backgroundColor: props.color || "yellow",
      padding: "2px 4px",
      borderRadius: "2px",
      ...props.style,
    }}
  >
    {children}
  </mark>
);

import styles from "./Ring.module.css";

const Ring = ({
  size = 40,
  color = "black",
  speed = 2,
  stroke = 5,
  bgOpacity = 0,
}) => {
  const sizeInt = parseInt(size + "");
  const strokeInt = parseInt(stroke + "");
  const centerPoint = sizeInt / 2;
  const radius = Math.max(0, sizeInt / 2 - strokeInt / 2);

  return (
    <div
      className={styles["ring-container"]}
      style={{
        "--uib-size": size + "px",
        "--uib-color": color,
        "--uib-speed": speed + "s",
        "--uib-bg-opacity": bgOpacity + "",
      }}
    >
      <svg
        className={styles["ring-inner"]}
        viewBox={`0 0 ${size} ${size}`}
        height={size}
        width={size}
      >
        <circle
          className={styles["ring-track"]}
          cx={centerPoint}
          cy={centerPoint}
          r={radius}
          pathLength="100"
          strokeWidth={`${stroke}px`}
          fill="none"
        />
        <circle
          className={styles["ring-car"]}
          cx={centerPoint}
          cy={centerPoint}
          r={radius}
          pathLength="100"
          strokeWidth={`${stroke}px`}
          fill="none"
        />
      </svg>
    </div>
  );
};

export {
  Progress,
  CommandButton,
  HStack,
  VStack,
  Stack,
  Text,
  Code,
  Mark,
  Ring,
};
