import mempoolJS from '../../../src/index';

const init = async () => {
  const {
    liquid: { assets },
  } = mempoolJS();

  const asset_id =
    '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';

  const asset = await assets.getAsset({ asset_id });
  console.log(asset);

  const assetTxs = await assets.getAssetTxs({ asset_id, is_mempool: false });
  console.log(assetTxs);

  const assetSupply = await assets.getAssetSupply({ asset_id, decimal: false });
  console.log(assetSupply);
};
init();
