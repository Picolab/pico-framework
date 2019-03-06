import { AbstractLevelDOWN } from "abstract-leveldown";
import * as cuid from "cuid";
import { default as level, LevelUp } from "levelup";
import { Channel, ChannelConfig } from "./Channel";
import { Pico, PicoRulesetReadOnly } from "./Pico";
import { Ruleset, RulesetConfig } from "./Ruleset";
const charwise = require("charwise");
const encode = require("encoding-down");
const safeJsonCodec = require("level-json-coerce-null");

export class Persistence {
  // TODO use db instead of in-memory
  private db: LevelUp;
  private picos: Pico[] = [];
  private channels: Channel[] = [];

  private installedRulesets: {
    [picoId: string]: {
      [rid: string]: {
        version: string;
        config: RulesetConfig;
      };
    };
  } = {};

  constructor(
    leveldown: AbstractLevelDOWN,
    private genID: () => string = cuid
  ) {
    this.db = level(
      encode(leveldown, {
        keyEncoding: charwise,
        valueEncoding: safeJsonCodec
      })
    );
  }

  addPico(pico: Pico) {
    this.picos.push(pico);
  }

  async install(picoId: string, rs: Ruleset, config: RulesetConfig = {}) {
    if (!this.installedRulesets[picoId]) {
      this.installedRulesets[picoId] = {};
    }

    if (this.installedRulesets[picoId][rs.rid]) {
      if (this.installedRulesets[picoId][rs.rid].version === rs.version) {
        // already have it
        // but we need to init again b/c configure may have changed
      } else {
        // old version
      }
    }
    this.installedRulesets[picoId][rs.rid] = {
      version: rs.version,
      config
    };
  }

  async uninstall(picoId: string, rid: string) {
    if (this.installedRulesets[picoId]) {
      delete this.installedRulesets[picoId][rid];
    }
  }

  picoRulesets(picoId: string): PicoRulesetReadOnly[] {
    return Object.keys(this.installedRulesets[picoId] || {}).map(
      (rid): PicoRulesetReadOnly => {
        return {
          rid,
          version: this.installedRulesets[picoId][rid].version,
          config: this.installedRulesets[picoId][rid].config
        };
      }
    );
  }

  async addChannel(
    picoId: string,
    conf?: ChannelConfig,
    familyChannelPicoID?: string
  ) {
    const chann = new Channel(picoId, this.genID(), conf, familyChannelPicoID);
    this.channels.push(chann);
    return chann;
  }

  async getMyChannel(picoId: string, eci: string): Promise<Channel> {
    const { channel } = this.lookupChannel(eci);
    if (picoId !== channel.picoId) {
      throw new Error(`ECI not found ${eci} on pico`);
    }
    return channel;
  }

  getMyChannels(picoId: string): Channel[] {
    return this.channels.filter(c => c.picoId === picoId);
  }

  async delChannel(eci: string) {
    this.channels = this.channels.filter(c => c.id !== eci);
  }

  removePico(picoId: string) {
    this.picos = this.picos.filter(p => p.id !== picoId);
  }

  lookupChannel(
    eci: string
  ): {
    pico: Pico;
    channel: Channel;
  } {
    for (const channel of this.channels) {
      if (channel.id === eci) {
        for (const pico of this.picos) {
          if (pico.id === channel.picoId) {
            return { pico, channel };
          }
        }
      }
    }
    throw new Error(`ECI not found ${eci}`);
  }

  private assertRidInstalled(picoId: string, rid: string) {
    if (this.installedRulesets[picoId]) {
      if (this.installedRulesets[picoId][rid]) {
        return;
      }
    }
    throw new Error(`Not installed ${rid}`);
  }

  async getEnt(picoId: string, rid: string, name: string) {
    this.assertRidInstalled(picoId, rid);
    let data: any;
    try {
      data = await this.db.get(["entvar", picoId, rid, name]);
    } catch (err) {
      if (err.notFound) {
        return null;
      }
    }
    return data;
  }

  async putEnt(picoId: string, rid: string, name: string, value: any) {
    this.assertRidInstalled(picoId, rid);
    await this.db.put(["entvar", picoId, rid, name], value);
  }

  async delEnt(picoId: string, rid: string, name: string) {
    this.assertRidInstalled(picoId, rid);
    await this.db.del(["entvar", picoId, rid, name]);
  }

  _test_allECIs(): string[] {
    return this.channels.map(c => c.id);
  }

  _test_allPicoIDs(): string[] {
    return this.picos.map(p => p.id);
  }
}
