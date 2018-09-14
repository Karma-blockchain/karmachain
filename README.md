# karmachain
Package for work with Karma blockchain

## Setup

This library can be obtained through npm:
```
# npm install karmachain
```

## Usage

__karmachain__ package contain class `Karma`: 
```js
const Karma = require("karmachain")
```
`Kamra` contains static methods for work with [public API](http://docs.bitshares.org/api/blockchain-api.html), and dynamic methods for work with [wallet API](http://docs.bitshares.org/api/wallet-api.html).

### Initialization

Example initialization:
```js
Karma.init('wss://node.karma.red')
```
After initialization, you can connect:
```js
Karma.connect()
```
`Karma.connect()` return Promise, resolve it when connection consists.

You may to subscribe to connection event:
```js
Karma.subscribe('connected',functionToCall)
```

### Public API

After connection, you may call public api methods. For example `Karma.db` return wrapper for [database API](http://docs.bitshares.org/api/database.html):
```js
Karma.db.get_objects(["1.3.0"])
Kamra.db.list_assets("krm",100)
```
`Karma.history` is wrapper for [history API](http://docs.bitshares.org/api/history.html):
```js
Karma.history.get_account_history("<account_id>", "1.11.0", 10, "1.11.0")
```

### Private API

If you want access to private API, you need create object from `Karma` class:
```js
let account = new Karma("accountName","privateActiveKey")
```
or
```js
let account = Karma.login("accountName","password")
```
`account` have `transfer` method:
```js
await account.transfer(toName, assetSymbol, amount, memo)
```

### Some examples:

```js
const Karma = require('karmachain')
KEY = 'privateActiveKey'

Karma.init('wss://node.karma.red')
Karma.subscribe('connected', startAfterConnected)

async function startAfterConnected() {
  let bot = new Karma('test-acc',KEY)

  let iam = await Karma.accounts['test-acc'];
  let info = await Karma.db.get_full_accounts([iam.id],false);
  
  console.log(info)
}
```

## Karma in REPL

If you install `karmachan`-package in global storage, you may start `karma` exec script:
```js
$ karma
>|
```
This command try autoconnect to mainnet karmachain. If you want to connect on testnet, try this:
```js
$ karma --testnet
>|
```

It is nodejs REPL with several variables:
- `karma`, main class `karmachain` package
- `login`, function to create object of class `Karma`
- `generateKeys`, to generateKeys from login and password
- `accounts`, is analog `Karma.accounts`
- `assets`, is analog `Karma.assets`
- `db`, is analog `Karma.db`
- `history`, is analog `Karma.hostory`
- `network`, is analog `Karma.network`
- `fees`, is analog `Karma.fees`

### For example

```js
$ karma
> assets["krm"].then(console.log)
```


## Contributing

Bug reports and pull requests are welcome on GitHub.

## License

The package is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
