import type { KeyValueOperations } from "@lib/common/util-types";

export class PersistedMap<K, V> implements KeyValueOperations<K, V> {
  toStringKey: (args: K) => string;
  persistance: KeyValueOperations<string, string>;
  toStringValue: (arg: V) => string;

  constructor(options: {
    persistance: KeyValueOperations<string, string>;
    toStringKey: (args: K) => string;
    toStringValue: (arg: V) => string;
  }) {
    const { toStringKey, toStringValue, persistance } = options;
    this.toStringKey = toStringKey;
    this.toStringValue = toStringValue;
    this.persistance = persistance;
  }

  get(key: K): V | undefined {
    const stringKey = this.toStringKey(key);
    return this.persistance.get(stringKey) as V;
  }

  set(key: K, value: V) {
    const stringKey = this.toStringKey(key);
    this.persistance.set(stringKey, this.toStringValue(value));
  }

  delete(key: K) {
    const stringKey = this.toStringKey(key);
    return this.persistance.delete(stringKey);
  }
}
