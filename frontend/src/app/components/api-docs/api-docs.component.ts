import { Component, OnInit } from '@angular/core';
import { Env, StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { Observable, merge, of } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-api-docs',
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss']
})
export class ApiDocsComponent implements OnInit {
  hostname = document.location.hostname;
  network$: Observable<string>;
  active = 0;
  env: Env;

  code = {
    address: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

        const myAddress = await addresses.getAddress({ address });
        console.log(myAddress);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address"`,
      },
      responseSample: `{
  address: "1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC",
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
}`,
    },
    addressTransactions: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

        const addressTxs = await addresses.getAddressTxs({ address });
        console.log(addressTxs);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address/txs"`,
      },
      responseSample: `[
  {
    txid: "f39fbfd2482ac8a7174fe27caddd66aec05eec0d0e988ddf0de2136a416394c4",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 251,
    weight: 1004,
    fee: 8212,
    status: {
      confirmed: true,
      block_height: 684536,
      block_hash: "00000000000000000008df08f428ca4e8251ba9171d9060b056f1f94d4fefbc7",
      block_time: 1621687336
    }
  },
  ...
]`,
    },
    addressTransactionsChain: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

        const addressTxsChain = await addresses.getAddressTxsChain({ address });
        console.log(addressTxsChain);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address/txs/chain"`,
      },
      responseSample: `[
  {
    txid: "f39fbfd2482ac8a7174fe27caddd66aec05eec0d0e988ddf0de2136a416394c4",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 251,
    weight: 1004,
    fee: 8212,
    status: {
      confirmed: true,
      block_height: 684536,
      block_hash: "00000000000000000008df08f428ca4e8251ba9171d9060b056f1f94d4fefbc7",
      block_time: 1621687336
    }
  },
  ...
]`,
    },
    addressTransactionsMempool: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1EnX7FFCzdBjpYnErSTaxaWyTND4m86ebK';

  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1EnX7FFCzdBjpYnErSTaxaWyTND4m86ebK';

        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
        console.log(addressTxsMempool);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address/txs/mempool"`,
      },
      responseSample: `[
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
]`,
    },
    addressUTXO: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1PQwtwajfHWyAkedss5utwBvULqbGocRpu';

  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1PQwtwajfHWyAkedss5utwBvULqbGocRpu';

        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
        console.log(addressTxsUtxo);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address/utxo"`,
      },
      responseSample: `[
  {
    txid: 'a3e4a5ce88c9a73983aaba34243472377e478c3ca77258018222b813e1256307',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 685094,
      block_hash: '00000000000000000002af00dc86cfc99c8843c7a4906a1ec3b0a79712334d81',
      block_time: 1622081201
    },
    value: 723191295
  },
  ...
]`,
    },
    assets: {
      codeSample: {
        esModule: `const { liquid: { assets } } = mempoolJS();
  const asset_id =
    '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

  const txs = await assets.getAsset({ asset_id });
  console.log(txs);`,
        commonJS: `const { liquid: { assets } } = mempoolJS();
        const asset_id =
          '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

        const asset = await assets.getAsset({ asset_id });
        console.log(asset);`,
        curl: `curl -X GET "https://mempool.space/liquid/api/asset/:asset_id"`,
      },
      responseSample: `{
  asset_id: "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  chain_stats: {
    tx_count: 3013,
    peg_in_count: 1832,
    peg_in_amount: 298054170045,
    peg_out_count: 982,
    peg_out_amount: 3905921326,
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
    assetTransactions: {
      codeSample: {
        esModule: `const { liquid: { assets } } = mempoolJS();
  const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

  const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
  console.log(asset);`,
        commonJS: `const { liquid: { assets } } = mempoolJS();
      const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

      const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
      console.log(asset);`,
        curl: `curl -X GET "https://mempool.space/liquid/api/asset/:asset_id/txs[/mempool|/chain]"`,
      },
      responseSample: `[
  {
    txid: "74057c98274a5e529bd3fcf5b906b235937cea5aed7e43132856b402006068e5",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 975,
    weight: 1461,
    fee: 42,
    status: {
      confirmed: true,
      block_height: 1337495,
      block_hash: "e73bfee19c8e1b59967cb035f835347a78818f8639ee7ccd157d3372cdcd236e",
      block_time: 1622328838
    }
  },
  ...
]`,
    },
    assetSupply: {
      codeSample: {
        esModule: `const { liquid: { assets } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);`,
        commonJS: `const { liquid: { assets } } = mempoolJS();
      const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

      const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
      console.log(assetSupply);`,
        curl: `curl -X GET "https://mempool.space/liquid/api/asset/:asset_id/supply[/decimal]"`,
      },
      responseSample: `293689745913`,
    },
    cpfp: {
      codeSample: {
        esModule: `const { %{1}: { fees } } = mempoolJS();
  const txid = 'txid';

  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);`,
        commonJS: `const { %{1}: { fees } } = mempoolJS();
        const txid = 'txid';

        const feesCPFP = await fees.getCPFP({ txid });`,
        curl: `curl -X GET "https://mempool.space/api/v1/cpfp/:txid"`,
      },
      responseSample: ``,
    },
    block: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const block = await blocks.getBlock({ hash });
  console.log(block);`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const block = await blocks.getBlock({ hash });
        console.log(block);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash"`,
      },
      responseSample: `{
    id: "000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce",
    height: 363366,
    version: 2,
    timestamp: 1435766771,
    tx_count: 494,
    size: 286494,
    weight: 1145976,
    merkle_root: "9d3cb87bf05ebae366b4262ed5f768ce8c62fc385c3886c9cb097647b04b686c",
    previousblockhash: "000000000000000010c545b6fa3ef1f7cf45a2a8760b1ee9f2e89673218207ce",
    mediantime: 1435763435,
    nonce: 2892644888,
    bits: 404111758,
    difficulty: 49402014931
  }`,
    },
    blockHeader: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();

