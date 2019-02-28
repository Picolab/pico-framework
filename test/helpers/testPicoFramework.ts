import { PicoFramework } from "../../src";
import { Ruleset } from "../../src/Ruleset";
const memdown = require("memdown");

export async function testPicoFramework(rootRulesets: Ruleset[]) {
  let nextId = 0;
  function genID() {
    return `id${nextId++}`;
  }

  const pf = new PicoFramework(memdown(), genID);

  for (const rs of rootRulesets) {
    await pf.addRuleset(rs);
  }

  const pico = await pf.getRootPico();
  for (const rs of rootRulesets) {
    await pico.install(rs.rid, rs.version);
  }
  const eci = (await pico.newChannel()).id;
  return { pf, eci };
}
