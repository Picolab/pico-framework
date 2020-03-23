import test from "ava";
import { PicoFramework } from "../src";
import { rulesetRegistry } from "./helpers/rulesetRegistry";

test("rulesetEnvironment", async function(t) {
  let lastInit: any;
  const environment = { some: "env" };
  const config = { some: "config" };

  const rsReg = rulesetRegistry();
  const pf = new PicoFramework({ rulesetLoader: rsReg.loader, environment });
  rsReg.add({
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

  await pico.install(rsReg.get("rid.A", "0.0.0"), config);

  t.is(lastInit.env, environment);
  t.is(lastInit.ctx.ruleset.config, config);
});