const blockHeader = await blocks.getBlockHeader({ hash: '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2' });
console.log(blockHeader);`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();

      const blockHeight = await blocks.getBlockHeight({ height: 0 });
      console.log(blockHeight);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/header"`,
      },
      responseSample: `040000202c04d4c450187d1da9b1bc23ba47d67fe028d22486fd0c00000000000000000059a3a33d4642c799af9f54a4dd351fff9130e6a89d4e251130c60064878616e906b5ea60ce9813173a25caf3`,
    },
    blockHeight: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();

  const blockHeight = await blocks.getBlockHeight({ height: 0 });
  console.log(blockHeight);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();

        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        console.log(blockHeight);`,
        curl: `curl -X GET "https://mempool.space/api/block-height/:height"`,
      },
      responseSample: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`,
    },
    blockRaw: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockRaw = await blocks.getBlockRaw({ hash });
        console.log(blockRaw);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/raw"`,
      },
      responseSample: ``,
    },
    blockStatus: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockStatus = await blocks.getBlockStatus({ hash });
        console.log(blockStatus);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/status"`,
      },
      responseSample: `{
  in_best_chain: true,
  height: 363366,
  next_best: "000000000000000015eb17c390eb4a920fc745332fda6a62179a6afe0d6a6548"
}`,
    },
    blockTipHeight: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();
        console.log(blocksTipHeight);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/tip/height"`,
      },
      responseSample: `685442`,
    },
    blockTipHash: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();

        const blocksTipHash = await blocks.getBlocksTipHash();
        console.log(blocksTipHash);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/tip/hash"`,
      },
      responseSample: `00000000000000000009165c5600f52cb7436b40f3ad48e996de63d63e1a124e`,
    },
    blockTxId: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxid = await blocks.getBlockTxid({ hash, index: 218 });
  console.log(blockTxid);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxid = await blocks.getBlockTxid({ hash, index: 218 });
        console.log(blockTxid);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/txid/:index"`,
      },
      responseSample: `0fa6da60e484941f255cbb025c3d6440e5a7e970119e899b4065c7999360e406`,
    },
    blockTxIds: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxids = await blocks.getBlockTxids({ hash });
        console.log(blockTxids);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/txids"`,
      },
      responseSample: `[
  "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
  "a5ef89881bd5103f223a0fa285dfc75f4718974cb792cf85e623a7de05801bc9",
  "94e8c35414db17cd10efa0ac4115e086edb168ba7bd86e737e5b8cab96821580",
  ...
]`,
    },
    blockTxs: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxs = await blocks.getBlockTxs({ hash });
        console.log(blockTxs);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash/txs[/:start_index]"`,
      },
      responseSample: `[
  {
    txid: "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
    version: 1,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object] ],
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
]`,
    },
    blocks: {
      codeSample: {
        esModule: `const { %{1}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ start_height: 9999 });
  console.log(getBlocks);
`,
        commonJS: `const { %{1}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ start_height: 9999 });
        console.log(getBlocks);`,
        curl: `curl -X GET "https://mempool.space/api/blocks[/:start_height]"`,
      },
      responseSample: `[
  {
    id: '00000000fbc97cc6c599ce9c24dd4a2243e2bfd518eda56e1d5e47d29e29c3a7',
    height: 9999,
    version: 1,
    timestamp: 1238987491,
    tx_count: 1,
    size: 216,
    weight: 864,
    merkle_root: '5012c1d2a46d5684aa0331f0d8a900767c86c0fd83bb632f357b1ea11fa69179',
    previousblockhash: '000000003dd32df94cfafd16e0a8300ea14d67dcfee9e1282786c2617b8daa09',
    mediantime: 1238984702,
    nonce: 3568610608,
    bits: 486604799,
    difficulty: 1
  },
  ...
]`,
    },
    difficulty: {
      codeSample: {
        esModule: `const { bitcoin: { difficulty } } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);`,
        commonJS: `const { bitcoin: { difficulty } } = mempoolJS();

        const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
        console.log(difficultyAdjustment);`,
        curl: `curl -X GET "https://mempool.space/api/v1/difficulty-adjustment"`,
      },
      responseSample: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 0.9845932018381687,
  estimatedRetargetDate: 1627762478.9111245,
  remainingBlocks: 1121,
  remainingTime: 665977.6261244365,
  previousRetarget: -4.807005268478962
}`,
    },
    mempoolBlocks: {
      codeSample: {
        esModule: `const { %{1}: { fees } } = mempoolJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);`,
        commonJS: `const { %{1}: { fees } } = mempoolJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
        console.log(feesMempoolBlocks);`,
        curl: `curl -X GET "https://mempool.space/api/v1/fees/mempool-blocks"`,
      },
      responseSample: `[
  {
    blockSize: 1325044,
    blockVSize: 974920,
    nTx: 2314,
    totalFees: 57600850,
    medianFee: 59.73444413716814,
    feeRange: [
      14.091264667535855,
      27.88170055452865,
      50.123893805309734,
      59,
      60.267857142857146,
      65.47085201793722,
      100,
      474.934036939314
    ]
  },
  ...
]`,
    },
    mempool: {
      codeSample: {
        esModule: `const { %{1}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);`,
        commonJS: `const { %{1}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();
        console.log(getMempool);`,
        curl: `curl -X GET "https://mempool.space/api/mempool"`,
      },
      responseSample: `{
  count: 12262,
  vsize: 18726518,
  total_fee: 99943359,
  fee_histogram: [
    [ 121.72455, 50049 ],
    ... 142 more items
  ]
}`,
    },
    mempoolTxs: {
      codeSample: {
        esModule: `const { %{1}: { mempool } } = mempoolJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);`,
        commonJS: `const { %{1}: { mempool } } = mempoolJS();

        const getMempoolTxids = await mempool.getMempoolTxids();
        console.log(getMempoolTxids);`,
        curl: `curl -X GET "https://mempool.space/api/mempool/txids"`,
      },
      responseSample: `[
  '0873cc5e6c63704a27c63d5b86231db2a688d1e8dee466c8162aa6a398e719c5',
  ... 12308 more items
]`,
    },
    mempoolRecent: {
      codeSample: {
        esModule: `const { %{1}: { mempool } } = mempoolJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);`,
        commonJS: `
        const { %{1}: { mempool } } = mempoolJS();

        const getMempoolRecent = await mempool.getMempoolRecent();
        console.log(getMempoolRecent);`,
        curl: `curl -X GET "https://mempool.space/api/mempool/recent"`,
      },
      responseSample: `[
  {
    txid: '4ab126bfde126a7824336080cbad0e6c3db0d39873b2093080ec5dc09205dca6',
    fee: 8520,
    vsize: 141,
    value: 3428127849
  },
  ...
]`,
    },
    postTransaction: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const postTx = await transactions.postTx({ txid });
  console.log(postTx);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const postTx = await transactions.postTx({ txid });
        console.log(postTx);`,
        curl: `curl -X POST "https://mempool.space/api/tx"`,
      },
      responseSample: ``,
    },
    recommendedFees: {
      codeSample: {
        esModule: `const { %{1}: { fees } } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);`,
        commonJS: `const { %{1}: { fees } } = mempoolJS();

        const feesRecommended = await fees.getFeesRecommended();
        console.log(feesRecommended);`,
        curl: `curl -X GET "https://mempool.space/api/v1/fees/recommended"`,
      },
      responseSample: `{
  fastestFee: 60,
  halfHourFee: 35,
  hourFee: 20,
  minimumFee: 1
}`,
    },
    transaction: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const tx = await transactions.getTx({ txid });
  console.log(tx);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const tx = await transactions.getTx({ txid });
  console.log(tx);`,
  curl: `curl -X GET "https://mempool.space/api/tx/:txid"`,
},
responseSample: `{
  txid: "15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521",
  version: 1,
  locktime: 0,
  vin: [
    {
      txid: "1fdfed84588cb826b876cd761ecebcf1726453437f0a6826e82ed54b2807a036",
      vout: 12,
      prevout: [Object],
      scriptsig: "483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0",
      scriptsig_asm: "OP_PUSHBYTES_72 3045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01 OP_PUSHBYTES_33 0255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0",
      is_coinbase: false,
      sequence: 4294967295
    },
    ...
  ],
  vout: [
    {
      scriptpubkey: "76a91472d52e2f5b88174c35ee29844cce0d6d24b921ef88ac",
      scriptpubkey_asm: "OP_DUP OP_HASH160 OP_PUSHBYTES_20 72d52e2f5b88174c35ee29844cce0d6d24b921ef OP_EQUALVERIFY OP_CHECKSIG",
      scriptpubkey_type: "p2pkh",
      scriptpubkey_address: "1BUBQuPV3gEV7P2XLNuAJQjf5t265Yyj9t",
      value: 1240000000
    },
    ...
  ],
  size: 884,
  weight: 3536,
  fee: 20000,
  status: {
    confirmed: true,
    block_height: 363348,
    block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
    block_time: 1435754650
  }
}`,
    },
    transactionHex: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txHex = await transactions.getTxHex({ txid });
        console.log(txHex);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/hex"`,
      },
      responseSample: `010000000536a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0c0000006b483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0ffffffffee08cb90c4e84dd7952b2cfad81ed3b088f5b32183da2894c969f6aa7ec98405020000006a47304402206332beadf5302281f88502a53cc4dd492689057f2f2f0f82476c1b5cd107c14a02207f49abc24fc9d94270f53a4fb8a8fbebf872f85fff330b72ca91e06d160dcda50121027943329cc801a8924789dc3c561d89cf234082685cbda90f398efa94f94340f2ffffffff36a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f060000006b4830450221009c97a25ae70e208b25306cc870686c1f0c238100e9100aa2599b3cd1c010d8ff0220545b34c80ed60efcfbd18a7a22f00b5f0f04cfe58ca30f21023b873a959f1bd3012102e54cd4a05fe29be75ad539a80e7a5608a15dffbfca41bec13f6bf4a32d92e2f4ffffffff73cabea6245426bf263e7ec469a868e2e12a83345e8d2a5b0822bc7f43853956050000006b483045022100b934aa0f5cf67f284eebdf4faa2072345c2e448b758184cee38b7f3430129df302200dffac9863e03e08665f3fcf9683db0000b44bf1e308721eb40d76b180a457ce012103634b52718e4ddf125f3e66e5a3cd083765820769fd7824fd6aa38eded48cd77fffffffff36a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0b0000006a47304402206348e277f65b0d23d8598944cc203a477ba1131185187493d164698a2b13098a02200caaeb6d3847b32568fd58149529ef63f0902e7d9c9b4cc5f9422319a8beecd50121025af6ba0ccd2b7ac96af36272ae33fa6c793aa69959c97989f5fa397eb8d13e69ffffffff0400e6e849000000001976a91472d52e2f5b88174c35ee29844cce0d6d24b921ef88ac20aaa72e000000001976a914c15b731d0116ef8192f240d4397a8cdbce5fe8bc88acf02cfa51000000001976a914c7ee32e6945d7de5a4541dd2580927128c11517488acf012e39b000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
    },
    transactionMerkleblockProof: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
        console.log(txMerkleBlockProof);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/merkleblock-proof"`,
      },
      responseSample: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663ecaa55b76cb638bb92b028e9bdeeeba65a06adaae75df61e79677b13b5d45523d5ab4067f6f3c89e27458b9c1072910436afdd26b9b89489d89f2a7daaad6d375e3ebafb169bfa3cf266b9605964debb72a79a6491481295dc5ed5198b989c6126c8b4d354c274f115a91b7d01d878c01c9a70ba5d78e11c38d1f7b94692afb177e63a9371b60665ee4cfc49cd9cffa78244de209537d97b19d5938a67078af79f7258d7afe325b16c68089fe31f9ac2185dcea0f9d66cb7b6b69c42c41127c3ddd1b1991f3ce99a89355f14507e115f92356b4c0984e291567cf9d869918726b0e650274a6c692682320257c9925eeb7240c4ced055b8b8cf804d33bbec407b4058b1e1f7c5a7127770f7cac890879706e1e34ef8e1b715e182cc691524135bc78da898afc89b401862af259dca1da9065dad015d747181e12ffb73ea0ba0480a0b89ff33fb3884514554be97bf0b603add505`,
    },
    tramsactionMerkleProof: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txMerkleProof = await transactions.getTxMerkleProof({ txid });
        console.log(txMerkleProof);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/merkle-proof"`,
      },
      responseSample: `{
  block_height: 363348,
  merkle: [
    "acf931fe8980c6165b32fe7a8d25f779af7870a638599db1977d5309e24d2478",
    ...
  ],
  pos: 1465
}`,
    },
    transactionOutspend: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: 3,
  });
  console.log(txOutspend);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: 3,
        });
        console.log(txOutspend);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/outspend/:vout"`,
      },
      responseSample: `{
  spent: true,
  txid: "2a1b8ec06d68096911da82b02806c3848c415b0044a0046850c4a97cbffac7b1",
  vin: 1,
  status: {
    confirmed: true,
    block_height: 363354,
    block_hash: "000000000000000012e6130dec174ca877bf39ead6e3d04a8ba3b0cd683c1661",
    block_time: 1435758032
  }
}`,
    },
    transactionOutspends: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txOutspends = await transactions.getTxOutspends({ txid });
  console.log(txOutspends);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txOutspends = await transactions.getTxOutspends({ txid });
        console.log(txOutspends);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/outspends"`,
      },
      responseSample: `[
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
]`,
    },
    transactionRaw: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txRaw = await transactions.getTxRaw({ txid });
        console.log(txRaw);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/raw"`,
      },
      responseSample: ``,
    },
    transactionStatus: {
      codeSample: {
        esModule: `const { %{1}: { transactions } } = mempoolJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
`,
        commonJS: `const { %{1}: { transactions } } = mempoolJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txStatus = await transactions.getTxStatus({ txid });
        console.log(txStatus);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid/status"`,
      },
      responseSample: `{
  confirmed: true,
  block_height: 363348,
  block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
  block_time: 1435754650
}`,
    },
    websocket: {
      codeSample: {
        esModule: `const { bitcoin: { websocket } } = mempoolJS();

  const ws = websocket.initServer({
    options: ["blocks", "stats", "mempool-blocks", "live-2h-chart"],
  });

  ws.on("message", function incoming(data) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      console.log(res.blocks);
    }
    if (res.mempoolInfo) {
      console.log(res.mempoolInfo);
    }
    if (res.transactions) {
      console.log(res.transactions);
    }
    if (res.mempoolBlocks) {
      console.log(res.mempoolBlocks);
    }
  });`,
        commonJS: `const { bitcoin: { websocket } } = mempoolJS();

        const ws = websocket.initClient({
          options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
        });

        ws.addEventListener('message', function incoming({data}) {
          const res = JSON.parse(data.toString());
          if (res.blocks) {
            console.log(res.blocks);
          }
          if (res.mempoolInfo) {
            console.log(res.mempoolInfo);
          }
          if (res.transactions) {
            console.log(res.transactions);
          }
          if (res.mempoolBlocks) {
            console.log(res.mempoolBlocks);
          }
        });`,
        curl: ``,
      },
      responseSample: ``,
    },
    liquidAssets: {
      codeSample: {
        esModule: `const { assets } = liquidJS();
  const asset_id =
    '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

  const txs = await assets.getAsset({ asset_id });
  console.log(txs);`,
        commonJS: `const { assets } = liquidJS();
        const asset_id =
          '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

        const asset = await assets.getAsset({ asset_id });
        console.log(asset);`,
        curl: `curl -X GET "https://liquid.network/api/asset/:asset_id"`,
      },
      responseSample: `{
  asset_id: "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
  chain_stats: {
    tx_count: 3013,
    peg_in_count: 1832,
    peg_in_amount: 298054170045,
    peg_out_count: 982,
    peg_out_amount: 3905921326,
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
    liquidAssetTransactions: {
      codeSample: {
        esModule: `const { assets } = liquidJS();
  const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

  const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
  console.log(asset);`,
        commonJS: `const { assets } = liquidJS();
      const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

      const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
      console.log(asset);`,
        curl: `curl -X GET "https://liquid.network/api/asset/:asset_id/txs[/mempool|/chain]"`,
      },
      responseSample: `[
  {
    txid: "74057c98274a5e529bd3fcf5b906b235937cea5aed7e43132856b402006068e5",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 975,
    weight: 1461,
    fee: 42,
    status: {
      confirmed: true,
      block_height: 1337495,
      block_hash: "e73bfee19c8e1b59967cb035f835347a78818f8639ee7ccd157d3372cdcd236e",
      block_time: 1622328838
    }
  },
  ...
]`,
    },
    liquidAssetSupply: {
      codeSample: {
        esModule: `const { assets } = liquidJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);`,
        commonJS: `const { assets } = liquidJS();
      const asset_id =
        '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

      const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
      console.log(assetSupply);`,
        curl: `curl -X GET "https://liquid.network/api/asset/:asset_id/supply[/decimal]"`,
      },
      responseSample: `293689745913`,
    },
    liquidRecommendedFees: {
      codeSample: {
        esModule: `const { fees } = liquidJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);`,
        commonJS: `const { fees } = liquidJS();

        const feesRecommended = await fees.getFeesRecommended();
        console.log(feesRecommended);`,
        curl: `curl -X GET "https://liquid.network/api/v1/fees/recommended"`,
      },
      responseSample: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  minimumFee: 1
}`,
    },
    liquidMempoolBlocks: {
      codeSample: {
        esModule: `const { fees } = liquidJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);`,
        commonJS: `const { fees } = liquidJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
        console.log(feesMempoolBlocks);`,
        curl: `curl -X GET "https://liquid.network/api/v1/fees/mempool-blocks"`,
      },
      responseSample: `[
  {
    blockSize: 4599,
    blockVSize: 1331,
    nTx: 1,
    totalFees: 579,
    medianFee: 0.4349295774647887,
    feeRange: [
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887,
      0.4349295774647887
    ]
  }
]`,
    },
    liquidCpfp: {
      codeSample: {
        esModule: `const { fees } = liquidJS();
  const txid = 'txid';

  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);`,
        commonJS: `const { fees } = liquidJS();
        const txid = 'txid';

        const feesCPFP = await fees.getCPFP({ txid });`,
        curl: `curl -X GET "https://liquid.network/api/v1/cpfp/:txid"`,
      },
      responseSample: ``,
    },
    liquidMempool: {
      codeSample: {
        esModule: `const { mempool } = liquidJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);`,
        commonJS: `const { mempool } = liquidJS();

        const getMempool = await mempool.getMempool();
        console.log(getMempool);`,
        curl: `curl -X GET "https://liquid.network/api/mempool"`,
      },
      responseSample: `{
  count: 2,
  vsize: 3895,
  total_fee: 836,
  fee_histogram: [
    [
      0.10023401,
      3895
    ]
  ]
}`,
    },
    liquidMempoolTxs: {
      codeSample: {
        esModule: `const { mempool } = liquidJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);`,
        commonJS: `const { mempool } = liquidJS();

        const getMempoolTxids = await mempool.getMempoolTxids();
        console.log(getMempoolTxids);`,
        curl: `curl -X GET "https://liquid.network/api/mempool/txids"`,
      },
      responseSample: `[
  '0873cc5e6c63704a27c63d5b86231db2a688d1e8dee466c8162aa6a398e719c5',
  ... 12308 more items
]`,
    },
    liquidMempoolRecent: {
      codeSample: {
        esModule: `const { mempool } = liquidJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);`,
        commonJS: `
        const { mempool } = liquidJS();

        const getMempoolRecent = await mempool.getMempoolRecent();
        console.log(getMempoolRecent);`,
        curl: `curl -X GET "https://liquid.network/api/mempool/recent"`,
      },
      responseSample: `[
  {
    txid: '4ab126bfde126a7824336080cbad0e6c3db0d39873b2093080ec5dc09205dca6',
    fee: 8520,
    vsize: 141,
    value: 3428127849
  },
  ...
]`,
    },
    liquidBlock: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const block = await blocks.getBlock({ hash });
  console.log(block);`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const block = await blocks.getBlock({ hash });
        console.log(block);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash"`,
      },
      responseSample: `{
    id: "000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce",
    height: 363366,
    version: 2,
    timestamp: 1435766771,
    tx_count: 494,
    size: 286494,
    weight: 1145976,
    merkle_root: "9d3cb87bf05ebae366b4262ed5f768ce8c62fc385c3886c9cb097647b04b686c",
    previousblockhash: "000000000000000010c545b6fa3ef1f7cf45a2a8760b1ee9f2e89673218207ce",
    mediantime: 1435763435,
    nonce: 2892644888,
    bits: 404111758,
    difficulty: 49402014931
  }`,
    },
    liquidBlockHeader: {
        codeSample: {
          esModule: `const { blocks } = liquidJS();

  const blockHeader = await blocks.getBlockHeader({ hash: '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2' });
  console.log(blockHeader);`,
          commonJS: `const { blocks } = liquidJS();

        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        console.log(blockHeight);`,
          curl: `curl -X GET "https://liquid.network/api/block/:hash/header"`,
        },
        responseSample: `040000202c04d4c450187d1da9b1bc23ba47d67fe028d22486fd0c00000000000000000059a3a33d4642c799af9f54a4dd351fff9130e6a89d4e251130c60064878616e906b5ea60ce9813173a25caf3`,
    },
    liquidBlockHeight: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();

  const blockHeight = await blocks.getBlockHeight({ height: 0 });
  console.log(blockHeight);
