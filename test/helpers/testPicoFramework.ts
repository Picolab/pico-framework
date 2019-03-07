import { PicoFramework } from "../../src";
import { Ruleset } from "../../src/Ruleset";

export async function testPicoFramework(rootRulesets: Ruleset[]) {
  let nextId = 0;
  function genID() {
    return `id${nextId++}`;
  }

  const pf = new PicoFramework({ genID });
  await pf.start();

  for (const rs of rootRulesets) {
    pf.addRuleset(rs);
  }

  const pico = await pf.rootPico;
  for (const rs of rootRulesets) {
    await pico.install(rs.rid, rs.version);
  }
  const eci = (await pico.newChannel()).id;
  return { pf, eci };
}
