import test from "ava";
import { PicoFramework } from "../src";

test("ruleset", async function(t) {
  let log: any[] = [];

  let nextId = 0;
  function genID() {
    return `id${nextId++}`;
  }

  const pf = new PicoFramework({ genID });
  pf.addRuleset({
    rid: "rid.A",
    version: "0.0.0",
    init(ctx, env) {
      return {
        event(event, eid) {
          log.push({ event, eid });
        },
        query: {
          hello(args, qid) {
            log.push({ args, qid });
          }
        }
      };
    }
  });
  await pf.start();
  const pico = await pf.rootPico;
  await pico.install("rid.A", "0.0.0", {});
  const eci = (await pico.newChannel()).id;

  t.deepEqual(log, []);

  const eid = await pico.event({
    eci,
    domain: "foo",
    name: "bar",
    data: { attrs: { aaa: 1 } },
    time: 0
  });

  t.is(eid, "id2");

  await pico.waitFor(eid);

  t.deepEqual(log, [
    {
      eid: "id2",
      event: {
        eci,
        domain: "foo",
        name: "bar",
        data: { attrs: { aaa: 1 } },
        time: 0
      }
    }
  ]);

  log = [];

  await pico.query({ eci, rid: "rid.A", name: "hello", args: { bbb: 2 } });

  t.deepEqual(log, [
    {
      qid: "id3",
      args: { bbb: 2 }
    }
  ]);
});
