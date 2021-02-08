import { addresses } from '../src/index';

const init = async () => {
  const address =
    '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521';

  const addressTest = await addresses.getAddress({ address });
  console.log(addressTest);

  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);

  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);

  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);

  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
};
init();
