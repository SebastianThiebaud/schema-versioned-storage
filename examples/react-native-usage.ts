/**
 * React Native usage example for schema-versioned-storage
 * 
 * This example shows how to use the package in a React Native app
 * with AsyncStorage adapter.
 */

import { z } from 'zod';
import { createPersistedState } from '../src/index';
import { createAsyncStorageAdapter } from '../src/adapters/async-storage';

// 1. Define your schema
export const persistedSchema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(['system', 'light', 'dark']).default('system'),
    notifications: z.boolean().default(true),
  }),
  auth: z.object({
    token: z.string().optional(),
    userId: z.string().optional(),
  }),
});

export type PersistedSchema = z.infer<typeof persistedSchema>;

// 2. Define defaults
export function createDefaults(version: number): PersistedSchema {
  return {
    _version: version,
    preferences: {
      colorScheme: 'system',
      notifications: true,
    },
    auth: {
      token: undefined,
      userId: undefined,
    },
  };
}

// 3. Import migrations (if you have any)
// import { getMigrations, getCurrentSchemaVersion } from './migrations';
const migrations: any[] = [];
const getCurrentSchemaVersion = () => 1;

// 4. Schema hashes (normally auto-generated)
// import { SCHEMA_HASHES_BY_VERSION } from './schema-hashes';
const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
  1: 'example-hash-1',
};

// 5. Initialize storage
const storage = createPersistedState({
  schema: persistedSchema,
  defaults: createDefaults,
  storageKey: 'MY_APP_STATE',
  storage: createAsyncStorageAdapter(), // Use AsyncStorage for React Native
  migrations,
  getCurrentVersion: getCurrentSchemaVersion,
  schemaHashes: SCHEMA_HASHES_BY_VERSION,
});

// 6. Export for use in your app
export { storage };

// Example usage in a React component:
/*
import { storage } from './storage';
import { useEffect, useState } from 'react';

function MyComponent() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    storage.init().then(() => {
      setInitialized(true);
    });
  }, []);

  if (!initialized) {
    return <LoadingScreen />;
  }

  const colorScheme = storage.get('preferences').colorScheme;
  
  const handleColorSchemeChange = async (scheme: 'light' | 'dark' | 'system') => {
    await storage.set('preferences', {
      ...storage.get('preferences'),
      colorScheme: scheme,
    });
  };

  return (
    <View>
      <Text>Color Scheme: {colorScheme}</Text>
      <Button onPress={() => handleColorSchemeChange('dark')} title="Dark" />
    </View>
  );
}
*/

