import * as moduleExports from './index';

describe('telephony package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
