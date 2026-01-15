# @sebastianthiebaud/schema-versioned-storage

Stop breaking persisted data when your schema changes.

**Type-safe, versioned persisted state with deterministic migrations** for **localStorage (Web)**, **AsyncStorage (React Native)**, or custom adapters — powered by **TypeScript + Zod**.

---

## Why this exists

Persisted state is easy… until your schema changes.

At that point, most apps:
- delete user data
- add fragile try/catch logic
- ship breaking updates

This library gives you a **safe, explicit, type-checked way to evolve persisted data over time**.

---

## 20-second Quick Start

```ts
import { z } from "zod";
import { createPersistedState } from "@sebastianthiebaud/schema-versioned-storage";
import { createLocalStorageAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/local-storage";

const schema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(["system", "light", "dark"]),
  }).default({ colorScheme: "system" }),
});

const storage = createPersistedState({
  schema,
  storageKey: "MY_APP_STATE",
  storage: createLocalStorageAdapter(),
  migrations: [],
  getCurrentVersion: () => 1,
  schemaHashes: { 1: "hash" },
});

await storage.init();

await storage.set("preferences", { colorScheme: "dark" });
const theme = storage.get("preferences").colorScheme;
```

---

## Features

- 🔒 Type-safe — full TypeScript inference and autocomplete
- 🔄 Automatic migrations — deterministic, versioned upgrades
- 🧩 Schema validation — powered by Zod
- 💾 Storage-agnostic — Web, React Native, tests, or custom adapters
- 🧪 Test-friendly — in-memory adapter included
- 📦 Minimal dependencies — only Zod
- 🌳 Tree-shakeable — ESM-first, CJS supported

---

## Documentation

📖 **[Full Documentation](./DOCS.md)** — Complete API reference, migration guides, advanced patterns, and more.

---

## Installation

```bash
npm install @sebastianthiebaud/schema-versioned-storage
```

Zod is installed automatically.

### React Native (optional)

Only needed if you're using the AsyncStorage adapter:

```bash
npm install @react-native-async-storage/async-storage
```

---

## License

MIT
