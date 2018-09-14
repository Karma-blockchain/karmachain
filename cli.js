#!/usr/bin/env node

const repl = require('repl');
const karma = require('./index.js');

function initializeContext(context) {
  let node = process.argv.includes("--testnet") ? "wss://testnet-node.karma.red" : undefined
  
  karma.init(node)
  karma.connect().then(() => {
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

const r = repl.start({ prompt: '> ' });
initializeContext(r.context);

r.on('reset', initializeContext);
