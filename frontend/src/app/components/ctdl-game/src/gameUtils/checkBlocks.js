import { CTDLGAME } from './CTDLGAME';
import { setTextQueue, addTextToQueue } from '../textUtils';
import { playSound } from '../sounds';
import { textQueue } from '../textUtils/textQueue';

/**
 * @description Method to add a block to the inventory
 * @param {Object} block the block to add
 * @returns {void}
 */
const addBlockToInventory = block => {
  if (CTDLGAME.blockHeight >= block.height && block.height !== 0) return;

  if (textQueue.length === 0 || textQueue.some(text => !/Found a new block/.test(text))) {
    playSound('blockFound');
  }

  CTDLGAME.blockHeight = block.height;
  CTDLGAME.inventory.blocks.push({
    height: block.height,
    id: block.id,
    size: block.size,
    tx_count: block.tx_count
  });

  setTextQueue(textQueue.filter(text => !/Found a new block/i.test(text.text)));
  addTextToQueue(`Found a new block: ${block.height}`);
};

const feeMap = {
  '1': '#14756f',
  '2': '#167e78',
  '3': '#188780',
  '4': '#199089',
  '5': '#1b9992',
  '6': '#1ca29a',
  '8': '#1eaba3',
  '10': '#2aafa8',
  '12': '#36b4ad',
  '15': '#42b8b2',
  '20': '#4ebdb7',
  '30': '#5ac1bb',
  '40': '#66c6c0',
  '50': '#71cac5',
  '60': '#7dcfca',
  '70': '#89d3cf',
  '80': '#95d8d4',
  '90': '#a1dcd9',
  '100': '#ade0de', 
  'Infinity': '#b9e5e2'
};

const feeBuckets = Object.keys(feeMap)
  .filter(fee => fee !== 'more')
  .map(fee => Number(fee));

const mempoolDummy = {"count":38687,"vsize":83417040,"total_fee":336141760,"fee_histogram":{"1":{"color":"#14756f","feeBucket":1,"size":32443873},"2":{"color":"#167e78","feeBucket":2,"size":11472001},"3":{"color":"#188780","feeBucket":3,"size":9775463},"4":{"color":"#199089","feeBucket":4,"size":17477358},"5":{"color":"#1b9992","feeBucket":5,"size":7566486},"6":{"color":"#1ca29a","feeBucket":6,"size":394374},"8":{"color":"#1eaba3","feeBucket":8,"size":635365},"10":{"color":"#2aafa8","feeBucket":10,"size":479547},"12":{"color":"#36b4ad","feeBucket":12,"size":526769},"15":{"color":"#42b8b2","feeBucket":15,"size":290780},"20":{"color":"#4ebdb7","feeBucket":20,"size":265493},"30":{"color":"#5ac1bb","feeBucket":30,"size":568230},"40":{"color":"#66c6c0","feeBucket":40,"size":334703},"50":{"color":"#71cac5","feeBucket":50,"size":151070},"60":{"color":"#7dcfca","feeBucket":60,"size":207769},"70":{"color":"#89d3cf","feeBucket":70,"size":469104},"80":{"color":"#95d8d4","feeBucket":80,"size":150821},"90":{"color":"#a1dcd9","feeBucket":90,"size":106075},"Infinity":{"color":"#b9e5e2","feeBucket":null,"size":101759}}} // eslint-disable-line
const mempoolDummyEmpty = {"count":1,"vsize":2000000,"total_fee":1,"fee_histogram":{"1":{"color":"#14756f","feeBucket":1,"size":2000000}}} // eslint-disable-line

/**
 * @description Method to fetch new blocks from the blockchain
 * @param {Number} startHeight height to start from
 * @returns {void}
 */
export const checkBlocks = startHeight => {
  let url = 'https://blockstream.info/api/blocks/';

  if (typeof startHeight !== 'undefined' && startHeight !== null) url += startHeight;
  fetch(url, {
      method: 'GET',
      redirect: 'follow'
    })
    .then(response => response.json())
    .then(blocks => blocks.reverse().forEach(block => addBlockToInventory(block)))
    .catch(() => {});
};

/**
 * @description Method to fetch new blocks from the blockchain
 * @param {Number} startHeight height to start from
 * @returns {void}
 */
export const checkMempool = callback => {
  fetch('https://mempool.space/api/mempool', {
      method: 'GET',
      redirect: 'follow'
    })
    .then(response => response.json())
    .then(mempool => {
      CTDLGAME.mempool = mempool;
      CTDLGAME.mempool.fee_histogram = mempool.fee_histogram.reduce((h, val) => {
        const currentFee = Math.round(val[0]);
        const feeBucket = feeBuckets.find(fee => currentFee <= fee);
        const color = feeMap[feeBucket];
        if (!h[feeBucket]) h[feeBucket] = {color, feeBucket, size: 0};
        h[feeBucket].size += val[1];
        return h;
      }, {});
      if (callback) callback();
    })
    .catch(() => {
      CTDLGAME.mempool = mempoolDummy;
      if (callback) callback();
    });
    fetch('https://mempool.space/api/v1/fees/recommended', {
      method: 'GET',
      redirect: 'follow'
    })
    .then(response => response.json())
    .then(recommendedFees => {
      CTDLGAME.recommendedFees = recommendedFees;
    })
    .catch(() => {
      CTDLGAME.recommendedFees = null;
    });
  };

