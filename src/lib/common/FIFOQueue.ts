import { popFirst } from "utils";

export class FIFOQueue<T> {
  private list: T[] = [];

  enqueue(t: T): void {
    this.list.push(t);
  }

  dequeue(): T | undefined {
    let element: T | undefined;
    [element, this.list] = popFirst(this.list);
    return element;
  }

  get length() {
    return this.list.length;
  }
}
