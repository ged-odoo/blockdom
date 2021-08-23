# blockdom

A very fast virtual dom library

- [Introduction](#introduction)
- [Example](#example)
- [Reference](#reference)
  - [Reactive System](#reactive-system)
- [Performance Notes](#performance-notes)
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
const tree = block([], [subBlock(["blockdom"])]);

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
It is however not a fully featured framework. Its goal is being a compilation target
for templates in a higher level framework. For some frameworks, it is useful to
have a rendering process in two phases: the render phase (creating the virtual
dom representation) and the commit phase (applying it to the DOM).

## Example

Here is a more interesting example. It is a dynamic list of counters, featuring
handlers, lists and dynamic content:

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
  const counter = state.find((c) => c.id === id);
  counter.value++;
  update();
}

function render(state) {
  const counters = state.map((c) => {
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

The `examples` folder contains the complete code for this example.

## Reference

`blockdom` api is not very big: 6 type of structural vnodes, 3 functions and one
configuration object.

The vnode types are:

- `text`: a simple vnode representing a text node
- `block`: a representation of an html element (with children/attributes)
- `list`: a dynamic list of vnodes (which have all the same type)
- `multi`: a representation of a static list of vnodes (possibly undefined or of different types)
- `toggler`: a container node that allows switching dynamically between different type of subnodes
- `html`: represent an arbitrary html content

The 3 functions are:

- `mount(vnode, target)`
- `patch(vnode1, vnode2)`
- `remove(vnode)`

## Performance Notes

`blockdom` is very fast, I believe. If you read this section, you may be interested
in understanding _why_. Well, to be honest, I am not really sure. I spent hours
running benchmarks, and even now, I am not really sure about what exactly makes
some code fast or not.

Here is what I can tell, though:

- working at a block level instead of a single html element is a huge speedup,
  obviously. This is the main selling point of this library.
- browsers are pretty good at inlining functions, so it's mostly pointless to
  try to manually complicate code by inlining small function.
- synthetic events is a small speed increase (around 1% on the main benchmark).
- I could not find any noticeable difference by using smaller objects/shorter
  key names
- however, for some reason, the implementation got a pretty big speedup once I
  started using classes. I am not certain why, but I guess that browsers are
  pretty good at optimizing class construction. It feels like it is faster than
  creating directly an object: I tried implementing vnodes with objects such as

  ```js
      return {
          mount: mountFunction,
          patch: patchFunction,
          moveBefore: moveBeforeFunction,
          ...,
          data: ...,
          children: ...
      }
  ```

  and it was noticeably slower. I assume that it is because each object takes
  more memory, since they need to keep a pointer to each vnode function.

  An alternative was grouping all such objects in a sub key:

  ```js
      return {
          impl: implementationObject // contains mount/patch/moveBefore/...
          data: ...,
          children: ...
      }
  ```

  but it was also slower (probably because the code had to perform a lookup
  everytime).

  Another alternative using `Object.create(implementationObject)` failed. So,
  the big takeway from this is that maybe, using classes is good for performance in some hot paths.

- one of the first implementation tried to build fast code by creating a new
  customized function with `new Function`, for each block. It was really fast,
  but actually not really noticeably faster than simply trying to setup a fast
  create/update path and using closures to _compile_ a block. This has also
  the advantage of not using `new Function` (which is disallowed in some
  environments), and is cheaper, memory wise.

- another interesting point: I believe some of the speed of this vdom comes from
  the fact that it has a pretty big constraint: a vdom tree is supposed to be
  patched with a vdom tree of the same shape. This comes naturally if we compile
  a template into a function (the template has always the same structure). This
  constraint means that the underlying code does not have to check the type or the
  keys in most cases. It knows that it is patched with a block of the same type.

## Credits

`blockdom` is inspired by many frameworks: snabbdom, then solid, ivi, stage0 and
1more. The people behind these projects are incredible.
