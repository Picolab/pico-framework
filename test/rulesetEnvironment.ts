import test from "ava";
import { PicoFramework } from "../src";

test("rulesetEnvironment", async function(t) {
  let lastInit: any;
  const environment = { some: "env" };
  const config = { some: "config" };

  const pf = new PicoFramework({ environment });
  pf.addRuleset({
    rid: "rid.A",
    version: "0.0.0",
    init(ctx, env) {
      lastInit = { ctx, env };
      return {};
    }
  });
  await pf.start();
  const pico = await pf.rootPico;

  t.is(lastInit, undefined);

  await pico.install("rid.A", "0.0.0", config);

  t.is(lastInit.env, environment);
  t.is(lastInit.ctx.ruleset.config, config);
});
