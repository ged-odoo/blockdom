[![Open Source Love](https://badges.frapsoft.com/os/mit/mit.svg?v=102)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/blockdom.svg)](https://badge.fury.io/js/blockdom)
[![Downloads](https://img.shields.io/npm/dm/blockdom.svg)](https://www.npmjs.com/package/blockdom)

# blockdom

_Probably the fastest virtual dom library in the world_

`blockdom` is a very fast virtual dom library. Its main selling
point is that it does not represent DOM element by element, but instead block by
block, where a block is an element with all its static content and some special
tags to indicate dynamic content. This allows blockdom to use `cloneNode(true)`
on blocks and speed up the diff process, since the vdom tree is much smaller.

It features blocks, supports fragments, manage synthetic event handlers and more.
Note that it is not a framework. It does not even have the concept of components.
`blockdom` is intended to be a lower level layer of abstraction, on top of which
other frameworks could be added. See the documentation for a tutorial on that
topic.

## How to Install

**NPM**

```js
npm i blockdom
yarn add blockdom
```

**CDN**

```js
https://unpkg.com/blockdom@{VERSION}/dist/blockdom.iife.min.js

// for the latest version
https://unpkg.com/blockdom/dist/blockdom.iife.min.js
```

## Documentation

- [Reference documentation](doc/reference.md)
- [Extending blockdom](doc/extending_blockdom.md)
- [Performance Notes](doc/performance_notes.md)
- [Tutorial: make your own framework](doc/make_your_own_framework/readme.md) ([chapter 1](doc/make_your_own_framework/part1.md), [chapter 2](doc/make_your_own_framework/part2.md), [chapter 3](doc/make_your_own_framework/part3.md), [chapter 4](doc/make_your_own_framework/part4.md), [chapter 5](doc/make_your_own_framework/part5.md), [chapter 6](doc/make_your_own_framework/part6.md), [conclusion](doc/make_your_own_framework/conclusion.md))

## Examples

Instead of doing something like `h('div', {}, [...some children])`, we can
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

This example shows the `mount` function. Here is a more interesting example.
It is a dynamic list of counters, featuring handlers, lists and dynamic content:

```js
const counterBlock = createBlock(`
    <div class="counter">
        <button block-handler-1="click">Increment</button>
        <span>Value: <block-text-0/></span>
    </div>`);

const mainBlock = createBlock(`
    <div>
        <div><button block-handler-0="click">Add a counter</button></div>
        <div><block-child-0/></div>
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
    return withKey(counterBlock([c.value, handler]), c.id);
  });
  return mainBlock([addCounter], [list(counters)]);
}

let tree = render(state);
mount(tree, document.body);

function update() {
  patch(tree, render(state));
}
```

Notice that block types are first created, with special attributes or tags such as
`<block-text-0 />` or `block-handler-1="click"`. What happens is that `blockdom`
then processes the block template, find all these special tags/attributes and generate
fast functions that will create and/or update these values. The number corresponds
to the index of the data given when the block is constructed.

Also, blockdom supports synthetic handlers (meaning: it only setup one actual
event handler on the body, which is an optimisation). To use this feature, one
can simply use the `.synthetic` suffix:

```js
const counterBlock = createBlock(`<button block-handler-1="click.synthetic">Increment</button>`);
```

It is also possible to setup an handler in `capture` mode:

```js
const counterBlock = createBlock(`<button block-handler-1="click.capture">Increment</button>`);
```

The [`examples`](examples) folder contains the complete code for this example.

## About this project

In this section, you will find answers to some questions you may have about this
project.

- _Is this virtual dom used in an actual project?_ Not yet ready, but it is used
  in the current work on Owl version 2. The Owl framework 1.x (github.com/odoo/owl)
  is based on a fork of snabbdom, and as such, does not support fragment. The
  version 2 is not ready yet, but will be based on `blockdom`.

- _This is not a virtual dom, is it?_ Yes it is. Well, it depends what you mean
  by a virtual dom. It is not a representation of the dom tree element by element,
  but it still is a complete representation of what the dom is looking like. So,
  yes, in that sense, `blockdom` is a virtual dom.

- _Why would you need a virtual dom, in the first place?_ It depends on your
  needs. Clearly, some frameworks can do very well by using other strategies.
  However, some other frameworks (such as React and owl with their concurrent mode)
  need the ability to split the rendering process in two phases, so we can
  choose to commit a rendering (or not if for some reason it is no longer useful).
  In that case, I do not see how to proceed without a virtual dom.

- _This sucks. blockdom is useless/slow because of X/Y_. Great, please tell me
  more. I genuinely want to improve this, and helpful criticism is always
  welcome.

## Credits

`blockdom` is inspired by many frameworks: snabbdom, then solid, ivi, stage0 and
1more. The people behind these projects are incredible.
