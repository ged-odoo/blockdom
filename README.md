# blockdom

A fast virtual dom 

## Intro

`blockdom` is a (hopefully) fast virtual dom library. Its main selling point is
that it does not work at the granularity of a single html element, but instead,
it works with `blocks`: html elements, with arbitrary content.

So, instead of doing something like `h('div', {}, [...some children])`, we can
work in blockdom with a larger unit of dom:

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

`blockdom` can update the dom, manage event handlers, support fragments (multi-root elements).
It is however not a full featured framework.  Its goal is being a compilation target
for templates in a higher level framework.

## Why is it so fast?

Well, to be honest, I am not really sure. I spent hours running benchmarks, and
even now, I am not really sure about what makes some code fast or not.

Here is what I can tell, though:

- working at a block level instead of a single html element is a huge speedup
- browsers are pretty good at inlining functions, so it's mostly pointless to
  try to manually complicate code by inlining small function.


## Documentation

todo

## Credits

`blockdom` is inspired by many frameworks: snabbdom, then solid, ivi, stage0 and
1more.  The people behind these projects are incredible.