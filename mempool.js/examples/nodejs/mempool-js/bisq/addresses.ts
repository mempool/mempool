import mempoolJS from "./../../../../src/index";

const init = async () => {
  try {
    const {
      bisq: { addresses },
    } = mempoolJS();
    
    const address = 'B1DgwRN92rdQ9xpEVCdXRfgeqGw9X4YtrZz';
    
    const myAddress = await addresses.getAddress({ address });
    console.log(myAddress);
  } catch (error) {
    console.log(error);
  }
};
init();
