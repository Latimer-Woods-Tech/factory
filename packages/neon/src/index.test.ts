import * as moduleExports from './index';

describe('neon package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
