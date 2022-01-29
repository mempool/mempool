import mempoolJS from "./../../../../src/index";

const init = async () => {
  try {
    const {
      bitcoin: { difficulty },
    } = mempoolJS();
    
    const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
    console.log(difficultyAdjustment);
  } catch (error) {
    console.log(error);
  }
};
init();