`,
        commonJS: `const { blocks } = liquidJS();

        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        console.log(blockHeight);`,
        curl: `curl -X GET "https://liquid.network/api/block-height/:height"`,
      },
      responseSample: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`,
    },
    liquidBlockRaw: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockRaw = await blocks.getBlockRaw({ hash });
        console.log(blockRaw);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash/raw"`,
      },
      responseSample: ``,
    },
    liquidBlockStatus: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockStatus = await blocks.getBlockStatus({ hash });
        console.log(blockStatus);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash/status"`,
      },
      responseSample: `{
  in_best_chain: true,
  height: 363366,
  next_best: "000000000000000015eb17c390eb4a920fc745332fda6a62179a6afe0d6a6548"
}`,
    },
    liquidBlockTipHeight: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
`,
        commonJS: `const { blocks } = liquidJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();
        console.log(blocksTipHeight);`,
        curl: `curl -X GET "https://liquid.network/api/blocks/tip/height"`,
      },
      responseSample: `685442`,
    },
    liquidBlockTipHash: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
`,
        commonJS: `const { blocks } = liquidJS();

        const blocksTipHash = await blocks.getBlocksTipHash();
        console.log(blocksTipHash);`,
        curl: `curl -X GET "https://liquid.network/api/blocks/tip/hash"`,
      },
      responseSample: `00000000000000000009165c5600f52cb7436b40f3ad48e996de63d63e1a124e`,
    },
    liquidBlockTxId: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxid = await blocks.getBlockTxid({ hash, index: 218 });
  console.log(blockTxid);
