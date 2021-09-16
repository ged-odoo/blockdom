# Chapter 5: Effects

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - [chapter 3](part3.md) - [chapter 4](part4.md) - **chapter 5** - [chapter 6](part6.md) - [conclusion](conclusion.md)

So far, we have a pretty nice base: we can define components, use templates,
we have reactive state with `useState`. But there is still a pretty large
missing piece: we have no control on the lifecyle of a component. This means
for example that we have no way of executing code whenever a component is
destroyed. So, no cleanup code is possible.

Consider the following example:

```js
function Clock() {
  let [state, setState] = useState(0);
  let reset = () => setState(0);

  setInterval(() => setState(state() + 1), 1000);

  return () => html` <div>
    <button onClick=${reset}>Reset</button>
    <p>Value: ${state()}</p>
  </div>`;
}

function Main() {
  let [isDisplayed, setIsDisplayed] = useState(true);
  let toggle = () => setIsDisplayed(!isDisplayed());

  return () => html` <div>
    <button onClick=${toggle}>Toggle</button>
    ${isDisplayed() ? component(Clock) : null}
  </div>`;
}
```

Clicking on the main button toggle a `Clock` component. And the `Clock` component
counts some number of seconds. Whenever we destroy a `Clock`, we would like to
at least clear the interval, otherwise we have a pretty clear memory leak!

We could expose some lifecycle hooks. Or, we could do like React: define a
`useEffect` hook, that regroup all of lifecycle uses in a single method.

## `useEffect`

The React `useEffect` method takes an effect (a function that perform some side
effects and return a cleanup function), and a dependency array. The dependency
array determines whenever the effect function should be called/cleaned up.

This is nice, but it does not work for `tomato`, just like for `useState`: we
have closure components, that are only created once, unlike React that calls
the function every time. So, the dependencies would never be updated.

But we can here also fix the issue by simply using a function instead of an array
for the dependencies: `tomato` can call that function and get updated dependencies.

```js
// in VComponent constructor:
this.effects = [];

// at the end of VComponent mount:
for (let effect of this.effects) {
  effect.perform();
}

// somewhere else:
const NO_OP = () => {};

class Effect {
  constructor(effect, depsFn = NO_OP) {
    this.fn = effect;
    this.depsFn = depsFn;
    this.deps = this.depsFn() || [];
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
```

This code defines a class `Effect` that represent a single effect. Each component can maintain a list of effects. We manage dependencies in the `checkDirty` method, whose goal is to cleanup the effect if necessary.

We still need to call the effect at the proper moment:

```js
// in VComponent patch, replace all code by:
patch() {
  if (!this.isDestroyed) {
    let current = currentVNode;
    let dirtyEffects = this.effects.filter(e => e.checkDirty());
    this.node.patch(this.instance(this.props), this.isParent);
    for (let effect of dirtyEffects) {
      effect.perform();
    }
    this.isParent = this.isParent || current === currentVNode;
  }
}

// add these 3 lines on top of beforeRemove:
for (let effect of this.effects) {
  effect.cleanup();
}
```

And that's it. We cleanup effects whenever necessary and reapply them. And
whenever our component is destroyed, we make sure to cleanup all effects.

We can now execute code such as this:

```js
function Clock() {
  let [state, setState] = useState(0);
  let reset = () => setState(0);

  useEffect(
    () => {
      document.title = `Clock ${state()}`;
    },
    () => [state()]
  );

  useEffect(() => {
    let interval = setInterval(() => setState(state() + 1), 1000);
    return () => clearInterval(interval);
  });

  return () => html` <div>
    <button onClick=${reset}>Reset</button>
    <p>Value: ${state()}</p>
  </div>`;
}

function Main() {
  let [isDisplayed, setIsDisplayed] = useState(true);
  let toggle = () => setIsDisplayed(!isDisplayed());

  return () => html` <div>
    <button onClick=${toggle}>Toggle</button>
    ${isDisplayed() ? component(Clock) : null}
  </div>`;
}
```

Notice that there are two effects, one with a dependency, and another without.

## Common lifecycle hooks and useEffect

Many frameworks provide access to more detailed lifecycle methods, such as
`mounted`, or `destroyed`. However, React showed with `useEffect` that we could
have a (slightly more complicated) single abstraction that can replace all those
lifecycle methods, at a negligible cost.

So, it is probably not necessary to define those other lifecycle methods, but if
one really wanted, we could do something like this:

```js
function onMounted(fn) {
  useEffect(fn, () => []);
}

function onDestroyed(fn) {
  useEffect(
    () => fn,
    () => []
  );
}
```

It's interesting to understand how they are defined: each of these effects declare
an empty list as dependency, which means that they will only be executed once.
For the `onMounted` hook, we simply call the function immediately (so, it is
called when the component is mounted). For the destroyed hook, the trick is to
return a _cleanup_ function which is therefore executed just before being
destroyed.

## Full Code

To conclude this chapter, here is the full 160 lines of code for the `tomato`
framework:

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
    this.effects = [];
  }

  mount(parent, afterNode) {
    currentVNode = this;
    this.instance = this.C();
    this.node = this.instance(this.props);
    this.node.mount(parent, afterNode);
    this.isParent = currentVNode !== this;
    for (let effect of this.effects) {
      effect.perform();
    }
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

const NO_OP = () => {};

class Effect {
  constructor(effect, depsFn = NO_OP) {
    this.fn = effect;
    this.depsFn = depsFn;
    this.deps = this.depsFn() || [];
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
```

---

Quick links: [start](readme.md) - [chapter 1](part1.md) - [chapter 2](part2.md) - [chapter 3](part3.md) - [chapter 4](part4.md) - **chapter 5** - [chapter 6](part6.md) - [conclusion](conclusion.md)
