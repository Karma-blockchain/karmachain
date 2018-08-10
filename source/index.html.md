---
title: API Reference

language_tabs: # must be one of https://git.io/vQNgJ
  - javascript

search: true
---

# Karmachain

Package for work with Karma blockchain

## Setup

```javascript
npm install karmachain
```

This library can be obtained through npm:

## Usage

```javascript
const Karma = require("karmachain")
```

__karmachain__ package contain class `Karma`:

`Kamra` contains static methods for work with [public API](http://docs.bitshares.org/api/blockchain-api.html), and dynamic methods for work with [wallet API](http://docs.bitshares.org/api/wallet-api.html).

### Initialization

```javascript
Karma.init('wss://node.karma.red')
```

Example initialization:

```javascript
Karma.connect()
```

After initialization, you can connect:

`Karma.connect()` return Promise, resolve it when connection consists.

```javascript
Karma.subscribe('connected',functionToCall)
```
You may to subscribe to connection event:


### Public API

```javascript
Karma.db.get_objects(["1.3.0"])
Kamra.db.list_assets("krm",100)
```

After connection, you may call public api methods. For example `Karma.db` return wrapper for [database API](http://docs.bitshares.org/api/database.html):

`Karma.history` is wrapper for [history API](http://docs.bitshares.org/api/history.html):

```javascript
Karma.history.get_account_history("<account_id>", "1.11.0", 10, "1.11.0")
```

### Private API

If you want access to private API, you need create object from `Karma` class:

```javascript
let account = new Karma("accountName","privateActiveKey")
```
or

```javascript
let account = Karma.login("accountName","password")
```

`account` have `transfer` method:

```javascript
await account.transfer(toName, assetSymbol, amount, memo)
```

# Some examples:

```javascript
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

## Contributing

Bug reports and pull requests are welcome on GitHub.

## License

The package is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
