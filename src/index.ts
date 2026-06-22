interface Card {
  [x: number]: any;
  push: (_: any) => void;
  pop: () => void;
  length: number;
}

const enum Ops {
  read = 0,
  write = 1,
  delete = 2,
  allKeys = 3,
  allItems = 4,
  clear = 5,
}

const opType = 0;

const enum r {
  id = 1,
  clb = 2,
}

const enum w {
  id = 1,
  item = 2,
  clb = 3,
}

const enum d {
  id = 1,
  clb = 2,
}

const enum ak {
  queryOrOptions = 1,
  count = 2,
  clb = 3,
}

const enum ai {
  queryOrOptions = 1,
  count = 2,
  clb = 3,
}

const enum ca {
  clb = 1,
}

type ClearCLB = (success: boolean) => void;
type AllCLB = (result: any[]) => void;
type AllKeysCLB = (result: string[]) => void;
type ReadCLB = (result: any) => void;
type WriteCLB = (success: boolean) => void;
type DeleteCLB = (success: boolean) => void;

type ReadOp = Card & {
  [opType]: Ops.read;
  [r.id]: string;
  [r.clb]: ReadCLB;
};

type WriteOp = Card & {
  [opType]: Ops.write;
  [w.id]: string;
  [w.item]: (id?: string) => any;
  [w.clb]?: WriteCLB;
};

type DeleteOp = Card & {
  [opType]: Ops.delete;
  [d.id]: string;
  [d.clb]?: any;
};

type AllKeysOp = Card & {
  [opType]: Ops.allKeys;
  [ak.queryOrOptions]?: IDBValidKey | IDBKeyRange | null;
  [ak.count]?: number;
  [ak.clb]: AllKeysCLB;
};

type AllOp = Card & {
  [opType]: Ops.allItems;
  [ai.queryOrOptions]?: IDBValidKey | IDBKeyRange | null;
  [ai.count]?: number;
  [ai.clb]: AllCLB;
};

type ClearOp = Card & {
  [opType]: Ops.clear;
  [ca.clb]?: ClearCLB;
};

type Op = ReadOp | WriteOp | DeleteOp | AllKeysOp | AllOp | ClearOp;

type ReadyStateCLB = (readyFlag: boolean) => void;

/** IndexedDB sweet point */
const batchSize = 600;

type UpgradedIDB_TX = IDBTransaction & {
  store: IDBObjectStore;
  count: number;
};

const storeName = "main";

class EventLoop_idb {
  // ==========================================
  // Private Static Core Execution Engine
  // ==========================================
  private static GlobalLoop = new Set<EventLoop_idb>();
  private static GlobalIterator:
    | ReturnType<(typeof EventLoop_idb.GlobalLoop)["values"]>
    | undefined;
  private static tabsChannel = new BroadcastChannel("EventLoop_idb");

  private static runGlobalLoop() {
    const next = EventLoop_idb.GlobalIterator!.next();
    next.done
      ? (EventLoop_idb.GlobalIterator = undefined)
      : (EventLoop_idb.GlobalLoop.delete(next.value),
        EventLoop_idb.processNextOp(
          EventLoop_idb.createUpgradedTX(next.value.db),
          next.value,
        ));
  }

  private static startGlobalLoop() {
    EventLoop_idb.GlobalIterator ||
      ((EventLoop_idb.GlobalIterator = EventLoop_idb.GlobalLoop.values()),
      EventLoop_idb.runGlobalLoop());
  }

  private static commit_a_batch(tx: IDBTransaction, ins: EventLoop_idb) {
    tx.oncomplete = () =>
      EventLoop_idb.processNextOp(EventLoop_idb.createUpgradedTX(ins.db), ins);
    tx.commit();
  }

