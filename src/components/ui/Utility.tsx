// ui utility components
import type { CSSProperties, ReactNode } from "react";
import styles from "./Ring.module.css";

interface ProgressProps {
  label: ReactNode;
  /** 0–100. */
  value: number;
  color?: string;
  bgColor?: string;
  width?: string;
  gap?: string;
  trackStyle?: CSSProperties;
  barStyle?: CSSProperties;
}

// progress bar with label
const Progress = ({
  label,
  value,
  color = "blue",
  bgColor = "gray",
  width = "100%",
  gap = "1rem",
  trackStyle,
  barStyle,
}: ProgressProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      width: width,
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
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={typeof label === "string" ? label : undefined}
        style={{
          // progress bar container - set min width to prevent collapse
          minWidth: "8rem",
          width: "25%",
          height: "100%",
          backgroundColor: bgColor,
          ...trackStyle,
        }}
      >
        <div
          style={{
            width: `${value}%`,
            backgroundColor: color,
            height: "100%",
            ...barStyle,
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

interface StackProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const HStack = ({ children, style, className }: StackProps) => (
  <div
    className={className}
    style={{
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

const VStack = ({ children, style, className }: StackProps) => (
  <div
    className={className}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

interface TextProps {
  fontSize?: CSSProperties["fontSize"];
  fontWeight?: CSSProperties["fontWeight"];
  color?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

const Text = ({
  fontSize = "medium",
  fontWeight = "normal",
  color = "white",
  children,
  style,
}: TextProps) => (
  <span
    style={{
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      ...style,
    }}
  >
    {children}
  </span>
);

interface RingProps {
  size?: number;
  color?: string;
  speed?: number;
  stroke?: number;
  bgOpacity?: number;
}

const Ring = ({
  size = 40,
  color = "black",
  speed = 2,
  stroke = 5,
  bgOpacity = 0,
}: RingProps) => {
  const centerPoint = size / 2;
  const radius = Math.max(0, size / 2 - stroke / 2);

  return (
    <div
      className={styles["ring-container"]}
      role="status"
      aria-label="Loading"
      style={
        {
          "--uib-size": size + "px",
          "--uib-color": color,
          "--uib-speed": speed + "s",
          "--uib-bg-opacity": bgOpacity + "",
        } as CSSProperties
      }
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

export { Progress, HStack, VStack, Text, Ring };
