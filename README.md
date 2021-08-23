# blockdom

A very fast virtual dom (still not production ready!)

- [Introduction](#introduction)
- [Example](#example)
- [Reference](#reference)
  - [Reactive System](#reactive-system)
- [Performance](#performance)
- [Credits](#credits)

## Introduction

`blockdom` is a fast virtual dom library. Its main selling point is
that it does not work at the granularity of a single html element, but instead,
it works with `blocks`: html elements, with arbitrary content.

So, instead of doing something like `h('div', {}, [...some children])`, we can
work in blockdom with a larger unit of dom. For example:

```js
// create block types
const block = createBlock(`<div class="some-class"><p>hello</p><blockdom-child-0/></div>`);
const subBlock = createBlock(`<span>some value: <blockdom-text-0/></span>`);

// create a blockdom virtual tree
const tree = block([], [subBlock(['blockdom'])]);

// mount the tree
mount(tree, document.body);

// result: 
// <div class="some-class"><p>hello</p><span>some value: blockdom</span></div>
```

As a result, `blockdom` can use the internal `cloneNode(true)` method to quickly
create dom elements in one call instead of many, and the diff process is much
faster, since it has to process less virtual nodes. Here is a benchmark run,
comparing the performance of a handcrafted vanilla js implementation against 
`blockdom`, `solid` (incredibly fast fine-grained framework) and `ivi` (the fastest
virtual dom implementation).

![Benchmark](benchmark.png "Benchmark")

`blockdom` can update the dom, manage event handlers, support fragments (multi-root elements).
It is however not a fully featured framework.  Its goal is being a compilation target
for templates in a higher level framework. For some frameworks, it is useful to
have a rendering process in two phases: the render phase (creating the virtual
dom representation) and the commit phase (applying it to the DOM). 

## Example

```js
const counterBlock = createBlock(`
    <div class="counter">
        <button owl-handler-1="click">Increment</button>
        <span>Value: <owl-text-0/></span>
    </div>`);

const mainBlock = createBlock(`
    <div>
        <div><button owl-handler-0="click">Add a counter</button></div>
        <div><owl-child-0/></div>
    </div>`);

const state = [{ id: 0, value: 3 }];

function addCounter() {
    state.push({ value: 0, id: state.length });
    update();
}

function incrementCounter(id) {
    const counter = state.find(c => c.id === id);
    counter.value++;
    update();
}

function render(state) {
    const counters = state.map(c => {
        const handler = [incrementCounter, c.id];
        return Object.assign(counterBlock([c.value, handler]), { key: c.id });
    });
    return mainBlock([addCounter], [list(counters)]);
}

let tree = render(state);
mount(tree, document.body);

function update() {
    patch(tree, render(state));
}
```

## Reference

todo

## Performance

Well, to be honest, I am not really sure. I spent hours running benchmarks, and
even now, I am not really sure about what makes some code fast or not.

Here is what I can tell, though:

- working at a block level instead of a single html element is a huge speedup
- browsers are pretty good at inlining functions, so it's mostly pointless to
  try to manually complicate code by inlining small function.

## Credits

`blockdom` is inspired by many frameworks: snabbdom, then solid, ivi, stage0 and
1more.  The people behind these projects are incredible.