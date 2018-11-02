import Event from "./event.js"
import Asset from "./asset.js"
import Account from "./account.js"
import Api from "./api.js"
import Fees from "./fees.js"
import Transaction from "./transaction.js";
import { PrivateKey, Login, Aes, ChainStore } from "karmajs"

class Karma {
  static node = "wss://node.karma.red"
  static autoreconnect = true

  static async connect(node = Karma.node, autoreconnect = Karma.autoreconnect) {
    Karma.autoreconnect = autoreconnect
    if (Karma.connectPromise || Karma.connectedPromise)
      return Promise.all([Karma.connectPromise, Karma.connectedPromise]);

    if (Karma.autoreconnect)
      Api.getApis().setRpcConnectionStatusCallback(Karma.statusCallBack)

    await (Karma.connectPromise = Karma.reconnect(node));
    await (Karma.connectedPromise = Karma.connectedInit());

    Karma.store = ChainStore;

    Event.connectedNotify()

    return true;
  }

  static async reconnect(node) {
    Karma.node = node
    let res = await Api.getApis().instance(Karma.node, true).init_promise;
    Karma.chain = res[0].network;

    return res;
  }

  static disconnect() {
    Karma.connectPromise = Karma.connectedPromise = undefined
    Karma.autoreconnect = false
    return Api.getApis().close()
  }

  static statusCallBack(status) {
    console.log("WebSocket status:", status)
    if (Karma.autoreconnect && status === 'closed') {
      console.log("WebSocket status, try to connect...");
      setTimeout(Karma.reconnect, 2000)
    }
  }

  static async connectedInit() {
    if (!this.connectPromise || this.blockReCall)
      return

    this.blockReCall = true

    this.db = Api.new('db_api');
    this.history = Api.new('history_api');
    this.network = Api.new('network_api');
    //this.crypto = Api.new('crypto_api');
    this.newTx = Transaction.newTx;

    this.assets = Asset.init(this.db);
    this.accounts = Account.init(this.db);
    this.fees = Fees.init(this.db);
    await this.fees.update();
  }

  static subscribe() {
    Event.subscribe(...arguments)
  }

  static async login(accountName, password, feeSymbol = Karma.chain.core_asset) {
    let
      acc = await Karma.accounts[accountName],
      activeKey = PrivateKey.fromSeed(`${accountName}active${password}`),
      genPubKey = activeKey.toPublicKey().toString();

    if (genPubKey != acc.active.key_auths[0][0])
      throw new Error("The pair of login and password do not match!")

    let account = new Karma(accountName, activeKey.toWif(), feeSymbol);

    account.setMemoKey((acc.options.memo_key === genPubKey ? activeKey : PrivateKey.fromSeed(`${accountName}memo${password}`)).toWif())

    await account.initPromise;
    return account
  }

  static generateKeys(name, password, arrKeysName) {
    return Login.generateKeys(name, password, arrKeysName);
  }

  constructor(accountName, activeKey, feeSymbol = Karma.chain.core_asset) {
    if (activeKey)
      this.activeKey = PrivateKey.fromWif(activeKey);

    this.newTx = () => {
      return Transaction.newTx([this.activeKey])
    }

    this.initPromise = Promise.all([
      Karma.accounts[accountName],
      Karma.assets[feeSymbol]
    ]).then(params => {
      [this.account, this.feeAsset] = params;
    })
  }

  setFeeAsset = async feeSymbol => {
    await this.initPromise;
    this.feeAsset = await Karma.assets[feeSymbol]
  }

  setMemoKey = memoKey => {
    this.memoKey = PrivateKey.fromWif(memoKey);
  }

  broadcast = (tx, keys = [this.activeKey]) =>
    tx.broadcast(keys);

  sendOperation = operation => {
    let tx = this.newTx()
    tx.add(operation)
    return tx.broadcast()
  }

  balances = async (...args) => {
    await this.initPromise;

    let assets = await Promise.all(args
      .map(async asset => (await Karma.assets[asset]).id));
    let balances = await Karma.db.get_account_balances(this.account.id, assets);
    return Promise.all(balances.map(balance => Karma.assets.fromParam(balance)))
  }

  memo = async (toName, message) => {
    if (!this.memoKey)
      throw new Error("Not set memoKey!");

    let nonce = Date.now().toString(), //TransactionHelper.unique_nonce_uint64(),
        to = (await Karma.accounts[toName]).options.memo_key;

    return {
      from: this.memoKey.toPublicKey().toPublicKeyString(),
      to,
      nonce,
      message: Aes.encrypt_with_checksum(this.memoKey, to, nonce, message)
    }
  }

  memoDecode = memos => {
    if (!this.memoKey)
      throw new Error("Not set memoKey!");

    return Aes.decrypt_with_checksum(
      this.memoKey,
      memos.from,
      memos.nonce,
      memos.message
    ).toString("utf-8");
  }

  transferOperation = async (toName, assetSymbol, amount, memo) => {
    await this.initPromise;

    let asset = await Karma.assets[assetSymbol],
        intAmount = Math.floor(amount * 10 ** asset.precision);

    if (intAmount == 0)
      throw new Error("Amount equal 0!")

    let params = {
      fee: this.feeAsset.toParam(),
      from: this.account.id,
      to: (await Karma.accounts[toName]).id,
      amount: asset.toParam(intAmount),
      extensions: []
    };

    if (memo)
      params.memo = (typeof memo == "string") ? (await this.memo(toName, memo)) : memo;

    return { transfer: params }
  }

  transfer = async (...args) =>
    this.sendOperation(
      await this.transferOperation(...args)
    )

  creaditRequestOperation = async (loadAssetName, depositAssetName, period, percent, memo) => {
    await this.initPromise;

    let params = {
      fee: this.feeAsset.toParam(),
      borrower: this.account.id,
      loan_asset: (await Karma.assets[loadAssetName]).id,
      loan_period: period,
      loan_persent: percent,
      loan_memo: memo,
      deposit_asset: (await Karma.assets[depositAssetName]).id
    }

    return { credit_request_operation: params }
  }

  creaditRequest = async (...args) =>
    this.sendOperation(
      await this.creaditRequestOperation(...args)
    )

  creditApproveOperation = async (uuid, memo) => {
    await this.initPromise;

    let params = {
      fee: this.feeAsset.toParam(),
      creditor: this.account.id,
      credit_memo: memo,
      credit_request_uuid: uuid
    }

    return { credit_approve_operation: params }
  }

  creditApprove = async (...args) =>
    this.sendOperation(
      await this.creditApproveOperation(...args)
    )
}

Event.init(Karma)

export default Karma
