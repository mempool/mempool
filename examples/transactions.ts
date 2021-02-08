import { transactions } from '../src/index';

const init = async () => {
  const txid =
    '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const tx = await transactions.getTx({ txid });
  console.log(tx);

  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);

  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);

  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);

  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({
    txid,
  });
  console.log(txMerkleBlockProof);

  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);

  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: 3,
  });
  console.log(txOutspend);

  const txOutspends = await transactions.getTxOutspends({ txid });
  console.log(txOutspends);

  const postTx = await transactions.postTx({ txid });
  console.log(postTx);
};
init();
