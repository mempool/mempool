import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bisq: { addresses },
  } = mempoolJS();

  const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
};
init();
