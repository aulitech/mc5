// schemas.ts — Plain data describing the config: a sample default config,
// and the UI schema that drives the recursive config tree
// (labels, visibility, input types, ranges). No React or device imports —
// anything runtime (gesture names, custom editors) is passed in or looked up
// by name in the tree components.

import { ORIENTATION_OPTS } from "./mappings";
import type { Config } from "../types/config";

export interface SchemaOption {
  value: string | number;
  label?: string;
}

/** One node of the UI schema; child keys mirror the config's keys. */
export interface SchemaNode {
  label?: string;
  description?: string;
  mode?: "hidden" | "advanced" | "basic";
  readOnly?: boolean;
  type?: "action_binding";
  options?: SchemaOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Display names for array items, by index. */
  names?: string[];
  hiddenIndices?: number[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  /** Name of a custom editor registered in tree/JsonNodeRenderer. */
  custom?: string;
  /** Schema applied to every item of an array. */
  _item?: SchemaNode;
  [key: string]: unknown;
}

/** A representative device config — shape reference and test fixture. */
export const CONFIG_DATA: Config = {
  global_info: {
    name: "",
    HW_UID: "",
    sleep: {
      timeout: 600,
      threshold: 5,
    },
    orientation: {
      usb: "d",
      led: "r",
    },
    calibration: {
      auto_threshold: 3,
      auto_samples: 300,
    },
    profile_map: [0, 1, 2],
    action_list: [
      {
        label: "No Operation",
        command: "noop",
      },
      {
        label: "Left Click",
        command: "button",
        args: [0, "tap", 1],
      },
      {
        label: "Right Click",
        command: "button",
        args: [0, "tap", 2],
      },
      {
        label: "Double Left Click",
        command: "button",
        args: [0, "double_tap", 1],
      },
      {
        label: "Toggle Left Click",
        command: "button",
        args: [0, "toggle", 1],
      },
      {
        label: "Left Click & Drag",
        command: "button",
        args: [0, "hold_until_idle", 1],
      },
      {
        label: "Dwell Click",
        command: "dwell_click",
      },
      {
        label: "Scroll",
        command: "scroll",
        args: ["classic", ["pitch", 8], ["roll", 30]],
      },
      {
        label: "Pointer Sleep",
        command: "pointer_sleep",
      },
      {
        label: "Motion Sleep",
        command: "sleep",
      },
      {
        label: "Reboot Cato",
        command: "reboot_cato",
      },
      {
        label: "Next Connection",
        command: "next_connection",
      },
      {
        label: "W Key",
        command: "button",
        args: [1, "tap", [26, 0]],
      },
      {
        label: "A Key",
        command: "button",
        args: [1, "tap", [4, 0]],
      },
      {
        label: "S Key",
        command: "button",
        args: [1, "tap", [22, 0]],
      },
      {
        label: "D Key",
        command: "button",
        args: [1, "tap", [7, 0]],
      },
      {
        label: ". Key",
        command: "button",
        args: [1, "tap", [55, 0]],
      },
      {
        label: "/ Key",
        command: "button",
        args: [1, "tap", [56, 0]],
      },
    ],
    gesture_sensitivity: [
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
      {
        confidence_threshold: 0.55,
        sequential_inferences: 5,
      },
    ],
    action_names: [
      "next_connection",
      "deep_sleep",
      "scroll",
      "sleep",
      "pointer_sleep",
      "dwell_click",
      "reboot_cato",
      "erase_connection",
      "button",
      "noop",
    ],
  },
  profiles: [
    {
      name: "Dwell Click",
      operation_mode: {
        pointer_enabled: true,
        gesture_enabled: true,
        tapper_enabled: false,
      },
      pointer: {
        dwell_click_default: false,
        idle_threshold: 5,
        idle_duration: 40,
        dwell_repeat: false,
        scale_x: 1,
        scale_y: 1,
        acceleration: {
          start: 20,
          stop: 40,
          scale_slow: 0.6,
          scale_fast: 1.8,
        },
        mouse_type: "accel",
      },
      gesture: {
        bindings: [0, 0, 0, 0, 6, 0, 8, 0],
      },
      tapper: {
        max_tap_spacing: 0.4,
        tap_ths: 11,
        quiet: 2,
        shock: 2,
        bindings: [0, 1, 2, 4],
      },
    },
    {
      name: "PC",
      operation_mode: {
        pointer_enabled: false,
        gesture_enabled: true,
        tapper_enabled: false,
      },
      pointer: {
        dwell_click_default: false,
        idle_threshold: 5,
        idle_duration: 40,
        dwell_repeat: false,
        scale_x: 1,
        scale_y: 1,
        acceleration: {
          start: 20,
          stop: 40,
          scale_slow: 0.6,
          scale_fast: 1.8,
        },
        mouse_type: "ACCEL",
      },
      gesture: {
        bindings: [0, 0, 15, 13, 12, 14, 16, 17],
      },
      tapper: {
        max_tap_spacing: 0.4,
        tap_ths: 11,
        quiet: 2,
        shock: 2,
        bindings: [0, 1, 2, 4],
      },
    },
    {
      name: "Stretch",
      operation_mode: {
        pointer_enabled: true,
        gesture_enabled: true,
        tapper_enabled: false,
      },
      pointer: {
        dwell_click_default: false,
        idle_threshold: 5,
        idle_duration: 40,
        dwell_repeat: false,
        scale_x: 1,
        scale_y: 1,
        acceleration: {
          start: 20,
          stop: 40,
          scale_slow: 0.6,
          scale_fast: 1.8,
        },
        mouse_type: "ACCEL",
      },
      gesture: {
        bindings: [0, 0, 15, 13, 12, 14, 16, 17],
      },
      tapper: {
        max_tap_spacing: 0.4,
        tap_ths: 11,
        quiet: 2,
        shock: 2,
        bindings: [0, 1, 2, 4],
      },
    },
  ],
};

export const UI_SCHEMA = (gestureNames: string[]): SchemaNode => {
  return {
    global_info: {
      HW_UID: { mode: "hidden" },
      name: { mode: "hidden" },
      profile_map: { mode: "hidden" },
      action_list: { mode: "hidden" },
    action_names: { mode: "hidden" },
    sleep: {
      label: "Sleep",
      timeout: {
        options: [
          { value: 60, label: "1 Minute" },
          { value: 300, label: "5 Minutes" },
          { value: 600, label: "10 Minutes" },
          { value: 1800, label: "30 Minutes" },
          { value: 3600, label: "1 Hour" },
          { value: 7200, label: "2 Hours" },
          { value: 14400, label: "4 Hours" },
        ],
        label: "Sleep Timeout",
        description:
          "Duration of inactivity before the device enters low-power sleep mode.",
      },
      threshold: {
        options: [
          { value: 0, label: "Never Sleep" },
          { value: 1, label: "Very Light Movement" },
          { value: 4, label: "Light Movement" },
          { value: 7, label: "Moderate Movement" },
          { value: 10, label: "Heavy Movement" },
          { value: 15, label: "Very Heavy Movement" },
          { value: 20, label: "Extreme Movement" },
        ],
        label: "Keep Awake Threshold",
        mode: "advanced",
        description:
          "Movement intensity required to prevent device from sleeping. Set to 0 for 'never sleep.'",
      },
    },
    orientation: {
      label: "Orientation",
      mode: "advanced",
      usb: {
        label: "USB Direction",
        options: ORIENTATION_OPTS,
        description:
          "Which direction the USB port is pointing relative to the user.",
      },
      led: {
        label: "LED Direction",
        options: ORIENTATION_OPTS,
        description:
          "Which direction the Status LED is pointing relative to the user.",
      },
    },
    calibration: {
      label: "Calibration",
      mode: "advanced",
      auto_samples: {
        min: 50,
        max: 1000,
        step: 10,
        label: "Samples",
        description:
          "Number of sensor samples to collect during automatic calibration",
      },
      auto_threshold: {
        options: [
          { value: 0, label: "Off" },
          { value: 1, label: "1 Deg/Sec" },
          { value: 2, label: "2 Deg/Sec" },
          { value: 3, label: "3 Deg/Sec" },
          { value: 4, label: "4 Deg/Sec" },
          { value: 5, label: "5 Deg/Sec" },
          { value: 6, label: "6 Deg/Sec" },
          { value: 7, label: "7 Deg/Sec" },
          { value: 8, label: "8 Deg/Sec" },
          { value: 9, label: "9 Deg/Sec" },
          { value: 10, label: "10 Deg/Sec" },
        ],
        label: "Activation Threshold",
        description:
          "Deg/Sec variance limit for calibration to execute. Low number -> small motion cancels calibration.",
      },
    },
    gesture_sensitivity: {
      label: "Gesture Sensitivity",
      description:
        "Tune the gesture recognition sensitivity. Tradeoffs between 'ease of use' and 'false positive frequency'.",
      mode: "advanced",
      names: gestureNames,
      hiddenIndices: [0, 1],
      _item: {
        confidence_threshold: {
          min: 0.1,
          max: 1.0,
          step: 0.05,
          label: "Confidence",
          description:
            "Minimum probability score (0.0-1.0) required to trigger this gesture.",
        },
        sequential_inferences: {
          options: [
            { value: 1, label: "1 Frame" },
            { value: 2, label: "2 Frames" },
            { value: 3, label: "3 Frames" },
            { value: 4, label: "4 Frames" },
            { value: 5, label: "5 Frames" },
            { value: 6, label: "6 Frames" },
            { value: 7, label: "7 Frames" },
            { value: 8, label: "8 Frames" },
          ],
          label: "Sequential Frames",
          description:
            "Number of consecutive frames the model must agree on to confirm the gesture. Each must be above 'confidence' value to recognize.",
        },
      },
    },
  },
  profiles: {
    allowAdd: true,
    _item: {
      allowDelete: true,
      name: { mode: "hidden" },
      operation_mode: {
        mode: "basic",
        label: "Operation Mode",
        pointer_enabled: { label: "Enable Pointer", description:"Enable Mouse Pointer" },
        gesture_enabled: { label: "Enable Gesture", description:"Enable Gesture Recognition" },
        tapper_enabled: { label: "Enable Tapper", description:"Enable Tapper Functionality" },
      },
      pointer: {
        label: "Pointer",
        dwell_click_default: {
          mode: "basic",
          label: "Dwell Click Auto-On",
          description:
            "Turn Dwell Click ON automatically after reset. Useful for dwell-click when gestures are disabled.",
        },
        idle_threshold: {
          options: [
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
            { value: 5, label: "5" },
            { value: 6, label: "6" },
            { value: 7, label: "7" },
            { value: 8, label: "8" },
            { value: 9, label: "9" },
            { value: 10, label: "10" },
            { value: 11, label: "11" },
            { value: 12, label: "12" },
            { value: 13, label: "13" },
            { value: 14, label: "14" },
            { value: 15, label: "15" },
          ],
          mode: "advanced",
          step: 1,
          label: "Idle Threshold",
          description:
            "Movement speed below which the cursor is considered stationary.",
        },
        idle_duration: {
          options: [
            { value: 10, label: "100ms" },
            { value: 20, label: "200ms" },
            { value: 30, label: "300ms" },
            { value: 40, label: "400ms" },
            { value: 50, label: "500ms" },
            { value: 60, label: "600ms" },
            { value: 70, label: "700ms" },
            { value: 80, label: "800ms" },
            { value: 90, label: "900ms" },
            { value: 100, label: "1.0Sec" },
            { value: 120, label: "1.2Sec" },
          ],
          mode: "advanced",
          label: "Idle Duration",
          description:
            "Time that Cato must be stationary to consider user 'idle' and trigger idle-based actions like dwell click.",
        },
        dwell_repeat: {
          mode: "advanced",
          label: "Dwell Repeat",
          description:
            "If enabled, dwell click will fire repeatedly while holding still.",
        },
        scale_x: {
          min: 0.1,
          max: 5.0,
          step: 0.1,
          label: "Horizontal Sensitivity",
          description: "Multiplier for horizontal cursor movement speed.",
        },
        scale_y: {
          min: 0.1,
          max: 5.0,
          step: 0.1,
          label: "Vertical Sensitivity",
          description: "Multiplier for vertical cursor movement speed.",
        },
        mouse_type: {
          mode: "advanced",
          label: "Mouse Type",
          options: [
            { value: "accel", label: "Accelerated" },
            { value: "linear", label: "Linear" },
          ],
          description:
            "Choose between 'Linear' mode for consistent movement or 'Accelerated' mode for more dynamic, speed-sensitive control.",
        },
        acceleration: {
          label: "Acceleration",
          mode: "basic",
          start: {
            min: 0,
            max: 50,
            step: 1,
            mode: "advanced",
            label: "Start",
            description:
              "Speed threshold where acceleration begins to kick in.",
          },
          stop: {
            min: 0,
            max: 100,
            step: 1,
            mode: "advanced",
            label: "Stop",
            description: "Speed threshold where acceleration caps out.",
          },
          scale_slow: {
            min: 0.1,
            max: 2.0,
            step: 0.1,
            mode: "advanced",
            label: "Slow",
            description:
              "Speed multiplier applied when moving slowly (precision mode).",
          },
          scale_fast: {
            min: 1.0,
            max: 5.0,
            step: 0.1,
            mode: "advanced",
            label: "Fast",
            description: "Speed multiplier applied when moving quickly.",
          },
          custom: "accelerationEditor",
        },
      },
      gesture: {
        label: "Gesture",
        custom_model: {
          mode: "advanced",
          label: "Custom Model",
          description: "Enable or disable the use of a custom gesture model.",
        },
        bindings: {
          label: "Bindings",
          description: "Designate which gestures trigger which actions",
          names: gestureNames,
          hiddenIndices: [0, 1],
          _item: {
            type: "action_binding",
          },
        },
      },
      tapper: {
        label: "Tapper",
        quiet: {
          options: [
            { value: 0, label: "20ms" },
            { value: 1, label: "40ms" },
            { value: 2, label: "80ms" },
            { value: 3, label: "120ms" },
          ],
          mode: "advanced",
          label: "Quiet",
          description:
            "The minimum amount of time after the first detected tap in which there must not be any overthreshold event. Setting this to a higher value can help prevent false positives, but setting it too high may cause missed taps or make it difficult to perform quick successive taps.",
        },
        shock: {
          options: [
            { value: 0, label: "40ms" },
            { value: 1, label: "80ms" },
            { value: 2, label: "160ms" },
            { value: 3, label: "240ms" },
          ],
          mode: "advanced",
          label: "Shock",
          description:
            "The maximum time of an overthreshold signal detection to be recognized as a tap event.",
        },
        max_tap_spacing: {
          options: [
            { value: 0.1, label: "10ms" },
            { value: 0.2, label: "20ms" },
            { value: 0.3, label: "30ms" },
            { value: 0.4, label: "40ms" },
            { value: 0.5, label: "50ms" },
            { value: 0.6, label: "60ms" },
            { value: 0.7, label: "70ms" },
            { value: 0.8, label: "80ms" },
            { value: 0.9, label: "90ms" },
            { value: 1.0, label: "100ms" },
          ],
          mode: "advanced",
          label: "Max Spacing",
          description:
            "Max time (seconds) allowed between taps for a multi-tap.",
        },
        tap_ths: {
          min: 1,
          max: 31,
          step: 1,
          mode: "advanced",
          label: "Threshold",
          description: "Force threshold required to register a tap.",
        },
        bindings: {
          label: "Bindings",
          _item: {
            type: "action_binding",
            label: "Tap Count:",
            description: "Action to perform for this tap count.",
          },
        },
      },
    },
  },
}
};
