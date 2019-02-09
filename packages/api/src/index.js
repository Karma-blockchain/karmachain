import { Apis, ChainConfig, Manager } from "karmajs-ws"

ChainConfig.networks.KarmaTestnet = {
    core_asset: 'KRMT',
    address_prefix: 'KRMT',
    chain_id: 'e81bea67cebfe8612010fc7c26702bce10dc53f05c57ee6d5b720bbe62e51bef',
}

export default {
  Apis, ChainConfig, Manager
}


const get = api => ({ get: (_, name) => (...args) => {
  if (typeof name === 'symbol')
    return Apis.instance()[api]()

  return Apis.instance()[api]().exec(name,[...args])
}})


export const connect = (...args) => Apis.instance(...args).init_promise;
export const disconnect = Apis.close

export const setStatusCallback = Apis.setRpcConnectionStatusCallback

export const database = new Proxy({}, get('db_api'))
export const history = new Proxy({}, get('history_api'))
export const network = new Proxy({}, get('network_api'))

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
