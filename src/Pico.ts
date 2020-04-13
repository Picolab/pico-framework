import * as _ from "lodash";
import { Channel, ChannelConfig, ChannelReadOnly } from "./Channel";
import { cleanEvent, PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from "./PicoFramework";
import { PicoFrameworkEvent } from "./PicoFrameworkEvent";
import { PicoQuery } from "./PicoQuery";
import { PicoQueue, PicoTxn } from "./PicoQueue";
import { Ruleset, RulesetConfig, RulesetInstance } from "./Ruleset";
import { createRulesetContext } from "./RulesetContext";
import { LevelBatch } from "./utils";

export interface PicoReadOnly {
  /**
   * The pico's id, used to correlate framework events.
   * This is also an ECI only the pico can use to talk to itself i.e. scheduled events
   */
  id: string;

  /**
   * The pico's parent ECI
   * This is null for the root pico.
   */
  parent: string | null;

  /**
   * List of ECIs to the pico's children
   */
  children: string[];

  /**
   * List of the pico's channels
   */
  channels: ChannelReadOnly[];

  /**
   * Rulesets installed on the pico
   */
  rulesets: PicoRulesetReadOnly[];
}

export interface PicoRulesetReadOnly {
  rid: string;
  version: string;
  config: RulesetConfig;
}

export interface NewPicoRuleset {
  rs: Ruleset;
  config?: RulesetConfig;
}

export interface NewPicoConfig {
  rulesets?: NewPicoRuleset[];
}

export class Pico {
  id: string;
  parent: string | null = null;
  children: string[] = [];
  channels: { [eci: string]: Channel } = {};
  rulesets: {
    [rid: string]: {
      instance: RulesetInstance;
      version: string;
      config: RulesetConfig;
    };
  } = {};

  private queue: PicoQueue;

  constructor(private pf: PicoFramework, id: string) {
    this.id = id;
    this.channels[id] = new Channel(this, id, { tags: ["system", "self"] }, id);

    this.queue = new PicoQueue(
      this.id,
      this.doTxn.bind(this),
      (ev: PicoFrameworkEvent) => this.pf.emit(ev)
    );
  }

  async event(event: PicoEvent): Promise<string> {
    const eid = this.pf.genID();
    this.queue.push({
      id: eid,
      kind: "event",
      event,
    });
    return eid;
  }

  eventWait(event: PicoEvent): Promise<any> {
    const eid = this.pf.genID();
    this.queue.push({
      id: eid,
      kind: "event",
      event,
    });
    return this.queue.waitFor(eid);
  }

  async eventQuery(event: PicoEvent, query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.queue.push({
      id: eid,
      kind: "event",
      event,
    });
    const eidQ = eid + ".q";
    this.queue.push({
      id: eidQ,
      kind: "query",
      query,
    });
    const p0 = this.queue.waitFor(eid);
    const p1 = this.queue.waitFor(eidQ);
    await p0; // this may throwup
    return p1;
  }

  async query(query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.queue.push({
      id: eid,
      kind: "query",
      query,
    });
    return this.queue.waitFor(eid);
  }

  getCurrentTxn(): PicoTxn | undefined {
    return this.queue.getCurrentTxn();
  }

  waitFor(txnId: string): Promise<any> {
    return this.queue.waitFor(txnId);
  }

  async newPico(conf?: NewPicoConfig) {
    const child = new Pico(this.pf, this.pf.genID());
    const parentChannel = this.newChannelBase(
      { tags: ["system", "parent"] },
      child.id
    );
    child.parent = parentChannel.id;

    const childChannel = child.newChannelBase(
      { tags: ["system", "child"] },
      this.id
    );
    child.channels[childChannel.id] = childChannel;
    this.children.push(childChannel.id);

    const dbOps: LevelBatch[] = [
      this.toDbPut(),
      child.toDbPut(),
      parentChannel.toDbPut(),
      childChannel.toDbPut(),
    ];

    if (conf && conf.rulesets) {
      for (const rs of conf.rulesets) {
        const { instance, dbPut } = await child.installBase(rs.rs, rs.config);
        dbOps.push(dbPut);
        child.rulesets[rs.rs.rid] = {
          version: rs.rs.version,
          config: rs.config || {},
          instance,
        };
      }
    }

    try {
      await this.pf.db.batch(dbOps);
    } catch (err) {
      this.children = this.children.filter((c) => c !== childChannel.id);
      throw err;
    }

    this.channels[parentChannel.id] = parentChannel;
    this.pf.addPico(child);

    return childChannel.id;
  }

  async delPico(eci: string) {
    if (this.children.indexOf(eci) < 0) {
      throw new Error(`delPico(${eci}) - not found in children ECIs`);
    }

    const { pico } = this.pf.lookupChannel(eci);

    const { ops, picoIds } = pico.delPicoDbOps();

    if (pico.parent) {
      ops.push(this.channels[pico.parent].toDbDel());
    }

    this.children = this.children.filter((c) => c !== eci);
    ops.push(this.toDbPut());

    try {
      await this.pf.db.batch(ops);
    } catch (err) {
      this.children.push(eci); // restore state
      throw err;
    }

    if (pico.parent) {
      delete this.channels[pico.parent];
    }
    for (const id of picoIds) {
      this.pf.removePico(id);
    }
  }

  /**
   * Recursively get the delete operations and ids
   * DO NOT mutate state, only build the operations
   */
  private delPicoDbOps(): { ops: LevelBatch[]; picoIds: string[] } {
    let ops: LevelBatch[] = [];
    let picoIds: string[] = [];

    for (const eci of this.children) {
      // recursive delete
      const { pico } = this.pf.lookupChannel(eci);
      const sub = pico.delPicoDbOps();
      ops = ops.concat(sub.ops);
      picoIds = picoIds.concat(sub.picoIds);
    }

    for (const channel of Object.values(this.channels)) {
      ops.push(channel.toDbDel());
    }
    for (const rid of Object.keys(this.rulesets)) {
      ops.push(this.uninstallBase(rid));
    }
    ops.push(this.toDbDel());

    picoIds.push(this.id);

    return { ops, picoIds };
  }

  toReadOnly(): PicoReadOnly {
    const data: PicoReadOnly = {
      id: this.id,
      parent: this.parent,
      children: this.children.slice(0),
      channels: Object.values(this.channels).map((c) => c.toReadOnly()),
      rulesets: Object.keys(this.rulesets).map((rid) => ({
        rid,
        version: this.rulesets[rid].version,
        config: this.rulesets[rid].config,
      })),
    };
    data.channels = _.sortBy(data.channels, (c) => {
      return c.id;
    });
    return Object.freeze(data);
  }

  toDbPut(): LevelBatch {
    return {
      type: "put",
      key: ["pico", this.id],
      value: {
        id: this.id,
        parent: this.parent,
        children: this.children.slice(0),
      },
    };
  }

  toDbDel(): LevelBatch {
    return { type: "del", key: ["pico", this.id] };
  }

  static fromDb(pf: PicoFramework, val: any): Pico {
    const pico = new Pico(pf, val.id);
    pico.parent = val.parent;
    pico.children = val.children;
    return pico;
  }

  async newChannel(
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ): Promise<Channel> {
    const chann = this.newChannelBase(conf, familyChannelPicoID);
    await this.pf.db.batch([chann.toDbPut()]);
    this.channels[chann.id] = chann;
    return chann;
  }

  private newChannelBase(
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ): Channel {
    const chann = new Channel(this, this.pf.genID(), conf, familyChannelPicoID);
    return chann;
  }

  async putChannel(eci: string, conf: ChannelConfig): Promise<Channel> {
    const chann = this.channels[eci];
    if (!chann) {
      throw new Error(`ECI not found ${eci}`);
    }
    if (chann.familyChannelPicoID == this.id) {
      throw new Error("Cannot edit the self channel.");
    }
    chann.update(conf);
    await this.pf.db.batch([chann.toDbPut()]);
    return chann;
  }

  async delChannel(eci: string): Promise<void> {
    const chann = this.channels[eci];
    if (!chann) {
      throw new Error(`ECI not found ${eci}`);
    }
    if (chann.familyChannelPicoID) {
      throw new Error("Cannot delete family channels.");
    }
    await this.pf.db.del(["pico-channel", chann.id]);
    delete this.channels[eci];
  }

  async install(rs: Ruleset, config: RulesetConfig = {}) {
    const { instance, dbPut } = await this.installBase(rs, config);
    await this.pf.db.batch([dbPut]);
    this.rulesets[rs.rid] = { version: rs.version, config, instance };
  }

  async reInitRuleset(rs: Ruleset) {
    const rid = rs.rid;
    const version = rs.version;
    if (this.rulesets[rid] && this.rulesets[rid].version === version) {
      const config = this.rulesets[rid].config;
      const ctx = createRulesetContext(this.pf, this, { rid, version, config });
      const instance = await rs.init(ctx, this.pf.environment);
      this.rulesets[rid].instance = instance;
    }
  }

  private async installBase(
    rs: Ruleset,
    config: RulesetConfig = {}
  ): Promise<{ instance: RulesetInstance; dbPut: LevelBatch }> {
    // even if we already have that rid installed, we need to init again
    // b/c the version or configuration may have changed
    const ctx = createRulesetContext(this.pf, this, {
      rid: rs.rid,
      version: rs.version,
      config,
    });
    const instance = await rs.init(ctx, this.pf.environment);

    return {
      instance,
      dbPut: {
        type: "put",
        key: ["pico-ruleset", this.id, rs.rid],
        value: {
          rid: rs.rid,
          version: rs.version,
          config,
        },
      },
    };
  }

  async uninstall(rid: string) {
    await this.pf.db.batch([this.uninstallBase(rid)]);
    delete this.rulesets[rid];
  }

  private uninstallBase(rid: string): LevelBatch {
    return {
      type: "del",
      key: ["pico-ruleset", this.id, rid],
    };
  }

  private assertInstalled(rid: string) {
    if (!this.rulesets[rid]) {
      throw new Error(`Not installed ${rid}`);
    }
  }

  async getEnt(rid: string, name: string) {
    this.assertInstalled(rid);
    let data: any;
    try {
      data = await this.pf.db.get(["entvar", this.id, rid, name]);
    } catch (err) {
      if (err.notFound) {
        return null;
      }
    }
    return data;
  }

  async putEnt(rid: string, name: string, value: any) {
    this.assertInstalled(rid);
    await this.pf.db.put(["entvar", this.id, rid, name], value);
  }

  async delEnt(rid: string, name: string) {
    this.assertInstalled(rid);
    await this.pf.db.del(["entvar", this.id, rid, name]);
  }

  private schedule: { rid: string; event: PicoEvent }[] = [];
  private current: { rid: string; event: PicoEvent } | undefined;

  raiseEvent(
    domain: string,
    name: string,
    attrs: PicoEventPayload["attrs"],
    forRid?: string
  ) {
    const event = cleanEvent({
      eci: (this.current && this.current.event.eci) || "[raise]",
      domain,
      name,
      data: { attrs },
    });
    if (typeof forRid === "string") {
      this.schedule.push({ rid: forRid, event });
    } else {
      this.addEventToSchedule(event);
    }
  }

  clearSchedule() {
    this.schedule = [];
  }

  private addEventToSchedule(event: PicoEvent) {
    for (const rid of Object.keys(this.rulesets)) {
      this.schedule.push({ rid, event });
    }
  }

  private async doTxn(txn: PicoTxn): Promise<any> {
    switch (txn.kind) {
      case "event":
        this.schedule = []; // reset schedule every new event
        this.addEventToSchedule(txn.event);
        const eid = txn.id;
        const responses: any[] = [];
        try {
          while ((this.current = this.schedule.shift())) {
            const rs = this.rulesets[this.current.rid];
            if (rs && rs.instance.event) {
              // must process one event at a time to maintain the pico's single-threaded guarantee
              const response = await rs.instance.event(this.current.event, eid);
              responses.push(response);
            }
          }
        } finally {
          this.current = undefined;
        }
        return { eid, responses };
      case "query":
        const rs = this.rulesets[txn.query.rid];
        if (!rs) {
          throw new Error(`Pico doesn't have ${txn.query.rid} installed.`);
        }
        const qfn = rs.instance.query && rs.instance.query[txn.query.name];
        if (!qfn) {
          throw new Error(
            `Ruleset ${txn.query.rid} does not have query function "${txn.query.name}"`
          );
        }
        const data = await qfn(txn.query.args, txn.id);
        return data;
    }
  }
}