`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxid = await blocks.getBlockTxid({ hash, index: 218 });
        console.log(blockTxid);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash/txid/:index"`,
      },
      responseSample: `0fa6da60e484941f255cbb025c3d6440e5a7e970119e899b4065c7999360e406`,
    },
    liquidBlockTxIds: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxids = await blocks.getBlockTxids({ hash });
        console.log(blockTxids);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash/txids"`,
      },
      responseSample: `[
  "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
  "a5ef89881bd5103f223a0fa285dfc75f4718974cb792cf85e623a7de05801bc9",
  "94e8c35414db17cd10efa0ac4115e086edb168ba7bd86e737e5b8cab96821580",
  ...
]`,
    },
    liquidBlockTxs: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();
  const hash =
    '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
`,
        commonJS: `const { blocks } = liquidJS();
        const hash =
          '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce';

        const blockTxs = await blocks.getBlockTxs({ hash });
        console.log(blockTxs);`,
        curl: `curl -X GET "https://liquid.network/api/block/:hash/txs[/:start_index]"`,
      },
      responseSample: `[
  {
    txid: "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
    version: 1,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object] ],
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
]`,
    },
    liquidBlocks: {
      codeSample: {
        esModule: `const { blocks } = liquidJS();

  const getBlocks = await blocks.getBlocks({ start_height: 9999 });
  console.log(getBlocks);
