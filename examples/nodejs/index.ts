import mempoolJS from "@mempool/mempool.js";

const init = async () => {
    const { bitcoin } = mempoolJS({
        hostname:'mempool.ninja'
    });
    
    const feesRecommended = await bitcoin.fees.getFeesRecommended();
    console.log(feesRecommended);

    const hash = "0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2";
    const block = await bitcoin.blocks.getBlockHeader({hash});

    console.log(block);
};

init();