# mempool-frontend

## Contributing

This package is used for the https://mempool.space, https://liquid.network and https://bisq.markets websites - there are npm scripts to setup all three, which effectively change how BASE_MODULE is  configured:

```
$ npm run config:defaults:mempool
$ npm run config:defaults:liquid
$ npm run config:defaults:bisq
```

Changes that affect the frontend codebase only can be done using the production backend so you don't need to spin up the entire Mempool infrastructure. This is very convenient in case you want to quickly improve the UI, fix typos or implement new features that don't require any backend changes.

Make your changes, install the project dependencies and run the frontend server as follows:

```
$ npm install
$ npm run serve:local-prod
```

The frontend will be available at http://localhost:4200/ and all API requests will be proxied to the production server at https://mempool.space

After making your changes, you can run our end-to-end automation suite and check for possible regressions:

Headless:

```
$ npm run config:defaults:mempool && npm run cypress:run
```

Interactive:

```
$ npm run config:defaults:mempool && npm run cypress:open
```

This will open the Cypress test runner, where you can select any of the test files to run.

If all tests are green, submit your PR and it will be reviewed by someone on the team as soon as possible.

## Translations: Transifex Project

The mempool frontend strings are localized into 20+ locales:
https://www.transifex.com/mempool/mempool/dashboard/

### Translators

* Arabic @baro0k
* Czech @pixelmade2
* German @Emzy
* English (default)
* Spanish @maxhodler @bisqes
* Persian @techmix
* French @Bayernatoor
* Korean @kcalvinalvinn
* Italian @HodlBits
* Hebrew @Sh0ham
* Georgian @wyd_idk
* Hungarian @btcdragonlord
* Dutch @m__btc
* Japanese @wiz @japananon
* Norwegian @T82771355
* Polish @maciejsoltysiak
* Portugese @jgcastro1985
* Slovenian @thepkbadger
* Finnish @bio_bitcoin
* Swedish @softsimon_
* Thai @Gusb3ll
* Turkish @stackmore
* Ukrainian @volbil
* Vietnamese @bitcoin_vietnam
* Chinese @wdljt
* Russian @TonyCrusoe @Bitconan
* Romanian @mirceavesa
* Macedonian @SkechBoy
