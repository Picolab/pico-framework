import * as _ from "lodash";
import { Channel, ChannelConfig, ChannelReadOnly } from "./Channel";
import { PicoEvent, PicoEventPayload } from "./PicoEvent";
import { PicoFramework } from "./PicoFramework";
import { PicoQuery } from "./PicoQuery";
import { Ruleset, RulesetConfig, RulesetInstance } from "./Ruleset";
import { createRulesetContext } from "./RulesetContext";
import { LevelBatch } from "./utils";

interface PicoTxn_base {
  id: string;
}
interface PicoTxn_event extends PicoTxn_base {
  kind: "event";
  event: PicoEvent;
}
interface PicoTxn_query extends PicoTxn_base {
  kind: "query";
  query: PicoQuery;
}
type PicoTxn = PicoTxn_event | PicoTxn_query;

export interface PicoReadOnly {
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
  rid: string;
  version: string;
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

  // TODO use flumelog-offset or similar
  private txnLog: PicoTxn[] = [];
  private txnWaiters: {
    [id: string]: { resolve: (data: any) => void; reject: (err: any) => void };
  } = {};

  constructor(private pf: PicoFramework, id: string) {
    this.id = id;
  }

  async event(event: PicoEvent): Promise<string> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    setTimeout(() => this.doWork(), 0);
    return eid;
  }

  async eventWait(event: PicoEvent): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    const p = this.waitFor(eid);
    setTimeout(() => this.doWork(), 0);
    return p;
  }

  async eventQuery(event: PicoEvent, query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "event",
      event
    });
    const eidQ = eid + ".q";
    this.txnLog.push({
      id: eidQ,
      kind: "query",
      query
    });
    const p0 = this.waitFor(eid);
    const p1 = this.waitFor(eidQ);
    setTimeout(() => this.doWork(), 0);
    await p0; // this may throwup
    return p1;
  }

  async query(query: PicoQuery): Promise<any> {
    const eid = this.pf.genID();
    this.txnLog.push({
      id: eid,
      kind: "query",
      query
    });
    setTimeout(() => this.doWork(), 0);
    return this.waitFor(eid);
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
      childChannel.toDbPut()
    ];

    if (conf && conf.rulesets) {
      for (const rs of conf.rulesets) {
        const { instance, dbPut } = await child.installBase(
          rs.rid,
          rs.version,
          rs.config
        );
        dbOps.push(dbPut);
        child.rulesets[rs.rid] = {
          version: rs.version,
          config: rs.config || {},
          instance
        };
      }
    }

    try {
      await this.pf.db.batch(dbOps);
    } catch (err) {
      this.children = this.children.filter(c => c !== childChannel.id);
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

    this.children = this.children.filter(c => c !== eci);
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
      parent: this.parent,
      children: this.children.slice(0),
      channels: Object.values(this.channels).map(c => c.toReadOnly()),
      rulesets: Object.keys(this.rulesets).map(rid => ({
        rid,
        version: this.rulesets[rid].version,
        config: this.rulesets[rid].config
      }))
    };
    data.channels = _.sortBy(data.channels, c => {
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
        children: this.children.slice(0)
      }
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

  async install(rid: string, version: string, config: RulesetConfig = {}) {
    const { instance, dbPut } = await this.installBase(rid, version, config);
    await this.pf.db.batch([dbPut]);
    this.rulesets[rid] = { version, config, instance };
  }

  async reInitRuleset(rs: Ruleset) {
    const rid = rs.rid;
    const version = rs.version;
    if (this.rulesets[rid] && this.rulesets[rid].version === version) {
      const config = this.rulesets[rid].config;
      const ctx = createRulesetContext(this.pf, this, { rid, version, config });
      const instance = await rs.init(ctx);
      this.rulesets[rid].instance = instance;
    }
  }

  private async installBase(
    rid: string,
    version: string,
    config: RulesetConfig = {}
  ): Promise<{ instance: RulesetInstance; dbPut: LevelBatch }> {
    const rs = await this.pf.getRuleset(rid, version);

    // even if we already have that rid installed, we need to init again
    // b/c the version or configuration may have changed
    const ctx = createRulesetContext(this.pf, this, { rid, version, config });
    const instance = await rs.init(ctx);

    return {
      instance,
      dbPut: {
        type: "put",
        key: ["pico-ruleset", this.id, rid],
        value: {
          rid,
          version,
          config
        }
      }
    };
  }

  async uninstall(rid: string) {
    await this.pf.db.del(["pico-ruleset", this.id, rid]);
    delete this.rulesets[rid];
  }

  private uninstallBase(rid: string): LevelBatch {
    return {
      type: "del",
      key: ["pico-ruleset", this.id, rid]
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

  waitFor(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.txnWaiters[id] = { resolve, reject };
    });
  }

  private isWorking = false;
  private async doWork() {
    if (this.isWorking) {
      return;
    }
    this.isWorking = true;
    let txn;
    while ((txn = this.txnLog.shift())) {
      let data;
      let error;
      try {
        data = await this.doTxn(txn);
      } catch (err) {
        error = err;
      }
      if (this.txnWaiters[txn.id]) {
        if (error) {
          this.txnWaiters[txn.id].reject(error);
        } else {
          this.txnWaiters[txn.id].resolve(data);
        }
        delete this.txnWaiters[txn.id];
      }
    }
    this.txnWaiters = {};
    this.isWorking = false;
  }

  private schedule: PicoEvent[] = [];

  raiseEvent(domain: string, name: string, data: PicoEventPayload) {
    this.schedule.push({
      eci: "[raise]",
      domain,
      name,
      data,
      time: Date.now()
    });
  }

  private async doTxn(txn: PicoTxn): Promise<any> {
    switch (txn.kind) {
      case "event":
        this.schedule = []; // reset schedule every new event
        this.schedule.push(txn.event);
        let event: PicoEvent | undefined;
        while ((event = this.schedule.shift())) {
          for (const rs of Object.values(this.rulesets)) {
            if (rs.instance.event) {
              // must process one event at a time to maintain pico single-threadedness
              await rs.instance.event(event);
            }
          }
        }
        return;
      case "query":
        const rs = this.rulesets[txn.query.rid];
        if (!rs) {
          throw new Error(`Pico doesn't have ${txn.query.rid} installed.`);
        }
        const qfn = rs.instance.query && rs.instance.query[txn.query.name];
        if (!qfn) {
          throw new Error(
            `Ruleset ${txn.query.rid} does not have query function "${
              txn.query.name
            }"`
          );
        }
        const data = await qfn(txn.query.args);
        return data;
    }
  }
}