  private static processNextOp(tx: UpgradedIDB_TX, ins: EventLoop_idb) {
    const next = ins.I!.next();
    switch (next.done) {
      case true:
        delete ins.I;
        ins.runOnIdleClbs();
        EventLoop_idb.runGlobalLoop();
        break;
      case false:
        const store = tx.store;
        const op = next.value;
        ins.eventLoop.delete(next.value);
        switch (op[opType]) {
          case Ops.read:
            const readReq = store.get(op[r.id]);
            readReq.onsuccess = () => {
              op[r.clb](readReq.result);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            readReq.onerror = () => {
              op[r.clb](undefined);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
          case Ops.write:
            const writeReq = store.put(op[w.item](op[w.id]), op[r.id]);
            writeReq.onsuccess = () => {
              op[w.clb] && op[w.clb](true);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            writeReq.onerror = () => {
              op[w.clb] && op[w.clb](false);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
          case Ops.delete:
            const deleteReq = store.delete(op[d.id]);
            deleteReq.onsuccess = () => {
              op[d.clb] && op[d.clb](true);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            deleteReq.onerror = () => {
              op[d.clb] && op[d.clb](false);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
          case Ops.allKeys:
            const keysReq = store.getAllKeys(
              op[ak.queryOrOptions],
              op[ak.count],
            );
            keysReq.onsuccess = () => {
              op[ak.clb](keysReq.result as string[]);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            keysReq.onerror = () => {
              op[ak.clb]([]);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
          case Ops.allItems:
            const itemsReq = store.getAll(op[ak.queryOrOptions], op[ak.count]);
            itemsReq.onsuccess = () => {
              op[ai.clb](itemsReq.result);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            itemsReq.onerror = () => {
              op[ai.clb]([]);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
          case Ops.clear:
            const clearReq = store.clear();
            clearReq.onsuccess = () => {
              op[ca.clb] && op[ca.clb](true);
              ++tx.count === batchSize
                ? EventLoop_idb.commit_a_batch(tx, ins)
                : EventLoop_idb.processNextOp(tx, ins);
            };
            clearReq.onerror = () => {
              op[ca.clb] && op[ca.clb](false);
              EventLoop_idb.processNextOp(tx, ins);
            };
            break;
        }
        break;
    }
  }

  private static createUpgradedTX(db: IDBDatabase) {
    const tx = db.transaction(storeName, "readwrite") as UpgradedIDB_TX;
    tx.count = 0;
    tx.store = tx.objectStore(storeName);
    return tx;
  }

  // ==========================================
  // Private Instance Storage Arrays & Hooks
  // ==========================================
  private eventLoop = new Set<Op>();
  private I?: ReturnType<(typeof this.eventLoop)["values"]>;

  private _readyState:
    | IDBRequestReadyState
    | "unexpectedly closed"
    | "closed"
    | "close"
    | "blocked" = "close";
  private upgraded = false;
  private versionchange?: { newVersion: number | null; oldVersion: number };

  // ==========================================
  // Public Lifecycle & Configuration Properties
  // ==========================================

  /** The database storage namespace identifier */
  public name!: string;

  /** The native underlying IndexedDB instance */
  public db!: IDBDatabase;

  /**
   * Simple binary check indicating if the database instance is open and running operations.
   * * @see {@link readyState} for a highly granular representation of the execution environment's lifecycle state.
   */
  public readyFlag: boolean = false;

  /**
   * Current transaction execution capability status.
   * * Acts as a granular, detailed breakdown of {@link readyFlag}, exposing the exact under-the-hood
   * phase of the connection (e.g., `'done'`, `'blocked'`, `'closed'`, or `'unexpectedly closed'`).
   */
  public get readyState(): typeof this._readyState {
    return this._readyState;
  }

  private set readyState(state: typeof this._readyState) {
    (this.readyFlag = "done" === (this._readyState = state)) &&
      this.startLoop();
    this.runReadyStateChangeCallbacks(this.readyFlag);
  }

  /**
   * Initializes a connection to the IndexedDB pipeline.
   * @param name Unique tracking identifier for the datastore namespace.
   */
  constructor(name: string) {
    this.name = name;
    this.initialize();
  }

  // ==========================================
  // Public Database Operations (Event-Loop Bound)
  // ==========================================

  /** Enqueues a read task into the micro-transaction batching loop */
  public read(id: string, clb: ReadCLB) {
    this.eventLoop.add([Ops.read, id, clb]);
    this.startLoop();
  }

  /** Enqueues an atomic item insertion or update transaction modifier */
  public write(id: string, data: (id?: string) => any, clb?: WriteCLB) {
    this.eventLoop.add([Ops.write, id, data, clb]);
    this.startLoop();
  }

  /** Enqueues a single target identifier excision routine */
  public delete(id: string, clb?: DeleteCLB) {
    this.eventLoop.add([Ops.delete, id, clb]);
    this.startLoop();
  }

  /** Enqueues an entire object store flush sequence */
  public clear(clb?: DeleteCLB) {
    this.eventLoop.add([Ops.clear, clb]);
    this.startLoop();
  }

  /** Asynchronously collects all key indicators matching the optional bounds query descriptor */
  public getAllKeys(
    clb: (allKeys: string[]) => void,
    queryOrOptions?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ) {
    this.eventLoop.add([Ops.allKeys, queryOrOptions, count, clb]);
    this.startLoop();
  }

  /** Asynchronously crawls the storage context returning all unmarshalled elements matching queries */
  public getAll(
    clb: (allItems: any[]) => void,
    queryOrOptions?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ) {
    this.eventLoop.add([Ops.allItems, queryOrOptions, count, clb]);
    this.startLoop();
  }

  // ==========================================
  // Public Native Event Subscription Mechanics
  // ==========================================

  /**
   * Callbacks invoked immediately when the instance finishes processing its internal micro-task execution batch.
   * Leans on native function reference lookups for efficient registration.
   * * @example
   * // 1. Define a persistent function reference
   * const handleQueueIdle = () => console.log("Engine is idle.");
   * * // 2. Subscribe to the event loop status
   * db.onIdleClbs.add(handleQueueIdle);
   * * // 3. Unsubscribe individual callback cleanly
   * db.onIdleClbs.delete(handleQueueIdle);
   * * // 4. MASS UNSUBSCRIBE: Clear ALL registered idle callbacks simultaneously
   * db.onIdleClbs.clear();
   */
  public onIdleClbs = new Set<() => void>();

  /**
   * Callbacks fired whenever the under-the-hood connection state changes.
   * Receives the absolute boolean state transition flag as its sole argument.
   * * @example
   * let isConnected: boolean;
   * const trackConnection = (connected: boolean) => (isConnected = connected);
   * * // 1. Sync the current state immediately
   * isConnected = db.readyFlag;
   * * // 2. Subscribe to track all future state transitions
   * db.onReadyStateChangeClbs.add(trackConnection);
   * * // 3. Unsubscribe individual callback cleanly
   * db.onReadyStateChangeClbs.delete(trackConnection);
   * * // 4. Mass unsubscribe: Clear all observers simultaneously
   * db.onReadyStateChangeClbs.clear();
   */
  public onReadyStateChangeClbs = new Set<ReadyStateCLB>();

  // ==========================================
  // Private System Notification Dispatchers
  // ==========================================
  private startLoop() {
    this.I ||
      (this.readyFlag &&
        ((this.I = this.eventLoop.values()),
        EventLoop_idb.GlobalLoop.add(this),
        EventLoop_idb.startGlobalLoop()));
  }

  private runOnIdleClbs() {
    for (const clb of this.onIdleClbs) clb();
  }

  private runReadyStateChangeCallbacks(readyFlag: boolean) {
    for (const clb of this.onReadyStateChangeClbs) clb(readyFlag);
  }

  private initialize() {
    const dbRequest = self.indexedDB.open(this.name, 1);
    this.readyState = dbRequest.readyState;

    dbRequest.onsuccess = () => {
      this.db = dbRequest.result;
      this.versionchange &&= undefined;
      this.readyState = dbRequest.readyState;
      this.db.onclose = () => (this.readyState = "unexpectedly closed");
      this.db.onabort = (e) => (
        console.error("a transaction aborted", e),
        e.stopPropagation(),
        e.preventDefault()
      );
      this.db.onerror = (e) => console.error("unknown IndexedDB error", e);
      this.db.onversionchange = ({ newVersion, oldVersion }) => {
        this.versionchange = { newVersion, oldVersion };
        this.db.close();
        this.readyState = "closed";
        this.eventLoop.clear();
        EventLoop_idb.tabsChannel.addEventListener(
          "message",
          (e) =>
            e.data.type === "DB_REOPEN" &&
            e.data.db === this.name &&
            this.initialize(),
          { once: true },
        );
      };

      this.upgraded &&=
        (EventLoop_idb.tabsChannel.postMessage({
          type: "DB_REOPEN",
          db: this.name,
        }),
        false);
    };

    dbRequest.onupgradeneeded = () => {
      this.db = dbRequest.result;
      this.upgraded = true;
      this.db.createObjectStore(storeName);
    };

    dbRequest.onerror = (e) => console.error(this.name, "Errored:", e);

    dbRequest.onblocked = ({ newVersion, oldVersion }) => {
      this.versionchange = { newVersion, oldVersion };
      this.readyState = "blocked";
    };
  }
}

export { EventLoop_idb };
