import * as cuid from "cuid";

export class Channel {
  id: string = cuid();

  /**
   * A way to categorize channels i.e. bulk update of a group of channels
   */
  tags: string[] = [];

  /**
   * The pico-engine had shared policies, however there were more problems by sharing that space
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

interface EventPolicy {
  allow: EventPolicyRule[];
  deny: EventPolicyRule[];
}
interface EventPolicyRule {
  domain: string;
  name: string;
}

interface QueryPolicy {
  allow: QueryPolicyRule[];
  deny: QueryPolicyRule[];
}
interface QueryPolicyRule {
  rid: string;
  name: string;
}
