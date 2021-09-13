# Part 6: Lists and iterators

Quick links: [start](readme.md) - [part 1](part1.md) - [part 2](part2.md) - [part 3](part3.md) - [part 4](part4.md) - [part 5](part5.md) - **part 6** - [conclusion](conclusion.md)

We have a very good base for a framework, but there is a small detail that may
be annoying: when we need to display list of elements, we need to use `blockdom`
primitives instead of higher level `tomato` abstractions. So, for example, we
need to write a component like this:

```js
function RecordList() {
  return (records) => html` <div>
    ${list(records.map((record) => withKey(component(Record, record), record.id)))}
  </div>`;
}
```

It would be better to write some code like this instead:

```js
function RecordList() {
  let iterator = createIterator("id", (record) => component(Record, record));

  return (records) => html` <div>${iterator(records)}</div>`;
}
```

It is slightly simpler to write, and it has more potential for improvements, as we
will see later.

## First implementation

```js
function createIterator(key, elemFn) {
  return function iterate(elems) {
    return list(
      elems.map((elem) => {
        let node = elemFn(elem);
        node.key = elem[key];
        return node;
      })
    );
  };
}
```

With this implementation, we abstract away the `blockdom` primitives. It is a
higher order function, that returns a function that capture the key and a builder
function, and generata a list of vnodes.

## Optimization: let us add a cache

This is a totally fine implementation. But we can now improve it: list of vnodes
have an arbitrary size, and it is a good place to introduce a nice optimization
technique provided by blockdom: if two vnodes are the same referentially, it
will totally skip the diff process.

So, we want to introduce a cache, but we still need to be able to update elements
if they have the same key, but some different content. This is basically the
idea of a memo function. So, our `createIterator` need to take
an optional dependency function. Then, it needs to maintain an internal cache,
and check if there is already a rendered element in it. If the answer is yes,
it can check if it can reuse it by comparing the dependencies.

Let's make it extra fancy by rotating the cache: we recreate a different cache at
every rendering, while making sure it is properly populated. The idea is to avoid
reusing old rendered element, and also to prevent memory leaks (if for example
a long running list keeps adding and removing elements, its content will never
be garbage collected).

```js
function createIterator(key, elemFn, depsFn) {
  if (!depsFn) {
    return function iterate(elems) {
      return list(
        elems.map((elem) => {
          let node = elemFn(elem);
          node.key = elem[key];
          return node;
        })
      );
    };
  }
  let cache = {};

  return function iterate(elems) {
    let nextCache = {};
    let result = list(
      elems.map((elem) => {
        let cacheKey = elem[key];
        let deps = depsFn(elem);
        let cachedElem = cache[cacheKey];
        if (cachedElem) {
          let cacheDeps = cachedElem.memo;
          let isSame = true;
          for (let i = 0, l = cacheDeps.length; i < l; i++) {
            if (deps[i] !== cacheDeps[i]) {
              isSame = false;
              break;
            }
          }
          if (isSame) {
            nextCache[cacheKey] = cachedElem;
            return cachedElem;
          }
        }
        let node = elemFn(elem);
        node.key = cacheKey;
        node.memo = deps;
        nextCache[cacheKey] = node;
        return node;
      })
    );
    cache = nextCache;
    return result;
  };
}
```

## Full Code

Here again, let's end this part with a listing of the final code for our `tomato`
framework:

