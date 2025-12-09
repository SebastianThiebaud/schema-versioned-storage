import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
      };
    },
  },
  {
    entry: {
      'adapters/index': 'src/adapters/index.ts',
      'adapters/async-storage': 'src/adapters/async-storage.ts',
      'adapters/local-storage': 'src/adapters/local-storage.ts',
      'adapters/memory': 'src/adapters/memory.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
      };
    },
  },
  {
    entry: {
      'react/index': 'src/react/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
      };
    },
  },
]);

