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
          0,                              // Latest block timestamp in seconds (only used if difficulty already locked in)
        ],
        { // Expected Result
          progressPercent: 9.027777777777777,
          difficultyChange: 13.180707740199772,
          estimatedRetargetDate: 1661895424692,
          remainingBlocks: 1834,
          remainingTime: 977591692,
          previousRetarget: 0.6280047707459726,
          previousTime: 1660820820,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          timeOffset: 0,
          expectedBlocks: 161.68833333333333,
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
          difficultyChange: 13.180707740199772,
          estimatedRetargetDate: 1661895424692,
          remainingBlocks: 1834,
          remainingTime: 977591692,
          previousTime: 1660820820,
          previousRetarget: 0.6280047707459726,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          timeOffset: -667000, // 11 min 7 seconds since last block (testnet only)
          // If we add time avg to abs(timeOffset) it makes exactly 1200000 ms, or 20 minutes
          expectedBlocks: 161.68833333333333,
        },
      ],
      [ // Vector 3 (mainnet lock-in (epoch ending 788255))
        [ // Inputs
          dt('2023-04-20T09:57:33.000Z'), // Last DA time (in seconds)
          dt('2023-05-04T14:54:09.000Z'), // Current time (now) (in seconds)
          788255,                         // Current block height
          1.7220298879531821,             // Previous retarget % (Passed through)
          'mainnet',                      // Network (if testnet, next value is non-zero)
          dt('2023-05-04T14:54:26.000Z'), // Latest block timestamp in seconds
        ],
        { // Expected Result
          progressPercent: 99.95039682539682,
          difficultyChange: -1.4512637555574193,
          estimatedRetargetDate: 1683212658129,
          remainingBlocks: 1,
          remainingTime: 609129,
          previousRetarget: 1.7220298879531821,
          previousTime: 1681984653,
          nextRetargetHeight: 788256,
          timeAvg: 609129,
          timeOffset: 0,
          expectedBlocks: 2045.66,
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
