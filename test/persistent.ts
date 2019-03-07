import test from "ava";
import { PicoFramework } from "../src";
import { dbRange } from "../src/dbRange";
import { jsonDumpPico } from "./helpers/inspect";
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

  let pf = new PicoFramework(down, genID);
  addRids(pf);
  await pf.start();

  let pico = pf.rootPico;
  let pico0 = await pico.newPico();
  let pico00 = await pico0.newPico();
  let pico000 = await pico00.newPico();
  let pico1 = await pico.newPico();
  let pico10 = await pico1.newPico();
  let pico11 = await pico1.newPico();

  await pico.install("one", "0.0.0", { one: "two" });
  await pico0.install("two", "0.0.0", { some: { thing: 22 } });
  await pico00.install("three", "0.0.0", { aaa: 1 });
  await pico00.install("two", "0.0.0");
  await pico000.install("two", "0.0.0");
  await pico1.install("two", "0.0.0", { some: { thing: 22 } });
  await pico10.install("three", "0.0.0");

  let chann = await pico11.newChannel({ tags: ["one", "two"] });
  await pico11.putChannel(chann.id, { tags: ["changed", "it"] });

  let dumpBefore = await jsonDumpPico(pf, pf.rootPico);

  pf = new PicoFramework(down, genID);
  addRids(pf);
  await pf.start();

  let dumpAfter = await jsonDumpPico(pf, pf.rootPico);
  t.deepEqual(dumpBefore, dumpAfter);

  t.is(pf.numberOfPicos(), 7);

  pico = pf.rootPico;
  await pico.uninstall("one");
  for (const eci of pico.children) {
    await pico.delPico(eci);
  }

  t.is(pf.numberOfPicos(), 1);

  t.deepEqual(await jsonDumpPico(pf, pf.rootPico), {
    parent: null,
    children: [],
    channels: [],
    rulesets: [],
    childrenPicos: []
  });

  pf = new PicoFramework(down, genID);
  addRids(pf);
  await pf.start();

  t.deepEqual(await jsonDumpPico(pf, pf.rootPico), {
    parent: null,
    children: [],
    channels: [],
    rulesets: [],
    childrenPicos: []
  });

  const dbKeys = await dbRange(pf.db, {}, function(data) {
    return data.key.join("|");
  });
  t.deepEqual(dbKeys, ["pico|id0", "root-pico"]);
});
