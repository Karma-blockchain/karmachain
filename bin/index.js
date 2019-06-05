#!/usr/bin/env node

const repl = require("repl"),
  karma = require("../index.js"),
  readline = require("readline"),
  Writable = require("stream").Writable,
  operations = require("./operations.json");

var mutableStdout = new Writable({
  write: function(chunk, encoding, callback) {
    if (!this.muted) process.stdout.write(chunk, encoding);
    else process.stdout.write(Buffer.from("*", "utf-8"), encoding);
    callback();
  }
});

var rl;

function initializeContext(context) {
  connect().then(() => {
    context.accounts = karma.accounts;
    context.assets = karma.assets;
    context.db = karma.db;
    context.history = karma.history;
    context.network = karma.network;
    context.fees = karma.fees;
  });

  context.karma = karma;
  context.login = karma.login.bind(karma);
  context.generateKeys = karma.generateKeys;
}

function connect(autoreconnect = true) {
  let node = process.argv.includes("--node")
    ? process.argv[process.argv.indexOf("--node") + 1]
    : process.argv.includes("--testnet")
    ? "wss://testnet-node.karma.red"
    : karma.node;

  return karma.connect(node, autoreconnect);
}

function showError(error) {
  console.log(`Error: ${error.message}`);
  karma.disconnect();
}
if (process.argv.includes("--help")) {
  console.log(`Available keys:
    --version
    --account     <'name' or 'id' or 'last number in id'>
    --asset       <'symbol' or 'id' or 'last number in id'>
    --block       [<number>]
    --object      1.2.3
    --history     <account> [<limit>] [<start>] [<stop>] [--key <memoKey>]
    --balance     <account or accounts> [<asset or assets>]
    --transfer    <from> <to> <amount> <asset> [--key]
    --mint        <from> <to> <amount> <asset> [--key]
    --burn        <account> <amount> <asset> [--key]
  `);
} else if (process.argv.includes("--account")) {
  let index = process.argv.indexOf("--account");

  connect(false).then(() => {
    karma.accounts[process.argv[index + 1]].then(result => {
      console.log(JSON.stringify(result, null, 2));
      karma.disconnect();
    }, showError);
  });
} else if (process.argv.includes("--asset")) {
  let index = process.argv.indexOf("--asset");

  connect(false).then(() => {
    karma.assets[process.argv[index + 1]].then(result => {
      console.log(JSON.stringify(result, null, 2));
      karma.disconnect();
    }, showError);
  });
} else if (process.argv.includes("--block")) {
  let index = process.argv.indexOf("--block");

  connect(false).then(async () => {
    let block_num =
      process.argv[index + 1] ||
      (await karma.db.get_dynamic_global_properties()).head_block_number;
    karma.db.get_block(block_num).then(result => {
      console.log(`block_num: ${block_num}`);
      console.log(JSON.stringify(result, null, 2));
      karma.disconnect();
    }, showError);
  });
} else if (process.argv.includes("--object")) {
  let index = process.argv.indexOf("--object");

  connect(false).then(() => {
    karma.db.get_objects([process.argv[index + 1]]).then(result => {
      console.log(JSON.stringify(result[0], null, 2));
      karma.disconnect();
    }, showError);
  });
} else if (process.argv.includes("--history")) {
  let index = process.argv.indexOf("--history"),
    account_name = process.argv[index + 1],
    limit = process.argv[index + 2],
    start = process.argv[index + 3],
    stop = process.argv[index + 4];

  connect(false).then(async () => {
    try {
      let account = await karma.accounts[account_name];
      let history = await karma.history.get_account_history(
        account.id,
        /^1.11.\d+$/.test(start) ? start : "1.11.0",
        isNaN(limit) ? 100 : limit,
        /^1.11.\d+$/.test(stop) ? stop : "1.11.0"
      );

      let acc = null;
      if (process.argv.includes("--key")) {
        acc = new karma(account_name);
        acc.setMemoKey(process.argv[process.argv.indexOf("--key") + 1]);
      }

      //console.log(JSON.stringify(history, null, 2))
      let i = 0;
      for (; i < history.length; i++) {
        let op = history[i];
        let txt = `id: ${op.id}, ${operations[op.op[0]]} = `;
        if (op.op[0] == 0) {
          let asset = await karma.assets.id(op.op[1].amount.asset_id);
          let from = await karma.accounts.id(op.op[1].from);
          let to = await karma.accounts.id(op.op[1].to);

          txt += `from: ${from.name}, to: ${to.name}, amount: ${op.op[1].amount
            .amount /
            10 ** asset.precision} ${asset.symbol}, ${
            acc && op.op[1].memo && to.name === account_name
              ? `memo: ${acc.memoDecode(op.op[1].memo)}`
              : ""
          }`;
        } else txt += JSON.stringify(op.op[1]);
        console.log(txt);
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }

    karma.disconnect();
  }, showError);
} else if (process.argv.includes("--balance")) {
  let index = process.argv.indexOf("--balance"),
    accounts = process.argv[index + 1],
    assets = process.argv[index + 2];

  connect(false).then(async () => {
    try {
      try {
        assets = await Promise.all(
          assets.split(",").map(asset => karma.assets[asset])
        );
      } catch (error) {
        assets = [];
      }

      accounts = accounts.split(",");
      result = await Promise.all(
        accounts.map(async account_name => {
          let account = await karma.accounts[account_name];
          let assetBalances = await karma.db.get_account_balances(
            account.id,
            assets.map(asset => asset.id)
          );
          let balances = {};

          await Promise.all(
            assetBalances.map(async assetBalance => {
              asset = await karma.assets.id(assetBalance.asset_id);
              balances[asset.symbol] =
                assetBalance.amount / 10 ** asset.precision;
            })
          );
          return balances;
        })
      );
      result.forEach((balance, index) =>
        console.log(
          `\n${accounts[index]}${Object.keys(balance).map(
            name => `\n${name}: ${balance[name]}`
          )}`
        )
      );
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    karma.disconnect();
  });
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
    rl.question(
      `Enter the ${isKey ? "private key" : "password"}: `,
      async answer => {
        mutableStdout.muted = false;

        try {
          let account = isKey
            ? new karma(from, answer)
            : await karma.login(from, answer);

          rl.question("Write memo: ", async memo => {
            try {
              await account.transfer(to, asset, amount, memo);
              console.log(
                `Transfered ${amount} ${asset} from '${from}' to '${to}' with memo '${memo}'`
              );
            } catch (error) {
              console.log(`Error: ${error.message}`);
            }

            rl.close();
            karma.disconnect();
          });
        } catch (error) {
          console.log(`Error: ${error.message}`);
          rl.close();
          karma.disconnect();
        }
      }
    );
    mutableStdout.muted = true;
  }, showError);
} else if (process.argv.includes("--mint")) {
  let index = process.argv.indexOf("--mint"),
    from = process.argv[index + 1],
    to = process.argv[index + 2],
    amount = process.argv[index + 3],
    asset = process.argv[index + 4].toUpperCase(),
    isKey = process.argv.includes("--key");

  connect(false).then(() => {
    rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    mutableStdout.muted = false;
    rl.question(
      `Enter the ${isKey ? "private key" : "password"}: `,
      async answer => {
        mutableStdout.muted = false;

        try {
          let account = isKey
            ? new karma(from, answer)
            : await karma.login(from, answer);

          rl.question("Write memo: ", async memo => {
            try {
              await account.mint(to, asset, amount, memo);
              console.log(
                `Minted ${amount} ${asset} to '${to}' with memo '${memo}'`
              );
            } catch (error) {
              console.log(`Error: ${error.message}`);
            }

            rl.close();
            karma.disconnect();
          });
        } catch (error) {
          console.log(`Error: ${error.message}`);
          rl.close();
          karma.disconnect();
        }
      }
    );
    mutableStdout.muted = true;
  }, showError);
} else if (process.argv.includes("--burn")) {
  let index = process.argv.indexOf("--burn"),
    accName = process.argv[index + 1],
    amount = process.argv[index + 2],
    asset = process.argv[index + 3].toUpperCase(),
    isKey = process.argv.includes("--key");

  connect(false).then(() => {
    rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    mutableStdout.muted = false;
    rl.question(
      `Enter the ${isKey ? "private key" : "password"}: `,
      async answer => {
        mutableStdout.muted = false;

        try {
          let account = isKey
            ? new karma(accName, answer)
            : await karma.login(accName, answer);

          rl.question("Write memo: ", async memo => {
            try {
              await account.burn(asset, amount, memo);
              console.log(
                `Burned ${amount} ${asset} from '${accName}' with memo '${memo}'`
              );
            } catch (error) {
              console.log(`Error: ${error.message}`);
            }

            rl.close();
            karma.disconnect();
          });
        } catch (error) {
          console.log(`Error: ${error.message}`);
          rl.close();
          karma.disconnect();
        }
      }
    );
    mutableStdout.muted = true;
  }, showError);
} else if (process.argv.includes("--version")) {
  console.log(`karmachain version: v${require("../package.json").version}`);
} else {
  const r = repl.start({ prompt: "> " });
  initializeContext(r.context);

  r.on("reset", initializeContext);
}
