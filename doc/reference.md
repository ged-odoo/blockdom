# Reference

`blockdom` api is quite small: 6 function to create vnodes, 3 functions to manipulate
vdom trees and one configuration object.

## The Golden Rule

By design, `blockdom` assumes that a virtual tree is patched with a virtual tree
of the same shape. This comes naturally when we compile a template into a render
function (which is my intended usecase). But this means that one cannot patch
a block with a block of another type (or a virtual tree with different types of
nodes). In order to do that, one needs to use explicitely a `toggler` element
(see below).

```js
const block1 = createBlock(`<div>block1</div>`);
const block2 = createBlock(`<div>block2</div>`);

// incorrect: trees have not the same shape!!!
{
  const tree = block1();
  mount(tree, document.body);
  patch(tree, block2());
}

// correct: trees uses the toggler element to differentiate between two sub trees
{
  const tree = toggler("tree1", block1());
  mount(tree, document.body);
  patch(tree, toggler("tree2", block2()));
}
```

## Manipulating vnodes

`blockdom` provide three functions:

- `mount(vnode, target)` is called initially to mount a vnode tree inside a
  target (which should be an html element). This will create the relevant DOM and
  store the proper references inside the vnodes.

- `patch(vnode1, vnode2)` is used to update a (already mounted) vnode tree with
  a new vnode tree. This method will patch the dom, and update the internal
  references in `vnode`. `vnode2` is left unchanged, and can be discarded.
  Also, note that if `vnode1` and `vnode2` are the same reference, then the
  patching process will be entirely skipped. This is the way we can implement
  memoization.

- `remove(vnode)` is a method that will remove a (already mounted) vnode tree.

## Creating vnodes

First, let us talk about the various vnode types:

| Name      | Purpose                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `block`   | a representation of an html element (with children/attributes)                         |
| `multi`   | a representation of a static list of vnodes (possibly undefined or of different types) |
| `list`    | a dynamic list of vnodes (which have all the same type)                                |
| `text`    | a simple vnode representing a text node                                                |
| `toggler` | a container node that allows switching dynamically between different type of subnodes  |
| `html`    | represent an arbitrary html content                                                    |

### Blocks

The most important vnode type is a block. Since each block is actually unique,
we need to first generate a block builder function:

```js
const block = createBlock(`<div>hello blockdom</div>`);
```

The `createBlock` function takes a string and return a function that builds the
corresponding block:

```js
const tree = block(); // now tree is a vnode that can be mounted/patched
```

So, in a sense, `createBlock` is a kind of factory. It creates a function that
will generate the final vnode. The function `createBlock` takes two optional
arguments: `data` (list of values) and `children` (list of vnodes).

The values given in `data` are used to set/update dynamic content (text, attributes,
handlers or refs). The vnodes in `children` correspond to sub blocks.

Text content is simply added by using a special tag `block-text-{index}`:

```js
const block = createBlock(`<div><p><block-text-0/></p><p><block-text-1/></p></div>`);
```

Notice the suffix `0` and `1`: all content nodes/attributes have to be indexed,
starting at 0. Then, we can provide the corresponding values in the `data` array,
given in argument:

```js
const tree = block(["hello", "blockdom"]);
```

This tree now represents `<div><p>hello</p><p>blockdom</p></div>`

Block attributes are defined with an attribute: `block-attribute-{index}`:

```js
const block = createBlock(`<div block-attribute-0="hello"></div>`);
const tree = block(["world"]); // correspond to <div hello="world"></div>
```

Note that attribute here is given a broad meaning: class and styles are considered
attributes (but they will use specialized code to properly manage them), and also
some special tags have properties (for example, the `checked` property on an input).
These properties are also properly handled, even though they are defined as
attribute.

Event handlers can be added with the `block-handler-{index}` attribute:

```js
const block = createBlock(`<div block-handler-0="click"></div>`);
const tree = block([someFunction]);
```

