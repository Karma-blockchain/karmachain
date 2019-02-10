
var config = {
  core_asset: "CORE",
  address_prefix: "KRM",
  expire_in_secs: 15,
  expire_in_secs_proposal: 24 * 60 * 60,
  review_in_secs_committee: 24 * 60 * 60,
  networks: {
    Karma: {
      core_asset: "KRM",
      address_prefix: "KRM",
      chain_id: "c85b4a30545e09c01aaa7943be89e9785481c1e7bd5ee7d176cb2b3d8dd71a70"
    },
    Testnet: {
      core_asset: 'KRMT',
      address_prefix: 'KRMT',
      chain_id: 'e81bea67cebfe8612010fc7c26702bce10dc53f05c57ee6d5b720bbe62e51bef',
    }
  },

  setChainId: chain_id => {
    Object.entries(config.networks).forEach(([network_name, network]) => {
      console.log(network_name, network)
      if (network.chain_id === chain_id) {
        config.network_name = network_name

        if (network.address_prefix)
          config.address_prefix = network.address_prefix

        return { network_name, network }
      }
    })

    if (!config.network_name) {
      console.log("Unknown chain id (this may be a testnet)", chain_id);
    }

  },

  reset: () => {
      config.core_asset = "CORE";
      config.address_prefix = "GPH";
      config.expire_in_secs = 15;
      config.expire_in_secs_proposal = 24 * 60 * 60;

      console.log("Chain config reset");
  },

  setPrefix: (prefix = "GPH") => config.address_prefix = prefix
}


export default config
