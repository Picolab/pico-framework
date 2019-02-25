export function isNotStringOrBlank(val: any) {
  return typeof val !== "string" || val.trim().length === 0;
}
