import { describe, expect, it } from 'vitest';

import * as moduleExports from './index';

describe('seo package scaffold', () => {
  it('exports a module object', () => {
    expect(moduleExports).toBeTypeOf('object');
  });
});
