import test from "ava";
import { PicoFramework } from "../src";
import { PicoFrameworkEvent } from "../src/PicoFrameworkEvent";

test("PicoFrameworkEvent", async function(t) {
  let log: PicoFrameworkEvent[] = [];

  let nextId = 0;

  const pf = new PicoFramework({
    genID() {
      return `id${nextId++}`;
    },
    onFrameworkEvent(e) {
      log.push(e);
    }
  });

  t.deepEqual(log, [{ type: "startup" }]);

  await pf.start();

  t.deepEqual(log, [{ type: "startup" }, { type: "startupDone" }]);
  log = [];

  const pico = await pf.rootPico;
  const eci = (await pico.newChannel()).id;

  const p = pf.eventWait({
    eci,
    domain: "one",
    name: "two",
    data: { attrs: {} },
    time: 0
  });

  t.is(log.length, 1);
  const entry = log[0];
  if (entry.type !== "txnQueued") {
    t.fail();
    return;
  }
  t.is(entry.picoId, "id0");
  const txn = entry.txn;

  log = [];

  await p;

  t.deepEqual(log, [
    { type: "txnStart", picoId: "id0", txn },
    { type: "txnDone", picoId: "id0", txn, data: undefined }
  ]);
});
