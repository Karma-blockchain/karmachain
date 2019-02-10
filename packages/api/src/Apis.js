// var { List } = require("immutable");
import ChainWebSocket from "./ChainWebSocket";
import GrapheneApi from "./GrapheneApi";
import ChainConfig from "./ChainConfig";


var Apis = null
var statusCb = null
let autoReconnect = true;


export const instance = ( cs = "ws://localhost:8090", _connect, connectTimeout = 4000, enableCrypto) => {
  if (!Apis) 
    Apis = cleanApis()

  _connect && connect(cs, connectTimeout, enableCrypto);
  return Apis;
}


//export const connect = (server, timeout, enableCrypto) => 
//  instance(server, true, timeout, enableCrypto).init_promise;


export const setRpcConnectionStatusCallback = callback => statusCb = callback
export const setAutoReconnect = auto => autoReconnect = auto;
export const chainId = () => Apis.instance().chain_id


export const reset = async ( cs = "ws://localhost:8090", _connect, connectTimeout = 4000 ) => {
  await close()
  
  if (!Apis) 
    Apis = cleanApis()

  _connect && connect(cs, connectTimeout);
  return Apis;
}


export const close = async () => {
  if (Apis) {
    if (Apis.ws_rpc)
      await Apis.ws_rpc.close()
    Apis = null
  }
}


const connect = ( cs, connectTimeout, enableCrypto = false ) => {
    // console.log("INFO\tApiInstances\tconnect\t", cs);
    Apis.url = cs;
    let rpc_user = "", rpc_password = "";

    if (
      typeof window !== "undefined" && 
      window.location && 
      window.location.protocol === "https:" && 
      cs.indexOf("wss://") < 0
    ) {
      throw new Error("Secure domains require wss connection");
    }

    Apis.ws_rpc = new ChainWebSocket(cs, statusCb, connectTimeout, autoReconnect, () => {
      Apis._db.exec('get_objects', [['2.1.0']]).catch((e)=>{})
    });

    Apis.init_promise = init(rpc_user, rpc_password, enableCrypto)
}

const init = async (user, password, enableCrypto) => {
  await Apis.ws_rpc.login(user, password)
  
  console.log("Connected to API node:", Apis.url);

  Apis._db = new GrapheneApi(Apis.ws_rpc, "database");
  Apis._net = new GrapheneApi(Apis.ws_rpc, "network_broadcast");
  Apis._hist = new GrapheneApi(Apis.ws_rpc, "history");
  if (enableCrypto) Apis._crypt = new GrapheneApi(Apis.ws_rpc, "crypto");

  var db_promise = Apis._db.init().then( ()=> {
    //https://github.com/cryptonomex/graphene/wiki/chain-locked-tx
    return Apis._db.exec("get_chain_id",[]).then( _chain_id => {
      Apis.chain_id = _chain_id
      return ChainConfig.setChainId( _chain_id )
      //DEBUG console.log("chain_id1",this.chain_id)
    });
  });

  Apis.ws_rpc.on_reconnect = async () => {
    await Apis.ws_rpc.login("", "")

    Apis._db.init().then(() => {
      if(statusCb)
        statusCb("reconnect");
    });

    Apis._net.init();
    Apis._hist.init();
    if (enableCrypto) Apis._crypt.init();
  }

  let initPromises = [
    db_promise,
    Apis._net.init(),
    Apis._hist.init(),
  ];
  if (enableCrypto) initPromises.push(Apis._crypt.init());
  return Promise.all(initPromises);
}


const cleanApis = () => ({
  connect,
  db_api: () => Apis._db,
  network_api: () => Api._net,
  history_api: () => Apis._hist,
  crypto_api: () => Apis._crypt
})

const get = api => ({ get: (_, name) => (...args) => {
  if (typeof name === 'symbol')
    return Apis[api]

  return Apis[api].exec(name, [...args])
}})

