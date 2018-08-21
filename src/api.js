import {Apis, ChainConfig } from "karmajs-ws";

ChainConfig.networks.KarmaTestnet = {
    core_asset: 'KRMT',
    address_prefix: 'KRMT',
    chain_id: 'e81bea67cebfe8612010fc7c26702bce10dc53f05c57ee6d5b720bbe62e51bef',
}

export default class Api {
  static new(api) {
    return new Proxy(Apis, new Api(api));
  }

  static getApis() {
    return Apis;
  }

  constructor(api) {
    this.api = api;
  }

  get(apis, name) {
    let api = this.api;

    return function() {
      //console.log(`api call: ${name}(${[...arguments]})`)
      return apis.instance()[api]().exec(name,[...arguments])
    }
  }
}
