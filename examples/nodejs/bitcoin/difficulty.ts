import mempoolJS from "@mempool/mempool.js";

const init = async () => {
  const {
    bitcoin: { difficulty },
  } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);
};
init();
