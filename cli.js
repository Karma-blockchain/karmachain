#!/usr/bin/env node

const repl = require('repl'),
      karma = require('./index.js'),
      readline = require('readline'),
      Writable = require('stream').Writable;

var mutableStdout = new Writable({
  write: function(chunk, encoding, callback) {
    if (!this.muted)
      process.stdout.write(chunk, encoding);
    else
      process.stdout.write(Buffer.from('*', 'utf-8'), encoding);
    callback();
  }
});

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
  let 
    node = process.argv.includes("--node") 
              ? process.argv[process.argv.indexOf("--node") + 1] 
              : (process.argv.includes("--testnet") ? "wss://testnet-node.karma.red" : karma.node)

  return karma.connect(node, autoreconnect)
}

function showError(error) {
  console.log(`Error: ${error.message}`)
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
} else if (process.argv.includes("--history")) {
  let index = process.argv.indexOf("--history"),
      account_name = process.argv[index + 1],
      limit = process.argv[index + 2],
      start = process.argv[index + 3],
      stop = process.argv[index + 4];

  connect(false).then(async () => {
    try {
      let account = await karma.accounts[account_name]
      let history = await karma.history.get_account_history(
        account.id,
        /^1.11.\d+$/.test(start) ? start : "1.11.0",
        isNaN(limit) ? 100 : limit,
        /^1.11.\d+$/.test(stop) ? stop : "1.11.0"
      )
      console.log(JSON.stringify(history, null, 2))
    } catch(error) {
      console.log(`Error: ${error.message}`)
    }

    karma.disconnect()
  }, showError)
} else if (process.argv.includes("--help")) {
  if (process.argv.includes("--transfer"))
    console.log(`How to use '--transfer' key:
      $ karma --transfer <from> <to> <amount> <asset> [--key]`
    )
  else
    console.log(`Available keys:
      --version
      --account     <'name' or 'id' or 'last number in id'>
      --asset       <'symbol' or 'id' or 'last number in id'>
      --block       [<number>]
      --object      1.2.3
      --history     <account> [<limit>] [<start>] [<stop>]
      --transfer    <from> <to> <amount> <asset> [--key]
    `)
} else if (process.argv.includes("--transfer")) {
  let index = process.argv.indexOf("--transfer"),
      from = process.argv[index + 1],
      to = process.argv[index + 2],
      amount = process.argv[index + 3],
      asset = process.argv[index + 4].toUpperCase(),
      isKey = process.argv.includes("--key");

  connect(false).then(() => {
    /*
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    */
    rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    mutableStdout.muted = false;
    rl.question(`Enter the ${isKey ? 'private key' : 'password'}: `, async (answer) => {
      mutableStdout.muted = false;

      try {
        let account = isKey ? new karma(from, answer) : await karma.login(from, answer)

        rl.question('Write memo: ', async memo => {
          try {
            await account.transfer(to, asset, amount, memo)
            console.log(`Transfered ${amount} ${asset} from '${from}' to '${to}' with memo '${memo}'`)
          } catch(error) {
            console.log(`Error: ${error.message}`)
          }

          rl.close();
          karma.disconnect()
        })
      } catch(error) {
        console.log(`Error: ${error.message}`)
        rl.close();
        karma.disconnect()
      }
    });
    mutableStdout.muted = true;
  }, showError)
} else if (process.argv.includes("--version")) {
  console.log(`karmachain version: v${require('./package.json').version}`)
} else {
  const r = repl.start({ prompt: '> ' });
  initializeContext(r.context);

  r.on('reset', initializeContext);
}
