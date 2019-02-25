import * as cuid from "cuid";
import { isNotStringOrBlank } from "./utils";

export class Channel {
  id: string = cuid();

  /**
   * A way to categorize channels i.e. bulk update of a group of channels
   */
  tags: string[] = [];

  /**
   * pico-engine had shared policies, however there were more problems by sharing that space
   * pico-framework policies are denormalized i.e. each channel owns their own copy
   */
  eventPolicy: EventPolicy = {
    allow: [],
    deny: []
  };
  queryPolicy: QueryPolicy = {
    allow: [],
    deny: []
  };

  // TODO a policy that says it's only for the parent (owner) and can perfrom any event / query
}

export interface EventPolicy {
  allow: EventPolicyRule[];
  deny: EventPolicyRule[];
}
export interface EventPolicyRule {
  domain: string;
  name: string;
}

export interface QueryPolicy {
  allow: QueryPolicyRule[];
  deny: QueryPolicyRule[];
}
export interface QueryPolicyRule {
  rid: string;
  name: string;
}

export function cleanEventPolicy(orig: any): EventPolicy {
  if (
    !orig ||
    Object.keys(orig)
      .sort()
      .join(",") !== "allow,deny" ||
    !Array.isArray(orig.allow) ||
    !Array.isArray(orig.deny)
  ) {
    throw new TypeError(
      `EventPolicy expectes {allow: EventPolicyRule[], deny: EventPolicyRule[]}`
    );
  }

  return {
    allow: orig.allow.map(cleanEventPolicyRule),
    deny: orig.deny.map(cleanEventPolicyRule)
  };
}

function cleanEventPolicyRule(orig: any): EventPolicyRule {
  if (
    !orig ||
    Object.keys(orig)
      .sort()
      .join(",") !== "domain,name" ||
    isNotStringOrBlank(orig.domain) ||
    isNotStringOrBlank(orig.name)
  ) {
    throw new TypeError(
      `EventPolicyRule expectes {domain: string, name: string}`
    );
  }
  return {
    domain: orig.domain.trim(),
    name: orig.name.trim()
  };
}

export function cleanQueryPolicy(orig: any): QueryPolicy {
  if (
    !orig ||
    Object.keys(orig)
      .sort()
      .join(",") !== "allow,deny" ||
    !Array.isArray(orig.allow) ||
    !Array.isArray(orig.deny)
  ) {
    throw new TypeError(
      `QueryPolicy expectes {allow: QueryPolicyRule[], deny: QueryPolicyRule[]}`
    );
  }

  return {
    allow: orig.allow.map(cleanQueryPolicyRule),
    deny: orig.deny.map(cleanQueryPolicyRule)
  };
}

function cleanQueryPolicyRule(orig: any): QueryPolicyRule {
  if (
    !orig ||
    Object.keys(orig)
      .sort()
      .join(",") !== "name,rid" ||
    isNotStringOrBlank(orig.name) ||
    isNotStringOrBlank(orig.rid)
  ) {
    throw new TypeError(`QueryPolicyRule expectes {rid: string, name: string}`);
  }
  return {
    rid: orig.rid.trim(),
    name: orig.name.trim()
  };
}
