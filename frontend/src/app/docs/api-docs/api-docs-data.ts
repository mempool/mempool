const bitcoinNetworks = ["", "testnet", "signet"];
const liquidNetworks = ["liquid", "liquidtestnet"];
const miningTimeIntervals = "<code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>6m</code>, <code>1y</code>, <code>2y</code>, <code>3y</code>";

const emptyCodeSample = {
  esModule: [],
  commonJS: [],
  curl: [],
  response: ``
};

const showJsExamplesDefault = { "": true, "testnet": true, "signet": true, "liquid": true, "liquidtestnet": false, "bisq": true };
const showJsExamplesDefaultFalse = { "": false, "testnet": false, "signet": false, "liquid": false, "liquidtestnet": false, "bisq": false };

export const wsApiDocsData = {
  showJsExamples: showJsExamplesDefault,
  codeTemplate: {
    curl: `/api/v1/ws`,
    commonJS: `
  const { %{0}: { websocket } } = mempoolJS();

  const ws = websocket.initClient({
    options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
  });

  ws.addEventListener('message', function incoming({data}) {
    const res = JSON.parse(data.toString());
    if (res.block) {
      document.getElementById("result-blocks").textContent = JSON.stringify(res.block, undefined, 2);
    }
    if (res.mempoolInfo) {
      document.getElementById("result-mempool-info").textContent = JSON.stringify(res.mempoolInfo, undefined, 2);
    }
    if (res.transactions) {
      document.getElementById("result-transactions").textContent = JSON.stringify(res.transactions, undefined, 2);
    }
    if (res["mempool-blocks"]) {
      document.getElementById("result-mempool-blocks").textContent = JSON.stringify(res["mempool-blocks"], undefined, 2);
    }
  });
  `,
    esModule: `
const { %{0}: { websocket } } = mempoolJS();

const ws = websocket.initServer({
options: ["blocks", "stats", "mempool-blocks", "live-2h-chart"],
});

ws.on("message", function incoming(data) {
const res = JSON.parse(data.toString());
if (res.block) {
console.log(res.block);
}
if (res.mempoolInfo) {
console.log(res.mempoolInfo);
}
if (res.transactions) {
console.log(res.transactions);
}
if (res["mempool-blocks"]) {
console.log(res["mempool-blocks"]);
}
});
    `,
  },
  codeSampleMainnet: emptyCodeSample,
  codeSampleTestnet: emptyCodeSample,
  codeSampleSignet: emptyCodeSample,
  codeSampleLiquid: emptyCodeSample,
  codeSampleBisq: emptyCodeSample,
};

