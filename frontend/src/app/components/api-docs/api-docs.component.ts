import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
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

  code = {
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
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    mempool: {
      codeSample: {
        esModule: `const { %{1}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);`,
        commonJS: `const { %{1}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();
        console.log(getMempool);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
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
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    addressTransactionsMempool: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
        console.log(addressTxsMempool);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    addressUTXO: {
      codeSample: {
        esModule: `const { %{1}: { addresses } } = mempoolJS();
  const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
`,
        commonJS: `const { %{1}: { addresses } } = mempoolJS();
        const address = '1wizSAYSbuyXbt9d8JV8ytm5acqq2TorC';

        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
        console.log(addressTxsUtxo);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqAddress: {
      codeSample: {
        esModule: `const { bisq: { addresses } } = mempoolJS();
  const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
`,
        commonJS: `const { bisq: { addresses } } = mempoolJS();
        const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

        const myAddress = await addresses.getAddress({ address });
        console.log(myAddress);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqBlock: {
      codeSample: {
        esModule: `const { bisq: { blocks } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const block = await blocks.getBlock({ hash });
  console.log(block);
`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const block = await blocks.getBlock({ hash });
        console.log(block);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
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
  console.log(myBlocksHeight);
`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const myBlocksHeight = await blocks.getBlocksTipHeight({
          index: 0,
          length: 1,
        });
        console.log(myBlocksHeight);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqBlockIndex: {
      codeSample: {
        esModule: `const { bisq: { blocks } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
  console.log(myBlocks);
`,
        commonJS: `const { bisq: { blocks } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
        console.log(myBlocks);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqStats: {
      codeSample: {
        esModule: `const { bisq: { statistics } } = mempoolJS();
  const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const stats = await statistics.getStats();
  console.log(stats);
`,
        commonJS: `const { bisq: { statistics } } = mempoolJS();
        const hash = '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

        const stats = await statistics.getStats();
        console.log(stats);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqTransaction: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();
  const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

  const tx = await transactions.getTx({ txid });
  console.log(tx);
`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();
        const txid = '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5';

        const tx = await transactions.getTx({ txid });
        console.log(tx);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    bisqTransactions: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);
`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    assets: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);
`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    assetTransactions: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);
`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    },
    assetSupply: {
      codeSample: {
        esModule: `const { bisq: { transactions } } = mempoolJS();

  const txs = await transactions.getTxs({ index: 0, length: 1 });
  console.log(txs);
`,
        commonJS: `const { bisq: { transactions } } = mempoolJS();

        const txs = await transactions.getTxs({ index: 0, length: 1 });
        console.log(txs);`,
        curl: `curl -X GET "https://mempool.space/"`,
      },
      responseSample: `{
  fastestFee: 88,
  halfHourFee: 49,
  hourFee: 29,
  minimumFee: 1
}`,
    }
  };

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@e351b40b3869a5c7d19c3d4918cb1ac7aaab95c4:API`);
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.websocketService.want(['blocks']);

    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }

}
