import bisqJS from "./../../../src/index-bisq";

const init = async () => {
  const { addresses } = bisqJS();

  const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';

  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
};
init();
