# Extending `blockdom`

`blockdom` is designed to be used as a lower layer in a "real" framework. Some
frameworks (for example, Owl, which is the one I am working on) will need a way
to add some kind of component system. To do that, it seems like the best way is
to add new types of vnodes.

Here is the interface of a blockdom vnode:

```js
export interface VNode<T = any> {
  mount(parent: HTMLElement, afterNode: Node | null): void;
  moveBefore(other: T | null, afterNode: Node | null): void;
  patch(other: T, withBeforeRemove: boolean): void;
  beforeRemove(): void;
  remove(): void;
  firstNode(): Node | undefined;
}
```

So, to add a new vnode type, we simply need to define an object or a class with
these methods, and it will work with the `mount/patch/remove` methods.

Notice the `beforeRemove` method: it is a method used to let the framework know
that a vnode will be removed. It is called before the node is removed.
