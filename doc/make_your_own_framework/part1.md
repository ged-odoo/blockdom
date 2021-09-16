# Chapter 1: Component System

Quick links: [start](readme.md) - **chapter 1** - [chapter 2](part2.md) - [chapter 3](part3.md) - [chapter 4](part4.md) - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)

## First Attempt

All right, let's start by looking at what we can do with `blockdom`: we have a
simple way to define and compose blocks. For example:

```js
const counter = createBlock(`
  <div>
    <p>Value: <block-text-0/></p>
    <button block-handler-1="click">Increment</button>
  </div>`);

let state = 0;

function increment() {
  state++;
  update();
}

function render() {
  return counter([state, increment]);
}

let tree = render();
mount(tree, document.body);

function update() {
  patch(tree, render());
}
```

This is a working example. It is alive, maintains an internal state, and update
itself whenever we click on the button. However, there are some issues with this
code:

- first, the "business" code is mixed with the "plumbing" code,
- the code is not reusable. We cannot easily create two counters without changing
  everything,
- there is no scalable way of improving this application: if we want to add other
  features, there is no obvious way to do it.

Clearly, the situation will be much improved if we could separate the "counter"
code from the rest.

## Iteration 1: separate counter code

Let's try to do it, naively:

```js
function Counter(state, increment) {
  const counter = createBlock(`
    <div>
      <p>Value: <block-text-0/></p>
      <button block-handler-1="click">Increment</button>
    </div>`);
  return counter([state, increment]);
}

let state = 0;

function increment() {
  state++;
  update();
}

let tree = Counter(state, increment);
mount(tree, document.body);

function update() {
  patch(tree, Counter(state, increment));
}
```

This is a start, we managed to separate the render code in a nice function. But
we could not move the state and increment logic as well. This is because a function
taking an input and giving a virtual tree as output is basically a pure component,
stateless. However, our counter component is stateful.

The state has to live somewhere. It could be global (but then, we cannot
create a new counter), or in a class, object or closure.

It seems to me that a classical solution to this issue is a closure. So let's
see what it could look like:

```js
function Counter() {
  let state = 0;

  function increment() {
    state++;
    update();
  }

  const counter = createBlock(`
    <div>
      <p>Value: <block-text-0/></p>
      <button block-handler-1="click">Increment</button>
    </div>`);

  return () => counter([state, increment]);
}

let app = Counter();
let tree = app();
mount(tree, document.body);

function update() {
  patch(tree, app());
}
```

It's much better. The code for the component is almost properly separated. The
only issue is that it needs a reference to the global `update` function. We can
improve again by giving it in the first argument to the initial call to `Counter`:

```js
function Counter(render) {
  let state = 0;

  function increment() {
    state++;
    render();
  }

  const counter = createBlock(`
    <div>
      <p>Value: <block-text-0/></p>
      <button block-handler-1="click">Increment</button>
    </div>`);

  return () => counter([state, increment]);
}

let app = Counter(update);
let tree = app();
mount(tree, document.body);

function update() {
  patch(tree, app());
}
```

Now the `Counter` component is neatly separated from the rest of the application.

## Iteration 2: factorize common framework code

So far, we actually do not really have a framework. The code is still a low level
call to the `mount` and `patch` methods. And clearly, every single application
in our framework will need to perform the exact same task. So, let's start by creating
a simple method to mount and update the application.

Before that, we need a catchy name for our framework. I have no imagination
whatsoever, so let's go with `tomato`.

```js
// tomato framework

function render(Comp, target) {
  let app = Comp(update);
  let tree = app();

  function update() {
    patch(tree, app());
  }
  mount(tree, target);
}

// application code

function Counter(render) {
  let state = 0;

  function increment() {
    state++;
    render();
  }

  const counter = createBlock(`
    <div>
      <p>Value: <block-text-0/></p>
      <button block-handler-1="click">Increment</button>
    </div>`);

  return () => counter([state, increment]);
}

render(Counter, document.body);
```

Now the application code is really completely focused on its own business logic.

## Iteration 3 : introducing sub components

So far, we cannot really say that the `tomato` framework is ready. A missing
feature is a way to define and reuse sub components. Let us extend our code to
allow that. We want a main component that will contain a `Counter` component.
Something like this:

```js
// does not work yet!!!
function Main() {
  const main = createBlock(`
    <div>
      <p>Hello Tomato</p>
      <block-child-0/>
    </div>`);

  return () => main([], [Counter]);
}
render(Main, document.body);
```

The problem here is that `Counter` is not a virtual node, so `blockdom` does not
know what to do with it. This can be solved by wrapping it in a function: `component(Counter)` that returns a virtual node.

