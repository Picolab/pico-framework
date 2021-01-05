# pico-framework

[![Build Status](https://travis-ci.org/Picolab/pico-framework.svg)](https://travis-ci.org/Picolab/pico-framework)
[![codecov](https://codecov.io/gh/Picolab/pico-framework/branch/master/graph/badge.svg)](https://codecov.io/gh/Picolab/pico-framework)

A framework for building actor-based, people-centric systems. (pico = PersIstent Compute Objects)

## Why Picos?

An excellent explanation is [here](http://www.windley.com/archives/2015/05/picos_persistent_compute_objects.shtml).

## What the PicoFramework does

It handles the building blocks of a Pico based system.

- Picos
  - Parent / Child relationships
  - Channels
    - Events
    - Queries
    - Policies for them
  - Rulesets
  - What the ruleset code is allowed to do to a pico i.e. sandboxing

The pico-framework also handles persistence of the pico objects. You can provided the persistance layer via an implementation of [abstract-leveldown](https://github.com/Level/abstract-leveldown)

## Contributing

Be sure to run the tests before checking in changes.

```sh
npm test
```

## License

MIT
