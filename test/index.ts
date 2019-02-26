import * as _ from "lodash";
import test from "ava";
import { PicoFramework } from "../src";
import { isCuid } from "cuid";
const memdown = require("memdown");

test("hello world", async function(t) {
  const pf = new PicoFramework(memdown());

  pf.addRuleset({
    rid: "rid.hello",
    version: "0.0.0",
    init(ctx) {
      const state: any = {};
      return {
        event(event) {
          if (`${event.domain}:${event.name}` == "echo:hello") {
            state.status = `Said hello to ${
              event.data ? event.data.attrs.name : ""
            } with an event.`;
          }
        },
        query: {
          hello({ name }) {
            return `Hello ${name}!`;
          },
          status() {
            return state.status;
          }
        }
      };
    }
  });

  const pico = await pf.newPico();
  await pico.installRuleset("rid.hello", "0.0.0");
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
    await pf.send(
      {
        eci,
        domain: "echo",
        name: "hello",
        data: { attrs: { name: "Jim" } },
        time: Date.now()
      },
      {
        eci,
        rid: "rid.hello",
        name: "status",
        args: {}
      }
    ),
    "Said hello to Jim with an event."
  );
});

test("pico can pass configuration to rulesets", async function(t) {
  const pf = new PicoFramework(memdown());

  pf.addRuleset({
    rid: "some.rid",
    version: "0.0.0",
    init(ctx) {
      const confName = (ctx.config && ctx.config.name) || "default name";
      return {
        query: {
          name() {
            return confName;
          }
        }
      };
    }
  });

  const pico = await pf.newPico();
  const eci = pico.newChannel().id;

  await pico.installRuleset("some.rid", "0.0.0");

  t.deepEqual(
    await pf.query({
      eci,
      rid: "some.rid",
      name: "name",
      args: {}
    }),
    "default name"
  );

  await pico.installRuleset("some.rid", "0.0.0", { name: "Ove" });

  t.deepEqual(
    await pf.query({
      eci,
      rid: "some.rid",
      name: "name",
      args: {}
    }),
    "Ove"
  );
});

test("check channel policies", async function(t) {
  const pf = new PicoFramework(memdown());
  pf.addRuleset({
    rid: "some.rid",
    version: "0.0.0",
    init(ctx) {
      return {
        event(event) {
          if (event.name !== "foo") {
            t.fail("should not run this event");
          }
        },
        query: {
          foo: () => "foo",
          bar: () => "bar"
        }
      };
    }
  });
  const pico = await pf.newPico();
  await pico.installRuleset("some.rid", "0.0.0");
  const eci = pico.newChannel({
    eventPolicy: { allow: [{ domain: "*", name: "foo" }], deny: [] },
    queryPolicy: { allow: [{ rid: "*", name: "foo" }], deny: [] }
  }).id;

  async function doE(domain: string, name: string) {
    try {
      return await pf.send({
        eci,
        domain,
        name,
        data: { attrs: {} },
        time: 0
      });
    } catch (e) {
      return e + "";
    }
  }

  t.deepEqual(await doE("one", "bar"), "Error: Not allowed by channel policy");
  t.true(isCuid(await doE("one", "foo")));

  async function doQ(name: string) {
    try {
      return await pf.query({
        eci,
        rid: "some.rid",
        name,
        args: {}
      });
    } catch (e) {
      return e + "";
    }
  }

  t.deepEqual(await doQ("one"), "Error: Not allowed by channel policy");
  t.deepEqual(await doQ("foo"), "foo");
});
