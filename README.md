# EventLoop_idb

> The Fastest IndexedDB wrapper out there.

A fast, simple, single file, zero-dependency wrapper driven by an asynchronous micro-task event loop. Groups reads, writes, and deletes into controlled transactional batches — eliminating write-amplification, context switching, and transaction thrashing.

[![npm version](https://img.shields.io/npm/v/eventloop_idb.svg?style=flat-square)](https://www.npmjs.com/package/eventloop_idb)
[![license](https://img.shields.io/npm/l/eventloop_idb.svg?style=flat-square)](LICENSE)

```bash
npm i eventloop_idb
```
or copy/paste the single file at [src/index.ts]([https://idbwrappersbenchmark.vercel.app/](https://github.com/fullmooner-stack/eventloop_idb/blob/main/src/index.ts))

https://github.com/fullmooner-stack/eventloop_idb/blob/main/src/index.ts
## Performance

<img width="1572" height="703" alt="Benchmark" src="https://github.com/user-attachments/assets/a8609e08-be2d-4246-bf31-cc2b644dee1f" />

Compare against other IndexedDB wrappers at [idbwrappersbenchmark.vercel.app](https://idbwrappersbenchmark.vercel.app/)

---

## Usage

### Instansiation

```javascript
import { EventLoop_idb } from 'eventloop_idb';
const db = new EventLoop_idb('my_store');
```

### Write

```javascript
const item = { id: "123_string", name: "john doe", age: 31 }
db.write(item.id, () => item, (success: boolean) => { if (success) console.log('saved'); });
```

### Read

```javascript
db.read("123_string", (item: any) => console.log(item)); // { id: "123_string", name: "john doe", age: 31 }
```

### Delete

```javascript
db.delete("123_string", (success: boolean) => success && console.log("successfully deleted item 123_string"));
```

### Read all keys

```javascript
db.getAllKeys((allKeys: string[]) => console.log(allKeys)); // reads all keys
db.getAllKeys((allKeys: string[]) => console.log(allKeys), null, 10); // reads the first 10 keys
const idbKeyRange = [10, 100]
db.getAllKeys((allKeys: string[]) => console.log(allKeys), idbKeyRange); // reads all keys withing an idb key range 
```


### Read all keys

```javascript
db.getAll((allItems: any[]) => console.log(allItems)); // reads all items
db.getAll((allItems: any[]) => console.log(allItems), null, 10); // reads the first 10 items
const idbKeyRange = [10, 100];
db.getAllKeys((allItems: any[]) => console.log(allItems), idbKeyRange); // reads all items withing an idb key range 
```

### Clear all items form database

```javascript
db.clear((success: boolean) => success && console.log(`${db.name} was successfully cleared`));
```

## Reactive State

`EventLoop_idb` exposes raw `Set`-based callback collections. Sets do not self-execute on subscription, so always sync the current value before subscribing.


### Subscribe to connection state

```javascript
let connectionState = false;
const trackConnection = (connected) => (connectionState = connnected);
connectionState = db.readyFlag;
db.onReadyStateChangeClbs.add(trackConnection);
```

### Unsubscribe from connection state

```javascript
db.onReadyStateChangeClbs.delete(trackConnection); // unsubscribe single subscriber
db.onReadyStateChangeClbs.clear(); // unsubscribe all subscribers
```


### Subscribe to on-idle
fires when all pending operations are done and the instance goes idle

```javascript
const isIdle = () => console.log(db.name, "is idling");
db.onIdleClbs.add(isIdle);
```

### Unsubscribe from on-idle

```javascript
db.onIdleClbs.delete(isIdle); // unsubscribe single subscriber
db.onIdleClbs.clear(); // unsubscribe all subscribers
```

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

  const handleWrite (e) => {
    const item = e.target.value;
    db.write(e.id, ()=> e.id, (success) => {
      if (success) toast("success");
      else toast("fail")
    });

  }

  return (
    <div>
      <p>{ready ? '🟢 Connected' : '⚪ Connecting...'}</p>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={handleWrite}>save</button>
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
| `onReadyStateChangeClbs` | `Set<(readyFlag: boolean) => void>` | Fires when all pending operations are done and the instance goes idle |
| `onIdleClbs` | `Set<() => void>` | Fires when the transaction batch goes idle |
| `name` | `string` | The name of DB |
| `db` | `IDBDatabase` | Direct access to the raw native IDB instance |
| `readyFlag` | `boolean` | `true` when open and ready |
| `readyState` | `string` | detailed connection state `'done'` · `'blocked'` · `'closed'` · `'unexpectedly closed'` · `'close'` nothing documented yet. |

### Methods

Read.
```typescript
read(id: string, clb: (res: any) => void): void
```

Read all keys, or only matching key if either or both "range" or "count" was provided (skip "range" with "null").
```typescript
getAllKeys(clb: (keys: string[]) => void, range?: IDBKeyRange, count?: number): void
```

Read all items, or only matching key if either or both "range" or "count" was provided (skip "range" with "null").
```typescript
getAll(clb: (items: any[]) => void, range?: IDBKeyRange, count?: number): void
```

Write (writes takes an accessor "() => item" and not direct value.
```typescript
write(id: string, data: (id: string) => any, clb?: (ok: boolean) => void): void
```

Deletion.
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
