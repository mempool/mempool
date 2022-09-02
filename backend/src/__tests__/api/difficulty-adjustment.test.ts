import { calcDifficultyAdjustment, DifficultyAdjustment } from '../../api/difficulty-adjustment';

describe('Mempool Difficulty Adjustment', () => {
  test('should calculate Difficulty Adjustments properly', () => {
    const dt = (dtString) => {
      return Math.floor(new Date(dtString).getTime() / 1000);
    };

    const vectors = [
      [ // Vector 1
        [ // Inputs
          dt('2022-08-18T11:07:00.000Z'), // Last DA time (in seconds)
          dt('2022-08-19T14:03:53.000Z'), // Current time (now) (in seconds)
          750134,                         // Current block height
          0.6280047707459726,             // Previous retarget % (Passed through)
          'mainnet',                      // Network (if testnet, next value is non-zero)
          0,                              // If not testnet, not used
        ],
        { // Expected Result
          progressPercent: 9.027777777777777,
          difficultyChange: 12.562233927411782,
          estimatedRetargetDate: 1661895424692,
          remainingBlocks: 1834,
          remainingTime: 977591692,
          previousRetarget: 0.6280047707459726,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          timeOffset: 0,
        },
      ],
      [ // Vector 2 (testnet)
        [ // Inputs
          dt('2022-08-18T11:07:00.000Z'), // Last DA time (in seconds)
          dt('2022-08-19T14:03:53.000Z'), // Current time (now) (in seconds)
          750134,                         // Current block height
          0.6280047707459726,             // Previous retarget % (Passed through)
          'testnet',                      // Network
          dt('2022-08-19T13:52:46.000Z'), // Latest block timestamp in seconds
        ],
        { // Expected Result is same other than timeOffset
          progressPercent: 9.027777777777777,
          difficultyChange: 12.562233927411782,
          estimatedRetargetDate: 1661895424692,
          remainingBlocks: 1834,
          remainingTime: 977591692,
          previousRetarget: 0.6280047707459726,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          timeOffset: -667000, // 11 min 7 seconds since last block (testnet only)
          // If we add time avg to abs(timeOffset) it makes exactly 1200000 ms, or 20 minutes
        },
      ],
    ] as [[number, number, number, number, string, number], DifficultyAdjustment][];

    for (const vector of vectors) {
      const result = calcDifficultyAdjustment(...vector[0]);
      // previousRetarget is passed through untouched
      expect(result.previousRetarget).toStrictEqual(vector[0][3]);
      expect(result).toStrictEqual(vector[1]);
    }
  });
});
