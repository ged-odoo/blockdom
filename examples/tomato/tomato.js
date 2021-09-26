(function () {

  const { list, createBlock } = blockdom;

  // Component
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

    patch(other) {
      if (!this.isDestroyed) {
        let current = currentVNode;
        let dirtyEffects = this.effects.filter((e) => e.checkDirty());
        this.node.patch(this.instance(other.props), this.isParent);
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

  // render function

  function render(Comp, target) {
    let vnode = new VComponent(Comp);
    vnode.mount(target);
  }

  // html tagged template

  let cache = new WeakMap();

  function html(strings, ...args) {
    let template = cache.get(strings);
    if (!template) {
      template = compileTemplate(strings, args);
      cache.set(strings, template);
    }
    return template(args);
  }

  // template compiler

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

  // scheduler

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

  // reactivity

  function useState(value) {
    let vnode = currentVNode;

    let state = () => value;
    let setState = (newValue) => {
      value = newValue;
      scheduleRendering(vnode);
    };
    return [state, setState];
  }

  // effects management

  const NO_OP = () => { };

  class Effect {
    constructor(effect, depsFn = NO_OP) {
      this.fn = effect;
      this.depsFn = depsFn;
      this.deps = this.depsFn() || [];
      this.perform();
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

  // iterators


  function createIterator(key, elemFn, depsFn) {
    if (!depsFn) {
      return function iterate(elems) {
        return list(
          elems.map((elem) => {
            let node = elemFn(elem);
            node.key = elem[key];
            return node;
          })
        );
      };
    }
    let cache = {};

    return function iterate(elems) {
      let nextCache = {};
      let result = list(
        elems.map((elem) => {
          let cacheKey = elem[key];
          let deps = depsFn(elem);
          let cachedElem = cache[cacheKey];
          if (cachedElem) {
            let cacheDeps = cachedElem.memo;
            let isSame = true;
            for (let i = 0, l = cacheDeps.length; i < l; i++) {
              if (deps[i] !== cacheDeps[i]) {
                isSame = false;
                break;
              }
            }
            if (isSame) {
              nextCache[cacheKey] = cachedElem;
              return cachedElem;
            }
          }
          let node = elemFn(elem);
          node.key = cacheKey;
          node.memo = deps;
          nextCache[cacheKey] = node;
          return node;
        })
      );
      cache = nextCache;
      return result;
    };
  }

  window.tomato = {
    component,
    render,
    html,
    useState,
    useEffect,
    createIterator
  };

})();
