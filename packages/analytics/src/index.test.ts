import { describe, expect, it } from 'vitest';

import * as moduleExports from './index';

describe('analytics package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
