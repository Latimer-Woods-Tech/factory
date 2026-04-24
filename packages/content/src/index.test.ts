import * as moduleExports from './index';

describe('content package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
