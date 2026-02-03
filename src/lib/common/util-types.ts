export type Setter<K, V> = (key: K, value: V) => void;
export type Getter<K, V> = (key: K) => V | undefined;
export type Deleter<K> = (key: K) => boolean;

export interface KeyValueOperations<K, V> {
  set: Setter<K, V>;
  get: Getter<K, V>;
  delete: Deleter<K>;
}
