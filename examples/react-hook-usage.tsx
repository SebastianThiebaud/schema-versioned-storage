/**
 * React hook usage example for schema-versioned-storage
 *
 * This example shows how to use the StorageProvider and useStorage hook
 * in a React application.
 */

import React, { useEffect, useState } from 'react';
import { createPersistedState } from '../src/index';
import { createAsyncStorageAdapter } from '../src/adapters/async-storage';
import { StorageProvider, useStorage, useStorageInitialized } from '../src/react';
import { z } from 'zod';

// 1. Define your schema
const persistedSchema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(['system', 'light', 'dark']).default('system'),
    language: z.string().default('en'),
  }),
});

type PersistedSchema = z.infer<typeof persistedSchema>;

// 2. Create storage instance
const storage = createPersistedState({
  schema: persistedSchema,
  defaults: (version): PersistedSchema => ({
    _version: version,
    preferences: {
      colorScheme: 'system' as const,
      language: 'en',
    },
  }),
  storageKey: 'MY_APP_STATE',
  storage: createAsyncStorageAdapter(),
  migrations: [],
  getCurrentVersion: () => 1,
  schemaHashes: { 1: 'example-hash' },
});

// 3. Initialize storage and wrap app with provider
function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    storage.init().then(() => {
      setInitialized(true);
    });
  }, []);

  // Wrap with provider immediately - children can check initialization status
  return (
    <StorageProvider storage={storage} initialized={initialized}>
      <MyComponent />
    </StorageProvider>
  );
}

// 4. Use the hook in any component
function MyComponent() {
  const storage = useStorage<PersistedSchema>();
  const isInitialized = useStorageInitialized();

  // Show loading state if storage isn't initialized yet
  if (!isInitialized) {
    return <div>Loading storage...</div>;
  }

  // Access values - you can use either pattern:
  // Method-based: storage.get('preferences').colorScheme
  // Property-based: storage.getAll().preferences.colorScheme
  const { preferences } = storage.getAll();
  const colorScheme = preferences.colorScheme;
  const language = preferences.language;

  const handleColorSchemeChange = async (scheme: 'light' | 'dark' | 'system') => {
    await storage.set('preferences', {
      ...storage.get('preferences'),
      colorScheme: scheme,
    });
  };

  return (
    <div>
      <p>Color Scheme: {colorScheme}</p>
      <p>Language: {language}</p>
      <button onClick={() => handleColorSchemeChange('dark')}>Dark</button>
      <button onClick={() => handleColorSchemeChange('light')}>Light</button>
    </div>
  );
}

export default App;
