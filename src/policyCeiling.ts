import {
  cleanEventPolicy,
  cleanQueryPolicy,
  EventPolicy,
  EventPolicyRule,
  QueryPolicy,
  QueryPolicyRule,
  allowsEventPolicy,
  allowsQueryPolicy,
} from "./Channel";

export interface PolicyCeiling {
  eventPolicy: EventPolicy;
  queryPolicy: QueryPolicy;
}

/** Max-permissive ceiling (legacy behavior when no ceiling is stored). */
export const PERMISSIVE_POLICY_CEILING: PolicyCeiling = {
  eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
  queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] },
};

export function hasUnrestrictedEventAllow(eventPolicy: EventPolicy): boolean {
  return eventPolicy.allow.some(
    (r) => r.domain === "*" && r.name === "*",
  );
}

export function hasUnrestrictedQueryAllow(queryPolicy: QueryPolicy): boolean {
  return queryPolicy.allow.some((r) => r.rid === "*" && r.name === "*");
}

function sampleDomains(rules: EventPolicyRule[]): string[] {
  const literals = new Set<string>();
  let star = false;
  for (const r of rules) {
    if (r.domain === "*") star = true;
    else literals.add(r.domain);
  }
  if (star) {
    if (literals.size === 0) {
      return ["sampleDomainA", "sampleDomainB"];
    }
    return [...literals, "sampleDomainExtra"];
  }
  return literals.size ? [...literals] : ["sampleDomainOnly"];
}

function sampleNames(rules: EventPolicyRule[]): string[] {
  const literals = new Set<string>();
  let star = false;
  for (const r of rules) {
    if (r.name === "*") star = true;
    else literals.add(r.name);
  }
  if (star) {
    if (literals.size === 0) {
      return ["sampleNameA", "sampleNameB"];
    }
    return [...literals, "sampleNameExtra"];
  }
  return literals.size ? [...literals] : ["sampleNameOnly"];
}

function sampleRids(rules: QueryPolicyRule[]): string[] {
  const literals = new Set<string>();
  let star = false;
  for (const r of rules) {
    if (r.rid === "*") star = true;
    else literals.add(r.rid);
  }
  if (star) {
    if (literals.size === 0) {
      return ["sample.rid.a", "sample.rid.b"];
    }
    return [...literals, "sample.rid.extra"];
  }
  return literals.size ? [...literals] : ["sample.rid.only"];
}

function sampleQueryNames(rules: QueryPolicyRule[]): string[] {
  const literals = new Set<string>();
  let star = false;
  for (const r of rules) {
    if (r.name === "*") star = true;
    else literals.add(r.name);
  }
  if (star) {
    if (literals.size === 0) {
      return ["sampleQueryA", "sampleQueryB"];
    }
    return [...literals, "sampleQueryExtra"];
  }
  return literals.size ? [...literals] : ["sampleQueryOnly"];
}

/**
 * True when every event allowed by `inner` is also allowed by `outer`.
 * Uses a finite sample set derived from rule literals and wildcards.
 */
export function eventPolicySubsetOf(
  inner: EventPolicy,
  outer: EventPolicy,
): boolean {
  const rules = [...inner.allow, ...inner.deny, ...outer.allow, ...outer.deny];
  const domains = sampleDomains(rules);
  const names = sampleNames(rules);
  for (const domain of domains) {
    for (const name of names) {
      if (allowsEventPolicy(inner, { domain, name })) {
        if (!allowsEventPolicy(outer, { domain, name })) {
          return false;
        }
      }
    }
  }
  return true;
}

export function queryPolicySubsetOf(
  inner: QueryPolicy,
  outer: QueryPolicy,
): boolean {
  const rules = [...inner.allow, ...inner.deny, ...outer.allow, ...outer.deny];
  const rids = sampleRids(rules);
  const names = sampleQueryNames(rules);
  for (const rid of rids) {
    for (const name of names) {
      if (allowsQueryPolicy(inner, { rid, name })) {
        if (!allowsQueryPolicy(outer, { rid, name })) {
          return false;
        }
      }
    }
  }
  return true;
}

export function policyCeilingSubsetOf(
  inner: PolicyCeiling,
  outer: PolicyCeiling,
): boolean {
  return (
    eventPolicySubsetOf(inner.eventPolicy, outer.eventPolicy) &&
    queryPolicySubsetOf(inner.queryPolicy, outer.queryPolicy)
  );
}

export function assertPolicyCeilingWithin(
  inner: PolicyCeiling,
  outer: PolicyCeiling,
): void {
  if (!policyCeilingSubsetOf(inner, outer)) {
    throw new Error("Policy ceiling exceeds parent pico policy ceiling");
  }
}

export function assertChannelPolicyWithinCeiling(
  eventPolicy: EventPolicy,
  queryPolicy: QueryPolicy,
  ceiling: PolicyCeiling,
): void {
  if (!eventPolicySubsetOf(eventPolicy, ceiling.eventPolicy)) {
    throw new Error("Channel event policy exceeds pico policy ceiling");
  }
  if (!queryPolicySubsetOf(queryPolicy, ceiling.queryPolicy)) {
    throw new Error("Channel query policy exceeds pico policy ceiling");
  }
}

export function normalizePolicyCeiling(raw: PolicyCeiling): PolicyCeiling {
  return {
    eventPolicy: cleanEventPolicy(raw.eventPolicy),
    queryPolicy: cleanQueryPolicy(raw.queryPolicy),
  };
}