export const database = new Proxy({}, get('_db'))
export const history = new Proxy({}, get('_hist'))
export const network = new Proxy({}, get('_net'))
export const crypto = new Proxy({}, get('_crypt'))


/*
// DATABASE API
export const getObjects = database.get_objects
export const setSubscribeCallback = database.set_subscribe_callback
export const setPendingTransactionCallback = database.set_pending_transaction_callback
export const setBlockAppliedCallback = database.set_block_applied_callback
export const cancelAllSubscriptions = database.cancel_all_subscriptions
export const getBlockHeader = database.get_block_header
export const getBlock = database.get_block
export const getTransaction = database.get_transaction
export const getRecentTransactionById = database.get_recent_transaction_by_id
export const getChainProperties = database.get_chain_properties
export const getGlobalProperties = database.get_global_properties
export const getConfig = database.get_config
export const getChainId = database.get_chain_id
export const getDynamicGlobalProperties = database.get_dynamic_global_properties
export const getKeyReferences = database.get_key_references
export const getAccounts = database.get_accounts
export const getFullAccounts = database.get_full_accounts
export const getAccountByName = database.get_account_by_name
export const getAccountReferences = database.get_account_references
export const lookupAccountNames = database.lookup_account_names
export const lookupAccounts = database.lookup_accounts
export const getAccountCount = database.get_account_count
export const getAccountBalances = database.get_account_balances
export const getNamedAccountBalances = database.get_named_account_balances
export const getBalanceObjects = database.get_balance_objects
export const getVestedBalances = database.get_vested_balances
export const getVestingBalances = database.get_vesting_balances
export const getAssets = database.get_assets
export const listAssets = database.list_assets
export const lookupAssetSymbols = database.lookup_asset_symbols
export const getOrderBook = database.get_order_book
export const getLimitOrders = database.get_limit_orders
export const getCallOrders = database.get_call_orders
export const getSettleOrders = database.get_settle_orders
export const getMarginPositions = database.get_margin_positions
export const subscribeToMarket = database.subscribe_to_market
export const unsubscribeFromMarket = database.unsubscribe_from_market
export const getTicker = database.get_ticker
export const get24Volume = database.get_24_volume
export const getTradeHistory = database.get_trade_history
export const getWitnesses = database.get_witnesses
export const getWitnessByAccount = database.get_witness_by_account
export const lookupWitnessAccounts = database.lookup_witness_accounts
export const getWitnessCount = database.get_witness_count
export const getCommitteeMembers = database.get_committee_members
export const getCommitteeMemberByAccount = database.get_committee_member_by_account
export const lookupCommitteeMemberAccounts = database.lookup_committee_member_accounts
export const getWorkersByAccount = database.get_workers_by_account
export const lookupVoteIds = database.lookup_vote_ids
export const getTransactionHex = database.get_transaction_hex
export const getRequiredSignatures = database.get_required_signatures
export const getPotentialSignatures = database.get_potential_signatures
export const getPotentialAddressSignatures = database.get_potential_address_signatures
export const verifyAuthority = database.verify_authority
export const verifyAccountAuthority = database.verify_account_authority
export const validateTransaction = database.validate_transaction
export const getRequiredFees = database.get_required_fees
export const getProposedTransactions = database.get_proposed_transactions
export const getBlindedBalances = database.get_blinded_balances


// HISTORY API
export const getAccountHistory = history.get_account_history
export const getAccountHistoryOperations = history.get_account_history_operations
export const getRelativeAccountHistory = history.get_relative_account_history
export const getFillOrderHistory = history.get_fill_order_history
export const getMarketHistory = history.get_market_history
export const getMarketHistoryBuckets = history.get_market_history_bucke


// NETWORK API
export const broadcastTransaction = network.broadcast_transaction
export const broadcastTransactionWithCallback = network.broadcast_transaction_with_callback
export const broadcastBlock = network.broadcast_block
*/