import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLocalStorageAdapter } from '../../src/adapters/local-storage';

describe('LocalStorageAdapter', () => {
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Mock window and localStorage
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: mockLocalStorage,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    delete global.window;
  });

  it('should throw error when localStorage is not available', () => {
    // @ts-ignore
    delete global.window;
    
    expect(() => createLocalStorageAdapter()).toThrow(
      'localStorage is not available in this environment'
    );
  });

  it('should throw error when window.localStorage is not available', () => {
    Object.defineProperty(global, 'window', {
      value: {},
      writable: true,
      configurable: true,
    });
    
    expect(() => createLocalStorageAdapter()).toThrow(
      'localStorage is not available in this environment'
    );
  });

  it('should store and retrieve values', async () => {
    mockLocalStorage.getItem.mockReturnValue('test-value');
    
    const adapter = createLocalStorageAdapter();
    await adapter.setItem('test-key', 'test-value');
    const value = await adapter.getItem('test-key');
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
    expect(value).toBe('test-value');
  });

  it('should return null for non-existent keys', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    
    const adapter = createLocalStorageAdapter();
    const value = await adapter.getItem('non-existent');
    
    expect(value).toBeNull();
  });

  it('should remove items', async () => {
    const storage: Record<string, string> = {};
    mockLocalStorage.getItem.mockImplementation((key: string) => storage[key] || null);
    mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });
    mockLocalStorage.removeItem.mockImplementation((key: string) => {
      delete storage[key];
    });
    
    // Re-create adapter after setting up mocks
    const adapter = createLocalStorageAdapter();
    await adapter.setItem('test-key', 'test-value');
    expect(storage['test-key']).toBe('test-value');
    await adapter.removeItem('test-key');
    const value = await adapter.getItem('test-key');
    
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
    expect(value).toBeNull();
  });

  it('should handle multiple keys', async () => {
    mockLocalStorage.getItem
      .mockReturnValueOnce('value1')
      .mockReturnValueOnce('value2');
    
    const adapter = createLocalStorageAdapter();
    await adapter.setItem('key1', 'value1');
    await adapter.setItem('key2', 'value2');
    
    expect(await adapter.getItem('key1')).toBe('value1');
    expect(await adapter.getItem('key2')).toBe('value2');
  });

  it('should overwrite existing values', async () => {
    mockLocalStorage.getItem.mockReturnValue('value2');
    
    const adapter = createLocalStorageAdapter();
    await adapter.setItem('test-key', 'value1');
    await adapter.setItem('test-key', 'value2');
    const value = await adapter.getItem('test-key');
    
    expect(value).toBe('value2');
  });

  it('should handle errors in getItem', async () => {
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    
    const adapter = createLocalStorageAdapter();
    const value = await adapter.getItem('test-key');
    
    expect(value).toBeNull();
  });

  it('should handle errors in setItem', async () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    
    const adapter = createLocalStorageAdapter();
    
    await expect(adapter.setItem('test-key', 'test-value')).rejects.toThrow('QuotaExceededError');
  });

  it('should handle errors in removeItem', async () => {
    mockLocalStorage.removeItem.mockImplementation(() => {
      throw new Error('Storage error');
    });
    
    const adapter = createLocalStorageAdapter();
    
    // removeItem doesn't throw (non-critical operation)
    await adapter.removeItem('test-key');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
  });
});
