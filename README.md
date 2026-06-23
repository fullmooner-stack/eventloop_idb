# EventLoop_idb

> The Fastest IndexedDB wrapper out there.

A fast, simple, single file, zero-dependency wrapper driven by an asynchronous micro-task event loop. Groups reads, writes, and deletes into controlled transactional batches — eliminating write-amplification, context switching, and transaction thrashing.

[![npm version](https://img.shields.io/npm/v/eventloop_idb.svg?style=flat-square)](https://www.npmjs.com/package/eventloop_idb)
[![license](https://img.shields.io/npm/l/eventloop_idb.svg?style=flat-square)](LICENSE)

```bash
npm i eventloop_idb
```
or copy/paste the single file at [src/index.ts](https://github.com/fullmooner-stack/eventloop_idb/blob/main/src/index.ts)

## Performance

<img width="1572" height="703" alt="Benchmark" src="https://github.com/user-attachments/assets/a8609e08-be2d-4246-bf31-cc2b644dee1f" />

Compare against other IndexedDB wrappers at [idbwrappersbenchmark.vercel.app](https://idbwrappersbenchmark.vercel.app/)

---

## Usage

### Instantiation

```javascript
import { EventLoop_idb } from 'eventloop_idb';
const db = new EventLoop_idb('my_store');
```

### Write

```javascript
const item = { id: "123_string", name: "john doe", age: 31 }
db.write(item.id, () => item, (success) => { if (success) console.log('saved'); });
```

### Read

```javascript
db.read("123_string", (item) => console.log(item)); // { id: "123_string", name: "john doe", age: 31 }
```

### Delete

```javascript
db.delete("123_string", (success) => success && console.log("successfully deleted item 123_string"));
```

### Read all keys

```javascript
db.getAllKeys((allKeys) => console.log(allKeys)); // reads all keys
db.getAllKeys((allKeys) => console.log(allKeys), null, 10); // reads the first 10 keys
const idbKeyRange = [10, 100];
db.getAllKeys((allKeys) => console.log(allKeys), idbKeyRange); // reads all keys within an idb key range
```

### Read all items

```javascript
db.getAll((allItems) => console.log(allItems)); // reads all items
db.getAll((allItems) => console.log(allItems), null, 10); // reads the first 10 items
const idbKeyRange = [10, 100];
db.getAll((allItems) => console.log(allItems), idbKeyRange); // reads all items within an idb key range
```

### Clear all items from database

```javascript
db.clear((success) => success && console.log(`${db.name} was successfully cleared`));
```

---

## Reactive State

`EventLoop_idb` exposes raw `Set`-based callback collections. Sets do not self-execute on subscription, so always sync the current value before subscribing.

### Subscribe to connection state

```javascript
let connectionState = false;
const trackConnection = (connected) => (connectionState = connected);
connectionState = db.readyFlag;
db.onReadyStateChangeClbs.add(trackConnection);
```

### Unsubscribe from connection state

```javascript
db.onReadyStateChangeClbs.delete(trackConnection); // unsubscribe single subscriber
db.onReadyStateChangeClbs.clear(); // unsubscribe all subscribers
```

### Subscribe to on-idle
Fires when all pending operations are exhausted and the instance goes idle.

```javascript
const isIdle = () => console.log(db.name, "is idling");
db.onIdleClbs.add(isIdle);
```

### Unsubscribe from on-idle

```javascript
db.onIdleClbs.delete(isIdle); // unsubscribe single subscriber
db.onIdleClbs.clear(); // unsubscribe all subscribers
```

---

## Examples

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
    return () => db.onReadyStateChangeClbs.delete(onState);
  }, []);

  const handleWrite = (item) => {
    db.write(item.id, () => item, (success) => {
      if (success) toast("success");
      else toast("fail");
    });
  };

  return (
    <div>
      <p>{ready ? '🟢 Connected' : '⚪ Connecting...'}</p>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={() => handleWrite({ id: "1", name: "john" })}>save</button>
    </div>
  );
}
```

### SolidJS

```javascript
import { createSignal, onCleanup } from 'solid-js';
import { EventLoop_idb } from 'eventloop_idb';

const db = new EventLoop_idb('my-store');

export function App() {
  const [ready, setReady] = createSignal(db.readyFlag);
  const [items, setItems] = createSignal([]);

  setReady(db.readyFlag);
  db.onReadyStateChangeClbs.add(setReady);

  onCleanup(() => db.onReadyStateChangeClbs.delete(setReady));

  return <p>{ready() ? '🟢 Connected' : '⚪ Connecting...'} — {items().length} records</p>;
}
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
| `name` | `string` | The name of the DB |
| `db` | `IDBDatabase` | Direct access to the raw native IDB instance |
| `readyFlag` | `boolean` | `true` when open and ready |
| `readyState` | `string` | Detailed connection state: `'done'` · `'blocked'` · `'closed'` · `'unexpectedly closed'` · `'close'` |
| `onReadyStateChangeClbs` | `Set<(readyFlag: boolean) => void>` | Fires on every connection state transition |
| `onIdleClbs` | `Set<() => void>` | Fires when all pending operations are exhausted and the instance goes idle |

### Methods

Read.
```typescript
read(id: string, clb: (res: any) => void): void
```

Read all keys, or only matching keys if either or both `range` or `count` are provided (skip `range` with `null`).
```typescript
getAllKeys(clb: (keys: string[]) => void, range?: IDBKeyRange, count?: number): void
```

Read all items, or only matching items if either or both `range` or `count` are provided (skip `range` with `null`).
```typescript
getAll(clb: (items: any[]) => void, range?: IDBKeyRange, count?: number): void
```

Write (takes an accessor `() => item`, not a direct value).
```typescript
write(id: string, data: (id: string) => any, clb?: (ok: boolean) => void): void
```

Delete a single record.
```typescript
delete(id: string, clb?: (ok: boolean) => void): void
```

Delete all records.
```typescript
clear(clb?: (ok: boolean) => void): void
```

---

## License

MIT
