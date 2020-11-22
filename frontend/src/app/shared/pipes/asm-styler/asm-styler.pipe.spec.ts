import { AsmStylerPipe } from './asm-styler.pipe';

describe('OpcodesStylerPipe', () => {
  it('create an instance', () => {
    const pipe = new AsmStylerPipe();
    expect(pipe).toBeTruthy();
  });
});
