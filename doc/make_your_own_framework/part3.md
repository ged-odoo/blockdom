# Chapter 3: Reactivity

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - **chapter 3** - [chapter 4](part4.md) - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)

The `tomato` framework so far is pretty nice, but it feels like it is slightly
too low level for many usecases. To illustrate this, let's have a look at the
implementation of the `Counter` component in the previous part:

```js
function Counter(render) {
  let state = 0;
  let inc = () => {
    state++;
    render();
  };

  return () => html`<button onClick=${inc}>Value: ${state}</button>`;
}
```

Wouldn't it be better if we could have some kind of reactivity: whenever we
update the state, the component is automatically rerendered? An ideal code would
look like this:

```js
function Counter() {
  let state = 0;
  let inc = () => state++;

  return () => html`<button onClick=${inc}>Value: ${state}</button>`;
}
```

This is actually possible, by modifying the handler code to render the component
immediately after calling the handler function. But I am not a big fan of that
solution, it seems to me that this is a little bit too much on the _magic_ side.

This problem is very common, and most frameworks have a solution for that.
There are many ideas such as streams, hooks, proxies, observables and many others.
We need a way to execute some code whenever the state is udpated. Let's have a
look at what React-y `useState` look like:

```js
function Counter() {
  let [state, setState] = useState(0);
  let inc = () => setState(state++);

  return () => html`<button onClick=${inc}>Value: ${state}</button>`;
}
```

This looks quite nice, but it cannot possibly work with our `tomato` framework:
we have a very different idea of what a component is. In React, component
functions are called at every render. In `tomato`, they are closures, and called
only once, then the render function is called. This means that the `setState`
function has no way of modifying the state in the closure.

It may not be immediately obvious, but as often with functions, we can slightly
rearrange the types of various elements, and we can have something that would
work for us. The key is that the state is no longer a simple value, but a function
returning a value. Doing so means that the `setState` function can modify some
internal value, which will be returned by the `state` function:

```js
function Counter() {
  let [state, setState] = useState(0);
  let inc = () => setState(state() + 1);

  return () => html`<button onClick=${inc}>Value: ${state()}</button>`;
}
```

Note that reactivity is a huge subject, and what we do here is only scratching
the surface. Still, it is interesting to see how far we can go with pretty
simple abstractions.

## Implementing `useState`

Such a `useState` function is not pure: it is magically bound to the current
component. So, clearly, the implementation cannot be a pure function. Let's
start by getting a reference to the render function of the component being
currently created.

```js
let currentRenderFn = null;

class VComponent {
  // ...

  mount(parent, afterNode) {
    // the 2 first lines are new/different
    currentRenderFn = () => this.patch();
    this.instance = this.C(currentRenderFn);
    this.node = this.instance(this.props);
    this.node.mount(parent, afterNode);
  }

  // ...
}
```

We use a variable `currentRenderFn` that contains the render function for the
last component that has been created. We need now to capture that value and use
it in the `useState` function:

```js
function useState(value) {
  let renderFn = currentRenderFn;

  let state = () => value;
  let setState = (newValue) => {
    value = newValue;
    renderFn();
  };
  return [state, setState];
}
```

The code so far is really simple: the closure keeps the state in the `value`
variable, and returns two functions reading and updating that value. The key
point is to also capture the render function, so we can use it later, even if
other components have been created.

With this implementation, the example above now works!

## Let us batch some updates!

Our `useState` hook is very nice, but since the call to the `render` function is
now slightly less visible, it is actually quite easy to trigger multiple renderings.
For example, let's consider some code like this:

```js
let [a, setA] = useState(0);
let [b, setB] = useState(0);
let increment = () => {
  setA(a() + 1);
  setB(b() + 1);
};
```

Calling `increment` will trigger 2 renderings! Worse: the first rendering will
use an incomplete/corrupted state: this may in some case be inconsistant, or
even crash. We need to wait for the complete transition before initiating a
rendering. Let's do that, by simply waiting the call stack to be over. This can
be done by waiting a micro task tick (with a promise.resolve), or a `setTimeout`,
or a `requestAnimationFrame`. This last possibility is interesting: it makes
sense to only render once per frame anyway.

So, here is a very simple scheduler:

```js
let pendingRenderings = new Set();

function scheduleRendering(fn) {
  if (!pendingRenderings.size) {
    requestAnimationFrame(() => {
      for (let fn of pendingRenderings) {
        fn();
      }
      pendingRenderings.clear();
    });
  }
  pendingRenderings.add(fn);
}
```

This code keeps track of all pending renderings in a set. This makes sure we
have no duplicate rendering. And if no rendering is pending, we schedule the
flush operation to the next animation frame.

We can now use it in the `useState` function:

```js
function useState(value) {
  let renderFn = currentRenderFn;

  let state = () => value;
  let setState = (newValue) => {
    value = newValue;
    scheduleRendering(renderFn);
  };
  return [state, setState];
}
```

This code is still too naive, because it only batches updates components by
components. Ideally, we would want renderings batched by _root_: if a rendering
is initiated by a component and its direct parent, then we only want to render
the parent. But at least, we handle the most common case.

There is still an important issue with the scheduling: a rendering may be
executed after a component is removed from the DOM... We'll fix that in the
next chapter.

## Complete code so far

Here is a listing of the current state of our `tomato` framework. Note that I
removed the argument given to the component when it is created: if a component
needs to render itself, we can easily do it using `useState` (or a derived hook).

```js
function render(Comp, target) {
  let vnode = new VComponent(Comp);
  vnode.mount(target);
}

let currentRenderFn = null;

class VComponent {
  constructor(C, props) {
    this.C = C;
    this.instance = null;
    this.props = props;
  }

  mount(parent, afterNode) {
    currentRenderFn = () => this.patch();
    this.instance = this.C();
    this.node = this.instance(this.props);
    this.node.mount(parent, afterNode);
  }

  moveBefore(other, afterNode) {
    this.node.moveBefore(other ? other.node : null, afterNode);
  }

  patch(other) {
    this.node.patch(this.instance(other.props));
  }

  beforeRemove() {
    this.node.beforeRemove();
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
      for (let fn of pendingRenderings) {
        fn();
      }
      pendingRenderings.clear();
    });
  }
  pendingRenderings.add(fn);
}

function useState(value) {
  let renderFn = currentRenderFn;

  let state = () => value;
  let setState = (newValue) => {
    value = newValue;
    scheduleRendering(renderFn);
  };
  return [state, setState];
}
```

---

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - **chapter 3** - [chapter 4](part4.md) - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)
