import type { Setter } from "./block_compiler";

const elementProto = Element.prototype;
const elementSetAttribute = elementProto.setAttribute;
const elementRemoveAttribute = elementProto.removeAttribute;
const tokenList = DOMTokenList.prototype;
const tokenListAdd = tokenList.add;
const tokenListRemove = tokenList.remove;

/**
 * We regroup here all code related to updating attributes in a very loose sense:
 * attributes, properties and classs are all managed by the functions in this
 * file.
 */

export function createAttrUpdater(attr: string): Setter<HTMLElement> {
  return function (this: HTMLElement, value: any) {
    if (value !== false) {
      elementSetAttribute.call(this, attr, value === true ? "" : value);
    }
  };
}

export function attrsSetter(this: HTMLElement, attrs: any) {
  if (Array.isArray(attrs)) {
    elementSetAttribute.call(this, attrs[0], attrs[1]);
  } else {
    for (let k in attrs) {
      elementSetAttribute.call(this, k, attrs[k]);
    }
  }
}

export function attrsUpdater(this: HTMLElement, attrs: any, oldAttrs: any) {
  if (Array.isArray(attrs)) {
    const name = attrs[0];
    const val = attrs[1];
    if (name === oldAttrs[0]) {
      if (val === oldAttrs[1]) {
        return;
      }
      elementSetAttribute.call(this, name, val);
    } else {
      elementRemoveAttribute.call(this, oldAttrs[0]);
      elementSetAttribute.call(this, name, val);
    }
  } else {
    for (let k in oldAttrs) {
      if (!(k in attrs)) {
        elementRemoveAttribute.call(this, k);
      }
    }
    for (let k in attrs) {
      const val = attrs[k];
      if (val !== oldAttrs[k]) {
        elementSetAttribute.call(this, k, val);
      }
    }
  }
}

function toClassObj(expr: string | number | { [c: string]: any }) {
  const result: { [c: string]: any } = {};

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
  for (let i = 0, l = words.length; i < l; i++) {
    result[words[i]] = true;
  }
  return result;
}

export function setClass(this: HTMLElement, val: any) {
  val = val === undefined ? {} : toClassObj(val);
  // add classes
  const cl = this.classList;
  for (let c in val) {
    tokenListAdd.call(cl, c);
  }
}

export function updateClass(this: HTMLElement, val: any, oldVal: any) {
  oldVal = oldVal === undefined ? {} : toClassObj(oldVal);
  val = val === undefined ? {} : toClassObj(val);
  const cl = this.classList;
  // remove classes
  for (let c in oldVal) {
    if (!(c in val)) {
      tokenListRemove.call(cl, c);
    }
  }
  // add classes
  for (let c in val) {
    if (!(c in oldVal)) {
      tokenListAdd.call(cl, c);
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
