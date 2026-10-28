// Device configuration as read from / written to the device with
// "config get" / "config set". Only the fields the app reads directly are
// typed; the rest is rendered generically by the schema-driven tree.

/** Path into the config tree, e.g. ["profiles", 0, "pointer", "scale_x"]. */
export type ConfigPath = (string | number)[];

export interface ConfigAction {
  label: string | null;
  command: string;
  args?: unknown[] | null;
}

/**
 * Args of a "button" action: device (0 mouse, 1 keyboard), press type, then
 * the button/key code — a bare mouse button, or [HID code, modifier mask].
 */
export type ButtonArgs = [actor: number, type: string, code: number | [number, number]];

export type OrientationCode = "u" | "d" | "l" | "r" | "f" | "b";

export interface GlobalInfo {
  name: string;
  HW_UID: string;
  profile_map: number[];
  action_list: ConfigAction[];
  action_names: string[];
  orientation?: { usb: OrientationCode; led: OrientationCode };
  [key: string]: unknown;
}

export interface Profile {
  name: string;
  [key: string]: unknown;
}

export interface Config {
  global_info: GlobalInfo;
  profiles: Profile[];
}
