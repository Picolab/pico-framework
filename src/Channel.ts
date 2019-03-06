import * as _ from "lodash";
import { PicoEvent } from "./PicoEvent";
import { PicoQuery } from "./PicoQuery";
import { isNotStringOrBlank } from "./utils";
import { AbstractBatch } from "abstract-leveldown";

export interface ChannelConfig {
  tags?: string[];
  eventPolicy?: EventPolicy;
  queryPolicy?: QueryPolicy;
}

export interface ChannelReadOnly {
  id: string;
  tags: string[];
  eventPolicy: EventPolicy;
  queryPolicy: QueryPolicy;
  familyChannelPicoID: string | null;
}

export class Channel {
  id: string;
  picoId: string;

  /**
   * A way to categorize channels i.e. bulk update of a group of channels
   */
  tags: string[] = [];

  /**
   * pico-engine had shared policies, however there were more problems by sharing that space
   * pico-framework policies are denormalized i.e. each channel owns their own copy
   */
  eventPolicy: EventPolicy = {
    allow: [{ domain: "*", name: "*" }],
    deny: []
  };
  queryPolicy: QueryPolicy = {
    allow: [{ rid: "*", name: "*" }],
    deny: []
  };

  /**
   * This is set by the family member (parent-child relation) who owns this channel.
   * Only this pico is allowed to send messages through it.
   */
  familyChannelPicoID?: string;

  constructor(
    picoId: string,
    id: string,
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ) {
    this.picoId = picoId;
    this.id = id;
    if (familyChannelPicoID) {
      this.tags = (conf && conf.tags) || [];
      this.familyChannelPicoID = familyChannelPicoID;
    } else {
      if (conf && conf.tags) {
        this.tags = cleanTags(conf.tags);
      }
      // if not a family channel, use policies
      if (conf && conf.eventPolicy) {
        this.eventPolicy = cleanEventPolicy(conf.eventPolicy);
      }
      if (conf && conf.queryPolicy) {
        this.queryPolicy = cleanQueryPolicy(conf.queryPolicy);
      }
    }
  }

  update(conf: ChannelConfig) {
    if (this.familyChannelPicoID) {
      // can't change anything
      return;
    }
    if (conf.tags) {
      this.tags = cleanTags(conf.tags);
    }
    if (conf.eventPolicy) {
      this.eventPolicy = cleanEventPolicy(conf.eventPolicy);
    }
    if (conf.queryPolicy) {
      this.queryPolicy = cleanQueryPolicy(conf.queryPolicy);
    }
    // NOTE: can't change familyChannelPicoID
  }

  assertEventPolicy(event: PicoEvent, fromPicoID?: string) {
    this.assertIfFamilyChannel(fromPicoID);
    assertEventPolicy(this.eventPolicy, event);
  }

  assertQueryPolicy(query: PicoQuery, fromPicoID?: string) {
    this.assertIfFamilyChannel(fromPicoID);
    assertQueryPolicy(this.queryPolicy, query);
  }

  private assertIfFamilyChannel(fromPicoID?: string) {
    if (this.familyChannelPicoID) {
      if (this.familyChannelPicoID === fromPicoID) {
        return; // good to go
      } else {
        throw new Error(
          "This is a family channel and only the owner can use it."
        );
      }
    }
  }

  toReadOnly(): ChannelReadOnly {
    return Object.freeze({
      id: this.id,
      tags: this.tags.slice(0),
      eventPolicy: _.cloneDeep(this.eventPolicy),
      queryPolicy: _.cloneDeep(this.queryPolicy),
      familyChannelPicoID: this.familyChannelPicoID || null
    });
  }

  toDbPut(): AbstractBatch {
    return {
      type: "put",
      key: ["pico", this.id],
      value: {
        id: this.id,
        picoId: this.picoId,
        tags: this.tags,
        eventPolicy: this.eventPolicy,
        queryPolicy: this.queryPolicy,
        familyChannelPicoID: this.familyChannelPicoID || null
      }
    };
  }
}

export function assertEventPolicy(eventPolicy: EventPolicy, event: PicoEvent) {
  for (const p of eventPolicy.deny) {
    if (p.domain === "*" || p.domain === event.domain) {
      if (p.name === "*" || p.name === event.name) {
        throw new Error("Denied by channel policy");
      }
    }
  }
  let isAllowed = false;
  for (const p of eventPolicy.allow) {
    if (p.domain === "*" || p.domain === event.domain) {
      if (p.name === "*" || p.name === event.name) {
        isAllowed = true;
        break;
      }
    }
  }
  if (!isAllowed) {
    throw new Error("Not allowed by channel policy");
  }
}

export function assertQueryPolicy(queryPolicy: QueryPolicy, query: PicoQuery) {
  for (const p of queryPolicy.deny) {
    if (p.rid === "*" || p.rid === query.rid) {
      if (p.name === "*" || p.name === query.name) {
        throw new Error("Denied by channel policy");
      }
    }
  }
  let isAllowed = false;
  for (const p of queryPolicy.allow) {
    if (p.rid === "*" || p.rid === query.rid) {
      if (p.name === "*" || p.name === query.name) {
        isAllowed = true;
        break;
      }
    }
  }
  if (!isAllowed) {
    throw new Error("Not allowed by channel policy");
  }
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
      `EventPolicy expects {allow: EventPolicyRule[], deny: EventPolicyRule[]}`
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
      `EventPolicyRule expects {domain: string, name: string}`
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
      `QueryPolicy expects {allow: QueryPolicyRule[], deny: QueryPolicyRule[]}`
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
    throw new TypeError(`QueryPolicyRule expects {rid: string, name: string}`);
  }
  return {
    rid: orig.rid.trim(),
    name: orig.name.trim()
  };
}

function cleanTags(tags: any): string[] {
  if (!Array.isArray(tags)) {
    throw new TypeError(
      "Channel `tags` must be an array of non-empty strings."
    );
  }
  return tags.map(tag => {
    if (typeof tag !== "string") {
      throw new TypeError(
        "Channel `tags` must be an array of non-empty strings."
      );
    }
    tag = tag
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    if (tag.length === 0) {
      throw new TypeError("Channel tag cannot be a blank string.");
    }
    if (tag === "system") {
      throw new TypeError('Cannot tag channel as "system".');
    }
    return tag;
  });
}