Here, we need some more specialized knowledge of how our virtual dom works.
The upside is that it is not very difficult. Here is a naive code to get started:

```js
class VComponent {
  constructor(C) {
    this.C = C;
    this.instance = null;
  }

  mount(parent, afterNode) {
    this.instance = this.C();
    this.node = this.instance();
    this.node.mount(parent, afterNode);
  }

  moveBefore(other, afterNode) {
    this.node.moveBefore(other ? other.node : null, afterNode);
  }

  patch() {}

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

function component(C) {
  return new VComponent(C);
}
```

A virtual component node needs a reference to the function defining the component.
Whenever it is mounted, it will call it. The return value is the closure capturing
the state, that we needs to keep. Then we call that closure to get the current
vnode, and we mount that vnode.

The other methods are basically simply calling the corresponding methods of the
component vnode. For example, moving a component simply means moving the underlying
virtual node.

Let us try using this code with the following application code:

```js
function Counter(render) {
  let state = 0;

  function increment() {
    state++;
    render();
  }

  const counter = createBlock(`
    <div>
      <p>Value: <block-text-0/></p>
      <button block-handler-1="click">Increment</button>
    </div>`);

  return () => counter([state, increment]);
}

function Main() {
  const main = createBlock(`
    <div>
      <p>Hello Tomato</p>
      <block-child-0/>
    </div>`);

  return () => main([], [component(Counter)]);
}
render(Main, document.body);
```

The initial rendering looks fine, but then, clicking on the button fails
miserably. The reason is that we did not pass a render function. Let's modify
our `VComponent` class to do it:

```js
class VComponent {
  // ...

  mount(parent, afterNode) {
    this.instance = this.C(() => this.patch());
    this.node = this.instance();
    this.node.mount(parent, afterNode);
  }

  patch() {
    this.node.patch(this.instance());
  }
}
```

This is quite subtle, and it works. We now have a complete component system!
It works. Every component and sub component will properly be updated.

Let us explain what happened here. A component is defined by a function returning
a closure. So, rendering the component is actually done by calling the closure.
This explains the call to `instance()` in mount (initial rendering) and in patch
(following renderings).

The key thing to understand is that the rendering of the sub components is done
in the "patch/mount" phase. So, the correct mental model of what happens is this:
the root component is rendered, then it is patched to the DOM. The virtual dom
will then discover that it has sub components, and will mount them. This triggers
the rendering of each sub component, which will then be mounted. If they have
sub components, the process keeps going: rendering, then mounting/patching, then
rendering, and so on.

Notice that the `render` function given in the counter component only causes
a rendering/update of the counter component itself, not the parent component.

## Iteration 4: use VComponent for root node

Looking at the code, we can see that the top component is handled differently.
It has a custom `update` function, is manually created, and in general, does not
correspond to a virtual node. This is not a big deal for now, but having more
than one way to do something is a potential source for bugs in the future. So,
let's modify our `render` function to generate a virtual node:

```js
function render(Comp, target) {
  let vnode = new VComponent(Comp);
  vnode.mount(target);
}
```

It is simpler and shorter.

## Iteration 5: adding support for props

Our `tomato` framework is for now useless in practice: we need a way to pass
information from a component to a subcomponent. It is however quite simple to
add: we just need to add a `props` object and give it to the closure.

Here is the full code of our updated `tomato` framework look like now:

```js
function render(Comp, target) {
  let vnode = new VComponent(Comp);
  vnode.mount(target);
}

class VComponent {
  constructor(C, props) {
    this.C = C;
    this.instance = null;
    this.props = props;
  }

  mount(parent, afterNode) {
    this.instance = this.C(() => this.patch());
    this.node = this.instance(this.props);
    this.node.mount(parent, afterNode);
  }

  moveBefore(other, afterNode) {
    this.node.moveBefore(other ? other.node : null, afterNode);
  }

  patch() {
    this.node.patch(this.instance(this.props));
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
```

And we can test it with the following application:

```js
function Hello(render) {
  const block = createBlock(`<p>Hello <block-text-0/></p>`);

  return (name) => block([name]);
}

function Main() {
  const main = createBlock(`
    <div>
      <block-child-0/>
    </div>`);

  return () => main([], [component(Hello, "tomato")]);
}

render(Main, document.body);
```

And it's a wrap! We have a working framework, that could be used to write real
applications. Well, it still is quite low level and most developers would
expect a better experience/more features. That's what the next few chapters are
about!

---

Quick links: [start](readme.md) - **chapter 1** - [chapter 2](part2.md) - [chapter 3](part3.md) - [chapter 4](part4.md) - [chapter 5](part5.md) - [chapter 6](part6.md) - [conclusion](conclusion.md)
