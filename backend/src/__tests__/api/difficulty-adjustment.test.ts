import {
  calcBitsDifference,
  calcDifficultyAdjustment,
  DifficultyAdjustment,
} from '../../api/difficulty-adjustment';

describe('Mempool Difficulty Adjustment', () => {
  test('should calculate Difficulty Adjustments properly', () => {
    const dt = (dtString) => {
      return Math.floor(new Date(dtString).getTime() / 1000);
    };

    const vectors = [
      [ // Vector 1 (normal adjustment)
        [ // Inputs
          dt('2024-02-02T15:42:06.000Z'), // Last DA time (in seconds)
          dt('2024-02-08T14:43:05.000Z'), // timestamp of 504 blocks ago (in seconds)
          dt('2024-02-11T22:43:01.000Z'), // Current time (now) (in seconds)
          830027,                         // Current block height
          7.333505241141637,             // Previous retarget % (Passed through)
          'mainnet',                      // Network (if testnet, next value is non-zero)
          0,                              // Latest block timestamp in seconds (only used if difficulty already locked in)
        ],
        { // Expected Result
          progressPercent: 71.97420634920636,
          difficultyChange: 8.512745140778843,
          estimatedRetargetDate: 1708004001715,
          remainingBlocks: 565,
          remainingTime: 312620715,
          previousRetarget: 7.333505241141637,
          previousTime: 1706888526,
          nextRetargetHeight: 830592,
          timeAvg: 553311,
          adjustedTimeAvg: 553311,
          timeOffset: 0,
          expectedBlocks: 1338.0916666666667,
        },
      ],
      [ // Vector 2 (within quarter-epoch overlap)
        [ // Inputs
          dt('2022-08-18T11:07:00.000Z'), // Last DA time (in seconds)
          dt('2022-08-16T03:16:54.000Z'), // timestamp of 504 blocks ago (in seconds)
          dt('2022-08-19T14:03:53.000Z'), // Current time (now) (in seconds)
          750134,                         // Current block height
          0.6280047707459726,             // Previous retarget % (Passed through)
          'mainnet',                      // Network (if testnet, next value is non-zero)
          0,                              // Latest block timestamp in seconds (only used if difficulty already locked in)
        ],
        { // Expected Result
          progressPercent: 9.027777777777777,
          difficultyChange: 1.0420538959004633,
          estimatedRetargetDate: 1662009048328,
          remainingBlocks: 1834,
          remainingTime: 1091215328,
          previousRetarget: 0.6280047707459726,
          previousTime: 1660820820,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          adjustedTimeAvg: 594992,
          timeOffset: 0,
          expectedBlocks: 161.68833333333333,
        },
      ],
      [ // Vector 3 (testnet)
        [ // Inputs
          dt('2022-08-18T11:07:00.000Z'), // Last DA time (in seconds)
          dt('2022-08-16T03:16:54.000Z'), // timestamp of 504 blocks ago (in seconds)
          dt('2022-08-19T14:03:53.000Z'), // Current time (now) (in seconds)
          750134,                         // Current block height
          0.6280047707459726,             // Previous retarget % (Passed through)
          'testnet',                      // Network
          dt('2022-08-19T13:52:46.000Z'), // Latest block timestamp in seconds
        ],
        { // Expected Result is same other than timeOffset
          progressPercent: 9.027777777777777,
          difficultyChange: 1.0420538959004633,
          estimatedRetargetDate: 1662009048328,
          remainingBlocks: 1834,
          remainingTime: 1091215328,
          previousTime: 1660820820,
          previousRetarget: 0.6280047707459726,
          nextRetargetHeight: 751968,
          timeAvg: 533038,
          adjustedTimeAvg: 594992,
          timeOffset: -667000, // 11 min 7 seconds since last block (testnet only)
          // If we add time avg to abs(timeOffset) it makes exactly 1200000 ms, or 20 minutes
          expectedBlocks: 161.68833333333333,
        },
      ],
      [ // Vector 4 (mainnet lock-in (epoch ending 788255))
        [ // Inputs
          dt('2023-04-20T09:57:33.000Z'), // Last DA time (in seconds)
          dt('2022-08-16T03:16:54.000Z'), // timestamp of 504 blocks ago (in seconds)
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
          adjustedTimeAvg: 609129,
          timeOffset: 0,
          expectedBlocks: 2045.66,
        },
      ],
    ] as [[number, number, number, number, number, string, number], DifficultyAdjustment][];

    for (const vector of vectors) {
      const result = calcDifficultyAdjustment(...vector[0]);
      // previousRetarget is passed through untouched
      expect(result.previousRetarget).toStrictEqual(vector[0][4]);
      expect(result).toStrictEqual(vector[1]);
    }
  });

  test('should calculate Difficulty change from bits fields of two blocks', () => {
    // Check same exponent + check min max for output
    expect(calcBitsDifference(0x1d000200, 0x1d000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000400, 0x1d000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000800, 0x1d000100)).toEqual(300); // Actually 700
    expect(calcBitsDifference(0x1d000100, 0x1d000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000100, 0x1d000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000100, 0x1d000800)).toEqual(-75); // Actually -87.5
    // Check new higher exponent
    expect(calcBitsDifference(0x1c000200, 0x1d000001)).toEqual(100);
    expect(calcBitsDifference(0x1c000400, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000800, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000100, 0x1d000002)).toEqual(-50);
    expect(calcBitsDifference(0x1c000100, 0x1d000004)).toEqual(-75);
    expect(calcBitsDifference(0x1c000100, 0x1d000008)).toEqual(-75);
    // Check new lower exponent
    expect(calcBitsDifference(0x1d000002, 0x1c000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000004, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000008, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000001, 0x1c000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000001, 0x1c000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000001, 0x1c000800)).toEqual(-75);
    // Check error when exponents are too far apart
    expect(() => calcBitsDifference(0x1d000001, 0x1a000800)).toThrow(
      /Impossible exponent difference/
    );
    // Check invalid inputs
    expect(() => calcBitsDifference(0x7f000001, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(100.2783, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x00800000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x1c000000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
  });
});
