import * as _ from "lodash";
import test from "ava";
import { ridCtx } from "./helpers/ridCtx";
import { testPicoFramework } from "./helpers/testPicoFramework";

test("testing the ctx functions", async function(t) {
  const { pf, eci } = await testPicoFramework([ridCtx]);

  function ctxEvent(name: string, args: any[] = []) {
    return pf.eventQuery(
      {
        eci,
        domain: "ctx",
        name,
        data: { attrs: { args } },
        time: Date.now()
      },
      {
        eci,
        rid: "rid.ctx",
        name: "_lastResult",
        args: {}
      }
    );
  }
  function ctxQuery(name: string, args: any = {}) {
    return pf.query({ eci, rid: "rid.ctx", name, args });
  }

  t.deepEqual(await ctxQuery("pico"), {
    parent: null,
    children: [],
    channels: [
      {
        id: "id1",
        tags: [],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] }
      }
    ],
    rulesets: [{ rid: "rid.ctx", version: "0.0.0", config: {} }]
  });

  t.deepEqual(await ctxEvent("newPico", []), {
    parent: "id5",
    children: [],
    channels: [
      {
        id: "id6",
        tags: [],
        eventPolicy: { allow: [{ domain: "*", name: "*" }], deny: [] },
        queryPolicy: { allow: [{ rid: "*", name: "*" }], deny: [] }
      }
    ],
    rulesets: []
  });
});
