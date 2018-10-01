#!/usr/bin/env node

const repl = require('repl');
const karma = require('./index.js');

function initializeContext(context) {
  connect().then(() => {
    context.accounts = karma.accounts;
    context.assets = karma.assets;
    context.db = karma.db;
    context.history = karma.history;
    context.network = karma.network;
    context.fees = karma.fees;
  })

  context.karma = karma;
  context.login = karma.login.bind(karma)
  context.generateKeys = karma.generateKeys
}

function connect(autoreconnect = true) {
  let node = process.argv.includes("--testnet") ? "wss://testnet-node.karma.red" : undefined

  karma.init(node, false, autoreconnect)
  return karma.connect()
}

function showError(error) {
  console.log(error.message)
  karma.disconnect()
}

if (process.argv.includes("--account")) {
  let index = process.argv.indexOf("--account")

  connect(false).then(() => {
    karma.accounts[process.argv[index + 1]].then(result => {
      console.log(JSON.stringify(result, null, 2))
      karma.disconnect()
    }, showError)
  })
} else if (process.argv.includes("--asset")) {
  let index = process.argv.indexOf("--asset")

  connect(false).then(() => {
    karma.assets[process.argv[index + 1]].then(result => {
      console.log(JSON.stringify(result, null, 2))
      karma.disconnect()
    }, showError)
  })
} else if (process.argv.includes("--block")) {
  let index = process.argv.indexOf("--block")

  connect(false).then(async () => {
    let block_num = process.argv[index + 1] || (await karma.db.get_dynamic_global_properties()).head_block_number
    karma.db.get_block(block_num).then(result => {
      console.log(`block_num: ${block_num}`)
      console.log(JSON.stringify(result, null, 2))
      karma.disconnect()
    }, showError)
  })
} else if (process.argv.includes("--object")) {
  let index = process.argv.indexOf("--object")

  connect(false).then(() => {
    karma.db.get_objects([process.argv[index + 1]]).then(result => {
      console.log(JSON.stringify(result[0], null, 2))
      karma.disconnect()
    }, showError)
  })
} else {
  const r = repl.start({ prompt: '> ' });
  initializeContext(r.context);

  r.on('reset', initializeContext);
}

