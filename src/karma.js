import Event from "./event.js"
import Asset from "./asset.js"
import Account from "./account.js"
import Api from "./api.js"
import Fees from "./fees.js"
import {
  TransactionBuilder,
  TransactionHelper,
  PrivateKey,
  PublicKey,
  Login,
  Aes,
  ChainStore
} from "karmajs"

export default class Karma {
  static init(node = "wss://node.karma.red", autoconnect = false, autoreconnect = true) {
    this.node = node;
    this.events = Event.init(this)
    this.autoreconnect = autoreconnect

    if (autoconnect)
      return this.connect()
  }

  static async connect() {
    if (this.connectPromise || this.connectedPromise)
      return Promise.all([this.connectPromise, this.connectedPromise]);

    if (this.autoreconnect)
      Api.getApis().setRpcConnectionStatusCallback(this.statusCallBack.bind(this))

    await (this.connectPromise = this.reconnect());
    await (this.connectedPromise = this.connectedInit());

    this.store = ChainStore;

    this.events.connectedNotify()

    return true;
  }

  static async reconnect() {
    let res = await Api.getApis().instance(this.node, true).init_promise;
    this.chain = res[0].network;

    return res;
  }

  static disconnect() {
    return Api.getApis().close()
  }

  static statusCallBack(status) {
    console.log("WebSocket status:", status)
    if (status === 'closed') {
      console.log("WebSocket status, try to connect...");
      setTimeout(this.reconnect.bind(this), 2000)
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

    this.assets = Asset.init(this.db);
    this.accounts = Account.init(this.db);
    this.fees = Fees.init(this.db);
    await this.fees.update();
  }

  static subscribe() {
    this.events.subscribe(...arguments)
  }

  static async login(accountName, password, feeSymbol = this.chain.core_asset) {
    let
      acc = await this.accounts[accountName],
      activeKey = PrivateKey.fromSeed(`${accountName}active${password}`),
      genPubKey = activeKey.toPublicKey().toString();

    if (genPubKey != acc.active.key_auths[0][0])
      throw new Error("The pair of login and password do not match!")

    let account = new this(accountName, activeKey.toWif(), feeSymbol);

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

    this.initPromise = Promise.all([
      Karma.accounts[accountName],
      Karma.assets[feeSymbol]
    ]).then(params => {
      [this.account, this.feeAsset] = params;
    })
  }

  async setFeeAsset(feeSymbol) {
    await this.initPromise;
    this.feeAsset = await Karma.assets[feeSymbol]
  }

  setMemoKey(memoKey) {
    this.memoKey = PrivateKey.fromWif(memoKey);
  }

  newTransaction() {
    return new TransactionBuilder()
  }

  async broadcast(tx, privateKey = this.activeKey) {
    await tx.set_required_fees()
    tx.add_signer(privateKey, privateKey.toPublicKey().toPublicKeyString());
    return tx.broadcast();
  }

  async sendTransaction(type, operation) {
    let tx = new TransactionBuilder();
    tx.add_type_operation(type, operation)
    return this.broadcast(tx)
  }

  async balances() {
    await this.initPromise;

    let assets = await Promise.all(Object.keys(arguments)
      .map(async index => (await Karma.assets[arguments[index]]).id));
    let balances = await Karma.db.get_account_balances(this.account.id, assets);
    return Promise.all(balances.map(balance => Karma.assets.fromParam(balance)))
  }

  async memo(toName, message) {
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

  memoDecode(memos) {
    if (!this.memoKey)
      throw new Error("Not set memoKey!");

    return Aes.decrypt_with_checksum(this.memoKey, memos.from, memos.nonce, memos.message)
      .toString("utf-8");
  }

  async transfer(toName, assetSymbol, amount, memo) {
    await this.initPromise;

    let asset = await Karma.assets[assetSymbol],
        intAmount = Math.floor(amount * 10 ** asset.precision);

    if (intAmount == 0)
      throw new Error("Amount equal 0!")

    let operation = {
      fee: this.feeAsset.toParam(),
      from: this.account.id,
      to: (await Karma.accounts[toName]).id,
      amount: asset.toParam(intAmount),
      extensions: []
    };

    if (memo)
      operation.memo = (typeof memo == "string") ? (await this.memo(toName, memo)) : memo;

    return this.sendTransaction("transfer",operation);
  }
}
