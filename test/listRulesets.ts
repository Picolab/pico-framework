import test from "ava";
import { PicoFramework } from "../src";

test("listRulesets", async function(t) {
  const pf = new PicoFramework();
  t.deepEqual(pf.listRulesets(), []);

  pf.addRuleset({
    rid: "one",
    version: "0.0.0",
    init: () => ({})
  });
  pf.addRuleset({
    rid: "two",
    version: "0.0.0",
    init: () => ({})
  });
  pf.addRuleset({
    rid: "two",
    version: "0.1.0",
    init: () => ({})
  });
  pf.addRuleset({
    rid: "three",
    version: "3.2.1",
    init: () => ({})
  });
  pf.addRuleset({
    rid: "one",
    version: "2.1.1",
    init: () => ({})
  });

  t.deepEqual(
    pf.listRulesets().map(rs => {
      return `${rs.rid}@${rs.version}`;
    }),
    ["one@0.0.0", "one@2.1.1", "two@0.0.0", "two@0.1.0", "three@3.2.1"]
  );
});
