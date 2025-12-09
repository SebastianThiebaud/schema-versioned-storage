import type { StorageAdapter } from '../core/persisted';

/**
 * Create an AsyncStorage adapter for React Native
 * Requires @react-native-async-storage/async-storage as a peer dependency
 */
export function createAsyncStorageAdapter(): StorageAdapter {
  try {
    // Dynamic import to avoid bundling issues if not using React Native
    // Handle both v1.x (default export) and v2.x (default or named export) patterns
    const asyncStorageModule = require('@react-native-async-storage/async-storage');
    // Support both default export and direct export patterns
    const AsyncStorage = asyncStorageModule.default || asyncStorageModule;
    
    if (!AsyncStorage) {
      throw new Error('AsyncStorage is not available');
    }

    // Verify it has the required methods
    if (
      typeof AsyncStorage.getItem !== 'function' ||
      typeof AsyncStorage.setItem !== 'function' ||
      typeof AsyncStorage.removeItem !== 'function'
    ) {
      throw new Error('AsyncStorage does not have required methods');
    }

    return {
      async getItem(key: string): Promise<string | null> {
        try {
          return await AsyncStorage.getItem(key);
        } catch (error) {
          return null;
        }
      },
      async setItem(key: string, value: string): Promise<void> {
        try {
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          throw error;
        }
      },
      async removeItem(key: string): Promise<void> {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          throw error;
        }
      },
    };
  } catch (error) {
    throw new Error(
      'AsyncStorage adapter requires @react-native-async-storage/async-storage to be installed. ' +
        'Install it with: npm install @react-native-async-storage/async-storage'
    );
  }
}

