import { FeeRoundingPipe } from './fee-rounding.pipe';

describe('FeeRoundingPipe', () => {
  it('create an instance', () => {
    const pipe = new FeeRoundingPipe();
    expect(pipe).toBeTruthy();
  });
});
