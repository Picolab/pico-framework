import test from "ava";
import { PicoFramework, Ruleset } from "../src";
const memdown = require("memdown");

test("rulesetStartup", async function(t) {
  let errorOnInit = false;

  const rs: Ruleset = {
    rid: "rid.A",
    version: "0.0.0",
    init(ctx) {
      if (errorOnInit) {
        throw new Error("errorOnInit = true");
      }
      return {};
    }
  };

  const down = memdown();
  let pf = new PicoFramework({ leveldown: down });
  pf.addRuleset(rs);
  await pf.start();
  const pico = await pf.rootPico;
  await pico.install("rid.A", "0.0.0");

  // Restart - this time fail to startup the ruleset
  errorOnInit = true;
  pf = new PicoFramework({ leveldown: down });
  pf.addRuleset(rs);
  let err = await t.throwsAsync(pf.start());
  t.is(err + "", "Error: errorOnInit = true");

  // Restart - this time swallow the error
  let swallowedErrors: string[] = [];
  pf = new PicoFramework({
    leveldown: down,
    onStartupRulesetInitError(pico, rid, version, config, error) {
      swallowedErrors.push(
        rid + "@" + version + JSON.stringify(config) + error
      );
    }
  });
  pf.addRuleset(rs);

  t.deepEqual(swallowedErrors, []);
  await pf.start();

  t.is(swallowedErrors.length, 1);
  t.is(swallowedErrors[0], "rid.A@0.0.0{}Error: errorOnInit = true");
});
