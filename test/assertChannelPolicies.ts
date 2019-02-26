import test from "ava";
import {
  assertEventPolicy,
  assertQueryPolicy,
  EventPolicy,
  QueryPolicy
} from "../src/Channel";

test("policy = assertEventPolicy(policy)", function(t) {
  function wrapPolicy(eventPolicy: EventPolicy) {
    return function(domain: string, name: string) {
      try {
        assertEventPolicy(eventPolicy, {
          eci: "",
          domain: domain,
          name: name,
          data: { attrs: {} },
          time: 0
        });
        return true;
      } catch (err) {
        return err + "";
      }
    };
  }

  let policy = wrapPolicy({ allow: [], deny: [] });
  t.is(policy("foo", "bar"), "Error: Not allowed by channel policy");
  t.is(policy("*", "*"), "Error: Not allowed by channel policy");

  policy = wrapPolicy({ allow: [{ domain: "*", name: "*" }], deny: [] });
  t.is(policy("foo", "bar"), true);
  t.is(policy("bar", "foo"), true);

  policy = wrapPolicy({ allow: [{ domain: "foo", name: "*" }], deny: [] });
  t.is(policy("foo", "bar"), true);
  t.is(policy("bar", "foo"), "Error: Not allowed by channel policy");

  policy = wrapPolicy({
    allow: [{ domain: "foo", name: "*" }],
    deny: [{ domain: "*", name: "bar" }]
  });
  t.is(policy("foo", "ba"), true);
  t.is(policy("foo", "bar"), "Error: Denied by channel policy");
  t.is(policy("foo", "barr"), true);

  policy = wrapPolicy({
    allow: [],
    deny: [{ domain: "admin", name: "*" }]
  });
  t.is(policy("foo", "bar"), "Error: Not allowed by channel policy");
  t.is(policy("admin", "bar"), "Error: Denied by channel policy");
});

test("policy = assertQueryPolicy(policy)", function(t) {
  function wrapPolicy(queryPolicy: QueryPolicy) {
    return function(rid: string, name: string) {
      try {
        assertQueryPolicy(queryPolicy, {
          eci: "",
          rid,
          name,
          args: {}
        });
        return true;
      } catch (err) {
        return err + "";
      }
    };
  }

  let policy = wrapPolicy({ allow: [], deny: [] });
  t.is(policy("foo", "bar"), "Error: Not allowed by channel policy");
  t.is(policy("*", "*"), "Error: Not allowed by channel policy");

  policy = wrapPolicy({ allow: [{ rid: "*", name: "*" }], deny: [] });
  t.is(policy("foo", "bar"), true);
  t.is(policy("bar", "foo"), true);

  policy = wrapPolicy({ allow: [{ rid: "foo", name: "*" }], deny: [] });
  t.is(policy("foo", "bar"), true);
  t.is(policy("bar", "foo"), "Error: Not allowed by channel policy");

  policy = wrapPolicy({
    allow: [{ rid: "foo", name: "*" }],
    deny: [{ rid: "*", name: "bar" }]
  });
  t.is(policy("foo", "ba"), true);
  t.is(policy("foo", "bar"), "Error: Denied by channel policy");
  t.is(policy("foo", "barr"), true);

  policy = wrapPolicy({
    allow: [],
    deny: [{ rid: "admin", name: "*" }]
  });
  t.is(policy("foo", "bar"), "Error: Not allowed by channel policy");
  t.is(policy("admin", "bar"), "Error: Denied by channel policy");
});
