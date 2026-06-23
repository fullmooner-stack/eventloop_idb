# EventLoop_idb

> The Fastest IndexedDB wrapper out there.

A fast, simple, zero-dependency single-file wrapper driven by an asynchronous micro-task event loop. Groups reads, writes, and deletes into controlled transactional batches — eliminating write-amplification, context switching, and transaction thrashing.

[![npm version](https://img.shields.io/npm/v/eventloop_idb.svg?style=flat-square)](https://www.npmjs.com/package/eventloop_idb)
[![license](https://img.shields.io/npm/l/eventloop_idb.svg?style=flat-square)](LICENSE)

```bash
npm i eventloop_idb
```

## Performance

<img width="1572" height="703" alt="Benchmark" src="https://github.com/user-attachments/assets/a8609e08-be2d-4246-bf31-cc2b644dee1f" />

Compare against other IndexedDB wrappers at [idbwrappersbenchmark.vercel.app](https://idbwrappersbenchmark.vercel.app/)

---

## Usage

### Vanilla

```javascript
import { EventLoop_idb } from 'eventloop_idb';

const db = new EventLoop_idb('my-store');

db.write('theme', () => ({ mode: 'dark', accent: '#00ffcc' }), (ok) => {
  if (ok) console.log('saved');
});

db.read('theme', (data) => {
  console.log(data);
});
```

### TypeScript

```typescript
import { EventLoop_idb } from 'eventloop_idb';

interface AppConfig {
  mode: 'dark' | 'light';
  accent: string;
}

const db = new EventLoop_idb('my-store');

db.read('theme', (data: AppConfig | undefined) => {
  if (data) console.log(data.mode);
});
```

### React

```javascript
import { useState, useEffect } from 'react';
import { EventLoop_idb } from 'eventloop_idb';

const db = new EventLoop_idb('my-store');

export function App() {
  const [ready, setReady] = useState(db.readyFlag);
  const [data, setData] = useState(null);

  useEffect(() => {
    setReady(db.readyFlag);

    const onState = (r) => setReady(r);
    db.onReadyStateChangeClbs.add(onState);
    db.read('profile', setData);

    return () => db.onReadyStateChangeClbs.delete(onState);
  }, []);

  return (
    <div>
      <p>{ready ? '🟢 Connected' : '⚪ Connecting...'}</p>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

### SolidJS

```javascript
import { createSignal, onMount, onCleanup } from 'solid-js';
import { EventLoop_idb } from 'eventloop_idb';

const db = new EventLoop_idb('my-store');

export function App() {
  const [ready, setReady] = createSignal(db.readyFlag);
  const [items, setItems] = createSignal([]);

  onMount(() => {
    setReady(db.readyFlag);
    db.onReadyStateChangeClbs.add(setReady);
    db.getAll(setItems);
    onCleanup(() => db.onReadyStateChangeClbs.delete(setReady));
  });

  return <p>{ready() ? '🟢 Connected' : '⚪ Connecting...'} — {items().length} records</p>;
}
```

---

## Reactive State

`EventLoop_idb` exposes raw `Set`-based callback collections. Sets do not self-execute on subscription, so always sync the current value before subscribing.

```javascript
// Sync current state first
let isConnected = db.readyFlag;

// Then subscribe to future changes
const track = (v) => (isConnected = v);
db.onReadyStateChangeClbs.add(track);

// Unsubscribe
db.onReadyStateChangeClbs.delete(track);

// Or clear all listeners at once
db.onReadyStateChangeClbs.clear();
```

Subscribe to queue idle cycles (fires after each transaction batch completes):

```javascript
const onIdle = () => console.log('batch done');
db.onIdleClbs.add(onIdle);
db.onIdleClbs.delete(onIdle);
```

---

## API

### Constructor

```typescript
new EventLoop_idb(name: string)
```

### Properties

| Property | Type | Description |
|---|---|---|
| `name` | `string` | The namespace identifier of the store |
| `db` | `IDBDatabase` | Direct access to the raw native IDB instance |
| `readyFlag` | `boolean` | `true` when open and ready |
| `readyState` | `string` | `'done'` · `'blocked'` · `'closed'` · `'unexpectedly closed'` · `'close'` |
| `onReadyStateChangeClbs` | `Set<(v: boolean) => void>` | Fires on every connection state change |
| `onIdleClbs` | `Set<() => void>` | Fires when the transaction batch goes idle |

### Methods

```typescript
read(id: string, clb: (res: any) => void): void
```
Enqueues a read.

```typescript
write(id: string, data: (id: string) => any, clb?: (ok: boolean) => void): void
```
Enqueues a write. Receives a data builder callback.

```typescript
delete(id: string, clb?: (ok: boolean) => void): void
```
Enqueues a deletion.

```typescript
clear(clb?: (ok: boolean) => void): void
```
Flushes all records from the store.

```typescript
getAllKeys(clb: (keys: string[]) => void, range?: IDBKeyRange, count?: number): void
```
Collects all matching keys.

```typescript
getAll(clb: (items: any[]) => void, range?: IDBKeyRange, count?: number): void
```
Fetches all matching records.

---

## License

MIT