`,
        commonJS: `const { blocks } = liquidJS();

        const getBlocks = await blocks.getBlocks({ start_height: 9999 });
        console.log(getBlocks);`,
        curl: `curl -X GET "https://liquid.network/api/blocks[/:start_height]"`,
      },
      responseSample: `[
  {
    id: '00000000fbc97cc6c599ce9c24dd4a2243e2bfd518eda56e1d5e47d29e29c3a7',
    height: 9999,
    version: 1,
    timestamp: 1238987491,
    tx_count: 1,
    size: 216,
    weight: 864,
    merkle_root: '5012c1d2a46d5684aa0331f0d8a900767c86c0fd83bb632f357b1ea11fa69179',
    previousblockhash: '000000003dd32df94cfafd16e0a8300ea14d67dcfee9e1282786c2617b8daa09',
    mediantime: 1238984702,
    nonce: 3568610608,
    bits: 486604799,
    difficulty: 1
  },
  ...
]`,
    },
    liquidTransaction: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const tx = await transactions.getTx({ txid });
  console.log(tx);
`,
        commonJS: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const tx = await transactions.getTx({ txid });
  console.log(tx);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid"`,
      },
      responseSample: `{
  txid: "15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521",
  version: 1,
  locktime: 0,
  vin: [
    {
      txid: "1fdfed84588cb826b876cd761ecebcf1726453437f0a6826e82ed54b2807a036",
      vout: 12,
      prevout: [Object],
      scriptsig: "483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0",
      scriptsig_asm: "OP_PUSHBYTES_72 3045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01 OP_PUSHBYTES_33 0255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0",
      is_coinbase: false,
      sequence: 4294967295
    },
    ...
  ],
  vout: [
    {
      scriptpubkey: "76a91472d52e2f5b88174c35ee29844cce0d6d24b921ef88ac",
      scriptpubkey_asm: "OP_DUP OP_HASH160 OP_PUSHBYTES_20 72d52e2f5b88174c35ee29844cce0d6d24b921ef OP_EQUALVERIFY OP_CHECKSIG",
      scriptpubkey_type: "p2pkh",
      scriptpubkey_address: "1BUBQuPV3gEV7P2XLNuAJQjf5t265Yyj9t",
      value: 1240000000
    },
    ...
  ],
  size: 884,
  weight: 3536,
  fee: 20000,
  status: {
    confirmed: true,
    block_height: 363348,
    block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
    block_time: 1435754650
  }
}`,
    },
    liquidTransactionHex: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txHex = await transactions.getTxHex({ txid });
        console.log(txHex);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/hex"`,
      },
      responseSample: `010000000536a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0c0000006b483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0ffffffffee08cb90c4e84dd7952b2cfad81ed3b088f5b32183da2894c969f6aa7ec98405020000006a47304402206332beadf5302281f88502a53cc4dd492689057f2f2f0f82476c1b5cd107c14a02207f49abc24fc9d94270f53a4fb8a8fbebf872f85fff330b72ca91e06d160dcda50121027943329cc801a8924789dc3c561d89cf234082685cbda90f398efa94f94340f2ffffffff36a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f060000006b4830450221009c97a25ae70e208b25306cc870686c1f0c238100e9100aa2599b3cd1c010d8ff0220545b34c80ed60efcfbd18a7a22f00b5f0f04cfe58ca30f21023b873a959f1bd3012102e54cd4a05fe29be75ad539a80e7a5608a15dffbfca41bec13f6bf4a32d92e2f4ffffffff73cabea6245426bf263e7ec469a868e2e12a83345e8d2a5b0822bc7f43853956050000006b483045022100b934aa0f5cf67f284eebdf4faa2072345c2e448b758184cee38b7f3430129df302200dffac9863e03e08665f3fcf9683db0000b44bf1e308721eb40d76b180a457ce012103634b52718e4ddf125f3e66e5a3cd083765820769fd7824fd6aa38eded48cd77fffffffff36a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0b0000006a47304402206348e277f65b0d23d8598944cc203a477ba1131185187493d164698a2b13098a02200caaeb6d3847b32568fd58149529ef63f0902e7d9c9b4cc5f9422319a8beecd50121025af6ba0ccd2b7ac96af36272ae33fa6c793aa69959c97989f5fa397eb8d13e69ffffffff0400e6e849000000001976a91472d52e2f5b88174c35ee29844cce0d6d24b921ef88ac20aaa72e000000001976a914c15b731d0116ef8192f240d4397a8cdbce5fe8bc88acf02cfa51000000001976a914c7ee32e6945d7de5a4541dd2580927128c11517488acf012e39b000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
    },
    liquidTransactionMerkleblockProof: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
        console.log(txMerkleBlockProof);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/merkleblock-proof"`,
      },
      responseSample: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663ecaa55b76cb638bb92b028e9bdeeeba65a06adaae75df61e79677b13b5d45523d5ab4067f6f3c89e27458b9c1072910436afdd26b9b89489d89f2a7daaad6d375e3ebafb169bfa3cf266b9605964debb72a79a6491481295dc5ed5198b989c6126c8b4d354c274f115a91b7d01d878c01c9a70ba5d78e11c38d1f7b94692afb177e63a9371b60665ee4cfc49cd9cffa78244de209537d97b19d5938a67078af79f7258d7afe325b16c68089fe31f9ac2185dcea0f9d66cb7b6b69c42c41127c3ddd1b1991f3ce99a89355f14507e115f92356b4c0984e291567cf9d869918726b0e650274a6c692682320257c9925eeb7240c4ced055b8b8cf804d33bbec407b4058b1e1f7c5a7127770f7cac890879706e1e34ef8e1b715e182cc691524135bc78da898afc89b401862af259dca1da9065dad015d747181e12ffb73ea0ba0480a0b89ff33fb3884514554be97bf0b603add505`,
    },
    liquidTransactionMerkleProof: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txMerkleProof = await transactions.getTxMerkleProof({ txid });
        console.log(txMerkleProof);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/merkle-proof"`,
      },
      responseSample: `{
  block_height: 363348,
  merkle: [
    "acf931fe8980c6165b32fe7a8d25f779af7870a638599db1977d5309e24d2478",
    ...
  ],
  pos: 1465
}`,
    },
    liquidTransactionOutspend: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: 3,
  });
  console.log(txOutspend);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: 3,
        });
        console.log(txOutspend);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/outspend/:vout"`,
      },
      responseSample: `{
  spent: true,
  txid: "2a1b8ec06d68096911da82b02806c3848c415b0044a0046850c4a97cbffac7b1",
  vin: 1,
  status: {
    confirmed: true,
    block_height: 363354,
    block_hash: "000000000000000012e6130dec174ca877bf39ead6e3d04a8ba3b0cd683c1661",
    block_time: 1435758032
  }
}`,
    },
    liquidTransactionOutspends: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txOutspends = await transactions.getTxOutspends({ txid });
  console.log(txOutspends);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txOutspends = await transactions.getTxOutspends({ txid });
        console.log(txOutspends);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/outspends"`,
      },
      responseSample: `[
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
]`,
    },
    liquidTransactionRaw: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txRaw = await transactions.getTxRaw({ txid });
        console.log(txRaw);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/raw"`,
      },
      responseSample: ``,
    },
    liquidTransactionStatus: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const txStatus = await transactions.getTxStatus({ txid });
        console.log(txStatus);`,
        curl: `curl -X GET "https://liquid.network/api/tx/:txid/status"`,
      },
      responseSample: `{
  confirmed: true,
  block_height: 363348,
  block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
  block_time: 1435754650
}`,
    },
    liquidPostTransaction: {
      codeSample: {
        esModule: `const { transactions } = liquidJS();
  const txid =
  '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const postTx = await transactions.postTx({ txid });
  console.log(postTx);
