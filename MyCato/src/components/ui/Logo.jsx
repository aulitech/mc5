import LOGO from "../../assets/logo.svg";
import { version } from "/package.json";
import { HStack, VStack } from "./Utility";
const Logo = ({ data, device, catoStatus }) => (
  <HStack
    style={{
      fontSize: "larger",
      fontWeight: "700",
      gap: ".5rem",
      alignItems: "center",
      padding: "0",
      flex: "1",
      justifyContent: "flex-start",
    }}
  >
    <a href="https://AULI.TECH" target="_blank" rel="noopener noreferrer">
      <img
        src={LOGO}
        alt="logo"
        style={{
          height: "1.5rem",
          marginRight: ".5rem",
        }}
      />
    </a>

    <VStack
      style={{
        gap: ".1rem",
      }}
    >
      {device ? (
        <VStack
          style={{
            color: "var(--color-card)",
            fontSize: "smaller",
            fontWeight: "500",
            padding: "0",
            margin: "0",
          }}
        >
          <span>{device.productName}</span>
          {device?.info && (
            <span>
              {data?.profiles?.[catoStatus?.conIdx]?.name || `Profile ${catoStatus?.conIdx + 1}`}{"  "}
              {device?.info?.version?.string ?? ""}
            </span>
          )}
        </VStack>
      ) : (
        <VStack>
        <span style={{ color: "var(--royal-gold-300)" }}>myCato</span>
        <span style={{ color: "var(--color-card)", fontWeight: "lighter" ,fontSize: "xx-small"}}>{version}</span>
        </VStack>
      )}
    </VStack>
  </HStack>
);
export default Logo;
