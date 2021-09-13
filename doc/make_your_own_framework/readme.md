# Tutorial: Make your own framework

## Overview

This project, `blockdom`, does not pretend to be a framework. It simply is
designed to be a lower layer, on top of which other frameworks can be built.

In this tutorial, we will make a simple framework, imaginatively named `tomato`,
on top of `blockdom`. Here is a sneak peak of what `tomato` can do:

```js
import { render, component, useState } from "tomato";

function Counter() {
  let [counter, setCounter] = useState(0);
  let inc = () => setCounter(counter() + 1);

  useEffect(
    () => {
      document.title = `Value = ${counter()}`;
    },
    () => [counter()]
  );

  return () => html` <div>
    <p>Value: ${value}</p>
    <button onClick=${inc}>Increment</button>
  </div>`;
}

function Main() {
  let someValue = "tomato";

  return () => html` <div>
    <p>Hello ${someValue}</p>
    ${component(Counter)}
  </div>`;
}

render(Main, document.body);
```

Frameworks are full of compromises. Few abstractions are zero-cost, especially
if there are no compilation step. Many choices can be made for many reasons.
Developer experience is also a valid concern. As such, neither `blockdom` nor
this toy framework are the perfect answer to what a framework should be.

But it certainly is interesting to understand how to define concepts with a high
abstraction level on top of lower level primitives. In particular, the notion of
component is very interesting. Understanding how components can be defined, and
how the rendering of an application interleaves the reconciliation phase of a
virtual dom with the rendering of components is very satisfying. This is actually
the reason why I wrote this tutorial. It's kind of a document I wish I could have
read a few years ago.

## Tutorial

- [Part 1: Component System](part1.md)
- [Part 2: Tagged Templates](part2.md)
- [Part 3: Reactivity](part3.md)
- [Part 4: Lifecycle](part4.md)
- [Part 5: Effects](part5.md)
- [Part 6: Lists and iterators](part6.md)
- [Conclusion](conclusion.md)