`,
        commonJS: `const { transactions } = liquidJS();
        const txid =
        '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

        const postTx = await transactions.postTx({ txid });
        console.log(postTx);`,
        curl: `curl -X POST "https://liquid.network/api/tx"`,
      },
      responseSample: ``,
    },
    liquidAddress: {
      codeSample: {
        esModule: `const { addresses } = liquidJS();
  const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);`,
        commonJS: `const { addresses } = liquidJS();
        const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

        const myAddress = await addresses.getAddress({ address });
        console.log(myAddress);`,
        curl: `curl -X GET "https://liquid.network/api/address/:address"`,
      },
      responseSample: `{
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
}`,
    },
    liquidAddressTransactions: {
      codeSample: {
        esModule: `const { addresses } = liquidJS();
  const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);`,
        commonJS: `const { addresses } = liquidJS();
        const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

        const addressTxs = await addresses.getAddressTxs({ address });
        console.log(addressTxs);`,
        curl: `curl -X GET "https://liquid.network/api/address/:address/txs"`,
      },
      responseSample: `[
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
]`,
    },
    liquidAddressTransactionsChain: {
      codeSample: {
        esModule: `const { addresses } = liquidJS();
  const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);`,
        commonJS: `const { addresses } = liquidJS();
        const address = 'Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48';

        const addressTxsChain = await addresses.getAddressTxsChain({ address });
        console.log(addressTxsChain);`,
        curl: `curl -X GET "https://liquid.network/api/address/:address/txs/chain"`,
      },
      responseSample: `[
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
]`,
    },
    liquidAddressTransactionsMempool: {
      codeSample: {
        esModule: `const { addresses } = liquidJS();
  const address = '1EnX7FFCzdBjpYnErSTaxaWyTND4m86ebK';

  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);`,
        commonJS: `const { addresses } = liquidJS();
        const address = '1EnX7FFCzdBjpYnErSTaxaWyTND4m86ebK';

        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
        console.log(addressTxsMempool);`,
        curl: `curl -X GET "https://liquid.network/api/address/:address/txs/mempool"`,
      },
      responseSample: `[
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
]`,
    },
    liquidAddressUTXO: {
      codeSample: {
        esModule: `const { addresses } = liquidJS();
  const address = '1PQwtwajfHWyAkedss5utwBvULqbGocRpu';

  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);`,
        commonJS: `const { addresses } = liquidJS();
        const address = '1PQwtwajfHWyAkedss5utwBvULqbGocRpu';

        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
        console.log(addressTxsUtxo);`,
        curl: `curl -X GET "https://liquid.network/api/address/:address/utxo"`,
      },
      responseSample: `[
  {
    txid: 'a3e4a5ce88c9a73983aaba34243472377e478c3ca77258018222b813e1256307',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 685094,
      block_hash: '00000000000000000002af00dc86cfc99c8843c7a4906a1ec3b0a79712334d81',
      block_time: 1622081201
    },
    value: 723191295
  },
  ...
]`,
    },
    liquidWebsocket: {
      codeSample: {
        esModule: `const { websocket } = liquidJS();

  const ws = websocket.initServer({
    options: ["blocks", "stats", "mempool-blocks", "live-2h-chart"],
  });

  ws.on("message", function incoming(data) {
    const res = JSON.parse(data.toString());
    if (res.blocks) {
      console.log(res.blocks);
    }
    if (res.mempoolInfo) {
      console.log(res.mempoolInfo);
    }
    if (res.transactions) {
      console.log(res.transactions);
    }
    if (res.mempoolBlocks) {
      console.log(res.mempoolBlocks);
    }
  });`,
        commonJS: `const { websocket } = liquidJS();

        const ws = websocket.initClient({
          options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
        });

        ws.addEventListener('message', function incoming({data}) {
          const res = JSON.parse(data.toString());
          if (res.blocks) {
            console.log(res.blocks);
          }
          if (res.mempoolInfo) {
            console.log(res.mempoolInfo);
          }
          if (res.transactions) {
            console.log(res.transactions);
          }
          if (res.mempoolBlocks) {
            console.log(res.mempoolBlocks);
          }
        });`,
        curl: ``,
      },
      responseSample: ``,
    },
    bisqAddress: {
      codeSample: {
        esModule: `const { bisq: { addresses } } = mempoolJS();
  const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);`,
        commonJS: `const { bisq: { addresses } } = mempoolJS();
        const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

        const myAddress = await addresses.getAddress({ address });
        console.log(myAddress);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address"`,
      },
      responseSample: `[
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
]`,
    },
    bisqBlock: {
      codeSample: {
        esModule: `const { bisq: { blocks } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const block = await blocks.getBlock({ hash });
  console.log(block);`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const block = await blocks.getBlock({ hash });
        console.log(block);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash"`,
      },
      responseSample: `{
  height: 571747,
  time: 1555340856000,
  hash: "000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
  previousBlockHash: "0000000000000000001b8c271a4477a28d4ea7d4d4d1add6d96f386e3f151709",
  txs: [
    {
      txVersion: "1",
      id: "4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5",
      blockHeight: 571747,
      blockHash: "000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
      time: 1555340856000,
      inputs: [],
      outputs: [Array],
      txType: "GENESIS",
      txTypeDisplayString: "Genesis",
      burntFee: 0,
      invalidatedBsq: 0,
      unlockBlockHeight: 0
    }
  ]
}`,
    },
    bisqBlockTipHeight: {
      codeSample: {
        esModule: `const { bisq: { blocks } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const myBlocksHeight = await blocks.getBlocksTipHeight({
    index: 0,
    length: 1,
  });
  console.log(myBlocksHeight);`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const myBlocksHeight = await blocks.getBlocksTipHeight({
          index: 0,
          length: 1,
        });
        console.log(myBlocksHeight);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/tip/height"`,
      },
      responseSample: `685657`,
    },
    bisqBlockIndex: {
      codeSample: {
        esModule: `const { bisq: { blocks } } = mempoolJS();

  const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
  console.log(myBlocks);`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();

        const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
        console.log(myBlocks);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/:index/:length"`,
      },
      responseSample: `[
  {
    height: 685656,
    time: 1622468887000,
    hash: "00000000000000000004c7046979024bd8e8f07389ca53f4f1d7dcf84eefdb21",
    previousBlockHash: "0000000000000000000bf982d024e5afa38be8fc08c3a9b6a2bd89dbd18de832",
    txs: [
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object]
    ]
  }
]`,
    },
    bisqMarketsCurrencies: {
      codeSample: {
        esModule: `const { bisq: { markets } } = mempoolJS();

  const currencies = await markets.getCurrencies();
  console.log(currencies);`,
        commonJS: `const { bisq: { markets } } = mempoolJS();

        const currencies = await markets.getCurrencies();
        console.log(currencies);`,
        curl: `curl -X GET "https://mempool.space/api/markets/currencies/"`,
      },
      responseSample: `{
  BTC: {
    code: 'BTC',
    name: 'Bitcoin',
    precision: 8,
    _type: 'crypto'
  }
  ...
}`,
    },
    bisqMarketsDepth: {
      codeSample: {
        esModule: `const { bisq: { markets } } = mempoolJS();

  const market = "BTC_USD";

  const depth = await markets.getDepth({ market });
  console.log(depth);`,
        commonJS: `const { bisq: { markets } } = mempoolJS();

        const market = "BTC_USD";

        const depth = await markets.getDepth({ market });
        console.log(depth);`,
        curl: `curl -X GET "https://mempool.space/api/markets/depth/"`,
      },
      responseSample: `{
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
    bisqMarketsHloc: {
      codeSample: {
        esModule: `const { bisq: { markets } } = mempoolJS();

  const market = "BTC_USD";

  const hloc = await markets.getHloc({ market });
  console.log(hloc);`,
        commonJS: `const { bisq: { markets } } = mempoolJS();

        const market = "BTC_USD";

        const hloc = await markets.getHloc({ market });
        console.log(hloc);`,
        curl: `curl -X GET "https://mempool.space/api/markets/hloc/"`,
      },
      responseSample: `[
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
    bisqMarketsMarkets: {
        codeSample: {
          esModule: `const { bisq: { markets } } = mempoolJS();

  const allMarkets = await markets.getMarkets();
  console.log(allMarkets);`,
          commonJS: `const { bisq: { markets } } = mempoolJS();

        const allMarkets = await markets.getMarkets();
        console.log(allMarkets);`,
          curl: `curl -X GET "https://mempool.space/api/markets/"`,
        },
        responseSample: `{
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
    bisqMarketsOffers: {
        codeSample: {
          esModule: `const { bisq: { markets } } = mempoolJS();
  const market = "BTC_USD";

  const offers = await markets.getOffers({ market });
  console.log(offers);`,
          commonJS: `const { bisq: { markets } } = mempoolJS();
        const market = "BTC_USD";

        const offers = await markets.getOffers({ market });
        console.log(offers);`,
          curl: `curl -X GET "https://mempool.space/api/markets/offers"`,
        },
        responseSample: `{
  btc_usd: {
    buys: [
      [Object],
      ...
    ],
    sells: [
      [Object],
      ...
    ]
  }
}`,
    },
    bisqMarketsTicker: {
        codeSample: {
          esModule: `const { bisq: { markets } } = mempoolJS();
  const market = "BTC_USD";

  const ticker = await markets.getTicker({ market });
  console.log(ticker);`,
          commonJS: `const { bisq: { markets } } = mempoolJS();

        const market = "BTC_USD";
  
        const ticker = await markets.getTicker({ market });
        console.log(ticker);`,
          curl: `curl -X GET "https://mempool.space/api/markets/ticker"`,
        },
        responseSample: `{
  last: '45717.81750000',
  high: '56483.70620000',
  low: '43531.62860000',
  volume_left: '0.30170000',
  volume_right: '14093.11830000',
  buy: '42000.00000000',
  sell: '45782.92640000'
}`,
    },
    bisqMarketsTrades: {
        codeSample: {
          esModule: `const { bisq: { markets } } = mempoolJS();
  const market = "BTC_USD";

  const trades = await markets.getTrades({ market });
  console.log(trades);`,
          commonJS: `const { bisq: { markets } } = mempoolJS();

        const market = "BTC_USD";

        const trades = await markets.getTrades({ market });
        console.log(trades);`,
          curl: `curl -X GET "https://mempool.space/api/markets/trades"`,
        },
        responseSample: `[
  {
    price: '56483.70620000',
    amount: '0.02000000',
    volume: '1129.67410000',
    payment_method: 'AMAZON_GIFT_CARD',
    trade_date: 1628619031777
  },
  ...
]`,
    },
    bisqMarketsVolumes: {
        codeSample: {
          esModule: `const { bisq: { markets } } = mempoolJS();

  const market = "BTC_USD";
  const basecurrency = "BTC";

  const volumes = await markets.getVolumes({ basecurrency, market });`,
          commonJS: `const { bisq: { markets } } = mempoolJS();

        const market = "BTC_USD";
        const basecurrency = "BTC";

        const volumes = await markets.getVolumes({ basecurrency, market });
        console.log(volumes);`,
          curl: `curl -X GET "https://mempool.space/api/markets/volumes"`,
        },
        responseSample: `,
  {
    price: '40160.32250000',
    amount: '0.01000000',
    volume: '401.60320000',
    payment_method: 'AMAZON_GIFT_CARD',
    trade_date: 1628199923855
  },
  ...
]`,
    },
    bisqStats: {
      codeSample: {
        esModule: `const { bisq: { statistics } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const stats = await statistics.getStats();
  console.log(stats);`,
        commonJS: `const { bisq: { statistics } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const stats = await statistics.getStats();
        console.log(stats);`,
        curl: `curl -X GET "https://mempool.space/api/stats"`,
      },
      responseSample: `[
  {
    period_start: 1609459200,
    open: '30448.18510000',
    close: '45717.81750000',
    high: '77700.00000000',
    low: '27500.00000000',
    avg: '44613.01158471',
    volume_right: '4923536.57150000',
    volume_left: '110.36100000'
  },
  ...
]`,
    },
    bisqTransaction: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();
  const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

  const tx = await transactions.getTx({ txid });
  console.log(tx);`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();
        const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

        const tx = await transactions.getTx({ txid });
        console.log(tx);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid"`,
      },
      responseSample: `{
  "txVersion":"1",
  "id":"4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5",
  "blockHeight":571747,
  "blockHash":"000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
  "time":1555340856000,
  "inputs": [ [Object], [Object] ],
  "outputs": [ [Object], [Object] ],
  "txType":"GENESIS",
  "txTypeDisplayString":"Genesis",
  "burntFee":0,
  "invalidatedBsq":0,
  "unlockBlockHeight":0
}`,
    },
    bisqTransactions: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/api/txs/:index/:length"`,
      },
      responseSample: `[
  {
    txVersion: "1",
    id: "084e94afb67df0e6dff2e9ae6913d5ccb58f3b2dab0c4543a7c90c33b70c9bed",
    blockHeight: 685656,
    blockHash: "00000000000000000004c7046979024bd8e8f07389ca53f4f1d7dcf84eefdb21",
    time: 1622468887000,
    inputs: [ [Object], [Object] ],
    outputs: [ [Object], [Object], [Object] ],
    txType: "PAY_TRADE_FEE",
    txTypeDisplayString: "Pay trade fee",
    burntFee: 57,
    invalidatedBsq: 0,
    unlockBlockHeight: 0
  }
]`,
    },
    bisqAddressModule: {
      codeSample: {
        esModule: `const { addresses } = bisqJS();
  const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);`,
        commonJS: `const { addresses } = bisqJS();
        const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

        const myAddress = await addresses.getAddress({ address });
        console.log(myAddress);`,
        curl: `curl -X GET "https://mempool.space/api/address/:address"`,
      },
      responseSample: `[
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
]`,
    },
    bisqBlockModule: {
      codeSample: {
        esModule: `const { blocks } = bisqJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const block = await blocks.getBlock({ hash });
  console.log(block);`,
        commonJS: `const { blocks } = bisqJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const block = await blocks.getBlock({ hash });
        console.log(block);`,
        curl: `curl -X GET "https://mempool.space/api/block/:hash"`,
      },
      responseSample: `{
  height: 571747,
  time: 1555340856000,
  hash: "000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
  previousBlockHash: "0000000000000000001b8c271a4477a28d4ea7d4d4d1add6d96f386e3f151709",
  txs: [
    {
      txVersion: "1",
      id: "4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5",
      blockHeight: 571747,
      blockHash: "000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
      time: 1555340856000,
      inputs: [],
      outputs: [Array],
      txType: "GENESIS",
      txTypeDisplayString: "Genesis",
      burntFee: 0,
      invalidatedBsq: 0,
      unlockBlockHeight: 0
    }
  ]
}`,
    },
    bisqBlockTipHeightModule: {
      codeSample: {
        esModule: `const { blocks } = bisqJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const myBlocksHeight = await blocks.getBlocksTipHeight({
    index: 0,
    length: 1,
  });
  console.log(myBlocksHeight);`,
        commonJS: `const { blocks } = bisqJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const myBlocksHeight = await blocks.getBlocksTipHeight({
          index: 0,
          length: 1,
        });
        console.log(myBlocksHeight);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/tip/height"`,
      },
      responseSample: `685657`,
    },
    bisqBlockIndexModule: {
      codeSample: {
        esModule: `const { blocks } = bisqJS();

  const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
  console.log(myBlocks);`,
        commonJS: `const { blocks } = bisqJS();

        const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
        console.log(myBlocks);`,
        curl: `curl -X GET "https://mempool.space/api/blocks/:index/:length"`,
      },
      responseSample: `[
  {
    height: 685656,
    time: 1622468887000,
    hash: "00000000000000000004c7046979024bd8e8f07389ca53f4f1d7dcf84eefdb21",
    previousBlockHash: "0000000000000000000bf982d024e5afa38be8fc08c3a9b6a2bd89dbd18de832",
    txs: [
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object]
    ]
  }
]`,
    },
    bisqMarketsCurrenciesModule: {
      codeSample: {
        esModule: `const { markets } = bisqJS();

  const currencies = await markets.getCurrencies();
  console.log(currencies);`,
        commonJS: `const { markets } = bisqJS();

        const currencies = await markets.getCurrencies();
        console.log(currencies);`,
        curl: `curl -X GET "https://bisq.markets/api/markets/currencies/"`,
      },
      responseSample: `{
  BTC: {
    code: 'BTC',
    name: 'Bitcoin',
    precision: 8,
    _type: 'crypto'
  }
  ...
}`,
    },
    bisqMarketsDepthModule: {
      codeSample: {
        esModule: `const { markets } = bisqJS();

  const market = "BTC_USD";

  const depth = await markets.getDepth({ market });
  console.log(depth);`,
        commonJS: `const { markets } = bisqJS();

        const market = "BTC_USD";

        const depth = await markets.getDepth({ market });
        console.log(depth);`,
        curl: `curl -X GET "https://bisq.markets/api/markets/depth/"`,
      },
      responseSample: `{
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
    bisqMarketsHlocModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();

  const market = "BTC_USD";

  const hloc = await markets.getHloc({ market });
  console.log(hloc);`,
          commonJS: `const { markets } = bisqJS();

        const market = "BTC_USD";

        const hloc = await markets.getHloc({ market });
        console.log(hloc);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/hloc/"`,
        },
        responseSample: `[
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
    bisqMarketsMarketsModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();

  const allMarkets = await markets.getMarkets();
  console.log(allMarkets);`,
          commonJS: `const { markets } = bisqJS();

        const allMarkets = await markets.getMarkets();
        console.log(allMarkets);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/"`,
        },
        responseSample: `{
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
    bisqMarketsOffersModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();
  const market = "BTC_USD";

  const offers = await markets.getOffers({ market });
  console.log(offers);`,
          commonJS: `const { markets } = bisqJS();
        const market = "BTC_USD";

        const offers = await markets.getOffers({ market });
        console.log(offers);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/offers"`,
        },
        responseSample: `{
  btc_usd: {
    buys: [
      [Object],
      ...
    ],
    sells: [
      [Object],
      ...
    ]
  }
}`,
    },
    bisqMarketsTickerModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();
  const market = "BTC_USD";

  const ticker = await markets.getTicker({ market });
  console.log(ticker);`,
          commonJS: `const { markets } = bisqJS();

        const market = "BTC_USD";
  
        const ticker = await markets.getTicker({ market });
        console.log(ticker);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/ticker"`,
        },
        responseSample: `{
  last: '45717.81750000',
  high: '56483.70620000',
  low: '43531.62860000',
  volume_left: '0.30170000',
  volume_right: '14093.11830000',
  buy: '42000.00000000',
  sell: '45782.92640000'
}`,
    },
    bisqMarketsTradesModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();
  const market = "BTC_USD";

  const trades = await markets.getTrades({ market });
  console.log(trades);`,
          commonJS: `const { markets } = bisqJS();

        const market = "BTC_USD";

        const trades = await markets.getTrades({ market });
        console.log(trades);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/trades"`,
        },
        responseSample: `[
  {
    price: '56483.70620000',
    amount: '0.02000000',
    volume: '1129.67410000',
    payment_method: 'AMAZON_GIFT_CARD',
    trade_date: 1628619031777
  },
  ...
]`,
    },
    bisqMarketsVolumesModule: {
        codeSample: {
          esModule: `const { markets } = bisqJS();

  const market = "BTC_USD";
  const basecurrency = "BTC";

  const volumes = await markets.getVolumes({ basecurrency, market });`,
          commonJS: `const { markets } = bisqJS();

        const market = "BTC_USD";
        const basecurrency = "BTC";

        const volumes = await markets.getVolumes({ basecurrency, market });
        console.log(volumes);`,
          curl: `curl -X GET "https://bisq.markets/api/markets/volumes"`,
        },
        responseSample: `,
  {
    price: '40160.32250000',
    amount: '0.01000000',
    volume: '401.60320000',
    payment_method: 'AMAZON_GIFT_CARD',
    trade_date: 1628199923855
  },
  ...
]`,
    },
    bisqStatsModule: {
      codeSample: {
        esModule: `const { statistics } = bisqJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const stats = await statistics.getStats();
  console.log(stats);`,
        commonJS: `const { statistics } = bisqJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const stats = await statistics.getStats();
        console.log(stats);`,
        curl: `curl -X GET "https://mempool.space/api/stats"`,
      },
      responseSample: `[
  {
    period_start: 1609459200,
    open: '30448.18510000',
    close: '45717.81750000',
    high: '77700.00000000',
    low: '27500.00000000',
    avg: '44613.01158471',
    volume_right: '4923536.57150000',
    volume_left: '110.36100000'
  },
  ...
]`,
    },
    bisqTransactionModule: {
      codeSample: {
        esModule: `const { transactions } = bisqJS();
  const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

  const tx = await transactions.getTx({ txid });
  console.log(tx);`,
        commonJS: `const { transactions } = bisqJS();
        const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

        const tx = await transactions.getTx({ txid });
        console.log(tx);`,
        curl: `curl -X GET "https://mempool.space/api/tx/:txid"`,
      },
      responseSample: `{
  "txVersion":"1",
  "id":"4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5",
  "blockHeight":571747,
  "blockHash":"000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d",
  "time":1555340856000,
  "inputs": [ [Object], [Object] ],
  "outputs": [ [Object], [Object] ],
  "txType":"GENESIS",
  "txTypeDisplayString":"Genesis",
  "burntFee":0,
  "invalidatedBsq":0,
  "unlockBlockHeight":0
}`,
    },
    bisqTransactionsModule: {
      codeSample: {
        esModule: `const { transactions } = bisqJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);`,
        commonJS: `const { transactions } = bisqJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/api/txs/:index/:length"`,
      },
      responseSample: `[
  {
    txVersion: "1",
    id: "084e94afb67df0e6dff2e9ae6913d5ccb58f3b2dab0c4543a7c90c33b70c9bed",
    blockHeight: 685656,
    blockHash: "00000000000000000004c7046979024bd8e8f07389ca53f4f1d7dcf84eefdb21",
    time: 1622468887000,
    inputs: [ [Object], [Object] ],
    outputs: [ [Object], [Object], [Object] ],
    txType: "PAY_TRADE_FEE",
    txTypeDisplayString: "Pay trade fee",
    burntFee: 57,
    invalidatedBsq: 0,
    unlockBlockHeight: 0
  }
]`,
    },
  };

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.seoService.setTitle($localize`:@@e351b40b3869a5c7d19c3d4918cb1ac7aaab95c4:API`);
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.websocketService.want(['blocks']);

    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }

    this.network$.subscribe((network) => {
      this.active = (network === 'liquid') ? 1 : 0;
    });
  }

}
