import test from "ava";
import { PicoFramework } from "../src";
import { Pico } from "../src/Pico";
const memdown = require("memdown");

function addRids(pf: PicoFramework) {
  ["one", "two", "three"].forEach(rid => {
    pf.addRuleset({
      rid,
      version: "0.0.0",
      init(ctx) {
        return {};
      }
    });
  });
}

test("persistent", async function(t) {
  const down = memdown();

  let nextId = 0;
  function genID() {
    return `id${nextId++}`;
  }

  const pf = new PicoFramework(down, genID);
  addRids(pf);

  const pico = await pf.getRootPico();
  const pico0 = await pico.newPico();
  const pico00 = await pico0.newPico();
  const pico1 = await pico.newPico();
  const pico10 = await pico1.newPico();
  const pico11 = await pico1.newPico();

  await pico.install("one", "0.0.0", { one: "two" });
  await pico0.install("two", "0.0.0", { some: { thing: 22 } });
  await pico00.install("three", "0.0.0", { aaa: 1 });
  await pico00.install("two", "0.0.0");
  await pico1.install("two", "0.0.0", { some: { thing: 22 } });
  await pico10.install("three", "0.0.0");

  const chann = await pico11.newChannel({ tags: ["one", "two"] });
  await pico11.putChannel(chann.id, { tags: ["changed", "it"] });

  const dumpBefore = await jsonDump(pf, await pf.getRootPico());

  const pfAfter = new PicoFramework(down, genID);
  addRids(pfAfter);
  const dumpAfter = await jsonDump(pfAfter, await pfAfter.getRootPico());

  t.deepEqual(dumpBefore, dumpAfter);
});

/**
 * dump the in-memory structure
 * to test if the picos are saved and reloaded at startup
 */
function jsonDump(pf: PicoFramework, pico: Pico): any {
  const json: any = Object.assign({}, pico.toReadOnly());
  json.childrenPicos = pico.children.map(eci => {
    const { pico } = pf.lookupChannel(eci);
    return jsonDump(pf, pico);
  });
  return json;
}
