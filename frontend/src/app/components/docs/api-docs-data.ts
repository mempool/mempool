const bitcoinNetworks = ["", "testnet", "signet"];

export const apiDocsData = [
  {
    type: "category",
    category: "general",
    fragment: "general",
    title: "General",
    showConditions: bitcoinNetworks.concat(["bisq"])
  },
  {
    type: "endpoint",
    category: "general",
    fragment: "get-difficulty-adjustment",
    title: "GET Difficulty Adjustment",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "general",
    fragment: "get-stats",
    title: "GET Stats",
    showConditions: ["bisq"]
  },
  {
    type: "category",
    category: "markets",
    fragment: "markets",
    title: "Markets",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-currencies",
    title: "GET Market Currencies",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-depth",
    title: "GET Market Depth",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-hloc",
    title: "GET Market HLOC",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-markets",
    title: "GET Markets",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-offers",
    title: "GET Market Offers",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-ticker",
    title: "GET Market Ticker",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-trades",
    title: "GET Market Trades",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "markets",
    fragment: "get-market-volumes",
    title: "GET Market Volumes",
    showConditions: ["bisq"]
  },
  {
    type: "category",
    category: "addresses",
    fragment: "addresses",
    title: "Addresses",
    showConditions: bitcoinNetworks.concat(["bisq", "liquid"])
  },
  {
    type: "endpoint",
    category: "addresses",
    fragment: "get-address",
    title: "GET Address",
    showConditions: bitcoinNetworks.concat(["bisq", "liquid"])
  },
  {
    type: "endpoint",
    category: "addresses",
    fragment: "get-address-transactions",
    title: "GET Address Transactions",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "addresses",
    fragment: "get-address-transactions-chain",
    title: "GET Address Transactions Chain",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "addresses",
    fragment: "get-address-transactions-mempool",
    title: "GET Address Transactions Mempool",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "addresses",
    fragment: "get-address-utxo",
    title: "GET Address UTXO",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "category",
    category: "assets",
    fragment: "assets",
    title: "Assets",
    showConditions: ["liquid"]
  },
  {
    type: "endpoint",
    category: "assets",
    fragment: "get-assets",
    title: "GET Assets",
    showConditions: ["liquid"]
  },
  {
    type: "endpoint",
    category: "assets",
    fragment: "get-asset-transactions",
    title: "GET Asset Transactions",
    showConditions: ["liquid"]
  },
  {
    type: "endpoint",
    category: "assets",
    fragment: "get-asset-supply",
    title: "GET Asset Supply",
    showConditions: ["liquid"]
  },
  {
    type: "category",
    category: "blocks",
    fragment: "blocks",
    title: "Blocks",
    showConditions: bitcoinNetworks.concat(["bisq", "liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block",
    title: "GET Block",
    showConditions: bitcoinNetworks.concat(["bisq", "liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-header",
    title: "GET Block Header",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-height",
    title: "GET Block Height",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-raw",
    title: "GET Block Raw",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-status",
    title: "GET Block Status",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-tip-height",
    title: "GET Block Tip Height",
    showConditions: bitcoinNetworks.concat(["liquid", "bisq"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-tip-hash",
    title: "GET Block Tip Hash",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-transaction-id",
    title: "GET Block Transaction ID",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-transaction-ids",
    title: "GET Block Transaction IDs",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-block-transactions",
    title: "GET Block Transactions",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "blocks",
    fragment: "get-blocks",
    title: "GET Blocks",
    showConditions: bitcoinNetworks.concat(["liquid", "bisq"])
  },
  {
    type: "category",
    category: "fees",
    fragment: "fees",
    title: "Fees",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "fees",
    fragment: "get-mempool-blocks-fees",
    title: "GET Mempool Blocks Fees",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "fees",
    fragment: "get-recommended-fees",
    title: "GET Recommended Fees",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "category",
    category: "mempool",
    fragment: "mempool",
    title: "Mempool",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "mempool",
    fragment: "get-mempool",
    title: "GET Mempool",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "mempool",
    fragment: "get-mempool-transaction-ids",
    title: "GET Mempool Transaction IDs",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "mempool",
    fragment: "get-mempool-recent",
    title: "GET Mempool Recent",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "category",
    category: "transactions",
    fragment: "transactions",
    title: "Transactions",
    showConditions: bitcoinNetworks.concat(["liquid", "bisq"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-cpfp",
    title: "GET Children Pay for Parent",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction",
    title: "GET Transaction",
    showConditions: bitcoinNetworks.concat(["liquid", "bisq"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-hex",
    title: "GET Transaction Hex",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-merkleblock-proof",
    title: "GET Transaction Merkleblock Proof",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-merkle-proof",
    title: "GET Transaction Merkle Proof",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-outspend",
    title: "GET Transaction Outspend",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-outspends",
    title: "GET Transaction Outspends",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-raw",
    title: "GET Transaction Raw",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transaction-status",
    title: "GET Transaction Status",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "get-transactions",
    title: "GET Transactions",
    showConditions: ["bisq"]
  },
  {
    type: "endpoint",
    category: "transactions",
    fragment: "post-transaction",
    title: "POST Transaction",
    showConditions: bitcoinNetworks.concat(["liquid"])
  },
];
