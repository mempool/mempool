import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bisq: { blocks },
  } = mempoolJS();

  const hash =
    '000000000000000000079aa6bfa46eb8fc20474e8673d6e8a123b211236bf82d';

  const block = await blocks.getBlock({ hash });
  console.log(block);

  const myBlocks = await blocks.getBlocks({ index: 0, length: 1 });
  console.log(myBlocks);

  const myBlocksHeight = await blocks.getBlocksTipHeight({
    index: 0,
    length: 1,
  });
  console.log(myBlocksHeight);
};
init();
