import * as moduleExports from './index';

describe('compliance package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
