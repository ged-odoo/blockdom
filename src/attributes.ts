import type { Setter, Updater } from "./block_compiler";
/**
 * We regroup here all code related to updating attributes in a very loose sense:
 * attributes, properties and classs are all managed by the functions in this
 * file.
 */

export function createAttrUpdater(attr: string): Setter<HTMLElement> {
  return function (this: HTMLElement, value: any) {
    if (value !== false) {
      if (value === true) {
        this.setAttribute(attr, "");
      } else {
        this.setAttribute(attr, value);
      }
    }
  };
}

export function attrsSetter(this: HTMLElement, attrs: any) {
  if (Array.isArray(attrs)) {
    this.setAttribute(attrs[0], attrs[1]);
  } else {
    for (let k in attrs) {
      this.setAttribute(k, attrs[k]);
    }
  }
}

export function attrsUpdater(this: HTMLElement, attrs: any, oldAttrs: any) {
  if (Array.isArray(attrs)) {
    if (attrs[0] === oldAttrs[0]) {
      if (attrs[1] === oldAttrs[1]) {
        return;
      }
      this.setAttribute(attrs[0], attrs[1]);
    } else {
      this.removeAttribute(oldAttrs[0]);
      this.setAttribute(attrs[0], attrs[1]);
    }
  } else {
    for (let k in oldAttrs) {
      if (!(k in attrs)) {
        this.removeAttribute(k);
      }
    }
    for (let k in attrs) {
      if (attrs[k] !== oldAttrs[k]) {
        this.setAttribute(k, attrs[k]);
      }
    }
  }
}

function toClassObj(expr: string | number | { [c: string]: any }, expr2?: any) {
  const result: { [c: string]: any } = expr2 ? toClassObj(expr2) : {};

  if (typeof expr === "object") {
    // this is already an object but we may need to split keys:
    // {'a': true, 'b c': true} should become {a: true, b: true, c: true}
    for (let key in expr) {
      const value = expr[key];
      if (value) {
        const words = key.split(/\s+/);
        for (let word of words) {
          result[word] = value;
        }
      }
    }
    return result;
  }
  if (typeof expr !== "string") {
    expr = String(expr);
  }
  // we transform here a list of classes into an object:
  //  'hey you' becomes {hey: true, you: true}
  const str = expr.trim();
  if (!str) {
    return {};
  }
  let words = str.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    result[words[i]] = true;
  }
  return result;
}

export function setClass(this: HTMLElement, val: any) {
  val = val === undefined ? {} : toClassObj(val);
  // add classes
  for (let c in val) {
    this.classList.add(c);
  }
}

export function updateClass(this: HTMLElement, val: any, oldVal: any) {
  oldVal = oldVal === undefined ? {} : toClassObj(oldVal);
  val = val === undefined ? {} : toClassObj(val);
  // remove classes
  for (let c in oldVal) {
    if (!(c in val)) {
      this.classList.remove(c);
    }
  }
  // add classes
  for (let c in val) {
    if (!(c in oldVal)) {
      this.classList.add(c);
    }
  }
}

export function makePropSetter(name: string): Setter<HTMLElement> {
  return function setProp(this: HTMLElement, value: any) {
    (this as any)[name] = value;
  };
}

export function isProp(tag: string, key: string): boolean {
  switch (tag) {
    case "input":
      return (
        key === "checked" ||
        key === "indeterminate" ||
        key === "value" ||
        key === "readonly" ||
        key === "disabled"
      );
    case "option":
      return key === "selected" || key === "disabled";
    case "textarea":
      return key === "readonly" || key === "disabled";
      break;
    case "button":
    case "select":
    case "optgroup":
      return key === "disabled";
  }
  return false;
}
