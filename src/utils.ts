export function isNotStringOrBlank(val: any) {
  return typeof val !== "string" || val.trim().length === 0;
}

/**
 * Copied AbstractBatch from "abstract-leveldown"
 * b/c typescript module resolution doesn't work very well with lerna (used in pico-engine)
 */
export type LevelBatch = PutBatch | DelBatch;
type LevelKey = (string | number | null | boolean)[];
interface PutBatch {
  readonly type: "put";
  readonly key: LevelKey;
  readonly value: any;
}
interface DelBatch {
  readonly type: "del";
  readonly key: LevelKey;
}
