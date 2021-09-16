# Chapter 4: Lifecycle

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - [chapter 3](part3.md) - **chapter 4** - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)

The asynchronous scheduling is nice, but asynchronous stuff is hard! A lot of
stuff can happen during the gap between the moment a rendering is scheduled,
and the moment it happens. In particular, a component could have been removed
from the DOM.

It is certainly time to look in more detail at the lifecycle of a component. We
currently don't have a need for that many states: a component is either _active_ or
_destroyed_. If it is destroyed, any rendering should be cancelled.

## Preliminary cleanup

This is not really necessary, but looking at the code, it seems to me that it
would be more natural to use a vnode instead of a renderFn as an internal variable.
So, let's replace the `currentRenderFn` variable by `currentVNode`:

```js
let currentVNode = null;

// in mount, replace currentRenderFn = () => this.patch(); by
currentVnode = this;

// in scheduler, replace flush code by
for (let vnode of pendingRenderings) {
  vnode.patch();
}

// in useState, rename renderFn => vnode
```

## Keeping track of status

For now, let's simply add a `isDestroyed` flag to our component:

```js
// in VComponent constructor:
this.isDestroyed = false;

// in beforeRemove:
this.isDestroyed = true;

// and in patch, replace code by:
if (!this.isDestroyed) {
  this.node.patch(this.instance(this.props), true);
}
```

The first two are quite straightforward: we set the `isDestroyed` flag to false,
then to true whenever our component is removed. The `if` statement in `mount` is
clear: we simply ignore a patch operation if the component is destroyed.

The tricky part is adding the
`true` argument to the patch call in the patch method. This is because of the
way `blockdom` works: by default, it does not propagate the `beforeRemove` call
to the children of a vnode being removed. This is useful when one can detect for
example that a component has no children, then there is no need to notify them
that they are being removed. But in our case, we now want to be notified all the
time, since we don't know if a component has children.

## Optimization

Note that calling the `beforeRemove` is certainly a small performance hit. But
we can do something about it in some cases: if we can detect that we have no
sub components, then there is no need for that. This may help some cases where
we have a component with a large list of content, but these elements are not
component.

Let's do it:

```js
// in VComponent constructor:
this.isParent = false;

// in mount, at the end:
this.isParent = currentVNode !== this;

// in patch, replace content by:
if (!this.isDestroyed) {
  current = currentVNode;
  this.node.patch(this.instance(this.props), this.isParent);
  this.isParent = this.isParent || current === currentVNode;
}
```

This code is not simple. First, we set `isParent` to false, because we are not
aware of any child yet. At the end of `mount`, we check if the `currentVNode`
has changed: this indicates that we mounted a sub component just now. We also
need to update the patch method, in two ways: we may discover new children at
this step, so we potentially need to update `isParent`, and we use `isParent`
instead of `true` as second argument to the patch call. This is the core of the
optimization: if we know that we are not a parent, we simply skip the `beforeRemove`
process.

## Full code

This chapter is short, and you may be wondering why we didn't expose a hook or
something to allow the developer to take advantage of the lifecycle of the
component. The answer to that question is that we will do it, but in the next
chapter!

```js
function render(Comp, target) {
  let vnode = new VComponent(Comp);
  vnode.mount(target);
}

let currentVNode = null;

class VComponent {
  constructor(C, props) {
    this.C = C;
    this.instance = null;
    this.props = props;
    this.isDestroyed = false;
    this.isParent = false;
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
      this.node.patch(this.instance(this.props), this.isParent);
      this.isParent = this.isParent || current === currentVNode;
    }
  }

  beforeRemove() {
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

let cache = new WeakMap();

function html(strings, ...args) {
  let template = cache.get(strings);
  if (!template) {
    template = compileTemplate(strings, args);
    cache.set(strings, template);
  }
  return template(args);
}

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

function useState(value) {
  let vnode = currentVNode;

  let state = () => value;
  let setState = (newValue) => {
    value = newValue;
    scheduleRendering(vnode);
  };
  return [state, setState];
}
```

---

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - [chapter 3](part3.md) - **chapter 4** - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)