By default, `blockdom` support two variations: the given data can be a function
(in that case, it will be called with the event as argument), or it can be a pair
`[fn, value]`, in which case, the function `fn` will be called with `value, event`
as arguments.

Note that this behaviour can be customized (see the section about configuration).
Also, `blockdom` has a synthetic event system: this means that it does not
really attach an event handler for each handler in each block. It just binds a
simple global event handler on `document.body` for each event type, and will
properly call the corresponding handlers when necessary.

Finally, blocks can define a reference with the `block-ref={index}` attribute.
In this case, the provided data should be a function:

```js
const block = createBlock(`<div><p block-ref="0">hey</p></div>`);
const tree = block([someFunction]);
```

The function `someFunction` will be called with the htmlelement `<p>` when it is
created, and then later with `null` when it is removed from the dom.

### multi

The multi block is useful when we deal with a fixed number of vnodes. For example,
a template with multiple consecutive elements. Also, some or all of its vnodes
can be undefined. This is useful when there is some condition for a child to be
present. If a child is undefined, the multi vnode will replace it by an empty
text node.

```js
const block1 = createBlock(`<div>1</div>`);
const block2 = createBlock(`<div>2</div>`);

const tree = multi([block1(), block2()]); // represents `<div>1</div><div>2</div>`
const otherTree = multi([block1(), undefined]); // represents `<div>1</div>`
```

Each children can be a mix of any type.

### list

A `list` vnode represents a dynamic collection of vnodes, all of them with the
same type. Each of these nodes need to have a key to properly reconcile them.
Here is an example:

```js
const data = [
  { id: 1, text: "apple" },
  { id: 2, text: "pear" },
];
const block = createBlock(`<p><block-text-0/></p>`);

const items = data.map((item) => withKey(block([item.text]), item.id));
const tree = list(items); // represents <p>apple</p><p>pear</p>
```

Note the use of the `withKey` helper.

### text

Most text are inserted inside a block with `block-text-{index}`. However, in
some cases, it is useful to be able to manipulate directly just a simple text
node:

```js
// represents 3 text nodes: blackyellowred
const tree = multi([text("black"), text("yellow"), text("red")]);
```

### toggler

As mentioned above, `blockdom` need each vnode in a patch operation to be of the
same exact type. However, it is not always known before hand what the concrete
type of the vnode will be. For example, if we implement sub templates (partials)
in a template language. The call site does not know what the result of an
arbitrary template render will be. In that case, we need the `toggler` vnode
to dispatch between different type of vnodes:

```js
const block = createBlock("<p>hey</p>");

const tree1 = toggler("key1", text("foo")); // represent a text node with foo
const tree2 = toggler("key2", block()); // represent <p>hey</p>
```

The `toggler` function takes a `key` as first argument, and a vnode as second.
When it is patched, it compares the values of the keys: if they are the same,
it will simply patch the child vnode. If they are different, it will remove the
previous one and mount the new vnode in its place.

### html

This should be used with caution: this vnode type is used to insert arbitrary
html into the DOM:

```js
const tree = html("<div>hey</div>");
```

This should be avoided most of the time. However, it happens that we need to
display some (hopefully safe/sanitized) html coming from the database. In that
case, the `html` vnode type is here to perform the job.

## Configuration

Here is a list of every configuration options in `blockdom`:

- `shouldNormalizeDom (boolean, default=true)` If true, `blockdom` will normalize
  the DOM generated by blocks. This means removing text nodes that only contains
  spaces.

  ```js
  config.shouldNormalizeDom = true;
  ```

- `mainEventHandler (function taking (data, event))`. Each event generated by
  handlers will go through that method. By default, `blockdom` uses
  the following code:

  ```js
  config.mainEventHandler = (data, event) => {
    if (typeof data === "function") {
      data(ev);
    } else if (Array.isArray(data)) {
      data[0](data[1], ev);
    }
  };
  ```

  This means that the data given to the block can be either a function or a pair
  `[function, argument]`. Overriding this may be helpful if the code using
  `blockdom` has different needs (for example, checking if a component is still
  alive).
