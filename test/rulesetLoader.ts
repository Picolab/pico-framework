import test from "ava";
import { PicoFramework, Ruleset } from "../src";

test("rulesetLoader", async function(t) {
  const initLog: string[] = [];

  const ridA: Ruleset = {
    rid: "rid.A",
    version: "0.0.0",
    init(ctx) {
      initLog.push("started A");
      return {};
    }
  };
  const ridB: Ruleset = {
    rid: "rid.B",
    version: "0.0.0",
    init(ctx) {
      initLog.push("started B");
      return {};
    }
  };

  const loadable: Ruleset[] = [];

  const pf = new PicoFramework({
    async rulesetLoader(rid: string, version: string) {
      for (const rs of loadable) {
        if (rs.rid === rid && rs.version === version) {
          return rs;
        }
      }
    }
  });
  await pf.start();

  const pico = await pf.rootPico;

  t.deepEqual(initLog, []);

  let err = await t.throwsAsync(pico.install("rid.A", "0.0.0"));
  t.is(err + "", "Error: Ruleset not found rid.A@0.0.0");

  pf.addRuleset(ridA);

  await t.notThrowsAsync(pico.install("rid.A", "0.0.0"));
  t.deepEqual(initLog, ["started A"]);

  err = await t.throwsAsync(pico.install("rid.B", "0.0.0"));
  t.is(err + "", "Error: Ruleset not found rid.B@0.0.0");

  loadable.push(ridB);

  await t.notThrowsAsync(pico.install("rid.B", "0.0.0"));
  t.deepEqual(initLog, ["started A", "started B"]);
});
