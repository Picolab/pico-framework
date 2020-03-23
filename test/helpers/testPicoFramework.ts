import { PicoFramework } from "../../src";
import { Ruleset } from "../../src/Ruleset";
import { rulesetRegistry } from "./rulesetRegistry";

export async function testPicoFramework(rootRulesets: Ruleset[]) {
  let nextId = 0;
  function genID() {
    return `id${nextId++}`;
  }

  const rsReg = rulesetRegistry();
  const pf = new PicoFramework({ rulesetLoader: rsReg.loader, genID });
  await pf.start();

  for (const rs of rootRulesets) {
    rsReg.add(rs);
  }

  const pico = await pf.rootPico;
  for (const rs of rootRulesets) {
    await pico.install(rsReg.get(rs.rid, rs.version));
  }
  const eci = (await pico.newChannel()).id;
  return { pf, eci, rsReg, genID };
}