export const restApiDocsData = [
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
    httpRequestMethod: "GET",
    fragment: "get-difficulty-adjustment",
    title: "GET Difficulty Adjustment",
    description: {
      default: "Returns details about difficulty adjustment."
    },
    urlString: "/v1/difficulty-adjustment",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: `
        const { %{0}: { difficulty } } = mempoolJS();

        const difficultyAdjustment = await difficulty.getDifficultyAdjustment();

        document.getElementById("result").textContent = JSON.stringify(difficultyAdjustment, undefined, 2);
          `,
          esModule: `
  const { %{0}: { difficulty } } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);
          `,
          curl: `/api/v1/difficulty-adjustment`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  timeOffset: 0
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  timeOffset: 0
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  timeOffset: 0
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  timeOffset: 0
}`
        }
      }
    }
  },
  {
    type: "endpoint",
    category: "general",
    httpRequestMethod: "GET",
    fragment: "get-stats",
    title: "GET Stats",
    description: {
      default: "Returns statistics about all Bisq transactions."
    },
    urlString: "/stats",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: `
        const { %{0}: { statistics } } = mempoolJS();

        const stats = await statistics.getStats();

        document.getElementById("result").textContent = JSON.stringify(stats, undefined, 2);
          `,
          esModule: `
  const { %{0}: { statistics } } = mempoolJS();

  const stats = await statistics.getStats();
  console.log(stats);
          `,
          curl: `/api/stats`,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  addresses: 213825,
  minted: 6148323.75,
  burnt: 1830262.66,
  spent_txos: 215705,
  unspent_txos: 2572
}`
        },
      }
    }
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
    httpRequestMethod: "GET",
    fragment: "get-market-currencies",
    title: "GET Market Currencies",
    description: {
      default: "Provides list of available currencies for a given base currency."
    },
    urlString: "/currencies",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/currencies`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const currencies = await markets.getCurrencies();

        document.getElementById("result").textContent = JSON.stringify(currencies, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const currencies = await markets.getCurrencies();
  console.log(currencies);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  BTC: {
    code: 'BTC',
    name: 'Bitcoin',
    precision: 8,
    _type: 'crypto'
  }
  ...
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-depth",
    title: "GET Market Depth",
    description: {
      default: "Provides list of open offer prices for a single market."
    },
    urlString: "/depth?market=[:market]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/depth?market=%{1}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const depth = await markets.getDepth({ market });

        document.getElementById("result").textContent = JSON.stringify(depth, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const depth = await markets.getDepth({ market });
  console.log(depth);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD'],
          commonJS: ['BTC_USD'],
          curl: ['BTC_USD'],
          response: `{
  btc_usd: {
    buys: [
      '4.56941560',
      ...
    ],
    sells: [
      '4.54668218',
      ...
    ]
  }
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-hloc",
    title: "GET Market HLOC",
    description: {
      default: "Provides hi/low/open/close data for a given market. This can be used to generate a candlestick chart."
    },
    urlString: "/hloc?market=[:market]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/hloc?market=%{1}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const hloc = await markets.getHloc({ market });

        document.getElementById("result").textContent = JSON.stringify(hloc, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const hloc = await markets.getHloc({ market });
  console.log(hloc);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD'],
          commonJS: ['BTC_USD'],
          curl: ['BTC_USD'],
          response: `[
  {
    period_start: 1609459200,
    open: '30448.18510000',
    close: '45717.81750000',
    high: '77700.00000000',
    low: '27500.00000000',
    avg: '44613.01158471',
    volume_right: '4923536.57150000',
    volume_left: '110.36100000'
  }
  ...
]`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-markets",
    title: "GET Markets",
    description: {
      default: "Provides list of available markets."
    },
    urlString: "/markets",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/markets`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const allMarkets = await markets.getMarkets();

        document.getElementById("result").textContent = JSON.stringify(allMarkets, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const allMarkets = await markets.getMarkets();
  console.log(allMarkets);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD'],
          commonJS: ['BTC_USD'],
          curl: ['BTC_USD'],
          response: `{
    btc_brl: {
      pair: 'btc_brl',
      lname: 'Bitcoin',
      rname: 'Brazilian Real',
      lsymbol: 'BTC',
      rsymbol: 'BRL',
      lprecision: 8,
      rprecision: 2,
      ltype: 'crypto',
      rtype: 'fiat',
      name: 'Bitcoin/Brazilian Real'
    },
    ...
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-offers",
    title: "GET Market Offers",
    description: {
      default: "Provides list of open offer details for a single market."
    },
    urlString: "/offers?market=[:market]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/offers?market=%{1}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const offers = await markets.getOffers({ market });

        document.getElementById("result").textContent = JSON.stringify(offers, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const offers = await markets.getOffers({ market });
  console.log(offers);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD'],
          commonJS: ['BTC_USD'],
          curl: ['BTC_USD'],
          response: `{
  btc_usd: {
    buys: [
      {
        offer_id: "ORHL1BE-0c193d04-be60-4657-ba42-cc172bb4ae5d-172",
        offer_date: 1630207815462,
        direction: "BUY",
        min_amount: "0.00500000",
        amount: "0.01500000",
        price: "50030.24770000",
        volume: "750.45370000",
        payment_method: "AMAZON_GIFT_CARD",
        offer_fee_txid: null
        },
        ...
    ],
    sells: [
      {
        offer_id: "nswiwkre-7676d5e6-e808-4c47-9c51-d5708e465ad5-172",
        offer_date: 1630320354509,
        direction: "SELL",
        min_amount: "0.04170000",
        amount: "0.04170000",
        price: "49534.89880000",
        volume: "2065.60520000",
        payment_method: "CASH_DEPOSIT",
        offer_fee_txid: null
        },
        ...
    ]
  }
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-ticker",
    title: "GET Market Ticker",
    description: {
      default: "Provides 24-hour price ticker for single market or all markets."
    },
    urlString: "/ticker?market=[:market]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/ticker?market=%{1}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const ticker = await markets.getTicker({ market });

        document.getElementById("result").textContent = JSON.stringify(ticker, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const ticker = await markets.getTicker({ market });
  console.log(ticker);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD'],
          commonJS: ['BTC_USD'],
          curl: ['BTC_USD'],
          response: `{
  last: "53923.20570000",
  high: "53923.20570000",
  low: "48137.67410000",
  volume_left: "0.27160000",
  volume_right: "13593.92070000",
  buy: "48118.52400000",
  sell: "49555.63750000"
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-trades",
    title: "GET Market Trades",
    description: {
      default: "Provides list of completed trades for a single market."
    },
    urlString: "/trades?market=[:market]&limit=[:limit]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/trades?market=%{1}&limit=%{2}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const trades = await markets.getTrades({ market, limit: %{2} });

        document.getElementById("result").textContent = JSON.stringify(trades, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const trades = await markets.getTrades({ market, limit: %{2} });
  console.log(trades);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD', '1'],
          commonJS: ['BTC_USD', '1'],
          curl: ['BTC_USD', '1'],
          response: `[
  {
    price: "53923.20570000",
    amount: "0.00500000",
    volume: "269.61600000",
    payment_method: "CLEAR_X_CHANGE",
    trade_date: 1630646161647
  }
]`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "markets",
    httpRequestMethod: "GET",
    fragment: "get-market-volumes",
    title: "GET Market Volumes",
    description: {
      default: "Provides periodic volume data in terms of base currency for one or all markets."
    },
    urlString: "/volumes?basecurrency=[:basecurrency]",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/volumes?markets=%{1}`,
          commonJS: `
        const { %{0}: { markets } } = mempoolJS();

        const market = "%{1}";

        const volumes = await markets.getVolumes({ market });

        document.getElementById("result").textContent = JSON.stringify(volumes, undefined, 2);
        `,
          esModule: `
  const { %{0}: { markets } } = mempoolJS();

  const market = "%{1}";

  const volumes = await markets.getVolumes({ market });
  console.log(volumes);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['BTC_USD', 'BTC'],
          commonJS: ['BTC_USD', 'BTC'],
          curl: ['BTC_USD', 'BTC'],
          response: `[
  {
    period_start: 1451606400,
    num_trades: 1923,
    volume: "1095.22050000"
  },
  ...
]`,
        },
      }
    }
  },
  {
    type: "category",
    category: "addresses",
    fragment: "addresses",
    title: "Addresses",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"])
  },
  {
    type: "endpoint",
    category: "addresses",
    httpRequestMethod: "GET",
    fragment: "get-address",
    title: "GET Address",
    description: {
      default: "Returns details about an address. Available fields: <code>address</code>, <code>chain_stats</code>, and <code>mempool_stats</code>. <code>chain_stats</code> and <code>mempool_stats</code> each contain an object with <code>tx_count</code>, <code>funded_txo_count</code>, <code>funded_txo_sum</code>, <code>spent_txo_count</code>, and <code>spent_txo_sum</code>."
    },
    urlString: "/address/:address",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"]),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const myAddress = await addresses.getAddress({ address });

        document.getElementById("result").textContent = JSON.stringify(myAddress, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `{
  address: "tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee",
  chain_stats: {
    funded_txo_count: 6747,
    funded_txo_sum: 84313783821,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 6747
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `{
  address: "Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 1,
    tx_count: 2
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `{
  address: "vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 0,
    tx_count: 1
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`
        },
        codeSampleBisq: {
          esModule: [`B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz`],
          commonJS: [`B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz`],
          curl: [`B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz`],
          response: `[
  {
    "txVersion": "1",
    "id": "d6f0a6fd191ac907ff88fc51af91cae8d50e596a846952ffa0ad0cea84eedc9a",
    "blockHeight": 679129,
    "blockHash": "00000000000000000001328850b0482312325f7f4abd5457e45d37cad664675d",
    "time": 1618369311000,
    "inputs": [ ... ],
    "outputs": [ ... ],
    "txType": "PAY_TRADE_FEE",
    "txTypeDisplayString": "Pay trade fee",
    "burntFee": 6,
    "invalidatedBsq": 0,
    "unlockBlockHeight": 0
  },
  ...
]`
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "addresses",
    httpRequestMethod: "GET",
    fragment: "get-address-transactions",
    title: "GET Address Transactions",
    description: {
      default: "Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using <code>:last_seen_txid</code> (see below)."
    },
    urlString: "/address/:address/txs",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxs = await addresses.getAddressTxs({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "dba43fd04b7ae3df8e5b596f2e7fab247c58629d622e3a5213f03a5a09684430",
    version: 1,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 255,
    weight: 1020,
    fee: 10000,
    status: {
      confirmed: true,
      block_height: 326148,
      block_hash: "00000000000000001e4118adcfbb02364bc13c41c210d8811e4f39aeb3687e36",
      block_time: 1413798020
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
    {
      txid: "3e6afd67862ce9fe3eb55268a3107f495415ff1b5d1933c928507e9bdf7a21e6",
      version: 2,
      locktime: 0,
      vin: [],
      vout: [],
      size: 211,
      weight: 736,
      fee: 0,
      status: {
        confirmed: true,
        block_height: 2091086,
        block_hash: "00000000340f3667cce7032d084973ca29bdd0d858ec363ed894ad4c8ed09ebc",
        block_time: 1630607773
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [Object],
    vout: [Object],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [Object],
    vout: [Object],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "addresses",
    httpRequestMethod: "GET",
    fragment: "get-address-transactions-chain",
    title: "GET Address Transactions Chain",
    description: {
      default: "Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query."
    },
    urlString: "/address/:address/txs/chain",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/chain`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsChain = await addresses.getAddressTxsChain({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsChain, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "c4e53c2e37f4fac759fdb0d8380e4d49e6c7211233ae276a44ce7074a1d6d168",
    version: 2,
    locktime: 697761,
    vin: [],
    vout: [],
    size: 221,
    weight: 884,
    fee: 331,
    status: {
      confirmed: true,
      block_height: 697782,
      block_hash: "000000000000000000011397e53a5b1442b3dbc5df046c959c11dfe0275a4579",
      block_time: 1630040570
    }
  },
  ...
],`
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
  {
    txid: "3e6afd67862ce9fe3eb55268a3107f495415ff1b5d1933c928507e9bdf7a21e6",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 211,
    weight: 736,
    fee: 0,
    status: {
    confirmed: true,
      block_height: 2091086,
      block_hash: "00000000340f3667cce7032d084973ca29bdd0d858ec363ed894ad4c8ed09ebc",
      block_time: 1630607773
    }
  },
  ...
],`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 765,
    funded_txo_sum: 87749875807,
    spent_txo_count: 765,
    spent_txo_sum: 87749875807,
    tx_count: 875
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [],
    vout: [],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          commonJS: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          curl: [`vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`
        },
        codeSampleBisq: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: ''
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "addresses",
    httpRequestMethod: "GET",
    fragment: "get-address-transactions-mempool",
    title: "GET Address Transactions Mempool",
    description: {
      default: "Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging)."
    },
    urlString: "/address/:address/txs/mempool",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/mempool`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          commonJS: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          curl: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          response: `[
  {
    txid: "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 14720,
    weight: 58880,
    fee: 1496,
    status: { confirmed: false }
  }
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "addresses",
    httpRequestMethod: "GET",
    fragment: "get-address-utxo",
    title: "GET Address UTXO",
    description: {
      default: "Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx).",
      liquid: "Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx). There is also a <code>valuecommitment</code> field that may appear in place of <code>value</code>, plus the following additional fields: <code>asset</code>/<code>assetcommitment</code>, <code>nonce</code>/<code>noncecommitment</code>, <code>surjection_proof</code>, and <code>range_proof</code>.",
    },
    urlString: "/address/:address/utxo",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/utxo`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsUtxo, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          commonJS: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          curl: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          response: `[
  {
    txid: "12f96289f8f9cd51ccfe390879a46d7eeb0435d9e0af9297776e6bdf249414ff",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 698642,
      block_hash: "00000000000000000007839f42e0e86fd53c797b64b7135fcad385158c9cafb8",
      block_time: 1630561459
    },
    value: 644951084
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          commonJS: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          curl: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          response: `[
  {
    txid: "c404bc4ba89e9423ff772cb45268ba6fba8b713f809484c1216f1a657aafa088",
    vout: 1,
    status: {
      confirmed: true,
      block_height: 2086944,
      block_hash: "000000000000039a27007892b0f3ac646afa4eb3ef3d4a4e75e8bdf636b4d006",
      block_time: 1630159123
    },
    value: 1973787
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "e58b47f657b496a083ad9a4fb10c744d5e993028efd9cfba149885334d98bdf5",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 698571,
      block_hash: "00000000000000000007536c0a664a7d2a01c31569623183eba0768d9a0c163d",
      block_time: 1630520708
    },
    value: 642070789
  },
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          commonJS: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          curl: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          response: `[
  {
    txid: "067bac619cc67de7654bb3ee01ebcadf1e582980b3873478bac7d3931f06045f",
    vout: 1,
    status: {
      confirmed: true,
      block_height: 1471900,
      block_hash: "9408b32d41225cea32bace82aac1789a218e6592ab24de5793ca2138b876f536",
      block_time: 1630621258
    },
    valuecommitment: "0805015e56cbbf6cc494cb200615b7f8b781f0d640e4c96b4abdad356068f6346f",
    assetcommitment: "0a6bb828996381a61cb9f24610bea8a0c35efe388d39a993d369e08a6fc358e7dc",
    noncecommitment: "0282f3f01f06e43fb88bcd28e7e83c9c0d9cefc92c104a6e814810c100ec66b33d"
  }
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          commonJS: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          curl: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          response: `[
  {
    "txid": "b010ce1accf781234e9736243a33c5367ce76e3a12609cf70a80ad15679c57dd",
    "vout": 0,
    "status": {
      "confirmed": false
    },
    "valuecommitment": "087851b6faa9b97d3c87dba24d69456b4084c36529ca0bda8aebea3fca787ec298",
    "assetcommitment": "0b16b09f9987d7f7aaa8b6bd61f00e50b448ecb8b4ecf3623338b80e2533637848",
    "noncecommitment": "03ba8cf651bd77791ea6a208a9f7ab8482b1ea207e4e4b2e6e964ebd163f81afb7",
    "surjection_proof": "010001398a7d5ac645e45b27898ee4548b111c64cdf1850cf283dbdea89c3163d168d8...",
    "range_proof": "6033000000000000000116898801858209e1386655e803472959b95e706d47fca2bfad..."
  }
]`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "category",
    category: "assets",
    fragment: "assets",
    title: "Assets",
    showConditions: liquidNetworks
  },
  {
    type: "endpoint",
    category: "assets",
    httpRequestMethod: "GET",
    fragment: "get-asset",
    title: "GET Asset",
    description: {
      default: "Returns information about a Liquid asset."
    },
    urlString: "/asset/:asset_id",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const asset = await assets.getAsset({ asset_id });

        document.getElementById("result").textContent = JSON.stringify(asset, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const asset = await assets.getAsset({ asset_id });
  console.log(asset);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `{
  asset_id: "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  chain_stats: {
    tx_count: 3887,
    peg_in_count: 2557,
    peg_in_amount: 328822657766,
    peg_out_count: 1131,
    peg_out_amount: 7427922560,
    burn_count: 199,
    burned_amount: 516003151
  },
  mempool_stats: {
    tx_count: 0,
    peg_in_count: 0,
    peg_in_amount: 0,
    peg_out_count: 0,
    peg_out_amount: 0,
    burn_count: 0,
    burned_amount: 0
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `{
  "asset_id": "ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926",
  "issuance_txin": {...},
  "issuance_prevout": {...},
  "reissuance_token": "55fdb86a988b07242a7edbddb53f40b3742c0e863a769937018b31621708b14b",
  "contract_hash": "b3619fb6ebd502ba57c4c026e73d7ae430c32431ffe833a4867faa9dd89abd5b",
  "status": {...},
  "chain_stats": {
    "tx_count": 2,
    "issuance_count": 2,
    "issued_amount": 0,
    "burned_amount": 0,
    "has_blinded_issuances": true,
    "reissuance_tokens": null,
    "burned_reissuance_tokens": 0
  },
  "mempool_stats": {
    "tx_count": 0,
    "issuance_count": 0,
    "issued_amount": 0,
    "burned_amount": 0,
    "has_blinded_issuances": false,
    "reissuance_tokens": null,
    "burned_reissuance_tokens": 0
  },
  "contract": {...},
  "entity": {...},
  "precision": 8,
  "name": "Liquid CAD",
  "ticker": "LCAD"
}`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "assets",
    httpRequestMethod: "GET",
    fragment: "get-asset-transactions",
    title: "GET Asset Transactions",
    description: {
      default: "Returns transactions associated with the specified Liquid asset. For the network's native asset, returns a list of peg in, peg out, and burn transactions. For user-issued assets, returns a list of issuance, reissuance, and burn transactions. Does not include regular transactions transferring this asset."
    },
    urlString: "/asset/:asset_id/txs[/mempool|/chain]",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}/txs`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });

        document.getElementById("result").textContent = JSON.stringify(assetTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
  console.log(assetTxs);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `[
  {
    txid: "93fedcc996df43c94f9f12e24b4040b60d47d84ef7a9a66ef05c2e6f4059b685",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 998,
    weight: 1484,
    fee: 42,
    status: {
      confirmed: true,
      block_height: 1471854,
      block_hash: "f113b64f6bc937fda6891fd9f1833d207312f986767aff91aea9649d87533250",
      block_time: 1630618498
    }
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `[
  {
    txid: "34b9cd013ddf4d4b5e9d09502ca953034fd52a0679845ac8b9d54c63d857a488",
    version: 2,
    locktime: 140139,
    vin: [],
    vout: [],
    size: 17918,
    weight: 19721,
    fee: 493,
    status: {
      confirmed: true,
      block_height: 140140,
      block_hash: "c3a08178acf2bbafabda120930a0b270e762550d8a46e3e093de779ef459d29d",
      block_time: 1640279893
    }
  },
  ...
]`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "assets",
    httpRequestMethod: "GET",
    fragment: "get-asset-supply",
    title: "GET Asset Supply",
    description: {
      default: "Get the current total supply of the specified asset. For the native asset (L-BTC), this is calculated as [chain,mempool]_stats.peg_in_amount - [chain,mempool]_stats.peg_out_amount - [chain,mempool]_stats.burned_amount. For issued assets, this is calculated as [chain,mempool]_stats.issued_amount - [chain,mempool]_stats.burned_amount. Not available for assets with blinded issuances. If /decimal is specified, returns the supply as a decimal according to the asset's divisibility. Otherwise, returned in base units."
    },
    urlString: "/asset/:asset_id/supply[/decimal]",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/asset/%{1}/supply`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();

        const asset_id = '%{1}';
        const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });

        document.getElementById("result").textContent = JSON.stringify(assetSupply, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();

  const asset_id = '%{1}';
  const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
  console.log(assetSupply);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `320878732055`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          commonJS: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          curl: [`05aa9f02a06da37f2a0a572c49ac381499a16a643ad7c70c51ac94560778c92e`],
          response: `1000`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "assets",
    httpRequestMethod: "GET",
    fragment: "get-asset-icons",
    title: "GET Asset Icons",
    description: {
      default: "Get all the Asset IDs that have icons."
    },
    urlString: "/v1/assets/icons",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/assets/icons`,
          commonJS: `
        const { %{0}: { assets } } = mempoolJS();
        const assetsIcons = await assets.getAssetsIcons();
        document.getElementById("result").textContent = JSON.stringify(assetsIcons, undefined, 2);
        `,
          esModule: `
  const { %{0}: { assets } } = mempoolJS();
  const assetsIcons = await assets.getAssetsIcons();
  console.log(assetsIcons);
          `,
        },
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `[
  "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
  ...
]`,
        },
        codeSampleLiquidTestnet: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "assets",
    httpRequestMethod: "GET",
    fragment: "get-asset-icon",
    title: "GET Asset Icon",
    description: {
      default: "Get the icon of the specified asset."
    },
    urlString: "/v1/asset/:asset_id/icon",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        noWrap: true,
        codeTemplate: {
          curl: `/api/v1/asset/%{1}/icon`,
          commonJS: `<img src="https://liquid.place/api/v1/asset/%{1}/icon">`,
        },
        codeSampleLiquid: {
          esModule: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          commonJS: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          curl: [`6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`],
          response: `PNG`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          commonJS: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          curl: [`ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`],
          response: `PNG`,
        },
      }
    }
  },
  {
    type: "category",
    category: "blocks",
    fragment: "blocks",
    title: "Blocks",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"])
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block",
    title: "GET Block",
    description: {
      default: "Returns details about a block.",
      liquid: "Returns details about a block. Available fields: <code>id</code>, <code>height</code>, <code>version</code>, <code>timestamp</code>, <code>bits</code>, <code>nonce</code>, <code>merkle_root</code>, <code>tx_count</code>, <code>size</code>, <code>weight</code>,<code>proof</code>, and <code>previousblockhash</code>."
    },
    urlString: "/block/:hash",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"]),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const block = await blocks.getBlock({ hash });

        document.getElementById("result").textContent = JSON.stringify(block, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const block = await blocks.getBlock({ hash });
  console.log(block);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          commonJS: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          curl: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          response: `{
  "extras": {
    "reward": 638307429,
    "coinbaseTx": {
      "vin": [
        {
          "scriptsig": "03ad3e0b2cfabe6d6df8fb5429a5de5fc2bd1bafffbc90d33c77eb73307d51931d247f21d7bccde51710000000f09f909f092f4632506f6f6c2f6b0000000000000000000000000000000000000000000000000000000000000000000000050086411100"
        }
      ],
      "vout": [
        {
          "scriptpubkey_address": "1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY",
          "value": 638307429
        }
      ]
    },
    "coinbaseRaw": "03ad3e0b2cfabe6d6df8fb5429a5de5fc2bd1bafffbc90d33c77eb73307d51931d247f21d7bccde51710000000f09f909f092f4632506f6f6c2f6b0000000000000000000000000000000000000000000000000000000000000000000000050086411100",
    "medianFee": 10,
    "feeRange": [
      1,
      8,
      9,
      10,
      15,
      21,
      348
    ],
    "totalFees": 13307429,
    "avgFee": 5591,
    "avgFeeRate": 13,
    "pool": {
      "id": 36,
      "name": "F2Pool",
      "slug": "f2pool"
    },
    "matchRate": 93
  },
  "id": "00000000000000000007566f8f035a1dc38b351e6f54778b311fe6dbabd79b46",
  "height": 736941,
  "version": 536870916,
  "timestamp": 1652891466,
  "bits": 386466234,
  "nonce": 3514220842,
  "difficulty": 31251101365711.12,
  "merkle_root": "4a3072f98f60cbb639bb7f46180b8843d17c7502627ffb633db0ed86610cdd71",
  "tx_count": 2381,
  "size": 1709571,
  "weight": 3997770,
  "previousblockhash": "00000000000000000005ef14db0b4befcbbe1e9b8676eec67fcf810a899c4d5e"
}`
        },
        codeSampleTestnet: {
          esModule: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          commonJS: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          curl: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          response: `{
  id: "000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81",
  height: 2091140,
  version: 543162372,
  timestamp: 1630625150,
  tx_count: 2,
  size: 575,
  weight: 1865,
  merkle_root: "5d10d8d158bb8eb217d01fecc435bd10eda028043a913dc2bfe0ccf536a51cc9",
  previousblockhash: "0000000000000073f95d1fc0a93d449f82a754410c635e46264ec6c7c4d5741e",
  mediantime: 1630621997,
  nonce: 1600805744,
  bits: 436273151,
  difficulty: 16777216
}`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `{
  id: "000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152",
  height: 53745,
  version: 536870912,
  timestamp: 1630624390,
  tx_count: 1,
  size: 343,
  weight: 1264,
  merkle_root: "2c1984132841b9f98270274012b22beb7d4ade778cf058e9a44d38de5a111362",
  previousblockhash: "000001497bffdc2347656847647f343afc0eee441a849259335b8a1d79b6aa4a",
  mediantime: 1630621400,
  nonce: 19642021,
  bits: 503404179,
  difficulty: 0
}`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `{
  id: "86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78",
  height: 1471971,
  version: 570425344,
  timestamp: 1630625518,
  tx_count: 2,
  size: 10841,
  weight: 16913,
  merkle_root: "7e40735e103d6015c90d285d09b535498c0a26df9ca8118b1b4d68aaf80ccf48",
  previousblockhash: "944fa8ffd906b3531af95f3d9b052dfdef0b60657c3c8def2c3591384f083424",
  mediantime: 1630625218,
  ext: {
    challenge: "5b21026a2a106ec32c8a1e8052e5d02a7b0a150423dbd9b116fc48d46630ff6e6a05b92102791646a8b49c2740352b4495c118d876347bf47d0551c01c4332fdc2df526f1a2102888bda53a424466b0451627df22090143bbf7c060e9eacb1e38426f6b07f2ae12102aee8967150dee220f613de3b239320355a498808084a93eaf39a34dcd62024852102d46e9259d0a0bb2bcbc461a3e68f34adca27b8d08fbe985853992b4b104e27412102e9944e35e5750ab621e098145b8e6cf373c273b7c04747d1aa020be0af40ccd62102f9a9d4b10a6d6c56d8c955c547330c589bb45e774551d46d415e51cd9ad5116321033b421566c124dfde4db9defe4084b7aa4e7f36744758d92806b8f72c2e943309210353dcc6b4cf6ad28aceb7f7b2db92a4bf07ac42d357adf756f3eca790664314b621037f55980af0455e4fb55aad9b85a55068bb6dc4740ea87276dc693f4598db45fa210384001daa88dabd23db878dbb1ce5b4c2a5fa72c3113e3514bf602325d0c37b8e21039056d089f2fe72dbc0a14780b4635b0dc8a1b40b7a59106325dd1bc45cc70493210397ab8ea7b0bf85bc7fc56bb27bf85e75502e94e76a6781c409f3f2ec3d1122192103b00e3b5b77884bf3cae204c4b4eac003601da75f96982ffcb3dcb29c5ee419b92103c1f3c0874cfe34b8131af34699589aacec4093399739ae352e8a46f80a6f68375fae",
    solution: "00473045022100b572ef7e8a1c5a795d4ca46ab0221f0296ae081870ec25b3eb3f7db4a9e48d6102207863cfcae9776d3fee8fb2f05f06c879cf16c319b633f09cfac9bf041e662f31463044022056e41068e5448c897f80ef864fbbd71690af375afc33d9a52a12efd399a75c0202203f61333e193e0ff3da1ef15fa5c84c3852bd3b4f701e4bf4ebc0dcb68138d227473045022100af50aae198402aa45764a771d3ec23cf86037ea1e3bd682d09f262d057de1a2c02202f46b42ff1062117001af9689fce666bc50cfd479f63969e28670e26b747610f46304402201bb90d72cd58e5198b135828354e8fcc3e73238e412c6e2474f9d67676b12ceb022053f3a6cbeb85abc5e0bc18a83eeffe7785c382746f50c98a29743eb00d474f9e473045022100954d79ddb28c5682a3600cb4f76433f31606064717c700e5ea626807cfb169cf0220365e42d1d07bd8a65b5cb6e449a6bbd3684bf31f0f31ffe9aa13a1f145f28de2473045022100e8a6566fbd8e2829ac24c02ff78794f0122d828e9c1989ed8c077013a2834c6d022016b6833665bbe9ca930247600694f90d40aeb9880fdf95ef62b553efb516997f473045022100c0dca22bfc3a3f64f1ac221796ecd052c153e03732e696ce891be4998c6ae34a0220650ff2e1af0cf3318e249e358738d69de91ebdc81535234a30bdbc4361edc08246304402205f0db67365c3667b93cbcfaa2e5a26a4dbab15a5e39196008fd84b61de358f89022035d5bca676b62028e17f962ef7a33b9f34534f02f3d1ac57b65a666f6d33b3fa473045022100ae711c250c7e4a9d7795e96a4209d05f2b4866473aa2a35b8478b9e3eec883800220514db41ba950cf089cce8fd71cfc41454c80005c2c57401da0e2fb3ce96097bc473045022100bfc416e16fb246cc21a3729359bcf9a752643f4c57190493418dab5df33ff8190220289600af6dc32bffb000f984c8c37f137841e1738c701e05c0a08be53e5eb62b473045022100accf30feb32423e20ddaae3c12584b33ad4eb6492deed1393175a0443832faa0022045b17184460ece57857fe74143166c3692348758054d3d7852fee833cb66e9c4"
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          commonJS: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          curl: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          response: `{
  id: "8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a",
  height: 154705,
  version: 536870912,
  timestamp: 1641154264,
  tx_count: 2,
  size: 5137,
  weight: 7348,
  merkle_root: "e7cc1145b3b074be73a84119485a504de77967aabe415240caca0e2c41a8b9b4",
  previousblockhash: "2745fd72a5bd2b256c9d2044631032d2cd872f1f0001c3db52e26604a6423526",
  mediantime: 1641153964,
  ext: {...}
}`,
        },
        codeSampleBisq: {
          esModule: ['0000000000000000000b24f70ed27da8b282b050f38e20831923211a1f7266d5'],
          commonJS: ['0000000000000000000b24f70ed27da8b282b050f38e20831923211a1f7266d5'],
          curl: ['0000000000000000000b24f70ed27da8b282b050f38e20831923211a1f7266d5'],
          response: `{
  height: 698746,
  time: 1630621494000,
  hash: "0000000000000000000b24f70ed27da8b282b050f38e20831923211a1f7266d5",
  previousBlockHash: "000000000000000000039cd226a99c125ee3004e9d585b04e2ccceccddef7547",
  txs: []
}`
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-header",
    title: "GET Block Header",
    description: {
      default: "Returns the hex-encoded block header."
    },
    urlString: "/block/:hash/header",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/header`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockHeader = await blocks.getBlockHeader({ height: 0 });

        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockHeader = await blocks.getBlockHeader({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          commonJS: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          curl: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          response: `040000202c04d4c450187d1da9b1bc23ba47d67fe028d22486fd0c00000000000000000059a3a33d4642c799af9f54a4dd351fff9130e6a89d4e251130c60064878616e906b5ea60ce9813173a25caf3`
        },
        codeSampleTestnet: {
          esModule: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          commonJS: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          curl: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          response: `040060201e74d5c4c7c64e26465e630c4154a7829f443da9c01f5df97300000000000000c91ca536f5cce0bfc23d913a0428a0ed10bd35c4ec1fd017b28ebb58d1d8105d7e5d3161ffff001a705b6a5f`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `000000204aaab6791d8a5b335992841a44ee0efc3a347f644768654723dcff7b490100006213115ade384da4e958f08c77de4a7deb2bb21240277082f9b941281384192c865a31619356011ea5b62b01`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `000000222434084f3891352cef8d3c7c65600beffd2d059b3d5ff91a53b306d9ffa84f9448cf0cf8aa684d1b8b11a89cdf260a8c4935b5095d280dc915603d105e73407eee5e3161e3751600fd01025b21026a2a106ec32c8a1e8052e5d02a7b0a150423dbd9b116fc48d46630ff6e6a05b92102791646a8b49c2740352b4495c118d876347bf47d0551c01c4332fdc2df526f1a2102888bda53a424466b0451627df22090143bbf7c060e9eacb1e38426f6b07f2ae12102aee8967150dee220f613de3b239320355a498808084a93eaf39a34dcd62024852102d46e9259d0a0bb2bcbc461a3e68f34adca27b8d08fbe985853992b4b104e27412102e9944e35e5750ab621e098145b8e6cf373c273b7c04747d1aa020be0af40ccd62102f9a9d4b10a6d6c56d8c955c547330c589bb45e774551d46d415e51cd9ad5116321033b421566c124dfde4db9defe4084b7aa4e7f36744758d92806b8f72c2e943309210353dcc6b4cf6ad28aceb7f7b2db92a4bf07ac42d357adf756f3eca790664314b621037f55980af0455e4fb55aad9b85a55068bb6dc4740ea87276dc693f4598db45fa210384001daa88dabd23db878dbb1ce5b4c2a5fa72c3113e3514bf602325d0c37b8e21039056d089f2fe72dbc0a14780b4635b0dc8a1b40b7a59106325dd1bc45cc70493210397ab8ea7b0bf85bc7fc56bb27bf85e75502e94e76a6781c409f3f2ec3d1122192103b00e3b5b77884bf3cae204c4b4eac003601da75f96982ffcb3dcb29c5ee419b92103c1f3c0874cfe34b8131af34699589aacec4093399739ae352e8a46f80a6f68375faefd160300473045022100b572ef7e8a1c5a795d4ca46ab0221f0296ae081870ec25b3eb3f7db4a9e48d6102207863cfcae9776d3fee8fb2f05f06c879cf16c319b633f09cfac9bf041e662f31463044022056e41068e5448c897f80ef864fbbd71690af375afc33d9a52a12efd399a75c0202203f61333e193e0ff3da1ef15fa5c84c3852bd3b4f701e4bf4ebc0dcb68138d227473045022100af50aae198402aa45764a771d3ec23cf86037ea1e3bd682d09f262d057de1a2c02202f46b42ff1062117001af9689fce666bc50cfd479f63969e28670e26b747610f46304402201bb90d72cd58e5198b135828354e8fcc3e73238e412c6e2474f9d67676b12ceb022053f3a6cbeb85abc5e0bc18a83eeffe7785c382746f50c98a29743eb00d474f9e473045022100954d79ddb28c5682a3600cb4f76433f31606064717c700e5ea626807cfb169cf0220365e42d1d07bd8a65b5cb6e449a6bbd3684bf31f0f31ffe9aa13a1f145f28de2473045022100e8a6566fbd8e2829ac24c02ff78794f0122d828e9c1989ed8c077013a2834c6d022016b6833665bbe9ca930247600694f90d40aeb9880fdf95ef62b553efb516997f473045022100c0dca22bfc3a3f64f1ac221796ecd052c153e03732e696ce891be4998c6ae34a0220650ff2e1af0cf3318e249e358738d69de91ebdc81535234a30bdbc4361edc08246304402205f0db67365c3667b93cbcfaa2e5a26a4dbab15a5e39196008fd84b61de358f89022035d5bca676b62028e17f962ef7a33b9f34534f02f3d1ac57b65a666f6d33b3fa473045022100ae711c250c7e4a9d7795e96a4209d05f2b4866473aa2a35b8478b9e3eec883800220514db41ba950cf089cce8fd71cfc41454c80005c2c57401da0e2fb3ce96097bc473045022100bfc416e16fb246cc21a3729359bcf9a752643f4c57190493418dab5df33ff8190220289600af6dc32bffb000f984c8c37f137841e1738c701e05c0a08be53e5eb62b473045022100accf30feb32423e20ddaae3c12584b33ad4eb6492deed1393175a0443832faa0022045b17184460ece57857fe74143166c3692348758054d3d7852fee833cb66e9c4`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          commonJS: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          curl: [`8f7cb70f32e2069724212c986f34462fc40180eabf189b44486faf6989824f9a`],
          response: `000000a0263542a60466e252dbc301001f2f87cdd232106344209d6c252bbda572fd4527b4b9a8412c0ecaca405241beaa6779e74d505a481941a873be74b0b34511cce7d806d261515c020001220020e9e4117540f7f23b3edd7c2cad660a17fb33c7959b8c37cf61d92b189133929a96000000fbee9cea00d8efdc49cfbec328537e0d7032194de6ebf3cf42e5c05bb89a08b10003004730440220303a6fc365e016422bd5d714e403db237964c9e53c244310a4a03f432583290202206951e82c2ffa028f88d64d9bb4ec7789ced137046bb38a02816617b554efd42b012551210217e403ddb181872c32a0cd468c710040b2f53d8cac69f18dad07985ee37e9a7151ae`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-height",
    title: "GET Block Height",
    description: {
      default: "Returns the hash of the block currently at <code>:height</code>."
    },
    urlString: "/block-height/:height",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block-height/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();
        const hash = '%{1}';
        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();
  const hash = '%{1}';
  const blockHeight = await blocks.getBlockHeight({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['615615'],
          commonJS: ['615615'],
          curl: ['615615'],
          response: `000000000000000000067bea442af50a91377ac796e63b8d284354feff4042b3`
        },
        codeSampleTestnet: {
          esModule: ['2100100'],
          commonJS: ['2100100'],
          curl: ['2100100'],
          response: `000000000000001be62f15637e813e1d8ecdf26ee95d1820ef16db9bd8685985`
        },
        codeSampleSignet: {
          esModule: ['48000'],
          commonJS: ['48000'],
          curl: ['48000'],
          response: `00000009e8322d4b8f74c8bbd04df1dd5a4abce236ae5907cc87f8364fa5e645`
        },
        codeSampleLiquid: {
          esModule: [`1234567`],
          commonJS: [`1234567`],
          curl: [`1234567`],
          response: `ec2e2bf982bca68c4b09634ba2e48fbe9de3d14744a8e8382971991ff8c6cfd1`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`150000`],
          commonJS: [`150000`],
          curl: [`150000`],
          response: `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-raw",
    title: "GET Block Raw",
    description: {
      default: "Returns the raw block representation in binary."
    },
    urlString: "/block/:hash/raw",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/raw`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockRaw = await blocks.getBlockRaw({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          commonJS: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          curl: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          response: '',
        },
        codeSampleTestnet: {
          esModule: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          commonJS: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          curl: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          response: '',
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: '',
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: '',
        },
        codeSampleLiquidTestnet: {
          esModule: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          commonJS: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          curl: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          response: '',
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-status",
    title: "GET Block Status",
    description: {
      default: "Returns the confirmation status of a block. Available fields: <code>in_best_chain</code> (boolean, false for orphaned blocks), <code>next_best</code> (the hash of the next block, only available for blocks in the best chain)."
    },
    urlString: "/block/:hash/status",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/status`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockStatus = await blocks.getBlockStatus({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          commonJS: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          curl: ['0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2'],
          response: `{
  in_best_chain: true,
  height: 690557,
  next_best: "00000000000000000003a59a34c93e39e636c8cd23ead726fdc467fbed0b7c5a"
}`
        },
        codeSampleTestnet: {
          esModule: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          commonJS: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          curl: ['000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81'],
          response: `{
  in_best_chain: true,
  height: 2091140,
  next_best: "0000000000000064152f2dc1e13bd70811fbcfa9c1660557233668b98b7b1c2b"
}`
        },
        codeSampleSignet: {
          esModule: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          commonJS: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          curl: ['000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152'],
          response: `{
  in_best_chain: true,
  height: 53745,
  next_best: "000000e9c2a969f6a3425ab70851328e878ebdeb90b73f9cfb16241b97c44640"
}`
        },
        codeSampleLiquid: {
          esModule: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          commonJS: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          curl: [`86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`],
          response: `{
  in_best_chain: true,
  height: 1471971,
  next_best: "1ce5b14c5fbc05be73d8833839e049fd34212da902a78118cd8502a95bf9c134"
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          commonJS: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          curl: [`67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`],
          response: `{
  in_best_chain: true,
  height: 150000,
  next_best: "2f24f3d94c006971b86fe2c9cdc92a7ed0aa7ec3b0643a836b8d8b5a54103bab"
}`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-tip-height",
    title: "GET Block Tip Height",
    description: {
      default: "Returns the height of the last block."
    },
    urlString: "/blocks/tip/height",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"]),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/height`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `698767`
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `2091168`
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `53763`
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `1472119`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `162495`,
        },
        codeSampleBisq: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `698765`
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-tip-hash",
    title: "GET Block Tip Hash",
    description: {
      default: "Returns the hash of the last block."
    },
    urlString: "/blocks/tip/hash",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/hash`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHash = await blocks.getBlocksTipHash();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHash, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `0000000000000000000624d76f52661d0f35a0da8b93a87cb93cf08fd9140209`
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `00000000000000a7a5227bb493ffb90d1e63e1c7e8cab2c9a2b98e9f2599a9a9`
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `000000c09517efadf7425f7c19543b69768aaa9871a817d192d2c33cebebf3f9`
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ec8fed6f33cba86f99b39ae65af948bfc2fdb95cceaa7331bbfd88f5daa823a2`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ff643a1e102b555103d8feb20b296ee5cf3b4a202fa284e5d6ce82945b738ae7`,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-transaction-id",
    title: "GET Block Transaction ID",
    description: {
      default: "Returns the transaction at index <code>:index</code> within the specified block."
    },
    urlString: "/block/:hash/txid/:index",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txid/%{2}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });

        document.getElementById("result").textContent = JSON.stringify(blockTxid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });
  console.log(blockTxid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          commonJS: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          curl: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          response: `0fa6da60e484941f255cbb025c3d6440e5a7e970119e899b4065c7999360e406`
        },
        codeSampleTestnet: {
          esModule: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          commonJS: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          curl: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          response: `7aede67cd9f48c2f77ca9112c27da2583ea41fbb391652777c44ef21d5b1656e`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          commonJS: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          curl: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          response: `b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89`
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-transaction-ids",
    title: "GET Block Transaction IDs",
    description: {
      default: "Returns a list of all txids in the block."
    },
    urlString: "/block/:hash/txids",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txids`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxids = await blocks.getBlockTxids({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          commonJS: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          curl: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce', '218'],
          response: `[
  "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
  "a5ef89881bd5103f223a0fa285dfc75f4718974cb792cf85e623a7de05801bc9",
  ...,
]`
        },
        codeSampleTestnet: {
          esModule: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          commonJS: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          curl: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b', '1'],
          response: `[
  "b5d033f57045b76f2f29df0c2469be0153ecf2514717bccd8d52250b3e7ba781",
  "7aede67cd9f48c2f77ca9112c27da2583ea41fbb391652777c44ef21d5b1656e",
  "20827f9a8fb5ec5fa55ce5389b1d7520d7961272492dc3424874887daeea21dc"
]`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          commonJS: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          curl: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f', '1'],
          response: `[
  "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
  "b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89",
  "0597e9355e868f98560b0e30d0c6b9f5e7c0f004c376ef26850f61096fabb692",
  "857ff0a341b14aae2e45122d458f13d0d744cc1081ef0ae2aaec32c01587d1c0",
  "6062ac26ef4b0c9b5343bdf46c1677297f85705f523472a96383af276a20b0da",
  "a469bed29a54ef3ed5d00c472f10603ed3ee7c4972fc3cb623e738d628064d19",
  "ca1a3d14d88dc72a5cb6da198c7151f1f71718ee4b4ba70d6bc597a260b0ab20",
  "7516b5aaeaab70a735f47b4e100421363cef535378d522a3244ac8741b9d6740",
  "ee428b6be6df6655ddcbfd64bb3a8fa8de513c4f50d94c1ef91df1254cf45172",
  "7cf09ecd458613cd3817754286d356fd91efa8456cc9fdc744b65dd6e01ca6ab",
  "43082dda77028f2ccab3639c919aea6049fd3917a5f3f413f0ee12ca4daf4ad6",
  "13e4c56fdc40928e8639d19aefff23270ea5555c6e8887fd95b609c50297cbe0",
  "99bcab11aab1ccb4b2881e5fb0e9b788b8ee0064caa0915e3de62ff8ea65adf5"
]`
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `[
  "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
  "36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598"
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `[
  "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
  "41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a",
  "fa6b8dda9037f8284a659627005ad32dbb81e22b102c1d3d8a9bab0893ce2ab7"
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-block-transactions",
    title: "GET Block Transactions",
    description: {
      default: "Returns a list of transactions in the block (up to 25 transactions beginning at <code>start_index</code>). Transactions returned here do not have the <code>status</code> field, since all the transactions share the same block and confirmation status."
    },
    urlString: "/block/:hash/txs[/:start_index]",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txs`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxs = await blocks.getBlockTxs({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          commonJS: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          curl: ['000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce'],
          response: `[
  {
    txid: "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 102,
    weight: 408,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 363366,
      block_hash: "000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce",
      block_time: 1435766771
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b'],
          commonJS: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b'],
          curl: ['000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b'],
          response: `[
  {
    txid: "b5d033f57045b76f2f29df0c2469be0153ecf2514717bccd8d52250b3e7ba781",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 238,
    weight: 844,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 2091173,
      block_hash: "000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b",
      block_time: 1630635771
    }
  },
  ...
],`
        },
        codeSampleSignet: {
          esModule: ['0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          commonJS: ['0000004b62b53d2550c300208af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          curl: ['0000014b60b53d2550c310200af9d792ab7a9a2487a67d82c06b17b201ee602f'],
          response: `[
  {
    txid: "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 892,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 53770,
      block_hash: "0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f",
      block_time: 1630635847
    }
  },
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          commonJS: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          curl: ['dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13', '1'],
          response: `[
  {
    txid: "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 877,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 1472142,
      block_hash: "dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13",
      block_time: 1630635778
    }
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          commonJS: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          curl: ['b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f', '1'],
          response: `[
  {
    txid: "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 226,
    weight: 781,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 142834,
      block_hash: "b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f",
      block_time: 1640441533
    }
  },
  ...
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-blocks",
    title: "GET Blocks",
    description: {
      default: "Returns details on the past 15 blocks with fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned."
    },
    urlString: "/v1/blocks[/:startHeight]",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['730000'],
          commonJS: ['730000'],
          curl: ['730000'],
          response: `[
  {
    "id": "0000000000000000000384f28cb3b9cf4377a39cfd6c29ae9466951de38c0529",
    "timestamp": 1648829449,
    "height": 730000,
    "version": 536870912,
    "bits": 386521239,
    "nonce": 3580664066,
    "difficulty": 28587155782195.14,
    "merkle_root": "efa344bcd6c0607f93b709515dd6dc5496178112d680338ebea459e3de7b4fbc",
    "tx_count": 1627,
    "size": 1210916,
    "weight": 3993515,
    "previousblockhash": "00000000000000000008b6f6fb83f8d74512ef1e0af29e642dd20daddd7d318f",
    "extras": {
      "coinbaseRaw": "0390230b1362696e616e63652f383038e0006f02cd583765fabe6d6d686355577affaad03015e732428a927a5d2d842471b350394139616bcb4401d804000000000000001a750000c9ad0000",
      "medianFee": 11,
      "feeRange": [
        1,
        11,
        11,
        11,
        18,
        21,
        660
      ],
      "reward": 641321983,
      "totalFees": 16321983,
      "avgFee": 10038,
      "avgFeeRate": 16,
      "pool": {
        "id": 105,
        "name": "Binance Pool",
        "slug": "binancepool"
      }
    }
  },
  {
    "id": "00000000000000000008b6f6fb83f8d74512ef1e0af29e642dd20daddd7d318f",
    "timestamp": 1648828946,
    "height": 729999,
    "version": 793796608,
    "bits": 386521239,
    "nonce": 3477019455,
    "difficulty": 28587155782195.14,
    "merkle_root": "d84f9cc1823bd069c505061b1f6faabd809d67ab5354e9f6234312dc4bdb1ecf",
    "tx_count": 2574,
    "size": 1481957,
    "weight": 3993485,
    "previousblockhash": "000000000000000000071e6c86c2175aa86817cae2a77acd95372b55c1103d89",
    "extras": {
      "coinbaseRaw": "038f230b1362696e616e63652f373739d8002900ca5de7a9fabe6d6dda31112c36c10a523154eae76847579755cd4ae558ee2e6f9f200b05dd32a0bf04000000000000006372000000020000",
      "medianFee": 17,
      "feeRange": [
        2,
        11,
        14,
        17,
        19,
        28,
        502
      ],
      "reward": 649090210,
      "totalFees": 24090210,
      "avgFee": 9362,
      "avgFeeRate": 24,
      "pool": {
        "id": 105,
        "name": "Binance Pool",
        "slug": "binancepool"
      }
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: ['2091187'],
          commonJS: ['2091187'],
          curl: ['2091187'],
          response: `[
   {
    "id": "00000000000000533f63df886281a9fd74da163e84a21445153ff480e5f57970",
    "timestamp": 1630641890,
    "height": 2091187,
    "version": 545259520,
    "bits": 436273151,
    "nonce": 309403673,
    "difficulty": 16777216,
    "merkle_root": "4d6df12a4af11bb928c7b2930e0a4d2c3e268c6dc6a07462943ad1c4b6b96468",
    "tx_count": 26,
    "size": 8390,
    "weight": 22985,
    "previousblockhash": "0000000000000079103da7d296e1480295df795b7379e7dffd27743e214b0b32",
    "extras": {
      "coinbaseRaw": "03b3e81f3a205468697320626c6f636b20776173206d696e65642077697468206120636172626f6e206e6567617469766520706f77657220736f75726365201209687a2009092009020de601d7986a040000",
      "medianFee": 1,
      "feeRange": [
        1,
        1,
        1,
        1,
        5,
        56,
        5053
      ],
      "reward": 10547567,
      "totalFees": 781942,
      "avgFee": 31277,
      "avgFeeRate": 143,
      "pool": {
        "id": 137,
        "name": "Unknown",
        "slug": "unknown"
      }
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: ['53783'],
          commonJS: ['53783'],
          curl: ['53783'],
          response: `[
  {
    "id": "0000010eeacb878340bae34af4e13551413d76a172ec302f7e50b62cb45374f2",
    "timestamp": 1630641504,
    "height": 53783,
    "version": 536870912,
    "bits": 503404179,
    "nonce": 11753379,
    "difficulty": 0.002919030932507782,
    "merkle_root": "3063ff3802c920eea68bdc9303957f3e7bfd0a03c93547fd7dad14b77a07d4e8",
    "tx_count": 1,
    "size": 343,
    "weight": 1264,
    "previousblockhash": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "extras": {
      "coinbaseRaw": "0317d200",
      "medianFee": 0,
      "feeRange": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "reward": 5000000000,
      "totalFees": 0,
      "avgFee": 0,
      "avgFeeRate": 0,
      "pool": {
        "id": 137,
        "name": "Unknown",
        "slug": "unknown"
      }
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-blocks",
    title: "GET Blocks",
    description: {
      default: "Returns details on the past 10 blocks with fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 10 blocks before (and including) <code>:startHeight</code> are returned."
    },
    urlString: "/blocks[/:startHeight]",
    showConditions: liquidNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: {
          esModule: ['1472246'],
          commonJS: ['1472246'],
          curl: ['1472246'],
          response: `[
  {
    id: "0bd348c08101fef863b7263b2b44b2f6575f707f1e397da95cfe2afdd5e9ccdb",
    height: 1472246,
    version: 570425344,
    timestamp: 1630642018,
    tx_count: 2,
    size: 10838,
    weight: 16901,
    merkle_root: "a8cdc1ba96d1f862ca7c9aec4133a6efd14138f54c17efdbc968632a6b9cb8c8",
    previousblockhash: "a06c327cdd76301de57ba0cf86c5ae8b1fd8a785945065ac9e2128322bd01f31",
    mediantime: 1630641718
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: ['150000'],
          commonJS: ['150000'],
          curl: ['150000'],
          response: `[
  {
    id: "67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db",
    height: 150000,
    version: 536870912,
    timestamp: 1640871913,
    tx_count: 2,
    size: 3527,
    weight: 7430,
    merkle_root: "40538ff1fcac07c65e36fcc230fc60f58e3a885ce9898e41bc27bcf28227e5ff",
    previousblockhash: "2d8c28042b03219e7e9bc6853cc3ae536e36be5639869c545a0f3dbd1309e2a5",
    mediantime: 1640871614
  },
  ...
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "blocks",
    httpRequestMethod: "GET",
    fragment: "get-blocks",
    title: "GET Blocks",
    description: {
      default: "<p>Returns the past <code>n</code> blocks with BSQ transactions starting <code>m</code> blocks ago.</p><p>Assume a block height of 700,000. Query <code>/blocks/0/10</code> for the past 10 blocks before 700,000 with BSQ transactions. Query <code>/blocks/1000/10</code> for the past 10 blocks before 699,000 with BSQ transactions."
    },
    urlString: "/blocks/:m/:n",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}/%{2}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ index: %{1}, length: %{2} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ index: %{1}, length: %{2} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: {
          esModule: ['0', '5'],
          commonJS: ['0', '5'],
          curl: ['0', '5'],
          response: `[
  {
    "height": 739030,
    "time": 1654203258000,
    "hash": "000000000000000000036bc04416ddeec264cbb977a9cd9e454897acb547b601",
    "previousBlockHash": "00000000000000000000f49261617b589d76e5e70529ea1d4c16f3e19ddcb8ef",
    "txs": [ ... ],
  },
  {
    "height": 739029,
    "time": 1654203236000,
    "hash": "00000000000000000000f49261617b589d76e5e70529ea1d4c16f3e19ddcb8ef",
    "previousBlockHash": "00000000000000000008dd87e9486cd0d71c5d84e452432bab33c2a0cbaa31ce",
    "txs": [ ... ],
  },
  {
    "height": 739025,
    "time": 1654199569000,
    "hash": "000000000000000000021e9ce82dec208af75807f92a9b1d9dae91f2b4d40e24",
    "previousBlockHash": "00000000000000000002db644c025a76464b466d25900402452b07213b30c40b",
    "txs": [ ... ]
  },
  {
    "height": 739023,
    "time": 1654198597000,
    "hash": "0000000000000000000702ce10250a46bea4155ca7acb869f3ea92c1e3a68bc5",
    "previousBlockHash": "00000000000000000002b3d6c1adc5676262ded84181982f88dbd357b9f9d1ec",
    "txs": [ ... ]
  },
  {
    "height": 739020,
    "time": 1654197263000,
    "hash": "000000000000000000046eb46ad941028381d3534c35658f9c80de0641dbbb31",
    "previousBlockHash": "000000000000000000073f1c49b4c4895f3fa6b866d1e21ab8b22f3f9318b42f",
    "txs": [ ... ]
  }
]`
        },
      }
    }
  },
  {
    type: "category",
    category: "mining",
    fragment: "mining",
    title: "Mining",
    showConditions: bitcoinNetworks
  },
 {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-mining-pools",
    title: "GET Mining Pools",
    description: {
      default: "Returns a list of all known mining pools ordered by blocks found over the specified trailing <code>:timePeriod</code>.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify one of the following values: " + miningTimeIntervals + "."
    },
    urlString: "/v1/mining/pools[/:timePeriod]",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `{
  "pools": [
  {
    "poolId": 111,
    "name": "Foundry USA",
    "link": "https://foundrydigital.com/",
    "blockCount": 194,
    "rank": 1,
    "emptyBlocks": 0,
    "slug": "foundryusa"
  },
  {
    "poolId": 36,
    "name": "F2Pool",
    "link": "https://www.f2pool.com/",
    "blockCount": 154,
    "rank": 2,
    "emptyBlocks": 0,
    "slug": "f2pool"
  },
  {
    "poolId": 44,
    "name": "AntPool",
    "link": "https://www.antpool.com/",
    "blockCount": 138,
    "rank": 3,
    "emptyBlocks": 0,
    "slug": "antpool"
  },
  ...
  "blockCount": 1005,
  "lastEstimatedHashrate": 230086716765559200000
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "pools": [
    {
      "poolId": 112,
      "name": "SBI Crypto",
      "link": "https://sbicrypto.com",
      "blockCount": 26243,
      "rank": 2,
      "emptyBlocks": 11272,
      "slug": "sbicrypto"
    },
    {
      "poolId": 8,
      "name": "Huobi.pool",
      "link": "https://www.hpt.com/",
      "blockCount": 12134,
      "rank": 3,
      "emptyBlocks": 6096,
      "slug": "huobipool"
    },
    ...
  ],
  "blockCount": 2226180,
  "lastEstimatedHashrate": 602244182177430.8
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-mining-pool",
    title: "GET Mining Pool",
    description: {
      default: "<p>Returns details about the mining pool specified by <code>:slug</code>.</p>"
    },
    urlString: "/v1/mining/pool/:slug",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`slushpool`],
          response: `{
  "pool": {
    "id": 43,
    "name": "SlushPool",
    "link": "https://slushpool.com/",
    "addresses": [
      "1CK6KHY6MHgYvmRQ4PAafKYDrg1ejbH1cE",
      "1AqTMY7kmHZxBuLUR5wJjPFUvqGs23sesr"
    ],
    "regexes": [
      "/slush/"
    ],
    "slug": "slushpool"
  },
  "blockCount": {
    "all": 679,
    "24h": 8,
    "1w": 56
  },
  "blockShare": {
    "all": 0.06015770355275981,
    "24h": 0.05333333333333334,
    "1w": 0.055666003976143144
  },
  "estimatedHashrate": 12448077385930390000,
  "reportedHashrate": null
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`binancepool`],
          response: `{
  "pool": {
    "id": 105,
    "name": "Binance Pool",
    "link": "https://pool.binance.com/",
    "addresses": [],
    "regexes": [
      "/Binance/",
      "binance"
    ],
    "slug": "binancepool"
  },
  "blockCount": {
    "all": 2,
    "24h": 1,
    "1w": 1
  },
  "blockShare": {
    "all": 8.984160924290476e-7,
    "24h": 0.004524886877828055,
    "1w": 0.0005089058524173028
  },
  "estimatedHashrate": 2617854550633.5283,
  "reportedHashrate": null
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `{}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-mining-pool-hashrates",
    title: "GET Mining Pool Hashrates",
    description: {
      default: "<p>Returns average hashrates (and share of total hashrate) of mining pools active in the specified trailing <code>:timePeriod</code>, in descending order of hashrate.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify any of the following time periods: " + miningTimeIntervals.substr(52) + ".</p>"
    },
    urlString: "/v1/mining/hashrate/pools/[:timePeriod]",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "timestamp": 1650240000,
    "avgHashrate": 38258816322322470000,
    "share": 0.185366,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 28996155528497033000,
    "share": 0.140488,
    "poolName": "F2Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 29801604293177496000,
    "share": 0.14439,
    "poolName": "AntPool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 21747116646372770000,
    "share": 0.105366,
    "poolName": "Poolin"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 26579809234455600000,
    "share": 0.12878,
    "poolName": "Binance Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 19934856925841707000,
    "share": 0.0965854,
    "poolName": "ViaBTC"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 11679007087866855000,
    "share": 0.0565854,
    "poolName": "SlushPool"
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1y`],
          response: `[
  {
    "timestamp": 1621814400,
    "avgHashrate": 395655036336662.7,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1621814400,
    "avgHashrate": 0,
    "share": 0,
    "poolName": "Binance Pool"
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  }
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-mining-pool-hashrate",
    title: "GET Mining Pool Hashrate",
    description: {
      default: "Returns all known hashrate data for the mining pool specified by <code>:slug</code>. Hashrate values are weekly averages."
    },
    urlString: "/v1/mining/pool/:slug/hashrate",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/hashrate`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`foundryusa`],
          response: `[
  {
    "timestamp": 1647216000,
    "avgHashrate": 39126788325841880000,
    "share": 0.195312,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647302400,
    "avgHashrate": 42038778612166990000,
    "share": 0.208941,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647820800,
    "avgHashrate": 40677922193000910000,
    "share": 0.196597,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647907200,
    "avgHashrate": 40210989932016525000,
    "share": 0.194707,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1648425600,
    "avgHashrate": 39336856807414260000,
    "share": 0.194605,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1648512000,
    "avgHashrate": 39391244745360090000,
    "share": 0.193487,
    "poolName": "Foundry USA"
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`kncminer`],
          response: `[
  {
    "timestamp": 1400457600,
    "avgHashrate": 23504290056.20675,
    "share": 0.21875,
    "poolName": "KnCMiner"
  },
  {
    "timestamp": 1401062400,
    "avgHashrate": 22880315827.385838,
    "share": 0.301661,
    "poolName": "KnCMiner"
  },
  {
    "timestamp": 1401667200,
    "avgHashrate": 65314000516.18979,
    "share": 0.774853,
    "poolName": "KnCMiner"
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1600646400,
    "avgHashrate": 23490.65374463165,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1601251200,
    "avgHashrate": 22660.62333333333,
    "share": 1,
    "poolName": "Unknown"
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-mining-pool-blocks",
    title: "GET Mining Pool Blocks",
    description: {
      default: "Returns past 10 blocks mined by the specified mining pool (<code>:slug</code>) before the specified <code>:blockHeight</code>. If no <code>:blockHeight</code> is specified, the mining pool's 10 most recent blocks are returned."
    },
    urlString: "/v1/mining/pool/:slug/blocks/[:blockHeight]",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/blocks/%{2}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`luxor`,`730000`],
          response: `[
  {
    "id": "0000000000000000000572c6eb693c51b728593139079c613c8ea0bc6384e362",
    "timestamp": 1648778242,
    "height": 729910,
    "version": 536895488,
    "bits": 386521239,
    "nonce": 1708647181,
    "difficulty": 28587155782195.14,
    "merkle_root": "729be37fb4b1bff0ca2e4b572e5dc3fb57e5aa57a8a400f8c89d4993d05c204f",
    "tx_count": 1808,
    "size": 1595444,
    "weight": 3992846,
    "previousblockhash": "00000000000000000000034e117bb9922da36adc6393fabfe9ed97c7bb38998c",
    "extras": {
      "coinbaseRaw": "0336230b315c20506f7765726564206279204c75786f722054656368205c000000002103a960b06341e200000e744596150000000000",
      "medianFee": 1,
      "reward": 628988802,
      "totalFees": 3988802,
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "00000000000000000009b6d122d9e2299d2f9cda13274a9f024bebe52ef96a59",
    "timestamp": 1648717740,
    "height": 729820,
    "version": 536870912,
    "bits": 386521239,
    "nonce": 1608169168,
    "difficulty": 28587155782195.14,
    "merkle_root": "4f67e65e8e5e554cd4a8d0f91aa63b5e8686817984eb8188af5fb39958263f5d",
    "tx_count": 1425,
    "size": 729585,
    "weight": 1954155,
    "previousblockhash": "000000000000000000006441657fa1eea37d68784ebd86dc1cd7f89251130f56",
    "extras": {
      "coinbaseRaw": "03dc220b315c20506f7765726564206279204c75786f722054656368205c00000000e5ae4908ac1f20df00000410c830000000000000",
      "medianFee": 8,
      "reward": 630138805,
      "totalFees": 5138805,
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "0000000000000000000796834c03bd3be474bfa895146a58015f5ff325ef50c0",
    "timestamp": 1648653948,
    "height": 729714,
    "version": 549453824,
    "bits": 386547904,
    "nonce": 883606929,
    "difficulty": 27452707696466.39,
    "merkle_root": "45593907e5fa0dee743d2f9194b0923a800cb6313e66221a86bf51df388e012c",
    "tx_count": 1709,
    "size": 1434271,
    "weight": 3993013,
    "previousblockhash": "000000000000000000000fbfac1a91cdeaf64d689f7673d02613da9d10bfb284",
    "extras": {
      "coinbaseRaw": "0372220b315c20506f7765726564206279204c75786f722054656368205c0000000063349a9b3d185fed000007e7092a000000000000",
      "medianFee": 3,
      "reward": 632350743,
      "totalFees": 7350743,
      "pool": {
        "id": 4
      }
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`bitcoincom`,`2226000`],
          response: `[
  {
    "id": "00000000000000ed428cdb70dfdeb0f3927912131cb96e7b1fe274b1bb1181b2",
    "timestamp": 1582018014,
    "height": 1666150,
    "version": 541065216,
    "bits": 436312585,
    "nonce": 21973352,
    "difficulty": 10474471.99230249,
    "merkle_root": "541456efe41e5730a563475e0c5e2007ee660f1d86d9778bfc164d73c59fd605",
    "tx_count": 382,
    "size": 126201,
    "weight": 331851,
    "previousblockhash": "00000000005a0843cc88b09cf6def15e4dc8fe38ab5cf3ad890f34a2df497004",
    "extras": {
      "coinbaseRaw": "03666c19706f6f6c2e626974636f696e2e636f6d010000022583010000000000",
      "medianFee": 1,
      "reward": 39726335,
      "totalFees": 663835,
      "pool": {
        "id": 12
      }
    }
  },
  {
    "id": "00000000000000af90f51e48cb29fdecc62e9961c5e27aca1a4ae8213aae1954",
    "timestamp": 1579793108,
    "height": 1663620,
    "version": 541065216,
    "bits": 436295134,
    "nonce": 1762790676,
    "difficulty": 12563071.03178775,
    "merkle_root": "02d02afea666f08bab5851de541d0570c71a6cd8be358c28952c52d57b7afad4",
    "tx_count": 24,
    "size": 9562,
    "weight": 23848,
    "previousblockhash": "000000000000013bbdbc0fef53a5b4b2af02880a6f56f7945de071b71d51123a",
    "extras": {
      "coinbaseRaw": "03846219706f6f6c2e626974636f696e2e636f6d01000065f224020000000000",
      "medianFee": 1,
      "reward": 39547121,
      "totalFees": 484621,
      "pool": {
        "id": 12
      }
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`,`45000`],
          response: `[
  {
    "id": "00000002440c34e403b2b4e10f390ab105c825dd6285cd6f4050db23cf7e3e46",
    "timestamp": 1625317548,
    "height": 44999,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 14354169,
    "difficulty": 0.002881346304279315,
    "merkle_root": "3324dc134dec1b57cfea574ce2db6e40e51469417b6381a1389e7969386ab42e",
    "tx_count": 14,
    "size": 2971,
    "weight": 8149,
    "previousblockhash": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "extras": {
      "coinbaseRaw": "03c7af00",
      "medianFee": 1,
      "reward": 5000002252,
      "totalFees": 2252,
      "pool": {
        "id": 137
      }
    }
  },
  {
    "id": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "timestamp": 1625317223,
    "height": 44998,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 4729165,
    "difficulty": 0.002881346304279315,
    "merkle_root": "55869f5a52d7709fb2c6df91d64841f4551d659948b7537b6cd8f19c68d27115",
    "tx_count": 32,
    "size": 6967,
    "weight": 18247,
    "previousblockhash": "000000d6de5b925642a7afed41994947db8612955fbdfd9d1b48f99fc0187385",
    "extras": {
      "coinbaseRaw": "03c6af00",
      "medianFee": 1,
      "reward": 5000005528,
      "totalFees": 5528,
      "pool": {
        "id": 137
      }
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-hashrate",
    title: "GET Hashrate",
    description: {
      default: "<p>Returns network-wide hashrate and difficulty figures over the specified trailing <code>:timePeriod</code>:</p><ul><li>Current (real-time) hashrate</li><li>Current (real-time) difficulty</li><li>Historical daily average hashrates</li><li>Historical difficulty</li></ul><p>Valid values for <code>:timePeriod</code> are " + miningTimeIntervals.substr(52) + ". If no time interval is specified, all available data is returned.</p><p>Be sure that <code>INDEXING_BLOCKS_AMOUNT</code> is set properly in your backend config so that enough blocks are indexed to properly serve your request.</p>"
    },
    urlString: "/v1/mining/hashrate/[:timePeriod]",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/3d`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 236499762108771800000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 217473276787331300000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 189877203506913000000
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652468330,
      "difficulty": 31251101365711.12,
      "height": 736249
    }
  ],
  "currentHashrate": 252033247355212300000,
  "currentDifficulty": 31251101365711.12
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 385829751259101.6
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 657984995406460.8
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 510731129917436.6
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652691434,
      "difficulty": 26119369.29706616,
      "height": 2225402
    }
  ],
  "currentHashrate": 781149965464814.4,
  "currentDifficulty": 55580658.55098472
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 21304.18163251096
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 22034.51091213679
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 20312.75493978447
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652692199,
      "difficulty": 0.002868721424409158,
      "height": 90533
    },
    {
      "timestamp": 1652796655,
      "difficulty": 0.00286032350920122,
      "height": 90720
    }
  ],
  "currentHashrate": 23490.95654668005,
  "currentDifficulty": 0.00286032350920122
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-reward-stats",
    title: "GET Reward Stats",
    description: {
      default: "Returns block reward and total transactions confirmed for the past <code>:blockCount</code> blocks."
    },
    urlString: "/v1/mining/reward-stats/:blockCount",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/reward-stats/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 736556,
  "endBlock": 736655,
  "totalReward": "63811748254",
  "totalFee": "1311748254",
  "totalTx": "164216"
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 2226086,
  "endBlock": 2226185,
  "totalReward": "513462793",
  "totalFee": "25181593",
  "totalTx": "2366"
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 90899,
  "endBlock": 90998,
  "totalReward": "500001245259",
  "totalFee": "1245259",
  "totalTx": "1112"
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-block-fees",
    title: "GET Block Fees",
    description: {
      default: "<p>Returns average total fees for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: " + miningTimeIntervals + ".</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and fee amounts are exact (not averages). For the <code>1w</code> time period, fees may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, fees are averages.</p>"
    },
    urlString: "/v1/mining/blocks/fees/:timePeriod",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fees/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 735644,
    "timestamp": 1652119111,
    "avgFees": 24212890
  },
  {
    "avgHeight": 735646,
    "timestamp": 1652120252,
    "avgFees": 21655996
  },
  {
    "avgHeight": 735648,
    "timestamp": 1652121214,
    "avgFees": 20678859
  },
  {
    "avgHeight": 735649,
    "timestamp": 1652121757,
    "avgFees": 21020140
  },
  {
    "avgHeight": 735650,
    "timestamp": 1652122367,
    "avgFees": 23064200
  },
  {
    "avgHeight": 735652,
    "timestamp": 1652122893,
    "avgFees": 17620723
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 2224253,
    "timestamp": 1652346420,
    "avgFees": 211686
  },
  {
    "avgHeight": 2224254,
    "timestamp": 1652346850,
    "avgFees": 2565952
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 89978,
    "timestamp": 1652346573,
    "avgFees": 1071
  },
  {
    "avgHeight": 89979,
    "timestamp": 1652346970,
    "avgFees": 1224
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-block-rewards",
    title: "GET Block Rewards",
    description: {
      default: "<p>Returns average block rewards for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: " + miningTimeIntervals + ".</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and block rewards are exact (not averages). For the <code>1w</code> time period, block rewards may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, block rewards are averages.</p>"
    },
    urlString: "/v1/mining/blocks/rewards/:timePeriod",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/rewards/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 599992,
    "timestamp": 1571438412,
    "avgRewards": 1260530933
  },
  {
    "avgHeight": 600000,
    "timestamp": 1571443398,
    "avgRewards": 1264314538
  },
  {
    "avgHeight": 725441,
    "timestamp": 1646139035,
    "avgRewards": 637067563
  },
  {
    "avgHeight": 725585,
    "timestamp": 1646222444,
    "avgRewards": 646519104
  },
  {
    "avgHeight": 725727,
    "timestamp": 1646308374,
    "avgRewards": 638709605
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 12,
    "timestamp": 1296689648,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 269,
    "timestamp": 1296717674,
    "avgRewards": 5000091820
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 183,
    "timestamp": 1598962247,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 576,
    "timestamp": 1599047892,
    "avgRewards": 5000000000
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-block-feerates",
    title: "GET Block Feerates",
    description: {
      default: "Returns average feerate percentiles for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: " + miningTimeIntervals + ".</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and percentiles are exact (not averages). For the <code>1w</code> time period, percentiles may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, percentiles are averages."
    },
    urlString: "/v1/mining/blocks/fee-rates/:timePeriod",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fee-rates/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 732152,
    "timestamp": 1650132959,
    "avgFee_0": 1,
    "avgFee_10": 2,
    "avgFee_25": 2,
    "avgFee_50": 3,
    "avgFee_75": 4,
    "avgFee_90": 8,
    "avgFee_100": 393
  },
  {
    "avgHeight": 732158,
    "timestamp": 1650134432,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 2,
    "avgFee_50": 4,
    "avgFee_75": 6,
    "avgFee_90": 10,
    "avgFee_100": 240
  },
  {
    "avgHeight": 732161,
    "timestamp": 1650135818,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 2,
    "avgFee_75": 5,
    "avgFee_90": 8,
    "avgFee_100": 251
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 2196306,
    "timestamp": 1650360168,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 2,
    "avgFee_90": 28,
    "avgFee_100": 2644
  },
  {
    "avgHeight": 2196308,
    "timestamp": 1650361209,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 4,
    "avgFee_75": 12,
    "avgFee_90": 65,
    "avgFee_100": 102
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `{
"blockFeeRates": [
  {
    "avgHeight": 86620,
    "timestamp": 1650360010,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  {
    "avgHeight": 86623,
    "timestamp": 1650361330,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mining",
    httpRequestMethod: "GET",
    fragment: "get-sizes-weights",
    title: "GET Block Sizes and Weights",
    description: {
      default: "<p>Returns average size (bytes) and average weight (weight units) for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: " + miningTimeIntervals + ".</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>"
    },
    urlString: "/v1/mining/blocks/sizes-weights/:timePeriod",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/sizes-weights/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgSize": 1271404
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgSize": 1105893
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgSize": 1141071
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgSize": 1108166
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgWeight": 3994002
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgWeight": 3756312
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgWeight": 3719625
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgWeight": 3631381
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 1517188,
      "timestamp": 1558262730,
      "avgSize": 25089
    },
    {
      "avgHeight": 1517275,
      "timestamp": 1558290933,
      "avgSize": 21679
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 1517188,
      "timestamp": 1558262730,
      "avgWeight": 74921
    },
    {
      "avgHeight": 1517275,
      "timestamp": 1558290933,
      "avgWeight": 65164
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 83,
      "timestamp": 1598937527,
      "avgSize": 329
    },
    {
      "avgHeight": 266,
      "timestamp": 1598982991,
      "avgSize": 330
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 83,
      "timestamp": 1598937527,
      "avgWeight": 1209
    },
    {
      "avgHeight": 266,
      "timestamp": 1598982991,
      "avgWeight": 1212
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "category",
    category: "fees",
    fragment: "fees",
    title: "Fees",
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: "endpoint",
    category: "fees",
    httpRequestMethod: "GET",
    fragment: "get-mempool-blocks-fees",
    title: "GET Mempool Blocks Fees",
    description: {
      default: "Returns current mempool as projected blocks."
    },
    urlString: "/v1/fees/mempool-blocks",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/mempool-blocks`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();

        document.getElementById("result").textContent = JSON.stringify(feesMempoolBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 873046,
    blockVSize: 746096.5,
    nTx: 863,
    totalFees: 8875608,
    medianFee: 10.79646017699115,
    feeRange: [
      1,
      2.4242424242424243,
      8.107816711590296,
      10.148014440433213,
      11.053311793214863,
      12.041811846689896,
      14.930957683741648,
      302.11480362537765
    ]
  }
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 2871,
    blockVSize: 2377.5,
    nTx: 11,
    totalFees: 3499,
    medianFee: 1.1799410029498525,
    feeRange: [
      1.00374531835206,
      1.00374531835206,
      1.0046860356138707,
      1.1799410029498525,
      1.183431952662722,
      1.3274336283185841,
      1.3995037220843674,
      5.0271041369472185
    ]
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 16157,
    blockVSize: 10338.5,
    nTx: 75,
    totalFees: 13493,
    medianFee: 1.304812834224599,
    feeRange: [
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.3123359580052494
    ]
  }
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 5011,
    blockVSize: 1530.25,
    nTx: 1,
    totalFees: 288,
    medianFee: 0.1882045417415455,
    feeRange: [
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455
    ]
  }
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 23782,
    blockVSize: 20457.25,
    nTx: 3,
    totalFees: 2089,
    medianFee: 0.10163043478260869,
    feeRange: [
      0.1,
      0.1,
      0.1,
      0.10163043478260869,
      0.10163043478260869,
      0.11385199240986717,
      0.11385199240986717,
      0.11385199240986717
    ]
  }
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "fees",
    httpRequestMethod: "GET",
    fragment: "get-recommended-fees",
    title: "GET Recommended Fees",
    description: {
      default: "Returns our currently suggested fees for new transactions."
    },
    urlString: "/v1/fees/recommended",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/recommended`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesRecommended = await fees.getFeesRecommended();

        document.getElementById("result").textContent = JSON.stringify(feesRecommended, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "category",
    category: "mempool",
    fragment: "mempool",
    title: "Mempool",
    showConditions: bitcoinNetworks.concat(liquidNetworks)
  },
  {
    type: "endpoint",
    category: "mempool",
    httpRequestMethod: "GET",
    fragment: "get-mempool",
    title: "GET Mempool",
    description: {
      default: "Returns current mempool backlog statistics."
    },
    urlString: "/mempool",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();

        document.getElementById("result").textContent = JSON.stringify(getMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3169,
  vsize: 1891542,
  total_fee: 20317481,
  fee_histogram: []
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 16,
  vsize: 2692,
  total_fee: 46318,
  fee_histogram: [
    [
      1.0071429,
      2692
    ]
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 58,
  vsize: 8008,
  total_fee: 10407,
  fee_histogram: [
    [
      1,
      8008
    ]
  ]
}`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 0,
  vsize: 0,
  total_fee: 0,
  fee_histogram: [ ]
}`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3,
  vsize: 20457,
  total_fee: 2089,
  fee_histogram: [
    [
      0.09981343,
      20457
    ]
  ]
}`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mempool",
    httpRequestMethod: "GET",
    fragment: "get-mempool-transaction-ids",
    title: "GET Mempool Transaction IDs",
    description: {
      default: "Get the full list of txids in the mempool as an array. The order of the txids is arbitrary and does not match bitcoind."
    },
    urlString: "/mempool/txids",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/txids`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolTxids = await mempool.getMempoolTxids();

        document.getElementById("result").textContent = JSON.stringify(getMempoolTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "65b04c4618999a221e8b66943a17c216172a9c865f49c88b76de81212b24bf01",
  "4a3ebe804f273b4c7a96e63f6b963e812ef7e6e0e8381c2d662715bcf5bfa846",
  "1ef9df26fab649183b591d148011ce809756f9cd9e6be3d383e80808b1929724",
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "af04a3e8b7bd49217165435e2717b6ed977cde9c0f6f2a5813c4c39eb53748af",
  "d4c4989617e9af40518f7846f98e98e4a187bc29fb95542c9aa469af159c61e4",
  "c4c0630b18e910be0a70ebd5d4897b379168b0f357a6536188a28e38d2cf8b43",
  "c6c9c44ca17ff8c1ebfe27978e57277be6098f0fb5129840370c013fe503db24",
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "ddd40341cfa1268801407e9ff43da020cab03f8bf1b422239da0652a4496367e",
  "7fe571957cf61c41598e2acb54211be32cd13df2b71b1612af1d860bbfb5ee9f",
  "b7cd3be4de533db392bb5bd8aaedd8b25607514502c60c0c6d54358931a6d95f",
  "7786de8ee4fe0b11410658866800b90e5a798e3721dd6031c6b5094474bd80c1",
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "f3f3acdaa6a823efcbbbbcc607ec4d1c2c40d618135ec09d8ed96e4d9b37db38"
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "b644716cb1aeb3e6e9fb4258b0b95dfad8b8e4cd1ec8649bf1116a500cc870e5",
  "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
  "dfbe66e6e71e775c9529a822c14286de0ee1066c2760a53552615d05e17006f3"
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "mempool",
    httpRequestMethod: "GET",
    fragment: "get-mempool-recent",
    title: "GET Mempool Recent",
    description: {
      default: "Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: <code>txid</code>, <code>fee</code>, <code>vsize</code>, and <code>value</code>."
    },
    urlString: "/mempool/recent",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/recent`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolRecent = await mempool.getMempoolRecent();

        document.getElementById("result").textContent = JSON.stringify(getMempoolRecent, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "4b93c138293a7e3dfea6f0a63d944890b5ba571b03cc22d8c66995535e90dce8",
    fee: 18277,
    vsize: 2585,
    value: 4972029
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "1fc5098fe3378828a890fa5144883cdd1411d9cdbb1af365c20e72503b11dc81",
    fee: 221,
    vsize: 201,
    value: 944960
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "18dcbd5405f65f583ed32db2f86f84510c07c59ac5321bb90cbd3a3f2963c224",
    fee: 183,
    vsize: 140,
    value: 4369990908
  },
  ...
]`
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "06428bf0f6dc6a55e1d800afcd4697d1cdee4debbfaa7fd782d747a80d051c25",
    fee: 251,
    vsize: 2515
  },
  ...
]`
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    fee: 376,
    vsize: 3767
  },
  {
    txid: "e09a8b6bc950458bc77183acf4fd566d1cfd8e7373c4869f877b52e3b02ad9b1",
    fee: 138,
    vsize: 1379
  },
  ...
]`
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "category",
    category: "transactions",
    fragment: "transactions",
    title: "Transactions",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"])
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-cpfp",
    title: "GET Children Pay for Parent",
    description: {
      default: "Returns the ancestors and the best descendant fees for a transaction."
    },
    urlString: "/v1/fees/cpfp",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/cpfp/%{1}`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const txid = 'txid';
        const feesCPFP = await fees.getCPFP({ txid });

        document.getElementById("result").textContent = JSON.stringify(feesCPFP, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const txid = 'txid';
  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);
          `,
        },
        codeSampleMainnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleLiquidTestnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction",
    title: "GET Transaction",
    description: {
      default: "Returns details about a transaction. Available fields: <code>txid</code>, <code>version</code>, <code>locktime</code>, <code>size</code>, <code>weight</code>, <code>fee</code>, <code>vin</code>, <code>vout</code>, and <code>status</code>."
    },
    urlString: "/tx/:txid",
    showConditions: bitcoinNetworks.concat(liquidNetworks).concat(["bisq"]),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const tx = await transactions.getTx({ txid });

        document.getElementById("result").textContent = JSON.stringify(tx, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const tx = await transactions.getTx({ txid });
  console.log(tx);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `{
  txid: "15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521",
  version: 1,
  locktime: 0,
  vin: [],
  vout: [],
  size: 884,
  weight: 3536,
  fee: 20000,
  status: {
    confirmed: true,
    block_height: 363348,
    block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
    block_time: 1435754650
  }
}`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `{
  txid: "eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d",
  version: 2,
  locktime: 2091198,
  vin: [],
  vout: [],
  size: 222,
  weight: 561,
  fee: 16332,
  status: {
    confirmed: true,
    block_height: 2091199,
    block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
    block_time: 1630648992
  }
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  txid: "fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025",
  version: 2,
  locktime: 0,
  vin: [],
  vout: [],
  size: 99,
  weight: 381,
  fee: 125,
  status: {
    confirmed: true,
    block_height: 53788,
    block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
    block_time: 1630648988
  }
}`
        },
        codeSampleLiquid: {
          esModule: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          commonJS: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          curl: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          response: `{
  txid: "801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a",
  version: 2,
  locktime: 1472364,
  vin: [],
  vout: [],
  size: 4599,
  weight: 5325,
  fee: 529,
  status: {
    confirmed: true,
    block_height: 1472366,
    block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
    block_time: 1630649218
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          commonJS: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          curl: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          response: `{
  txid: "59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4",
  version: 2,
  locktime: 168763,
  vin: [],
  vout: [],
  size: 13557,
  weight: 15069,
  fee: 376,
  status: {
    confirmed: true,
    block_height: 168765,
    block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
    block_time: 1642000444
  }
}`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `{
  txid: "98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e",
  version: 1,
  locktime: 0,
  vin: [],
  vout: [],
  size: 402,
  weight: 957,
  fee: 2390,
  status: {
    confirmed: true,
    block_height: 698788,
    block_hash: "00000000000000000005bfe17b41395bed53565022e0c98965b15ec1d00b1f31",
    block_time: 1630645738
  }
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-hex",
    title: "GET Transaction Hex",
    description: {
      default: "Returns a transaction serialized as hex."
    },
    urlString: "/tx/:txid/hex",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/hex`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txHex = await transactions.getTxHex({ txid });

        document.getElementById("result").textContent = JSON.stringify(txHex, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `010000000536a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0c0000006b483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0ffffffffee08cb90c4e84dd7952b2cfad81ed3b088f5b...`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `0200000000010146c398e70cceaf9d8f734e603bc53e4c4c0605ab46cb1b5807a62c90f5aed50d0100000000feffffff023c0fc10c010000001600145033f65b590f2065fe55414213f1d25ab20b6c4f487d1700000000001600144b812d5ef41fc433654d186463d41b458821ff740247304402202438dc18801919baa64eb18f7e925a...`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `02000000000101b7913f140f19850975352064a7ccfd7e96e1ed9a847c463309839a37c9d01e530000000000ffffffff017d65a61d000000002200204ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc3326001015100000000`
        },
        codeSampleLiquid: {
          esModule: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          commonJS: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          curl: [`801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`],
          response: `020000000101730fb6b65e115f4ec15690b3539311becd3ef8d1ed4c2b7e53ec3934b4254f65010000001716001436b178e63ed841263f7b82a97d2e783791394432feffffff020b5ff1f5c8059fc270bdeb196c5f38e3da2de8fd9034c34427b70fa66d2f388efe083745b65e4c6e029b020d74df709c5842737c4d50873ef4ec8e0579a3c41f09130274bf768af8b1c462b1e5b7ffb1bb496a019a0ed090e4ce26283a946542280c6f17a...`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          commonJS: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          curl: [`59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`],
          response: `020000000102fa567669f73a314138aa6dbe74e3935612895df273d20ccbbedbecd44a04d3ce0000000000fdffffff8412fed07b8316dd4304df90af6f20292d3b2950133711c0ee43eb94fe12cc4f0100000000fdffffff040b801035010192095b8d9316f28450e98a85c915994c3f80ecc493adf505d73e9609a51e48bc0f35e34f88c482654d659fa779dcbf0457dc71053f3edcf76bd3667f03821ffcc4fc4ae5c2668685fec678e4...`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `0100000000010222ae3642a9300262f6e730e8bfb7979b15852c8836f3835beef9cd58c464e5f70000000000ffffffff22ae3642a9300262f6e730e8bfb7979b15852c8836f3835beef9cd58c464e5f70200000000ffffffff03de0900000000000016001490f9ee145d7b1c9352b793350741da97f3e4d795aca80500000000001600144168859b4b74a09277969fb8152115aea9d33a159c960600000000001600146534b1859209d8ae8f1a8...`,
        },
      }
    },
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-merkleblock-proof",
    title: "GET Transaction Merkleblock Proof",
    description: {
      default: "Returns a merkle inclusion proof for the transaction using <a href='https://bitcoin.org/en/glossary/merkle-block'>bitcoind's merkleblock</a> format."
    },
    urlString: "/tx/:txid/merkleblock-proof",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkleblock-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleBlockProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663...`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `0000602002bf77bbb098f90f149430c314e71ef4e2671ea5e04a2503e0000000000000000406ffb54f2925360aae81bd3199f456928bbe6ae83a877902da9d9ffb08215da0ba3161ffff001a545a850bb80000000906e0c62f68fdf4865a46889e2e12d66f03cc537225d612aa77b08a38936b4d435d73544598d93174314d75e5833...`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `00000020d356e0a14120d45653120a7bd53280ffce2aa2ced301682a1f2867687f000000298ef149a1675866dbdde315b22c24c63fd7670fdc5b86b588007fa187fa85089cba31619356011eaedd8800180000000656e9b938241cb350316cd9155167f3bce7370aa1095143c304ef7a44da4984e02550c48f3e01648dd65f5e3e290432c...`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `04000020e05c5f176bdb7966b44388ca223bef6e548fb390a9f202000000000000000000f10d5017f8e98200ea6e9d9a90d48e8078a49f2ee1da2cae9f80f48a0badfdaaeaad3161a0fa0f174d163a5daa0400000c77d2b87749e72de52feacaab57134c40172ae247c9de1f8f180736a8ef64a024542ab6b22b2c1fc961eae3d7d7d6c5f...`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-merkle-proof",
    title: "GET Transaction Merkle Proof",
    description: {
      default: "Returns a merkle inclusion proof for the transaction using <a href='https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get-merkle'>Electrum's blockchain.transaction.get_merkle format."
    },
    urlString: "/tx/:txid/merkle-proof",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkle-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleProof = await transactions.getTxMerkleProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `{
  block_height: 363348,
  merkle: [
    "acf931fe8980c6165b32fe7a8d25f779af7870a638599db1977d5309e24d2478",
    "ee25997c2520236892c6a67402650e6b721899869dcf6715294e98c0b45623f9",
    "790889ac7c0f7727715a7c1f1e8b05b407c4be3bd304f88c8b5b05ed4c0c24b7",
    "facfd99cc4cfe45e66601b37a9637e17fb2a69947b1f8dc3118ed7a50ba7c901",
    "8c871dd0b7915a114f274c354d8b6c12c689b99851edc55d29811449a6792ab7",
    "eb4d9605966b26cfa3bf69b1afebe375d3d6aadaa7f2899d48899b6bd2fd6a43",
    "daa1dc59f22a8601b489fc8a89da78bc35415291c62c185e711b8eef341e6e70",
    "102907c1b95874e2893c6f7f06b45a3d52455d3bb17796e761df75aeda6aa065",
    "baeede9b8e022bb98b63cb765ba5ca3e66e414bfd37702b349a04113bcfcaba6",
    "b6f07be94b55144588b33ff39fb8a08004baa03eb7ff121e1847d715d0da6590",
    "7d02c62697d783d85a51cd4f37a87987b8b3077df4ddd1227b254f59175ed1e4"
  ],
  pos: 1465
}`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `{
  block_height: 2091199,
  merkle: [
    "434d6b93388ab077aa12d6257253cc036fd6122e9e88465a86f4fd682fc6e006",
    "bd9af28e56cf6731e78ee1503a65d9cc9b15c148daa474e71e085176f48996ac",
    "605f6f83423ef3b86623927ef2d9dcb0f8d9e40a8132217c2fa0910b84488ec7",
    "10b7ef06ef0756823dbf39dea717be397e7ccb49bbefc5cfc45e6f9d58793baf",
    "19183ceae11796a9b1d0893e0561870bbce4d060c9547b1e91ad8b34eb3d5001",
    "1b16723739522955422b4286b4d8620d2a704b6997e6bbd809d151b8d8d64611",
    "6f8496469b19dd35871684332dfd3fc0205d83d2c58c44ebdae068542bc951f6",
    "e0d2733bd7bce4e5690b71bc8f7cedb1edbc49a5ff85c3678ecdec894ea1c023"
  ],
  pos: 1
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  block_height: 53788,
  merkle: [
    "e08449da447aef04c3435109a10a37e7bcf3675115d96c3150b31c2438b9e956",
    "027699486d6cc71669bbc8168632101ed95266dcd02fa8b757830d570ef54d15",
    "62458b115b3db7e9dafecb37de1fcb985891bc77a323018811b6d0392e3705a6",
    "3a32287eccca335a3dac6aede77855a78faed4060d16bb89517da9816a763cb4",
    "76a86eb801f1884b99389af3cd41a7994679c3f93c53f9fcf0505ab1340b329f"
  ],
  pos: 1
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  block_height: 1472366,
  merkle: [
    "ce1903e0a8a5e17c6267cf3397d42011611eb26aa7b65fd73b9851b71da3fc66",
    "377158243ad98ae874cc624e39f7da10d7072e2cbb5229c33cc0bee0bfb6eb4e"
  ],
  pos: 1
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `{
  block_height: 168765,
  merkle: [
    "1dbe7041197b78f73c0d4a3810c47080c252bc928f041b787acaad3fa76ba7a0"
  ],
  pos: 1
}`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `{
  block_height: 698788,
  merkle: [
    "455eb8942edf5444f0130194353185705e891fb328b47fd5c43c0f5260de8121",
    "98d18cb3470a3ee27a1d083e8f7baf76eaed19b5c972af33a335acdb3374dc75",
    "1bf53a838bef7d64c2f7207bdb054df7dcc58e335ba9bd43803d00a24b4aec1b",
    "19033925798e6e09f385dd7b5afbd76136f910b21b75ca03a2692ee804e0860e",
    "5b4bd0b3cbbd5b73ae36d00bd144ee8db0966ff1f78c4483a4a8d601dc0b2ded",
    "485a0c2af1687efe5433d4621c5dd222f6c5d6d7d7e3ea61c91f2c2bb2b62a54",
    "1af9cbc4539b66e44c9bd6d07c5720301ba4694088e06b7f5978686b7a94aa62",
    "b7a27d5a849f30cdf82c19b3d84902a146a0723a0798e46f91028f412af0d14d",
    "b3925e68565674c54b3f0beb9f5f3820f4cd35cd15683b119cd232f52024a997",
    "24a064efa83607188f1fdec947e22a17404c1357abcaea2fe52de74977b8d277",
    "bd818bb2791a0d536097163c0d4dfb4dc3657cbd169617ca286dcc828ddf444d"
  ],
  pos: 546
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-outspend",
    title: "GET Transaction Outspend",
    description: {
      default: "Returns the spending status of a transaction output. Available fields: <code>spent</code> (boolean), <code>txid</code> (optional), <code>vin</code> (optional), and <code>status</code> (optional, the status of the spending tx)."
    },
    urlString: "/tx/:txid/outspend/:vout",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspend/%{2}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: %{2},
        });

        document.getElementById("result").textContent = JSON.stringify(txOutspend, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: %{2},
  });
  console.log(txOutspend);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521', '3'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521', '3'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521', '3'],
          response: `{
  spent: true,
  txid: "2a1b8ec06d68096911da82b02806c3848c415b0044a0046850c4a97cbffac7b1",
  vin: 1,
  status: {
    confirmed: true,
    block_height: 363354,
    block_hash: "000000000000000012e6130dec174ca877bf39ead6e3d04a8ba3b0cd683c1661",
    block_time: 1435758032
  }
}`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d', '0'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d', '0'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d', '0'],
          response: `{
  spent: true,
  txid: "37e867526abb7cde3f64f86f60b42bee1f989aa8514730ae2e741dd05bbc286b",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 2091199,
    block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
    block_time: 1630648992
  }
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025', '0'],
          response: `{
  spent: true,
  txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 53789,
    block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
    block_time: 1630649351
  }
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a', '0'],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4', '0'],
          response: `{
  spent: true,
  txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 168793,
    block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
    block_time: 1642002136
  }
}`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`, '1'],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`, '1'],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`, '1'],
          response: `{
  spent: true,
  txid: "455eb8942edf5444f0130194353185705e891fb328b47fd5c43c0f5260de8121",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 698788,
    block_hash: "00000000000000000005bfe17b41395bed53565022e0c98965b15ec1d00b1f31",
    block_time: 1630645738
  }
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-outspends",
    title: "GET Transaction Outspends",
    description: {
      default: "Returns the spending status of all transaction outputs."
    },
    urlString: "/tx/:txid/outspends",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspends`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspends = await transactions.getTxOutspends({ txid });
        document.getElementById("result").textContent = JSON.stringify(txOutspends, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspends = await transactions.getTxOutspends({ txid });

  console.log(txOutspends);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `[
  {
    spent: true,
    txid: "34de8ba520eb846da8831fa47c06eef9b4eb4a2ff6a3271165fd6b9aafc5a20c",
    vin: 12,
    status: {
      confirmed: true,
      block_height: 363349,
      block_hash: "000000000000000012ad81b3ea2cb1c4ba115901bd1b41cd05a6a8d736691322",
      block_time: 1435754897
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `[
  {
    spent: true,
    txid: "37e867526abb7cde3f64f86f60b42bee1f989aa8514730ae2e741dd05bbc286b",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 2091199,
      block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
      block_time: 1630648992
    }
  },
  {
    spent: false
  }
]`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `[
  {
    spent: true,
    txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 53789,
      block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
      block_time: 1630649351
    }
  }
]`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `[
  {
    spent: false
  },
  {
    spent: true,
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 168793,
      block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
      block_time: 1642002136
    }
  },
  {
    spent: false
  },
  {
    spent: false
  }
]`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `[
  {
    spent: false
  },
  {
    spent: true,
    txid: "455eb8942edf5444f0130194353185705e891fb328b47fd5c43c0f5260de8121",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 698788,
      block_hash: "00000000000000000005bfe17b41395bed53565022e0c98965b15ec1d00b1f31",
      block_time: 1630645738
    }
  },
  {
    spent: false
  }
]`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-raw",
    title: "GET Transaction Raw",
    description: {
      default: "Returns a transaction as binary data."
    },
    urlString: "/tx/:txid/raw",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/raw`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txRaw = await transactions.getTxRaw({ txid });

        document.getElementById("result").textContent = JSON.stringify(txRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: ``,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: ``,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transaction-status",
    title: "GET Transaction Status",
    description: {
      default: "Returns the confirmation status of a transaction. Available fields: <code>confirmed</code> (boolean), <code>block_height</code> (optional), and <code>block_hash</code> (optional)."
    },
    urlString: "/tx/:txid/status",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/status`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txStatus = await transactions.getTxStatus({ txid });

        document.getElementById("result").textContent = JSON.stringify(txStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          commonJS: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          curl: ['15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521'],
          response: `{
  confirmed: true,
  block_height: 363348,
  block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
  block_time: 1435754650
}`
        },
        codeSampleTestnet: {
          esModule: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          commonJS: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          curl: ['eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d'],
          response: `{
  confirmed: false
}`
        },
        codeSampleSignet: {
          esModule: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          commonJS: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          curl: ['fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025'],
          response: `{
  confirmed: true,
  block_height: 53788,
  block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
  block_time: 1630648988
}`
        },
        codeSampleLiquid: {
          esModule: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          commonJS: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          curl: ['801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a'],
          response: `{
  confirmed: true,
  block_height: 1472366,
  block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
  block_time: 1630649218
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          commonJS: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          curl: ['59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4'],
          response: `{
  confirmed: true,
  block_height: 168765,
  block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
  block_time: 1642000444
}`,
        },
        codeSampleBisq: {
          esModule: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          commonJS: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          curl: [`98a598aeea121ea061dc713d1547363358974191c257d3b563bbf2a1706ff44e`],
          response: `{
  confirmed: true,
  block_height: 698788,
  block_hash: "00000000000000000005bfe17b41395bed53565022e0c98965b15ec1d00b1f31",
  block_time: 1630645738
}`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "GET",
    fragment: "get-transactions",
    title: "GET Transactions",
    description: {
      default: "Returns :length of latest Bisq transactions, starting from :index."
    },
    urlString: "/txs/:index/:length",
    showConditions: ["bisq"],
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/txs/%{1}/%{2}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: %{1}, length: %{2} });

        document.getElementById("result").textContent = JSON.stringify(txs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: %{1}, length: %{2} });
  console.log(txStatus);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleBisq: {
          esModule: [`0`, '1'],
          commonJS: [`0`, '1'],
          curl: [`0`, '1'],
          response: `[
  {
    txVersion: "1",
    id: "be1b2932155c012bec79bbd0f7cf7db32a4a35859dcb7b70f5d35fea581ac30a",
    blockHeight: 698808,
    blockHash: "0000000000000000000bf9461e8e0b8e077bcc0e8fe0f55483a7fd5d0860336c",
    time: 1630658066000,
    inputs: [],
    outputs: [],
    txType: "PAY_TRADE_FEE",
    txTypeDisplayString: "Pay trade fee",
    burntFee: 609,
    invalidatedBsq: 0,
    unlockBlockHeight: 0
  }
]`,
        },
      }
    }
  },
  {
    type: "endpoint",
    category: "transactions",
    httpRequestMethod: "POST",
    fragment: "post-transaction",
    title: "POST Transaction",
    description: {
      default: "Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The <code>txid</code> will be returned on success."
    },
    urlString: "/api/tx",
    showConditions: bitcoinNetworks.concat(liquidNetworks),
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `%{1}" "[[hostname]][[baseNetworkUrl]]/api/tx`, //custom interpolation technique handled in replaceCurlPlaceholder()
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txHex = '%{1}';

        const txid = await transactions.postTx({ txHex });

        document.getElementById("result").textContent = JSON.stringify(txid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txHex = '%{1}';

  const txid = await transactions.postTx({ txHex });
  console.log(txid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleTestnet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleSignet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
        codeSampleLiquid: {
          esModule: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          commonJS: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          curl: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          commonJS: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          curl: [`0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`],
          response: ``,
        },
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "category",
    category: "lightning",
    fragment: "lightning",
    title: "Lightning",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-lightning-network-stats",
    title: "GET Network Stats",
    description: {
      default: "<p>Returns network-wide stats such as total number of channels and nodes, total capacity, and average/median fee figures.</p><p>Pass one of the following for <code>:interval</code>: <code>latest</code>, <code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>6m</code>, <code>1y</code>, <code>2y</code>, <code>3y</code>.</p>"
    },
    urlString: "/v1/lightning/statistics/:interval",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/statistics/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`latest`],
          response: `{
  "latest": {
    "id": 163,
    "added": "2022-08-30T00:00:00.000Z",
    "channel_count": 81690,
    "node_count": 15851,
    "total_capacity": 460820222344,
    "tor_nodes": 11455,
    "clearnet_nodes": 2305,
    "unannounced_nodes": 974,
    "avg_capacity": 5641085,
    "avg_fee_rate": 497,
    "avg_base_fee_mtokens": 915,
    "med_capacity": 1500000,
    "med_fee_rate": 40,
    "med_base_fee_mtokens": 100,
    "clearnet_tor_nodes": 1117
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`latest`],
          response: `{
  "latest": {
    "id": 13,
    "added": "2022-08-30T00:00:00.000Z",
    "channel_count": 5101,
    "node_count": 1806,
    "total_capacity": 43341092977,
    "tor_nodes": 288,
    "clearnet_nodes": 736,
    "unannounced_nodes": 656,
    "avg_capacity": 8496588,
    "avg_fee_rate": 354,
    "avg_base_fee_mtokens": 1183,
    "med_capacity": 1148313,
    "med_fee_rate": 1,
    "med_base_fee_mtokens": 1000,
    "clearnet_tor_nodes": 126
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`latest`],
          response: `{
  "latest": {
    "id": 13,
    "added": "2022-08-30T00:00:00.000Z",
    "channel_count": 33,
    "node_count": 24,
    "total_capacity": 161821884,
    "tor_nodes": 5,
    "clearnet_nodes": 11,
    "unannounced_nodes": 6,
    "avg_capacity": 4903693,
    "avg_fee_rate": 38,
    "avg_base_fee_mtokens": 1061,
    "med_capacity": 2000000,
    "med_fee_rate": 1,
    "med_base_fee_mtokens": 1000,
    "clearnet_tor_nodes": 2
  }
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-lightning-nodes-channels",
    title: "GET Nodes/Channels",
    description: {
      default: "<p>Returns Lightning nodes and channels that match a full-text, case-insensitive search <code>:query</code> across node aliases, node pubkeys, channel IDs, and short channel IDs.</p>"
    },
    urlString: "/v1/lightning/search?searchText=:query",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/search?searchText=%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`ACINQ`],
          response: `{
  "nodes": [
    {
      "public_key": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
      "alias": "ACINQ",
      "capacity": 35920090247,
      "channels": 2907
    },
    {
      "public_key": "03d3902b46d6ab9558a76cbf91b27d093c0a3c54e59f33c7eb4bd643dbb3b1b5b0",
      "alias": "Acinq",
      "capacity": null,
      "channels": null
    }
  ],
  "channels": []
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`lnd`],
          response: `{
  "nodes": [
    {
      "public_key": "02be8f360e57600486b93dd33ea0872a4e14a259924ba4084f27d693a77d151158",
      "alias": "lndus1.dev.zaphq.io",
      "capacity": 762968876,
      "channels": 27
    },
    {
      "public_key": "028c3640c57ffe47eb41db8225968833c5032f297aeba98672d6f7037090d59e3f",
      "alias": "lndus0.next.zaphq.io",
      "capacity": 641040063,
      "channels": 26
    }
  ],
  "channels": []
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`guggero`],
          response: `{
  "nodes": [
    {
      "public_key": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
      "alias": "guggero",
      "capacity": 66577093,
      "channels": 12,
      "status": 1
    }
  ],
  "channels": []
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-lightning-nodes-country",
    title: "GET Nodes in Country",
    description: {
      default: "<p>Returns a list of Lightning nodes running on clearnet in the requested <code>:country</code>, where <code>:country</code> is an ISO Alpha-2 country code.</p>"
    },
    urlString: "/v1/lightning/nodes/country/:country",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/country/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`ch`],
          response: `{
  "country": {
    "de": "Schweiz",
    "en": "Switzerland",
    "es": "Suiza",
    "fr": "Suisse",
    "ja": "スイス連邦",
    "pt-BR": "Suíça",
    "ru": "Швейцария",
    "zh-CN": "瑞士"
  },
  "nodes": [
    {
      "public_key": "033d8656219478701227199cbd6f670335c8d408a92ae88b962c49d4dc0e83e025",
      "capacity": 54339697486,
      "channels": 991,
      "alias": "bfx-lnd0",
      "first_seen": 1574813156,
      "updated_at": 1661814056,
      "city": {
        "de": "Zürich",
        "en": "Zurich",
        "es": "Zúrich",
        "fr": "Zurich",
        "ja": "チューリッヒ",
        "pt-BR": "Zurique",
        "ru": "Цюрих",
        "zh-CN": "苏黎世"
      },
      "country": {
        "de": "Schweiz",
        "en": "Switzerland",
        "es": "Suiza",
        "fr": "Suisse",
        "ja": "スイス連邦",
        "pt-BR": "Suíça",
        "ru": "Швейцария",
        "zh-CN": "瑞士"
      },
      "iso_code": "CH",
      "subdivision": {
        "de": "Zürich",
        "en": "Zurich",
        "fr": "Zurich"
      }
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`ch`],
          response: `{
  "country": {
    "de": "Schweiz",
    "en": "Switzerland",
    "es": "Suiza",
    "fr": "Suisse",
    "ja": "スイス連邦",
    "pt-BR": "Suíça",
    "ru": "Швейцария",
    "zh-CN": "瑞士"
  },
  "nodes": [
    {
      "public_key": "0200a7f20e51049363cb7f2a0865fe072464d469dca0ac34c954bb3d4b552b6e95",
      "capacity": 94802991,
      "channels": 15,
      "alias": "looptest",
      "first_seen": 1601298108,
      "updated_at": 1661857089,
      "city": {
        "de": "Thun",
        "en": "Thun",
        "es": "Thun",
        "fr": "Thoune",
        "ja": "トゥーン",
        "pt-BR": "Tune",
        "ru": "Тун",
        "zh-CN": "图恩"
      },
      "country": {
        "de": "Schweiz",
        "en": "Switzerland",
        "es": "Suiza",
        "fr": "Suisse",
        "ja": "スイス連邦",
        "pt-BR": "Suíça",
        "ru": "Швейцария",
        "zh-CN": "瑞士"
      },
      "iso_code": "CH",
      "subdivision": {
        "de": "Bern",
        "en": "Bern",
        "fr": "Berne"
      }
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`us`],
          response: `{
  "country": {
    "de": "Vereinigte Staaten",
    "en": "United States",
    "es": "Estados Unidos",
    "fr": "États Unis",
    "ja": "アメリカ",
    "pt-BR": "EUA",
    "ru": "США",
    "zh-CN": "美国"
  },
  "nodes": [
    {
      "public_key": "03f70ac4525c0014bbf380c069ce82d70946d37a56c027a2ed18609a3e60c3b353",
      "capacity": 2000000,
      "channels": 1,
      "alias": "",
      "first_seen": 1637708194,
      "updated_at": 0,
      "city": {
        "en": "Oak Park",
        "ru": "Оук-Парк"
      },
      "country": {
        "de": "Vereinigte Staaten",
        "en": "United States",
        "es": "Estados Unidos",
        "fr": "États Unis",
        "ja": "アメリカ",
        "pt-BR": "EUA",
        "ru": "США",
        "zh-CN": "美国"
      },
      "iso_code": "US",
      "subdivision": {
        "en": "Illinois",
        "es": "Illinois",
        "fr": "Illinois",
        "ja": "イリノイ州",
        "pt-BR": "Ilinóis",
        "ru": "Иллинойс",
        "zh-CN": "伊利诺伊州"
      }
    },
    {
      "public_key": "0397b15fd867541c53a3a5e27c021f7acad582684d05d120af572266c92c8a0313",
      "capacity": 19802,
      "channels": 1,
      "alias": "pseudozach",
      "first_seen": 1637620444,
      "updated_at": 1637721257,
      "city": {
        "de": "Atlanta",
        "en": "Atlanta",
        "es": "Atlanta",
        "fr": "Atlanta",
        "ja": "アトランタ",
        "pt-BR": "Atlanta",
        "ru": "Атланта",
        "zh-CN": "亚特兰大"
      },
      "country": {
        "de": "Vereinigte Staaten",
        "en": "United States",
        "es": "Estados Unidos",
        "fr": "États Unis",
        "ja": "アメリカ",
        "pt-BR": "EUA",
        "ru": "США",
        "zh-CN": "美国"
      },
      "iso_code": "US",
      "subdivision": {
        "en": "Georgia",
        "es": "Georgia",
        "fr": "Géorgie",
        "ja": "ジョージア州",
        "pt-BR": "Geórgia",
        "ru": "Джорджия",
        "zh-CN": "乔治亚"
      }
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-country-node-stats",
    title: "GET Node Stats Per Country",
    description: {
      default: "<p>Returns aggregate capacity and number of clearnet nodes per country. Capacity figures are in satoshis.</p>"
    },
    urlString: "/v1/lightning/nodes/countries",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/countries`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "name": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    },
    "iso": "US",
    "count": 2775,
    "share": 34.53,
    "capacity": "372732844657"
  },
  {
    "name": {
      "de": "Frankreich",
      "en": "France",
      "es": "Francia",
      "fr": "France",
      "ja": "フランス共和国",
      "pt-BR": "França",
      "ru": "Франция",
      "zh-CN": "法国"
    },
    "iso": "FR",
    "count": 972,
    "share": 12.09,
    "capacity": "7740713270"
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "name": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    },
    "iso": "US",
    "count": 304,
    "share": 37.95,
    "capacity": "23906225936"
  },
  {
    "name": {
      "de": "Deutschland",
      "en": "Germany",
      "es": "Alemania",
      "fr": "Allemagne",
      "ja": "ドイツ連邦共和国",
      "pt-BR": "Alemanha",
      "ru": "Германия",
      "zh-CN": "德国"
    },
    "iso": "DE",
    "count": 85,
    "share": 10.61,
    "capacity": "1878052329"
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "name": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    },
    "iso": "US",
    "count": 4,
    "share": 36.36,
    "capacity": "2059317"
  },
  {
    "name": {
      "de": "Japan",
      "en": "Japan",
      "es": "Japón",
      "fr": "Japon",
      "ja": "日本",
      "pt-BR": "Japão",
      "ru": "Япония",
      "zh-CN": "日本"
    },
    "iso": "JP",
    "count": 2,
    "share": 18.18,
    "capacity": "107710417"
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-isp-nodes",
    title: "GET ISP Nodes",
    description: {
      default: "<p>Returns a list of nodes hosted by a specified <code>:isp</code>, where <code>:isp</code> is an ISP's ASN.</p>"
    },
    urlString: "/v1/lightning/nodes/isp/:isp",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/isp/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`16509`],
          response: `{
  "isp": "Amazon.com",
  "nodes": [
    {
      "public_key": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
      "capacity": 36010390247,
      "channels": 2907,
      "alias": "ACINQ",
      "first_seen": 1522941222,
      "updated_at": 1661274935,
      "city": null,
      "country": {
        "de": "Vereinigte Staaten",
        "en": "United States",
        "es": "Estados Unidos",
        "fr": "États Unis",
        "ja": "アメリカ",
        "pt-BR": "EUA",
        "ru": "США",
        "zh-CN": "美国"
      },
      "iso_code": "US",
      "subdivision": null
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`16509`],
          response: `{
  "isp": "Amazon.com",
  "nodes": [
    {
      "public_key": "03933884aaf1d6b108397e5efe5c86bcf2d8ca8d2f700eda99db9214fc2712b134",
      "capacity": 2041664924,
      "channels": 70,
      "alias": "endurance",
      "first_seen": 1566809576,
      "updated_at": 1660926529,
      "city": null,
      "country": {
        "de": "Vereinigte Staaten",
        "en": "United States",
        "es": "Estados Unidos",
        "fr": "États Unis",
        "ja": "アメリカ",
        "pt-BR": "EUA",
        "ru": "США",
        "zh-CN": "美国"
      },
      "iso_code": "US",
      "subdivision": null
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`7684`],
          response: `{
  "isp": "SAKURA Internet",
  "nodes": [
    {
      "public_key": "02dadf6c28f3284d591cd2a4189d1530c1ff82c07059ebea150a33ab76e7364b4a",
      "capacity": 51155987,
      "channels": 15,
      "alias": "珠美ノード⚡@wakiyamap",
      "first_seen": 1612221581,
      "updated_at": 1662382573,
      "city": null,
      "country": {
        "de": "Japan",
        "en": "Japan",
        "es": "Japón",
        "fr": "Japon",
        "ja": "日本",
        "pt-BR": "Japão",
        "ru": "Япония",
        "zh-CN": "日本"
      },
      "iso_code": "JP",
      "subdivision": null
    }
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-isp-node-stats",
    title: "GET Node Stats Per ISP",
    description: {
      default: "<p>Returns aggregate capacity, number of nodes, and number of channels per ISP. Capacity figures are in satoshis.</p>"
    },
    urlString: "/v1/lightning/nodes/isp-ranking",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/isp-ranking`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "clearnetCapacity": 417154330493,
  "torCapacity": 36605381932,
  "unknownCapacity": 6678700534,
  "ispRanking": [
    [
      "14061",           //ASN
      "DigitalOcean",    //ISP name
      43681728521,       //aggregate capacity, in sats
      5028,              //total number of channels
      192                //number of nodes
    ],
    [
      "701",
      "Verizon Internet Services",
      3047086363,
      507,
      55
    ],
    [
      "396982,15169",
      "Google Cloud",
      139554933568,
      2747,
      78
    ],
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "clearnetCapacity": 21714967205,
  "torCapacity": 1183591190,
  "unknownCapacity": 965032372,
  "ispRanking": [
    [
      "14080",                  //ASN
      "Telmex Colombia S.A.",   //ISP Name
      220063321,                //aggregate capacity, in sats
      98,                       //total number of channels
      1                         //number of nodes
    ],
    [
      "16509,14618",
      "Amazon.com",
      5590657952,
      445,
      41
    ],
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "clearnetCapacity": 126914725,
  "torCapacity": 1000000,
  "unknownCapacity": 31150000,
  "ispRanking": [
    [
      "1136",
      "KPN",
      99878,
      1,
      1
    ],
    [
      "24940",
      "Hetzner Online GmbH",
      34877093,
      6,
      1
    ],
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-top-100-nodes",
    title: "GET Top 100 Nodes",
    description: {
      default: "<p>Returns two lists of the top 100 nodes: one ordered by liquidity (aggregate channel capacity) and the other ordered by connectivity (number of open channels).</p>"
    },
    urlString: "/v1/lightning/nodes/rankings",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/rankings`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "topByCapacity": [
    {
      "publicKey": "033d8656219478701227199cbd6f670335c8d408a92ae88b962c49d4dc0e83e025",
      "alias": "bfx-lnd0",
      "capacity": 54361697486
    },
    {
      "publicKey": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
      "alias": "ACINQ",
      "capacity": 36010516297
    },
    ...
  ],
  "topByChannels": [
    {
      "publicKey": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
      "alias": "ACINQ",
      "channels": 2908
    },
    {
      "publicKey": "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226",
      "alias": "WalletOfSatoshi.com",
      "channels": 2771
    },
    ...
  ]
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "topByCapacity": [
    {
      "publicKey": "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
      "alias": "aranguren.org",
      "capacity": 17155095532
    },
    {
      "publicKey": "0225ff2ae6a3d9722b625072503c2f64f6eddb78d739379d2ee55a16b3b0ed0a17",
      "alias": "STRANGEIRON",
      "capacity": 7038263480
    },
    ...
  ],
  "topByChannels": [
    {
      "publicKey": "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
      "alias": "aranguren.org",
      "channels": 489
    },
    {
      "publicKey": "030425d8babe3ab6dfc065e69dd8b10ce6738c86ea7d634324c913e21620fa5eaf",
      "alias": "MTest441",
      "channels": 258
    },
    ...
  ]
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "topByCapacity": [
    {
      "publicKey": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
      "alias": "guggero",
      "capacity": 66577093
    },
    {
      "publicKey": "0271cf3881e6eadad960f47125434342e57e65b98a78afa99f9b4191c02dd7ab3b",
      "alias": "eclair@wakiyamap",
      "capacity": 56554430
    },
    ...
  ],
  "topByChannels": [
    {
      "publicKey": "02dadf6c28f3284d591cd2a4189d1530c1ff82c07059ebea150a33ab76e7364b4a",
      "alias": "珠美ノード⚡@wakiyamap",
      "channels": 15
    },
    {
      "publicKey": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
      "alias": "guggero",
      "channels": 12
    },
    ...
  ]
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-top-100-nodes-liquidity",
    title: "GET Top 100 Nodes by Liquidity",
    description: {
      default: "<p>Returns a list of the top 100 nodes by liquidity (aggregate channel capacity).</p>"
    },
    urlString: "/v1/lightning/nodes/rankings/liquidity",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/rankings/liquidity`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "033d8656219478701227199cbd6f670335c8d408a92ae88b962c49d4dc0e83e025",
    "alias": "bfx-lnd0",
    "capacity": 54361697486,
    "channels": 993,
    "firstSeen": 1574813156,
    "updatedAt": 1661814056,
    "city": {
      "de": "Zürich",
      "en": "Zurich",
      "es": "Zúrich",
      "fr": "Zurich",
      "ja": "チューリッヒ",
      "pt-BR": "Zurique",
      "ru": "Цюрих",
      "zh-CN": "苏黎世"
    },
    "country": {
      "de": "Schweiz",
      "en": "Switzerland",
      "es": "Suiza",
      "fr": "Suisse",
      "ja": "スイス連邦",
      "pt-BR": "Suíça",
      "ru": "Швейцария",
      "zh-CN": "瑞士"
    }
  },
  {
    "publicKey": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
    "alias": "ACINQ",
    "capacity": 36010516297,
    "channels": 2908,
    "firstSeen": 1522941222,
    "updatedAt": 1661274935,
    "city": null,
    "country": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
    "alias": "aranguren.org",
    "capacity": 17155095532,
    "channels": 489,
    "firstSeen": 1521457251,
    "updatedAt": 1662035238,
    "city": {
      "de": "Melbourne",
      "en": "Melbourne",
      "es": "Melbourne",
      "fr": "Melbourne",
      "ja": "メルボルン",
      "pt-BR": "Melbourne",
      "ru": "Мельбурн",
      "zh-CN": "墨尔本"
    },
    "country": {
      "de": "Australien",
      "en": "Australia",
      "es": "Australia",
      "fr": "Australie",
      "ja": "オーストラリア",
      "pt-BR": "Austrália",
      "ru": "Австралия",
      "zh-CN": "澳大利亚"
    }
  },
  {
    "publicKey": "0225ff2ae6a3d9722b625072503c2f64f6eddb78d739379d2ee55a16b3b0ed0a17",
    "alias": "STRANGEIRON",
    "capacity": 7038263480,
    "channels": 95,
    "firstSeen": 1651725065,
    "updatedAt": 1661958465,
    "city": {
      "de": "Melbourne",
      "en": "Melbourne",
      "es": "Melbourne",
      "fr": "Melbourne",
      "ja": "メルボルン",
      "pt-BR": "Melbourne",
      "ru": "Мельбурн",
      "zh-CN": "墨尔本"
    },
    "country": {
      "de": "Australien",
      "en": "Australia",
      "es": "Australia",
      "fr": "Australie",
      "ja": "オーストラリア",
      "pt-BR": "Austrália",
      "ru": "Австралия",
      "zh-CN": "澳大利亚"
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "alias": "guggero",
    "capacity": 66577093,
    "channels": 12,
    "firstSeen": 1608832520,
    "updatedAt": 1662440260,
    "city": null,
    "country": {
      "de": "Deutschland",
      "en": "Germany",
      "es": "Alemania",
      "fr": "Allemagne",
      "ja": "ドイツ連邦共和国",
      "pt-BR": "Alemanha",
      "ru": "Германия",
      "zh-CN": "德国"
    }
  },
  {
    "publicKey": "0271cf3881e6eadad960f47125434342e57e65b98a78afa99f9b4191c02dd7ab3b",
    "alias": "eclair@wakiyamap",
    "capacity": 56554430,
    "channels": 4,
    "firstSeen": 1628031165,
    "updatedAt": 1648064593,
    "city": {
      "de": "Ōsaka",
      "en": "Osaka",
      "es": "Osaka",
      "fr": "Osaka",
      "ja": "大阪市",
      "pt-BR": "Osaka",
      "ru": "Осака"
    },
    "country": {
      "de": "Japan",
      "en": "Japan",
      "es": "Japón",
      "fr": "Japon",
      "ja": "日本",
      "pt-BR": "Japão",
      "ru": "Япония",
      "zh-CN": "日本"
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-top-100-nodes-connectivity",
    title: "GET Top 100 Nodes by Connectivity",
    description: {
      default: "<p>Returns a list of the top 100 nodes by connectivity (number of open channels).</p>"
    },
    urlString: "/v1/lightning/nodes/rankings/connectivity",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/rankings/connectivity`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
    "alias": "ACINQ",
    "channels": 2908,
    "capacity": 36010516297,
    "firstSeen": 1522941222,
    "updatedAt": 1661274935,
    "city": null,
    "country": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    }
  },
  {
    "publicKey": "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226",
    "alias": "WalletOfSatoshi.com",
    "channels": 2772,
    "capacity": 15464503162,
    "firstSeen": 1601429940,
    "updatedAt": 1661812116,
    "city": {
      "de": "Vancouver",
      "en": "Vancouver",
      "es": "Vancouver",
      "fr": "Vancouver",
      "ja": "バンクーバー市",
      "pt-BR": "Vancôver",
      "ru": "Ванкувер"
    },
    "country": {
      "de": "Kanada",
      "en": "Canada",
      "es": "Canadá",
      "fr": "Canada",
      "ja": "カナダ",
      "pt-BR": "Canadá",
      "ru": "Канада",
      "zh-CN": "加拿大"
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
    "alias": "aranguren.org",
    "channels": 489,
    "capacity": 17155095532,
    "firstSeen": 1521457251,
    "updatedAt": 1662035238,
    "city": {
      "de": "Melbourne",
      "en": "Melbourne",
      "es": "Melbourne",
      "fr": "Melbourne",
      "ja": "メルボルン",
      "pt-BR": "Melbourne",
      "ru": "Мельбурн",
      "zh-CN": "墨尔本"
    },
    "country": {
      "de": "Australien",
      "en": "Australia",
      "es": "Australia",
      "fr": "Australie",
      "ja": "オーストラリア",
      "pt-BR": "Austrália",
      "ru": "Австралия",
      "zh-CN": "澳大利亚"
    }
  },
  {
    "publicKey": "030425d8babe3ab6dfc065e69dd8b10ce6738c86ea7d634324c913e21620fa5eaf",
    "alias": "MTest441",
    "channels": 258,
    "capacity": 4113430492,
    "firstSeen": 1640955758,
    "updatedAt": 1662035216,
    "city": null,
    "country": null
  },
  {
    "publicKey": "0270685ca81a8e4d4d01beec5781f4cc924684072ae52c507f8ebe9daf0caaab7b",
    "alias": "0270685ca81a8e4d4d01",
    "channels": 164,
    "capacity": 638119030,
    "firstSeen": 1535613050,
    "updatedAt": 1662034882,
    "city": {
      "de": "Clifton",
      "en": "Clifton",
      "ja": "クリフトン",
      "pt-BR": "Clifton",
      "ru": "Клифтон",
      "zh-CN": "克利夫頓"
    },
    "country": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "02dadf6c28f3284d591cd2a4189d1530c1ff82c07059ebea150a33ab76e7364b4a",
    "alias": "珠美ノード⚡@wakiyamap",
    "channels": 15,
    "capacity": 51155987,
    "firstSeen": 1612221581,
    "updatedAt": 1662382573,
    "city": null,
    "country": {
      "de": "Japan",
      "en": "Japan",
      "es": "Japón",
      "fr": "Japon",
      "ja": "日本",
      "pt-BR": "Japão",
      "ru": "Япония",
      "zh-CN": "日本"
    }
  },
  {
    "publicKey": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "alias": "guggero",
    "channels": 12,
    "capacity": 66577093,
    "firstSeen": 1608832520,
    "updatedAt": 1662440260,
    "city": null,
    "country": {
      "de": "Deutschland",
      "en": "Germany",
      "es": "Alemania",
      "fr": "Allemagne",
      "ja": "ドイツ連邦共和国",
      "pt-BR": "Alemanha",
      "ru": "Германия",
      "zh-CN": "德国"
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-top-100-oldest-nodes",
    title: "GET Top 100 Oldest Nodes",
    description: {
      default: "<p>Returns a list of the top 100 oldest nodes.</p>"
    },
    urlString: "/v1/lightning/nodes/rankings/age",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/rankings/age`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "02d4531a2f2e6e5a9033d37d548cff4834a3898e74c3abe1985b493c42ebbd707d",
    "alias": "coinfinity.co",
    "channels": 13,
    "capacity": 35945717,
    "firstSeen": 1518001533,
    "updatedAt": 1661713804,
    "city": {
      "de": "Brüssel",
      "en": "Brussels",
      "es": "Bruselas",
      "fr": "Bruxelles",
      "ja": "ブリュッセル",
      "pt-BR": "Bruxelas",
      "ru": "Брюссель",
      "zh-CN": "布鲁塞尔"
    },
    "country": {
      "de": "Belgien",
      "en": "Belgium",
      "es": "Bélgica",
      "fr": "Belgique",
      "ja": "ベルギー王国",
      "pt-BR": "Bélgica",
      "ru": "Бельгия",
      "zh-CN": "比利时"
    }
  },
  {
    "publicKey": "024bd94f0425590434538fd21d4e58982f7e9cfd8f339205a73deb9c0e0341f5bd",
    "alias": "CL.rompert.com🔵 ",
    "channels": 2,
    "capacity": 600000,
    "firstSeen": 1520596684,
    "updatedAt": 1603261631,
    "city": {
      "de": "Clifton",
      "en": "Clifton",
      "ja": "クリフトン",
      "pt-BR": "Clifton",
      "ru": "Клифтон",
      "zh-CN": "克利夫頓"
    },
    "country": {
      "de": "Vereinigte Staaten",
      "en": "United States",
      "es": "Estados Unidos",
      "fr": "États Unis",
      "ja": "アメリカ",
      "pt-BR": "EUA",
      "ru": "США",
      "zh-CN": "美国"
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
    "alias": "aranguren.org",
    "channels": 489,
    "capacity": 17155095532,
    "firstSeen": 1521457251,
    "updatedAt": 1662035238,
    "city": {
      "de": "Melbourne",
      "en": "Melbourne",
      "es": "Melbourne",
      "fr": "Melbourne",
      "ja": "メルボルン",
      "pt-BR": "Melbourne",
      "ru": "Мельбурн",
      "zh-CN": "墨尔本"
    },
    "country": {
      "de": "Australien",
      "en": "Australia",
      "es": "Australia",
      "fr": "Australie",
      "ja": "オーストラリア",
      "pt-BR": "Austrália",
      "ru": "Австралия",
      "zh-CN": "澳大利亚"
    }
  },
  {
    "publicKey": "0277622bf4c497475960bf91bd3c673a4cb4e9b589cebfde9700c197b3989cc1b8",
    "alias": "CoinGate",
    "channels": 11,
    "capacity": 91768515,
    "firstSeen": 1525964963,
    "updatedAt": 1661991683,
    "city": {
      "de": "Frankfurt am Main",
      "en": "Frankfurt am Main",
      "es": "Francfort",
      "fr": "Francfort-sur-le-Main",
      "ja": "フランクフルト・アム・マイン",
      "pt-BR": "Frankfurt am Main",
      "ru": "Франкфурт",
      "zh-CN": "法兰克福"
    },
    "country": {
      "de": "Deutschland",
      "en": "Germany",
      "es": "Alemania",
      "fr": "Allemagne",
      "ja": "ドイツ連邦共和国",
      "pt-BR": "Alemanha",
      "ru": "Германия",
      "zh-CN": "德国"
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    "publicKey": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "alias": "guggero",
    "channels": 12,
    "capacity": 66577093,
    "firstSeen": 1608832520,
    "updatedAt": 1662440260,
    "city": null,
    "country": {
      "de": "Deutschland",
      "en": "Germany",
      "es": "Alemania",
      "fr": "Allemagne",
      "ja": "ドイツ連邦共和国",
      "pt-BR": "Alemanha",
      "ru": "Германия",
      "zh-CN": "德国"
    }
  },
  {
    "publicKey": "03870a4c4c54a9b2e705023d706843ffbac5b0e95e2b80d4b02dc7a9efb5380322",
    "alias": "03870a4c4c54a9b2e705",
    "channels": 2,
    "capacity": 30000000,
    "firstSeen": 1608832520,
    "updatedAt": 0,
    "city": null,
    "country": null
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-node-stats",
    title: "GET Node Stats",
    description: {
      default: "<p>Returns details about a node with the given <code>:pubKey</code>.</p>"
    },
    urlString: "/v1/lightning/nodes/:pubKey",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`033ac2f9f7ff643c235cc247c521663924aff73b26b38118a6c6821460afcde1b3`],
          response: `{
  "public_key": "033ac2f9f7ff643c235cc247c521663924aff73b26b38118a6c6821460afcde1b3",
  "alias": "Red.de.Rayos",
  "first_seen": 1521504055,
  "updated_at": 1661869523,
  "color": "#68f442",
  "sockets": "84.44.203.181:9735",
  "as_number": 8422,
  "city_id": 2886242,
  "country_id": 2921044,
  "subdivision_id": 2861876,
  "longitude": 6.9489,
  "latitude": 50.9298,
  "iso_code": "DE",
  "as_organization": "NetCologne GmbH",
  "city": {
    "de": "Köln",
    "en": "Cologne",
    "es": "Colonia",
    "fr": "Cologne",
    "ja": "ケルン",
    "pt-BR": "Colônia",
    "ru": "Кёльн",
    "zh-CN": "科隆"
  },
  "country": {
    "de": "Deutschland",
    "en": "Germany",
    "es": "Alemania",
    "fr": "Allemagne",
    "ja": "ドイツ連邦共和国",
    "pt-BR": "Alemanha",
    "ru": "Германия",
    "zh-CN": "德国"
  },
  "subdivision": {
    "de": "Nordrhein-Westfalen",
    "en": "North Rhine-Westphalia",
    "es": "Renania del Norte-Westfalia",
    "fr": "Rhénanie du Nord-Westphalie",
    "ru": "Северный Рейн-Вестфалия"
  },
  "active_channel_count": 55,
  "capacity": "31505027",
  "opened_channel_count": 55,
  "closed_channel_count": 111
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`03f060953bef5b777dc77e44afa3859d022fc1a77c55138deb232ad7255e869c00`],
          response: `{
  "public_key": "03f060953bef5b777dc77e44afa3859d022fc1a77c55138deb232ad7255e869c00",
  "alias": "Boltz",
  "first_seen": 1551006126,
  "updated_at": 1662033208,
  "color": "#ff9800",
  "sockets": "35.237.24.136:9735,idz7qlezif6hgmjkpmuelnsssyxea2lwan562a5gla7jmlxsl5cb2cad.onion:9735",
  "as_number": 396982,
  "city_id": 4589387,
  "country_id": 6252001,
  "subdivision_id": 4597040,
  "longitude": -79.9746,
  "latitude": 32.8608,
  "iso_code": "US",
  "as_organization": "Google Cloud",
  "city": {
    "en": "North Charleston",
    "ja": "ノースチャールストン",
    "pt-BR": "North Charleston",
    "ru": "Норт-Чарлстон",
    "zh-CN": "北查尔斯顿"
  },
  "country": {
    "de": "Vereinigte Staaten",
    "en": "United States",
    "es": "Estados Unidos",
    "fr": "États Unis",
    "ja": "アメリカ",
    "pt-BR": "EUA",
    "ru": "США",
    "zh-CN": "美国"
  },
  "subdivision": {
    "en": "South Carolina",
    "es": "Carolina del Sur",
    "fr": "Caroline du Sud",
    "ja": "サウスカロライナ州",
    "pt-BR": "Carolina do Sul",
    "ru": "Южная Каролина",
    "zh-CN": "南卡罗来纳州"
  },
  "active_channel_count": 46,
  "capacity": "111724126",
  "opened_channel_count": 165,
  "closed_channel_count": 1
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120`],
          response: `{
  "public_key": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
  "alias": "guggero",
  "first_seen": 1608832520,
  "updated_at": 1662440260,
  "color": "#cccccc",
  "sockets": "88.99.101.67:9735",
  "as_number": 24940,
  "city_id": null,
  "country_id": 2921044,
  "subdivision_id": null,
  "longitude": 9.491,
  "latitude": 51.2993,
  "iso_code": "DE",
  "as_organization": "Hetzner Online GmbH",
  "city": null,
  "country": {
    "de": "Deutschland",
    "en": "Germany",
    "es": "Alemania",
    "fr": "Allemagne",
    "ja": "ドイツ連邦共和国",
    "pt-BR": "Alemanha",
    "ru": "Германия",
    "zh-CN": "德国"
  },
  "subdivision": null,
  "active_channel_count": 12,
  "capacity": "66577093",
  "opened_channel_count": 16,
  "closed_channel_count": 0
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-historical-node-stats",
    title: "GET Historical Node Stats",
    description: {
      default: "<p>Returns historical stats for a node with the given <code>:pubKey</code>.</p>"
    },
    urlString: "/v1/lightning/nodes/:pubKey/statistics",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/nodes/%{1}/statistics`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`033ac2f9f7ff643c235cc247c521663924aff73b26b38118a6c6821460afcde1b3`],
          response: `[
  {
    "added": 1661817600,
    "capacity": 31505027,
    "channels": 55
  },
  {
    "added": 1661731200,
    "capacity": 31505027,
    "channels": 55
  },
  {
    "added": 1655078400,
    "capacity": 26487523,
    "channels": 43
  },
  {
    "added": 1654992000,
    "capacity": 32692287,
    "channels": 57
  },
  {
    "added": 1654905600,
    "capacity": 32692287,
    "channels": 57
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`0225ff2ae6a3d9722b625072503c2f64f6eddb78d739379d2ee55a16b3b0ed0a17`],
          response: `[
  {
    "added": 1662422400,
    "capacity": 7038263480,
    "channels": 95
  },
  {
    "added": 1662336000,
    "capacity": 7038263480,
    "channels": 95
  },
  {
    "added": 1662249600,
    "capacity": 7038263480,
    "channels": 95
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120`],
          response: `[
  {
    "added": 1662422400,
    "capacity": 66577093,
    "channels": 12
  },
  {
    "added": 1662336000,
    "capacity": 63477093,
    "channels": 9
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-channel",
    title: "GET Channel",
    description: {
      default: "<p>Returns info about a Lightning channel with the given <code>:channelId</code>.</p>"
    },
    urlString: "/v1/lightning/channels/:channelId",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/channels/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`768457472831193088`],
          response: `{
  "id": "768457472831193088",
  "short_id": "698908x1305x0",
  "capacity": 16777215,
  "transaction_id": "9f248ff82f6ff4c112c218438cfde8260623663bc85a360d09a13b9a9b083564",
  "transaction_vout": 0,
  "closing_transaction_id": null,
  "closing_reason": null,
  "updated_at": "2022-08-25T23:05:40.000Z",
  "created": "2021-09-04T00:10:42.000Z",
  "status": 1,
  "node_left": {
    "alias": "CoinGate",
    "public_key": "0242a4ae0c5bef18048fbecf995094b74bfb0f7391418d71ed394784373f41e4f3",
    "channels": 1,
    "capacity": 20000,
    "base_fee_mtokens": 1000,
    "cltv_delta": 0,
    "fee_rate": 1,
    "is_disabled": 0,
    "max_htlc_mtokens": 16609443000,
    "min_htlc_mtokens": 1000,
    "updated_at": "2022-08-25T23:05:40.000Z",
    "longitude": 8.6843,
    "latitude": 50.1188
  },
  "node_right": {
    "alias": "Blixt Wallet 🟡",
    "public_key": "0230a5bca558e6741460c13dd34e636da28e52afd91cf93db87ed1b0392a7466eb",
    "channels": 3,
    "capacity": 34754430,
    "base_fee_mtokens": 1000,
    "cltv_delta": 0,
    "fee_rate": 180,
    "is_disabled": 0,
    "max_htlc_mtokens": 16609443000,
    "min_htlc_mtokens": 1000,
    "updated_at": "2022-08-25T18:44:00.000Z",
    "longitude": 9.491,
    "latitude": 51.2993
  }
}`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`2478509215728271360`],
          response: `{
  "id": "2478509215728271360",
  "short_id": "2254191x4x0",
  "capacity": 16777215,
  "transaction_id": "6b711b07b019d73ad432f401c01ac6ea253fbe2778388e5a686b5777678556c7",
  "transaction_vout": 0,
  "closing_transaction_id": null,
  "closing_reason": null,
  "updated_at": "2022-08-31T08:30:42.000Z",
  "created": "2022-06-05T16:26:31.000Z",
  "status": 1,
  "node_left": {
    "alias": "scarce-city-testnet",
    "public_key": "0304fa1da67d441b382e3b2142a1980840276d89b6477812da8d26487b5ffa938c",
    "channels": 15,
    "capacity": 104876207,
    "base_fee_mtokens": 1000,
    "cltv_delta": 0,
    "fee_rate": 1,
    "is_disabled": 0,
    "max_htlc_mtokens": 16777215000,
    "min_htlc_mtokens": 1000,
    "updated_at": "2022-08-31T08:30:42.000Z",
    "longitude": -123.1236,
    "latitude": 49.2526
  },
  "node_right": {
    "alias": "STRANGEIRON",
    "public_key": "0225ff2ae6a3d9722b625072503c2f64f6eddb78d739379d2ee55a16b3b0ed0a17",
    "channels": 95,
    "capacity": 7038263480,
    "base_fee_mtokens": 0,
    "cltv_delta": 0,
    "fee_rate": 10,
    "is_disabled": 0,
    "max_htlc_mtokens": 16609443000,
    "min_htlc_mtokens": 1,
    "updated_at": "2022-08-27T20:22:06.000Z",
    "longitude": 144.9669,
    "latitude": -37.8159
  }
}`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`58998694435160064`],
          response: `{
  "id": "58998694435160064",
  "short_id": "53659x5x0",
  "capacity": 16777215,
  "transaction_id": "cbb18e4b23c2a27736fa5be559fee7efcc855f2dfb1f16b125f686c307513ef3",
  "transaction_vout": 0,
  "closing_transaction_id": null,
  "closing_reason": null,
  "updated_at": "2022-09-04T10:15:51.000Z",
  "created": "2021-09-02T07:08:40.000Z",
  "status": 1,
  "node_left": {
    "alias": "STRANGESUCKER-v0.12.0-11-gea4143",
    "public_key": "03b9e6c1dec203f47efc95d003314d22cbb12a1324de4b091fe7d68f321a56322f",
    "channels": 4,
    "capacity": 55778192,
    "base_fee_mtokens": 0,
    "cltv_delta": 0,
    "fee_rate": 0,
    "is_disabled": 0,
    "max_htlc_mtokens": 16609443000,
    "min_htlc_mtokens": 1,
    "updated_at": "2022-09-04T10:15:51.000Z",
    "longitude": 19.1477,
    "latitude": 48.7386
  },
  "node_right": {
    "alias": "guggero",
    "public_key": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "channels": 12,
    "capacity": 66577093,
    "base_fee_mtokens": 1000,
    "cltv_delta": 0,
    "fee_rate": 1,
    "is_disabled": 0,
    "max_htlc_mtokens": 16777215000,
    "min_htlc_mtokens": 1000,
    "updated_at": "2022-09-01T22:57:40.000Z",
    "longitude": 9.491,
    "latitude": 51.2993
  }
}`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-channels-from-txid",
    title: "GET Channels from TXID",
    description: {
      default: "<p>Returns channels that correspond to the given <code>:txid</code> (multiple transaction IDs can be specified).</p>"
    },
    urlString: "/v1/lightning/channels/txids?txId[]=:txid",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/channels/txids?txId[]=%{1}&txId[]=%{2}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`c3173549f502ede6440d5c48ea74af5607d88484c7a912bbef73d430049f8af4`,`d78f0b41a263af3df91fa4171cc2f60c40196aaf8f4bde5d1c8ff4474cfe753b`],
          response: `[
  {
    "inputs": {},
    "outputs": {
      "1": {
        "id": "819296691409584129",
        "short_id": "745146x287x1",
        "capacity": 300000000,
        "transaction_id": "c3173549f502ede6440d5c48ea74af5607d88484c7a912bbef73d430049f8af4",
        "transaction_vout": 1,
        "closing_transaction_id": null,
        "closing_reason": null,
        "updated_at": "2022-08-25T18:44:07.000Z",
        "created": "2022-07-16T00:11:33.000Z",
        "status": 1,
        "node_left": {
          "alias": "River Financial 1",
          "public_key": "03037dc08e9ac63b82581f79b662a4d0ceca8a8ca162b1af3551595b8f2d97b70a",
          "base_fee_mtokens": 0,
          "cltv_delta": 0,
          "fee_rate": 500,
          "is_disabled": 0,
          "max_htlc_mtokens": 297000000000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-08-23T17:53:43.000Z"
        },
        "node_right": {
          "alias": "0204a91bb5802ad0a799",
          "public_key": "0204a91bb5802ad0a799acfd86ef566da03d80cc9e13acb01e680634bf64188a0d",
          "base_fee_mtokens": 0,
          "cltv_delta": 0,
          "fee_rate": 152,
          "is_disabled": 0,
          "max_htlc_mtokens": 297000000000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-08-25T18:44:07.000Z"
        }
      }
    }
  },
  {
    "inputs": {},
    "outputs": {
      "1": {
        "id": "814662250034036737",
        "short_id": "740931x2355x1",
        "capacity": 300000000,
        "transaction_id": "d78f0b41a263af3df91fa4171cc2f60c40196aaf8f4bde5d1c8ff4474cfe753b",
        "transaction_vout": 1,
        "closing_transaction_id": null,
        "closing_reason": null,
        "updated_at": "2022-08-28T18:54:40.000Z",
        "created": "2022-06-15T16:18:33.000Z",
        "status": 1,
        "node_left": {
          "alias": "bfx-lnd0",
          "public_key": "033d8656219478701227199cbd6f670335c8d408a92ae88b962c49d4dc0e83e025",
          "base_fee_mtokens": 1000,
          "cltv_delta": 0,
          "fee_rate": 1,
          "is_disabled": 0,
          "max_htlc_mtokens": 297000000000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-08-25T18:44:03.000Z"
        },
        "node_right": {
          "alias": "River Financial 1",
          "public_key": "03037dc08e9ac63b82581f79b662a4d0ceca8a8ca162b1af3551595b8f2d97b70a",
          "base_fee_mtokens": 0,
          "cltv_delta": 0,
          "fee_rate": 750,
          "is_disabled": 0,
          "max_htlc_mtokens": 297000000000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-08-28T18:54:40.000Z"
        }
      }
    }
  }
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`6b711b07b019d73ad432f401c01ac6ea253fbe2778388e5a686b5777678556c7`],
          response: `[
  {
    "inputs": {},
    "outputs": {
      "0": {
        "id": "2478509215728271360",
        "short_id": "2254191x4x0",
        "capacity": 16777215,
        "transaction_id": "6b711b07b019d73ad432f401c01ac6ea253fbe2778388e5a686b5777678556c7",
        "transaction_vout": 0,
        "closing_transaction_id": null,
        "closing_reason": null,
        "updated_at": "2022-08-31T08:30:42.000Z",
        "created": "2022-06-05T16:26:31.000Z",
        "status": 1,
        "node_left": {
          "alias": "scarce-city-testnet",
          "public_key": "0304fa1da67d441b382e3b2142a1980840276d89b6477812da8d26487b5ffa938c",
          "base_fee_mtokens": 1000,
          "cltv_delta": 0,
          "fee_rate": 1,
          "is_disabled": 0,
          "max_htlc_mtokens": 16777215000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-08-31T08:30:42.000Z"
        },
        "node_right": {
          "alias": "STRANGEIRON",
          "public_key": "0225ff2ae6a3d9722b625072503c2f64f6eddb78d739379d2ee55a16b3b0ed0a17",
          "base_fee_mtokens": 0,
          "cltv_delta": 0,
          "fee_rate": 10,
          "is_disabled": 0,
          "max_htlc_mtokens": 16609443000,
          "min_htlc_mtokens": 1,
          "updated_at": "2022-08-27T20:22:06.000Z"
        }
      }
    }
  }
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`cbb18e4b23c2a27736fa5be559fee7efcc855f2dfb1f16b125f686c307513ef3`],
          response: `[
  {
    "inputs": {},
    "outputs": {
      "0": {
        "id": "58998694435160064",
        "short_id": "53659x5x0",
        "capacity": 16777215,
        "transaction_id": "cbb18e4b23c2a27736fa5be559fee7efcc855f2dfb1f16b125f686c307513ef3",
        "transaction_vout": 0,
        "closing_transaction_id": null,
        "closing_reason": null,
        "updated_at": "2022-09-04T10:15:51.000Z",
        "created": "2021-09-02T07:08:40.000Z",
        "status": 1,
        "node_left": {
          "alias": "STRANGESUCKER-v0.12.0-11-gea4143",
          "public_key": "03b9e6c1dec203f47efc95d003314d22cbb12a1324de4b091fe7d68f321a56322f",
          "base_fee_mtokens": 0,
          "cltv_delta": 0,
          "fee_rate": 0,
          "is_disabled": 0,
          "max_htlc_mtokens": 16609443000,
          "min_htlc_mtokens": 1,
          "updated_at": "2022-09-04T10:15:51.000Z"
        },
        "node_right": {
          "alias": "guggero",
          "public_key": "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
          "base_fee_mtokens": 1000,
          "cltv_delta": 0,
          "fee_rate": 1,
          "is_disabled": 0,
          "max_htlc_mtokens": 16777215000,
          "min_htlc_mtokens": 1000,
          "updated_at": "2022-09-01T22:57:40.000Z"
        }
      }
    }
  }
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-channels-from-pubkey",
    title: "GET Channels from Node Pubkey",
    description: {
      default: "<p>Returns a list of a node's channels given its <code>:pubKey</code>. Ten channels are returned at a time. Use <code>:index</code> for paging. <code>:channelStatus</code> can be <code>open</code>, <code>active</code>, or <code>closed</code>.</p>"
    },
    urlString: "/v1/lightning/channels?public_key=:pubKey&status=:channelStatus",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/channels?public_key=%{1}&status=%{2}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2`,`open`],
          response: `[
  {
    "status": 1,
    "closing_reason": null,
    "capacity": 59200000,
    "short_id": "751361x1324x1",
    "id": "826130156244172801",
    "fee_rate": 1,
    "node": {
      "alias": "ipayblue.com",
      "public_key": "032fe854a231aeb2357523ee6ca263ae04ce53eee8a13767ecbb911b69fefd8ace",
      "channels": 65,
      "capacity": "856675361"
    }
  },
  {
    "status": 1,
    "closing_reason": null,
    "capacity": 51000000,
    "short_id": "750792x1586x1",
    "id": "825504534145138689",
    "fee_rate": 1,
    "node": {
      "alias": "Escher",
      "public_key": "02b515c74f334dee09821bee299fcbd9668182730c5719b25a8f262b28893198b0",
      "channels": 50,
      "capacity": "2202925844"
    }
  },
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`0200202c1f23899d03bf3f37c87d348e6847bbd91e407df91a713c7dcf3442738b`, `open`],
          response: `[
  {
    "status": 1,
    "closing_reason": null,
    "closing_date": null,
    "capacity": 8000000,
    "short_id": "2223130x18x0",
    "id": "2444357285058838528",
    "fee_rate": 10,
    "node": {
      "alias": "Gilgamesh Lightning Testnet",
      "public_key": "034997a34858a25dc453a722efc1545d8c7749cbd4587a8d2ef149d257babd8357",
      "channels": 121,
      "capacity": "512199932"
    }
  },
  {
    "status": 0,
    "closing_reason": null,
    "closing_date": null,
    "capacity": 1000000,
    "short_id": "2223130x19x0",
    "id": "2444357285058904064",
    "fee_rate": 0,
    "node": {
      "alias": "routing.testnet.lnmarkets.com",
      "public_key": "03bae2db4b57738c1ec1ffa1c5e5a4423968cc592b3b39cddf7d495e72919d6431",
      "channels": 22,
      "capacity": "246940161"
    }
  },
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120`, `open`],
          response: `[
  {
    "status": 1,
    "closing_reason": null,
    "closing_date": null,
    "capacity": 16777215,
    "short_id": "53659x5x0",
    "id": "58998694435160064",
    "fee_rate": 1,
    "node": {
      "alias": "STRANGESUCKER-v0.12.0-11-gea4143",
      "public_key": "03b9e6c1dec203f47efc95d003314d22cbb12a1324de4b091fe7d68f321a56322f",
      "channels": 4,
      "capacity": "55778192"
    }
  },
  {
    "status": 1,
    "closing_reason": null,
    "closing_date": null,
    "capacity": 15000000,
    "short_id": "17498x2x1",
    "id": "19239254462955521",
    "fee_rate": 1,
    "node": {
      "alias": "03870a4c4c54a9b2e705",
      "public_key": "03870a4c4c54a9b2e705023d706843ffbac5b0e95e2b80d4b02dc7a9efb5380322",
      "channels": 2,
      "capacity": "30000000"
    }
  },
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-channel-geodata",
    title: "GET Channel Geodata",
    description: {
      default: "<p>Returns a list of channels with corresponding node geodata.</p>"
    },
    urlString: "/v1/lightning/channels-geo",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/channels-geo`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    "03120ac28af913889cbc3cb86d7aff12bc0abe939f1fa9fb1980bdff8483197092",
    "LIGHTNING2",
    -77.2278,
    38.9567,
    "03baa70886d9200af0ffbd3f9e18d96008331c858456b16e3a9b41e735c6208fef",
    "LIGHTNING",
    -77.2278,
    38.9567
  ],
  [
    "033d8656219478701227199cbd6f670335c8d408a92ae88b962c49d4dc0e83e025",
    "bfx-lnd0",
    8.5671,
    47.3682,
    "028d98b9969fbed53784a36617eb489a59ab6dc9b9d77fcdca9ff55307cd98e3c4",
    "OpenNode.com",
    -83.0061,
    39.9625
  ],
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    "038863cf8ab91046230f561cd5b386cbff8309fa02e3f0c3ed161a3aeb64a643b9",
    "aranguren.org",
    144.9669,
    -37.8159,
    "028c3640c57ffe47eb41db8225968833c5032f297aeba98672d6f7037090d59e3f",
    "lndus0.next.zaphq.io",
    -79.9746,
    32.8608
  ],
  [
    "02be8f360e57600486b93dd33ea0872a4e14a259924ba4084f27d693a77d151158",
    "lndus1.dev.zaphq.io",
    -79.9746,
    32.8608,
    "0273ec4a4c80e767aca1477592649ad6e709ad31e7435668043a9dceccb3020f35",
    "lndwr1.dev.zaphq.io",
    -79.9746,
    32.8608
  ],
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    "02dadf6c28f3284d591cd2a4189d1530c1ff82c07059ebea150a33ab76e7364b4a",
    "珠美ノード⚡@wakiyamap",
    139.6895,
    35.6897,
    "0271cf3881e6eadad960f47125434342e57e65b98a78afa99f9b4191c02dd7ab3b",
    "eclair@wakiyamap",
    135.4911,
    34.7135
  ],
  [
    "03b9e6c1dec203f47efc95d003314d22cbb12a1324de4b091fe7d68f321a56322f",
    "STRANGESUCKER-v0.12.0-11-gea4143",
    19.1477,
    48.7386,
    "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "guggero",
    9.491,
    51.2993
  ],
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  },
  {
    type: "endpoint",
    category: "lightning",
    httpRequestMethod: "GET",
    fragment: "get-channel-geodata-node",
    title: "GET Channel Geodata for Node",
    description: {
      default: "<p>Returns a list of channels with corresponding geodata for a node with the given <code>:pubKey</code>.</p>"
    },
    urlString: "/v1/lightning/channels-geo/:pubKey",
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/lightning/channels-geo/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`03d607f3e69fd032524a867b288216bfab263b6eaee4e07783799a6fe69bb84fac`],
          response: `[
  [
    "03d607f3e69fd032524a867b288216bfab263b6eaee4e07783799a6fe69bb84fac",
    "Bitrefill",
    -77.4903,
    39.0469,
    "024a2e265cd66066b78a788ae615acdc84b5b0dec9efac36d7ac87513015eaf6ed",
    "Bitrefill",
    -6.2591,
    53.3379
  ],
  [
    "03d607f3e69fd032524a867b288216bfab263b6eaee4e07783799a6fe69bb84fac",
    "Bitrefill",
    -77.4903,
    39.0469,
    "030c3f19d742ca294a55c00376b3b355c3c90d61c6b6b39554dbc7ac19b141c14f",
    "Bitrefill Routing",
    -6.2591,
    53.3379
  ],
  ...
]`
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`0273ec4a4c80e767aca1477592649ad6e709ad31e7435668043a9dceccb3020f35`],
          response: `[
  [
    "039b1717db1193eb332d3c0bfdcce90a6aab60efa478b60963d3b406a8fc45134a",
    "testnet.demo.btcpayserver.org",
    -79.3503,
    43.7806,
    "0273ec4a4c80e767aca1477592649ad6e709ad31e7435668043a9dceccb3020f35",
    "lndwr1.dev.zaphq.io",
    -79.9746,
    32.8608
  ],
  [
    "0273ec4a4c80e767aca1477592649ad6e709ad31e7435668043a9dceccb3020f35",
    "lndwr1.dev.zaphq.io",
    -79.9746,
    32.8608,
    "02c6fbedc6ca81d4db5883f1d01481c8187d5f85075729a658288a6d507f770ada",
    "HAPPYTOLL",
    -97.822,
    37.751
  ],
  ...
]`
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120`],
          response: `[
  [
    "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "guggero",
    9.491,
    51.2993,
    "0271cf3881e6eadad960f47125434342e57e65b98a78afa99f9b4191c02dd7ab3b",
    "eclair@wakiyamap",
    135.4911,
    34.7135
  ],
  [
    "02dadf6c28f3284d591cd2a4189d1530c1ff82c07059ebea150a33ab76e7364b4a",
    "珠美ノード⚡@wakiyamap",
    139.6895,
    35.6897,
    "02ad48db0d1a7f7c3d186ddc57f8e62c49a1234fb829af9ccd3be1a4596bc39120",
    "guggero",
    9.491,
    51.2993
  ],
  ...
]`
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
        codeSampleBisq: emptyCodeSample,
      }
    }
  }
];

export const faqData = [
  {
    type: "category",
    category: "basics",
    fragment: "basics",
    title: "Basics",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-a-mempool",
    title: "What is a mempool?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-a-mempool-explorer",
    title: "What is a mempool explorer?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-a-blockchain",
    title: "What is a blockchain?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-a-block-explorer",
    title: "What is a block explorer?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-mining",
    title: "What is mining?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-are-mining-pools",
    title: "What are mining pools?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-are-vb-wu",
    title: "What are virtual bytes (vB) and weight units (WU)?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-svb",
    title: "What is sat/vB?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "what-is-full-mempool",
    title: "What does it mean for the mempool to be \"full\"?",
  },
  {
    type: "endpoint",
    category: "basics",
    showConditions: bitcoinNetworks,
    fragment: "why-empty-blocks",
    title: "Why are there empty blocks?",
  },
  {
    type: "category",
    category: "help",
    fragment: "help-stuck-transaction",
    title: "Help! My transaction is stuck",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "help",
    showConditions: bitcoinNetworks,
    fragment: "why-is-transaction-stuck-in-mempool",
    title: "Why isn't my transaction confirming?",
  },
  {
    type: "endpoint",
    category: "help",
    showConditions: bitcoinNetworks,
    fragment: "how-to-get-transaction-confirmed-quickly",
    title: "How can I get my transaction confirmed more quickly?",
  },
  {
    type: "endpoint",
    category: "help",
    showConditions: bitcoinNetworks,
    fragment: "how-prevent-stuck-transaction",
    title: "How can I prevent a transaction from getting stuck in the future?",
  },
  {
    type: "category",
    category: "using",
    fragment: "using-this-website",
    title: "Using this website",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "how-to",
    showConditions: bitcoinNetworks,
    fragment: "looking-up-transactions",
    title: "How can I look up a transaction?",
  },
  {
    type: "endpoint",
    category: "how-to",
    showConditions: bitcoinNetworks,
    fragment: "looking-up-addresses",
    title: "How can I look up an address?",
  },
  {
    type: "endpoint",
    category: "how-to",
    showConditions: bitcoinNetworks,
    fragment: "looking-up-blocks",
    title: "How can I look up a block?",
  },
  {
    type: "endpoint",
    category: "how-to",
    showConditions: bitcoinNetworks,
    fragment: "looking-up-fee-estimates",
    title: "How can I look up fee estimates?",
  },
  {
    type: "endpoint",
    category: "how-to",
    showConditions: bitcoinNetworks,
    fragment: "looking-up-historical-trends",
    title: "How can I explore historical trends?",
  },
  {
    type: "category",
    category: "advanced",
    fragment: "advanced",
    title: "Advanced",
    showConditions: bitcoinNetworks
  },
  {
    type: "endpoint",
    category: "advanced",
    showConditions: bitcoinNetworks,
    fragment: "who-runs-this-website",
    title: "Who runs this website?",
  },
  {
    type: "endpoint",
    category: "advanced",
    showConditions: bitcoinNetworks,
    fragment: "host-my-own-instance-raspberry-pi",
    title: "How can I host my own instance on a Raspberry Pi?",
  },
  {
    type: "endpoint",
    category: "advanced",
    showConditions: bitcoinNetworks,
    fragment: "host-my-own-instance-linux-server",
    title: "How can I host my own instance on a Linux server?",
  },
  {
    type: "endpoint",
    category: "advanced",
    showConditions: bitcoinNetworks,
    fragment: "install-mempool-with-docker",
    title: "Can I install Mempool using Docker?",
  },
  {
    type: "endpoint",
    category: "advanced",
    showConditions: bitcoinNetworks,
    fragment: "address-lookup-issues",
    title: "Why do I get an error for certain address lookups on my Mempool instance?",
  }
];
