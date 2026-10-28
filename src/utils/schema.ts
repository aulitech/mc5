import { UI_SCHEMA, type SchemaNode } from "../constants/schemas";
import type { ConfigPath } from "../types/config";

// UI_SCHEMA is rebuilt only when the device's gesture list changes.
let cache: { gestureNames: string[]; schema: SchemaNode } | null = null;

const rootSchema = (gestureNames: string[]) => {
  if (cache?.gestureNames !== gestureNames) {
    cache = { gestureNames, schema: UI_SCHEMA(gestureNames) };
  }
  return cache.schema;
};

/** Schema node for a config path; array indices fall through to `_item`. */
export function getSchema(path: ConfigPath, gestureNames: string[]): SchemaNode | null {
  let current: SchemaNode | undefined = rootSchema(gestureNames);
  for (const key of path) {
    if (!current) return null;
    const child = current[key];
    if (child) current = child as SchemaNode;
    else if (current._item && !isNaN(parseInt(String(key)))) current = current._item;
    else return null;
  }
  return current ?? null;
}
