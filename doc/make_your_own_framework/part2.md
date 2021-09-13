# Part 2: Tagged Templates

Quick links: [start](readme.md) - [part 1](part1.md) - **part 2** - [part 3](part3.md) - [part 4](part4.md) - [part 5](part5.md) - [part 6](part6.md) - [conclusion](conclusion.md)

We already have a working framework. It can define components, handlers, update
itself, and in general do what we expect.

But it requires the developer to write components returning virtual dom. Also,
it looks unnatural to have to define the block in the main function, then use it in
the closure. It may be a small detail, but I would prefer to write code looking
like this:

```js
function Hello(render) {
  return (name) => html`<p>Hello ${name}</p>`;
}

function Main() {
  const main = createBlock();

  return () => html` <div>${component(Hello, "tomato")}</div>`;
}
```

So, let's just make it work!

## Iteration 1: write a tag function

We clearly need to use the tagged template feature provided by javascript (see
the [doc on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)).

So, we need a `html` function that look like this:

```js
function html(strings, ...args) {
  let virtualTree = ...; // todo
  return virtualTree
}
```

The immediate problem is that we get some list of strings that are pieces of
html, but not valid html. For example, `<p class=${c}>Hello ${name}</p>` will provide the
following strings: `<p class=`, `>Hello `, and `</p>`. So, we don't have a nice
simple way to parse this into valid html.

Let's write some code, and see where it leads us:

```js
function html(strings, ...args) {
  let data = [];
  let children = [];
  let blockDescription = strings
    .map((str, index) => {
      let arg = args[index];
      if (arg) {
        if (typeof arg === "string") {
          let index = data.push(arg) - 1;
          return str + `<block-text-${index}/>`;
        } else {
          let index = children.push(arg) - 1;
          return str + `<block-child-${index}/>`;
        }
      }
      return str;
    })
    .join("");

  let block = createBlock(blockDescription);
  return block(data, children);
}
```

With this, our example above works as expected! But can you see the weaknesses
in this? We do not support attributes, nor event handlers. Also, another more
subtle issue is that this code is executed every single time we render our
template.

## Iteration 2: add a cache

We clearly do not want to perform useless work every time we render our application.
This will clearly be a performance hit. The clear solution is to introduce a
cache. Now, two questions arises: what is the cache key, and what exactly do we
put in the cache?

The first question is really tricky. The problem is that it seems like we would
like to use the content of the strings as cache, but it is an array, so it
appears that we get a new array each time we enter that function. But the
official ECMAScript specification has a solution ([see note 2](https://262.ecma-international.org/9.0/#sec-gettemplateobject)): the strings argument is frozen, and we get the same
reference each time!

So, we can use it directly as a cache key, but then, we need to insert it in a
`WeakMap` (a `Map` would probably be fine most of the time in practice, but we
might as well free memory if the application code does something funky).

To answer the second question, let's simply add a template function: a function
that takes the `args` list, and return a block. The main issue is that `blockdom`
internally uses 2 lists: one list for data, and one list for children, but the
`args` from the template string mixes them together. It would be simpler if
`blockdom` could take a single list.

Now, let's write some code:

```js
let cache = new WeakMap();

function html(strings, ...args) {
  let template = cache.get(strings);
  if (!template) {
    let dataIdx = [];
    let childrenIdx = [];
    let blockDescription = strings
      .map((str, index) => {
        let arg = args[index];
        if (arg) {
          if (typeof arg === "string") {
            let i = dataIdx.push(index) - 1;
            return str + `<block-text-${i}/>`;
          } else {
            let i = childrenIdx.push(index) - 1;
            return str + `<block-child-${i}/>`;
          }
        }
        return str;
      })
      .join("");
    let block = createBlock(blockDescription);
    template = (args) => {
      let data = dataIdx.map((i) => args[i]);
      let children = childrenIdx.map((i) => args[i]);
      return block(data, children);
    };
    cache.set(strings, template);
  }
  return template(args);
}
```

It works, by slightly modifying the initial implementation to keep track of indices,
then creating a function that capture the index arrays and use them to generate
a block. The caching code is mixed up with the template code, so let's take a
minute to refactor this to make it simpler to work on our framework in the future:

```js
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
      if (arg) {
        if (typeof arg === "string") {
          let i = dataIdx.push(index) - 1;
          return str + `<block-text-${i}/>`;
        } else {
          let i = childrenIdx.push(index) - 1;
          return str + `<block-child-${i}/>`;
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
```

There is something subtle going on here: to compile our template, we not only
uses the structure of the template string, which is expected, but also the type
of the args given in the first rendering. There are two reasons for that: first,
it is just easier than extracting the information from the template strings. Also,
there is a deeper issue: there is no possible way to differentiate between (inline)
texts and children: both `<p>${someText}</p>` and `<p>${someChild}</p>` generate
the same pieces of html strings! It certainly is possible to avoid the issue,
for example, by always treating them as child, and then at runtime wrapping the text in a `text()`
vnode, but it has a cost.

## Iteration 3: add support for handlers, refs and attributes

Now, let's modify our code above to add support for event handlers, attributes
and refs. To do that, we will use the following heuristic:

- if previous string ends with an "=", we extract last word before the "=",
  - if that word starts with "on", we treat it as an event handler,
  - if that word is ref, then it is interpreted as a (callback) ref,
  - otherwise, it is an attribute.
- if the data is a string or a number, it should be an inline text
- otherwise, we assume it is a virtual node (child)

So, in the following html string:

```js
html`
  <div class=${"hey"} onClick=${onClick}>
    <p>${"some text"}</p>
    <div ref=${fn}>${someChild}</div>
  </div>
`;
```

The 5 holes are respectively an attribute (for the `class` attribute), an
handler (for the `click` event), an inline text, a ref and a child.

The code to implement that specification is not particularly difficult:

```js
// in compileTemplate function
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
      if (typeof arg === "string" || typeof arg === "number") {
        let i = dataIdx.push(index) - 1;
        return str + `<block-text-${i}/>`;
      } else {
        let i = childrenIdx.push(index) - 1;
        return str + `<block-child-${i}/>`;
      }
    }
    return str;
  })
  .join("");
```

The code on top of this page now really works. Or we can test it with an
application such as this:

```js
function Counter(render) {
  let state = 0;
  let inc = () => {
    state++;
    render();
  };

  return () => html`<button onClick=${inc}>Value: ${state}</button>`;
}

function Main() {
  return () => html`<div>${component(Counter)} ${component(Counter)}</div>`;
}
```

We now have a framework that is much more developer-friendly than before. We
can now define a template in a natural way, and includes data and subcomponents
directly in their correct position. It is not yet complete, but I can really
imagine writing an application with such a framework.

---

Quick links: [start](readme.md) - [part 1](part1.md) - **part 2** - [part 3](part3.md) - [part 4](part4.md) - [part 5](part5.md) - [part 6](part6.md) - [conclusion](conclusion.md)
