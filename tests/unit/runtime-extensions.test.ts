import {
  createContext,
  EarlyReturnError,
  getExtensionsState,
  isEarlyReturn,
  resetExtensionsState,
} from '../../src/context.js';

describe('runtime.earlyReturn()', () => {
  it('should throw EarlyReturnError when called', () => {
    const ctx = createContext({ arguments: {} });

    expect(() => ctx.runtime.earlyReturn('test data')).toThrow(EarlyReturnError);
  });

  it('should include data in EarlyReturnError', () => {
    const ctx = createContext({ arguments: {} });
    const testData = { userId: '123', name: 'Test' };

    try {
      ctx.runtime.earlyReturn(testData);
    } catch (error) {
      expect(isEarlyReturn(error)).toBe(true);
      expect((error as EarlyReturnError).data).toEqual(testData);
    }
  });

  it('should work with undefined data', () => {
    const ctx = createContext({ arguments: {} });

    try {
      ctx.runtime.earlyReturn();
    } catch (error) {
      expect(isEarlyReturn(error)).toBe(true);
      expect((error as EarlyReturnError).data).toBeUndefined();
    }
  });

  it('should have isEarlyReturn flag', () => {
    const ctx = createContext({ arguments: {} });

    try {
      ctx.runtime.earlyReturn('data');
    } catch (error) {
      expect((error as EarlyReturnError).isEarlyReturn).toBe(true);
    }
  });
});

describe('isEarlyReturn()', () => {
  it('should return true for EarlyReturnError', () => {
    const error = new EarlyReturnError('test');
    expect(isEarlyReturn(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('regular error');
    expect(isEarlyReturn(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isEarlyReturn(null)).toBe(false);
    expect(isEarlyReturn(undefined)).toBe(false);
    expect(isEarlyReturn('string')).toBe(false);
    expect(isEarlyReturn(123)).toBe(false);
  });
});

describe('extensions.setSubscriptionFilter()', () => {
  beforeEach(() => {
    resetExtensionsState();
  });

  it('should store subscription filter', () => {
    const ctx = createContext({ arguments: {} });
    const filter = { userId: { eq: '123' } };

    ctx.extensions.setSubscriptionFilter(filter);

    const state = getExtensionsState();
    expect(state.subscriptionFilters).toHaveLength(1);
    expect(state.subscriptionFilters[0]).toEqual(filter);
  });

  it('should store multiple filters', () => {
    const ctx = createContext({ arguments: {} });

    ctx.extensions.setSubscriptionFilter({ field1: { eq: 'a' } });
    ctx.extensions.setSubscriptionFilter({ field2: { eq: 'b' } });

    const state = getExtensionsState();
    expect(state.subscriptionFilters).toHaveLength(2);
  });

  it('should accept array of filters', () => {
    const ctx = createContext({ arguments: {} });
    const filters = [{ field1: { eq: 'a' } }, { field2: { ne: 'b' } }] as const;

    // @ts-expect-error - testing runtime behavior with array
    ctx.extensions.setSubscriptionFilter(filters);

    const state = getExtensionsState();
    expect(state.subscriptionFilters[0]).toEqual(filters);
  });
});

describe('extensions.invalidateSubscriptions()', () => {
  beforeEach(() => {
    resetExtensionsState();
  });

  it('should store invalidation config', () => {
    const ctx = createContext({ arguments: {} });
    const config = {
      subscriptionField: 'onUserUpdate',
      payload: { userId: '123' },
    };

    ctx.extensions.invalidateSubscriptions(config);

    const state = getExtensionsState();
    expect(state.invalidations).toHaveLength(1);
    expect(state.invalidations[0]).toEqual(config);
  });

  it('should allow up to 5 invalidations', () => {
    const ctx = createContext({ arguments: {} });

    for (let i = 0; i < 5; i++) {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: `field${i}`,
        payload: { id: i },
      });
    }

    const state = getExtensionsState();
    expect(state.invalidations).toHaveLength(5);
  });

  it('should throw error on 6th invalidation', () => {
    const ctx = createContext({ arguments: {} });

    for (let i = 0; i < 5; i++) {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: `field${i}`,
        payload: { id: i },
      });
    }

    expect(() =>
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: 'field6',
        payload: { id: 6 },
      })
    ).toThrow('Cannot call invalidateSubscriptions more than 5 times per request');
  });
});

describe('extensions.evictFromApiCache()', () => {
  beforeEach(() => {
    resetExtensionsState();
  });

  it('should store cache eviction', () => {
    const ctx = createContext({ arguments: {} });

    ctx.extensions.evictFromApiCache('Query', 'getUser', { id: '123' });

    const state = getExtensionsState();
    expect(state.cacheEvictions).toHaveLength(1);
    expect(state.cacheEvictions[0]).toEqual({
      typeName: 'Query',
      fieldName: 'getUser',
      keys: { id: '123' },
    });
  });

  it('should store multiple evictions', () => {
    const ctx = createContext({ arguments: {} });

    ctx.extensions.evictFromApiCache('Query', 'getUser', { id: '1' });
    ctx.extensions.evictFromApiCache('Query', 'getUser', { id: '2' });

    const state = getExtensionsState();
    expect(state.cacheEvictions).toHaveLength(2);
  });
});

describe('extensions.setSubscriptionInvalidationFilter()', () => {
  beforeEach(() => {
    resetExtensionsState();
  });

  it('should store invalidation filter', () => {
    const ctx = createContext({ arguments: {} });
    const filter = { groupId: { eq: 'admin' } };

    ctx.extensions.setSubscriptionInvalidationFilter(filter);

    const state = getExtensionsState();
    expect(state.subscriptionInvalidationFilters).toHaveLength(1);
    expect(state.subscriptionInvalidationFilters[0]).toEqual(filter);
  });
});

describe('resetExtensionsState()', () => {
  it('should clear all extensions state', () => {
    const ctx = createContext({ arguments: {} });

    ctx.extensions.setSubscriptionFilter({ field: { eq: 'value' } });
    ctx.extensions.invalidateSubscriptions({
      subscriptionField: 'test',
      payload: {},
    });
    ctx.extensions.evictFromApiCache('Query', 'field', { id: '1' });

    resetExtensionsState();

    const state = getExtensionsState();
    expect(state.subscriptionFilters).toHaveLength(0);
    expect(state.invalidations).toHaveLength(0);
    expect(state.cacheEvictions).toHaveLength(0);
  });
});
