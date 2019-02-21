import * as _ from "lodash";
import test from "ava";
import { PicoFramework } from "../src";
const memdown = require("memdown");

test("hello world", async function(t) {
  const pf = new PicoFramework(memdown());

  pf.addRuleset({
    rid: "rid.hello",
    version: "0.0.0",
    init(pf, pico) {
      const state: any = {};
      return {
        event: function(event) {
          if (`${event.domain}:${event.name}` == "echo:hello") {
            state.status = `Said hello to ${
              event.data ? event.data.attrs.name : ""
            } with an event.`;
          }
        },
        query: function(name, attrs) {
          if (name === "hello") {
            return `Hello ${attrs.name}!`;
          } else if (name === "status") {
            return state.status;
          }
        }
      };
    }
  });

  const pico = await pf.newPico();
  pico.installRuleset("rid.hello", "0.0.0");
  const eci = pico.newChannel().id;

  t.is(
    await pf.query({
      eci,
      rid: "rid.hello",
      name: "hello",
      args: { name: "Bob" }
    }),
    "Hello Bob!"
  );

  t.is(
    await pf.query({
      eci,
      rid: "rid.hello",
      name: "status",
      args: {}
    }),
    undefined
  );
  const eid = await pf.send({
    eci,
    domain: "echo",
    name: "hello",
    data: { attrs: { name: "Ed" } },
    time: Date.now()
  });
  t.true(/^c[a-z0-9]+/.test(eid));

  t.is(
    await pf.query({
      eci,
      rid: "rid.hello",
      name: "status",
      args: {}
    }),
    "Said hello to Ed with an event."
  );

  t.is(
    await pf.send({
      eci,
      domain: "echo",
      name: "hello",
      data: { attrs: { name: "Jim" } },
      time: Date.now(),
      query: {
        eci,
        rid: "rid.hello",
        name: "status",
        args: {}
      }
    }),
    "Said hello to Jim with an event."
  );
});
