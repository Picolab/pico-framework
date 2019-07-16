import * as _ from "lodash";
import test from "ava";
import { PicoFramework } from "../src";

test("raiseEvent", async function(t) {
  const pf = new PicoFramework();
  await pf.start();

  pf.addRuleset({
    rid: "rid.raise",
    version: "0.0.0",
    init(ctx) {
      const history: string[] = [];
      return {
        event(event) {
          switch (`${event.domain}:${event.name}`) {
            case "do:raise":
              history.push("doing raise");
              ctx.raiseEvent("got", "raise", { attrs: {} });
              break;
            case "got:raise":
              history.push("got the raise");
              break;
          }
        },
        query: {
          history: () => history
        }
      };
    }
  });

  const pico = pf.rootPico;
  const eci = (await pico.newChannel()).id;
  await pico.install("rid.raise", "0.0.0");

  let history = await pf.query({
    eci,
    rid: "rid.raise",
    name: "history",
    args: {}
  });
  t.is(history.join("|"), "");

  history = await pf.eventQuery(
    {
      eci,
      domain: "do",
      name: "raise",
      data: { attrs: {} },
      time: Date.now()
    },
    {
      eci,
      rid: "rid.raise",
      name: "history",
      args: {}
    }
  );

  t.is(history.join("|"), "doing raise|got the raise");
});

test("raiseEvent - forRid", async function(t) {
  let history: string[] = [];

  const pf = new PicoFramework();
  await pf.start();
  pf.addRuleset({
    rid: "rid.A",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          const dt = `${event.domain}:${event.name}`;
          switch (dt) {
            case "do:raise":
              history.push("doing raise");
              ctx.raiseEvent("got", "raise", {}, event.data.attrs.forRid);
              break;
            default:
              history.push("rid.A - " + dt);
              break;
          }
        }
      };
    }
  });
  pf.addRuleset({
    rid: "rid.A",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          history.push(`rid.A - ${event.domain}:${event.name}`);
          switch (`${event.domain}:${event.name}`) {
            case "do:raise":
              ctx.raiseEvent("got", "raise", {}, event.data.attrs.forRid);
          }
        }
      };
    }
  });
  pf.addRuleset({
    rid: "rid.B",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          history.push(`rid.B - ${event.domain}:${event.name}`);
        }
      };
    }
  });
  const pico = pf.rootPico;
  await pico.install("rid.A", "0.0.0");
  await pico.install("rid.B", "0.0.0");
  const eci = (await pico.newChannel()).id;

  await pf.eventWait({ eci, domain: "aaa", name: "aaa" } as any);
  t.deepEqual(history, ["rid.A - aaa:aaa", "rid.B - aaa:aaa"]);
  history = [];

  await pf.eventWait({ eci, domain: "do", name: "raise" } as any);
  t.deepEqual(history, [
    "rid.A - do:raise",
    "rid.B - do:raise",
    "rid.A - got:raise",
    "rid.B - got:raise"
  ]);
  history = [];

  await pf.eventWait({
    eci,
    domain: "do",
    name: "raise",
    data: { attrs: { forRid: "rid.A" } }
  } as any);
  t.deepEqual(history, [
    "rid.A - do:raise",
    "rid.B - do:raise",
    "rid.A - got:raise"
  ]);
  history = [];

  await pf.eventWait({
    eci,
    domain: "do",
    name: "raise",
    data: { attrs: { forRid: "rid.B" } }
  } as any);
  t.deepEqual(history, [
    "rid.A - do:raise",
    "rid.B - do:raise",
    "rid.B - got:raise"
  ]);
  history = [];

  await pf.eventWait({
    eci,
    domain: "do",
    name: "raise",
    data: { attrs: { forRid: "404" } }
  } as any);
  t.deepEqual(history, ["rid.A - do:raise", "rid.B - do:raise"]);
});