```js
// Component
let currentVNode = null;

class VComponent {
  constructor(C, props) {
    this.C = C;
    this.instance = null;
    this.props = props;
    this.isDestroyed = false;
    this.isParent = false;
    this.effects = [];
  }

  mount(parent, afterNode) {
    currentVNode = this;
    this.instance = this.C();
    this.node = this.instance(this.props);
    this.node.mount(parent, afterNode);
    this.isParent = currentVNode !== this;
  }

  moveBefore(other, afterNode) {
    this.node.moveBefore(other ? other.node : null, afterNode);
  }

  patch() {
    if (!this.isDestroyed) {
      let current = currentVNode;
      let dirtyEffects = this.effects.filter((e) => e.checkDirty());
      this.node.patch(this.instance(this.props), this.isParent);
      for (let effect of dirtyEffects) {
        effect.perform();
      }
      this.isParent = this.isParent || current === currentVNode;
    }
  }

  beforeRemove() {
    for (let effect of this.effects) {
      effect.cleanup();
    }
    this.node.beforeRemove();
    this.isDestroyed = true;
  }

  remove() {
    this.node.remove();
  }

  firstNode() {
    return this.node.firstNode();
  }
}

function component(C, props) {
  return new VComponent(C, props);
}

// render function

function render(Comp, target) {
  let vnode = new VComponent(Comp);
  vnode.mount(target);
}

// html tagged template

let cache = new WeakMap();

function html(strings, ...args) {
  let template = cache.get(strings);
  if (!template) {
    template = compileTemplate(strings, args);
    cache.set(strings, template);
  }
  return template(args);
}

// template compiler

function compileTemplate(strings, args) {
  let dataIdx = [];
  let childrenIdx = [];
  let blockDescription = strings
    .map((str, index) => {
      let arg = args[index];
      if (arg !== undefined) {
        if (str.endsWith("=")) {
          // either a handler, a ref or an attribute
          let i = dataIdx.push(index) - 1;
          let match = str.match(/\b(\w+)=$/);
          let prefix = str.slice(0, -match[0].length);
          if (match[1].startsWith("on")) {
            let event = match[1].slice(2).toLowerCase();
            return `${prefix}block-handler-${i}="${event}"`;
          } else if (match[1] === "ref") {
            return `${prefix}block-ref="${i}"`;
          } else {
            return `${prefix}block-attribute-${i}="${match[1]}"`;
          }
        }
        if (typeof arg === "object" || arg === null) {
          let i = childrenIdx.push(index) - 1;
          return str + `<block-child-${i}/>`;
        } else {
          let i = dataIdx.push(index) - 1;
          return str + `<block-text-${i}/>`;
        }
      }
      return str;
    })
    .join("");
  let block = createBlock(blockDescription);
  return function template(args) {
    let data = dataIdx.map((i) => args[i]);
    let children = childrenIdx.map((i) => args[i]);
    return block(data, children);
  };
}

// scheduler

let pendingRenderings = new Set();

function scheduleRendering(fn) {
  if (!pendingRenderings.size) {
    requestAnimationFrame(() => {
      for (let vnode of pendingRenderings) {
        vnode.patch();
      }
      pendingRenderings.clear();
    });
  }
  pendingRenderings.add(fn);
}

// reactivity

function useState(value) {
  let vnode = currentVNode;

  let state = () => value;
  let setState = (newValue) => {
    value = newValue;
    scheduleRendering(vnode);
  };
  return [state, setState];
}

// effects management

const NO_OP = () => {};

class Effect {
  constructor(effect, depsFn = NO_OP) {
    this.fn = effect;
    this.depsFn = depsFn;
    this.deps = this.depsFn() || [];
    this.perform();
  }
  checkDirty() {
    let deps = this.deps;
    let newDeps = this.depsFn() || [];
    const isDirty = newDeps.some((val, i) => val !== deps[i]);
    if (isDirty) {
      this.deps = newDeps;
      this.cleanup();
    }
    return isDirty;
  }
  perform() {
    this.cleanup = this.fn() || NO_OP;
  }
}

function useEffect(effect, depsFn) {
  currentVNode.effects.push(new Effect(effect, depsFn));
}

// iterators

function createIterator(key, elemFn, depsFn) {
  if (!depsFn) {
    return function iterate(elems) {
      return list(
        elems.map((elem) => {
          let node = elemFn(elem);
          node.key = elem[key];
          return node;
        })
      );
    };
  }
  let cache = {};

  return function iterate(elems) {
    let nextCache = {};
    let result = list(
      elems.map((elem) => {
        let cacheKey = elem[key];
        let deps = depsFn(elem);
        let cachedElem = cache[cacheKey];
        if (cachedElem) {
          let cacheDeps = cachedElem.memo;
          let isSame = true;
          for (let i = 0, l = cacheDeps.length; i < l; i++) {
            if (deps[i] !== cacheDeps[i]) {
              isSame = false;
              break;
            }
          }
          if (isSame) {
            nextCache[cacheKey] = cachedElem;
            return cachedElem;
          }
        }
        let node = elemFn(elem);
        node.key = cacheKey;
        node.memo = deps;
        nextCache[cacheKey] = node;
        return node;
      })
    );
    cache = nextCache;
    return result;
  };
}
```

---

Quick links: [start](readme.md) - [part 1](part1.md) - [part 2](part2.md) - [part 3](part3.md) - [part 4](part4.md) - [part 5](part5.md) - **part 6** - [conclusion](conclusion.md)
