import * as _ from "lodash";
import test from "ava";
import { PicoFramework } from "../src";
const memdown = require("memdown");

test("raiseEvent", async function(t) {
  const pf = new PicoFramework(memdown());

  await pf.addRuleset({
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

  const pico = await pf.getRootPico();
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
