export function isNotStringOrBlank(val: any) {
  return typeof val !== "string" || val.trim().length === 0;
}

export function isNullish(val: any) {
  return val === null || val === undefined || val !== val;
}
