# Changelog

## 0.8.1 - (unreleased)

* **Custom channel id at creation** — optional `ChannelConfig.id` on `Pico.newChannel` for operator-chosen ECIs (validated: min 12 chars, `[a-zA-Z0-9_-]` only, engine-wide uniqueness including pico ids). Family/system channels still auto-generate ids.
* **`PicoFramework.eciIsTaken(eci)`** — engine-wide check for channel or pico id collision.
* **`validateCustomChannelId`**, **`CUSTOM_CHANNEL_ID_MIN_LENGTH`**, **`CUSTOM_CHANNEL_ID_PATTERN`** exported from `pico-framework`.

## 0.8.0

* Multi-root picos: `rootPicos()`, `createRootPico()`, `autoCreateRootPico` option.
* Channel policy denormalized per channel (`allowsEventPolicy`, `allowsQueryPolicy`).
