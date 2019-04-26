import test from "ava";
import { PicoFramework } from "../src";

test("reInitRuleset", async function(t) {
  const pf = new PicoFramework();
  await pf.start();
  const pico = await pf.rootPico;
  const eci = (await pico.newChannel()).id;

  pf.addRuleset({
    rid: "rid.A",
    version: "draft",
    init() {
      return { query: { foo: () => "one" } };
    }
  });
  await pico.install("rid.A", "draft");
  const daQuery = {
    eci,
    rid: "rid.A",
    name: "foo",
    args: {}
  };

  let res = await pf.query(daQuery);
  t.is(res, "one");

  pf.addRuleset({
    rid: "rid.A",
    version: "draft",
    init() {
      return { query: { foo: () => "two" } };
    }
  });

  res = await pf.query(daQuery);
  t.is(res, "one", "We get same response b/c it hasn't yet been reloaded");

  let errors = await pf.reInitRuleset("rid.A", "draft");
  t.deepEqual(errors, []);

  res = await pf.query(daQuery);
  t.is(res, "two");
});
