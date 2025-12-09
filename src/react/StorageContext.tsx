import React, { createContext, useContext, ReactNode } from 'react';
import type { PersistedState } from '../core/persisted';

/**
 * Context for storing the persisted state instance
 */
export interface StorageContextValue<TSchema> {
  storage: PersistedState<TSchema>;
  initialized: boolean;
}

export const StorageContext = createContext<StorageContextValue<any> | null>(null);

/**
 * Props for StorageProvider
 */
export interface StorageProviderProps<TSchema> {
  storage: PersistedState<TSchema>;
  initialized?: boolean;
  children: ReactNode;
}

/**
 * Provider component that makes the storage instance available to all child components
 */
export function StorageProvider<TSchema>({
  storage,
  initialized = false,
  children,
}: StorageProviderProps<TSchema>) {
  const value: StorageContextValue<TSchema> = {
    storage,
    initialized,
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

/**
 * Hook to access the storage instance from context
 * @throws Error if used outside of StorageProvider
 */
export function useStorage<TSchema>(): PersistedState<TSchema> {
  const context = useContext(StorageContext);
  
  if (!context) {
    throw new Error(
      'useStorage must be used within a StorageProvider. ' +
      'Wrap your app with <StorageProvider storage={storage}>'
    );
  }

  return context.storage;
}

/**
 * Hook to check if storage is initialized
 */
export function useStorageInitialized(): boolean {
  const context = useContext(StorageContext);
  return context?.initialized ?? false;
}
