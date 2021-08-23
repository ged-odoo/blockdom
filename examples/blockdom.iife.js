(function (exports) {
    'use strict';

    // -----------------------------------------------------------------------------
    // Toggler node
    // -----------------------------------------------------------------------------
    class VToggler {
        //   singleNode?: boolean | undefined;
        constructor(key, child) {
            this.key = key;
            this.child = child;
        }
        mount(parent, afterNode) {
            this.parentEl = parent;
            this.child.mount(parent, afterNode);
        }
        moveBefore(other, afterNode) {
            this.child.moveBefore(other ? other.child : null, afterNode);
        }
        patch(other) {
            if (this === other) {
                return;
            }
            if (this.key === other.key) {
                this.child.patch(other.child);
            }
            else {
                other.child.mount(this.parentEl, this.child.firstNode());
                this.child.beforeRemove();
                this.child.remove();
                this.child = other.child;
                this.key = other.key;
            }
        }
        beforeRemove() { }
        remove() {
            this.child.remove();
        }
        firstNode() {
            return this.child.firstNode();
        }
        toString() {
            return this.child.toString();
        }
    }
    function toggler(key, child) {
        return new VToggler(key, child);
    }

    const getDescriptor$3 = (o, p) => Object.getOwnPropertyDescriptor(o, p);
    const nodeProto$4 = Node.prototype;
    const characterDataProto$1 = CharacterData.prototype;
    const nodeInsertBefore$3 = nodeProto$4.insertBefore;
    const characterDataSetData$1 = getDescriptor$3(characterDataProto$1, "data").set;
    const nodeRemoveChild$3 = nodeProto$4.removeChild;
    class VText {
        constructor(text) {
            this.text = text;
        }
        mount(parent, afterNode) {
            this.parentEl = parent;
            const node = document.createTextNode(toText(this.text));
            nodeInsertBefore$3.call(parent, node, afterNode);
            this.el = node;
        }
        moveBefore(other, afterNode) {
            const target = other ? other.el : afterNode;
            nodeInsertBefore$3.call(this.parentEl, this.el, target);
        }
        patch(other) {
            const text2 = other.text;
            if (this.text !== text2) {
                characterDataSetData$1.call(this.el, toText(text2));
                this.text = text2;
            }
        }
        beforeRemove() { }
        remove() {
            nodeRemoveChild$3.call(this.parentEl, this.el);
        }
        firstNode() {
            return this.el;
        }
        toString() {
            return this.text;
        }
    }
    function text(str) {
        return new VText(str);
    }
    function toText(value) {
        switch (typeof value) {
            case "string":
                return value;
            case "number":
                return String(value);
            case "boolean":
                return value ? "true" : "false";
            case "object":
                return value ? value.toString() : "";
            default:
                // most notably, undefined
                return "";
        }
    }

    const getDescriptor$2 = (o, p) => Object.getOwnPropertyDescriptor(o, p);
    const nodeProto$3 = Node.prototype;
    const elementProto = Element.prototype;
    const characterDataProto = CharacterData.prototype;
    const characterDataSetData = getDescriptor$2(characterDataProto, "data").set;
    const nodeGetFirstChild = getDescriptor$2(nodeProto$3, "firstChild").get;
    const nodeGetNextSibling = getDescriptor$2(nodeProto$3, "nextSibling").get;
    const NO_OP = () => { };
    const config = {
        shouldNormalizeDom: true,
        mainEventHandler: (data, ev) => {
            if (typeof data === "function") {
                data(ev);
            }
            else if (Array.isArray(data)) {
                data[0](data[1], ev);
            }
        },
    };
    const cache = {};
    function createBlock(str) {
        if (str in cache) {
            return cache[str];
        }
        const info = [];
        const ctx = {
            path: ["el"],
            info,
        };
        const doc = new DOMParser().parseFromString(str, "text/xml");
        const node = doc.firstChild;
        if (config.shouldNormalizeDom) {
            normalizeNode(node);
        }
        const template = processDescription(node, ctx);
        const result = compileBlock(info, template);
        cache[str] = result;
        return result;
    }
    function normalizeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (!/\S/.test(node.textContent)) {
                node.remove();
                return;
            }
            // node.textContent = node.textContent!.trim();
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "pre") {
                return;
            }
        }
        for (let i = node.childNodes.length - 1; i >= 0; --i) {
            normalizeNode(node.childNodes.item(i));
        }
    }
    function processDescription(node, ctx, parentPath = []) {
        switch (node.nodeType) {
            case 1: {
                // HTMLElement
                const tagName = node.tagName;
                if (tagName.startsWith("owl-text-")) {
                    const index = parseInt(tagName.slice(9), 10);
                    ctx.info.push({ index, path: ctx.path.slice(), type: "text" });
                    return document.createTextNode("");
                }
                if (tagName.startsWith("owl-child-")) {
                    const index = parseInt(tagName.slice(10), 10);
                    ctx.info.push({ index, type: "child", path: ctx.path.slice(), parentPath });
                    return document.createTextNode("");
                }
                const result = document.createElement(node.tagName);
                const attrs = node.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attrName = attrs[i].name;
                    const attrValue = attrs[i].value;
                    if (attrName.startsWith("owl-handler-")) {
                        const index = parseInt(attrName.slice(12), 10);
                        ctx.info.push({
                            index,
                            path: ctx.path.slice(),
                            type: "handler",
                            event: attrValue,
                        });
                    }
                    else if (attrName.startsWith("owl-attribute-")) {
                        const index = parseInt(attrName.slice(14), 10);
                        ctx.info.push({
                            index,
                            path: ctx.path.slice(),
                            type: "attribute",
                            name: attrValue,
                            tag: tagName,
                        });
                    }
                    else if (attrName === "owl-attributes") {
                        ctx.info.push({
                            index: parseInt(attrValue, 10),
                            path: ctx.path.slice(),
                            type: "attributes",
                        });
                    }
                    else if (attrName === "owl-ref") {
                        ctx.info.push({
                            index: parseInt(attrValue, 10),
                            path: ctx.path.slice(),
                            type: "ref",
                        });
                    }
                    else {
                        result.setAttribute(attrs[i].name, attrValue);
                    }
                }
                let children = node.childNodes;
                if (children.length === 1) {
                    const childNode = children[0];
                    if (childNode.nodeType === 1 && childNode.tagName.startsWith("owl-child-")) {
                        const tagName = childNode.tagName;
                        const index = parseInt(tagName.slice(10), 10);
                        ctx.info.push({ index, type: "child", path: ctx.path.slice(), isOnlyChild: true });
                        return result;
                    }
                }
                const initialPath = ctx.path.slice();
                let currentPath = initialPath.slice();
                for (let i = 0; i < children.length; i++) {
                    currentPath = currentPath.concat(i === 0 ? "firstChild" : "nextSibling");
                    ctx.path = currentPath;
                    result.appendChild(processDescription(children[i], ctx, initialPath));
                }
                ctx.path = initialPath;
                return result;
            }
            case 3: {
                // text node
                return document.createTextNode(node.textContent);
            }
            case 8: {
                // comment node
                return document.createComment(node.textContent);
            }
        }
        throw new Error("boom");
    }
    function createAttrUpdater(attr) {
        return function (value) {
            if (value !== false) {
                if (value === true) {
                    this.setAttribute(attr, "");
                }
                else {
                    this.setAttribute(attr, value);
                }
            }
        };
    }
    function attrsSetter(attrs) {
        if (Array.isArray(attrs)) {
            this.setAttribute(attrs[0], attrs[1]);
        }
        else {
            for (let k in attrs) {
                this.setAttribute(k, attrs[k]);
            }
        }
    }
    function attrsUpdater(attrs, oldAttrs) {
        if (Array.isArray(attrs)) {
            if (attrs[0] === oldAttrs[0]) {
                if (attrs[1] === oldAttrs[1]) {
                    return;
                }
                this.setAttribute(attrs[0], attrs[1]);
            }
            else {
                this.removeAttribute(oldAttrs[0]);
                this.setAttribute(attrs[0], attrs[1]);
            }
        }
        else {
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
    function isProp(tag, key) {
        switch (tag) {
            case "input":
                return (key === "checked" ||
                    key === "indeterminate" ||
                    key === "value" ||
                    key === "readonly" ||
                    key === "disabled");
            case "option":
                return key === "selected" || key === "disabled";
            case "textarea":
                return key === "readonly" || key === "disabled";
            case "button":
            case "select":
            case "optgroup":
                return key === "disabled";
        }
        return false;
    }
    function toClassObj(expr, expr2) {
        const result = expr2 ? toClassObj(expr2) : {};
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
    function setClass(val) {
        val = val === undefined ? {} : toClassObj(val);
        // add classes
        for (let c in val) {
            this.classList.add(c);
        }
    }
    function updateClass(val, oldVal) {
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
    function makePropSetter(name) {
        return function setProp(value) {
            this[name] = value;
        };
    }
    const nativeToSyntheticEvent = (event, name) => {
        const eventKey = `__event__${name}`;
        let dom = event.target;
        while (dom !== null) {
            const data = dom[eventKey];
            if (data) {
                config.mainEventHandler(data, event);
                return;
            }
            dom = dom.parentNode;
        }
    };
    const CONFIGURED_SYNTHETIC_EVENTS = {};
    function setupSyntheticEvent(name) {
        if (CONFIGURED_SYNTHETIC_EVENTS[name]) {
            return;
        }
        document.addEventListener(name, (event) => nativeToSyntheticEvent(event, name));
        CONFIGURED_SYNTHETIC_EVENTS[name] = true;
    }
    function createEventHandler(event) {
        const key = `__event__${event}`;
        return function setupHandler(data) {
            this[key] = data;
        };
    }
    function setText(value) {
        characterDataSetData.call(this, toText(value));
    }
    function compileBlock(info, template) {
        let collectors = [];
        let locations = [];
        let children = [];
        let isDynamic = Boolean(info.length);
        let refs = [];
        if (info.length) {
            let current = 0;
            let refMap = {};
            for (let line of info) {
                let currentIdx = 0;
                for (let i = 0; i < line.path.length; i++) {
                    const key = line.path.slice(0, i + 1).join();
                    currentIdx = key in refMap ? refMap[key] : (refMap[key] = current++);
                }
                line.refIndex = currentIdx;
            }
            for (let path in refMap) {
                if (path === "el") {
                    continue;
                }
                const pathL = path.split(",");
                const prevIdx = refMap[pathL.slice(0, -1).join()];
                switch (pathL[pathL.length - 1]) {
                    case "firstChild":
                        collectors.push({
                            prevIdx,
                            getVal: nodeGetFirstChild,
                        });
                        break;
                    case "nextSibling":
                        collectors.push({
                            prevIdx,
                            getVal: nodeGetNextSibling,
                        });
                        break;
                }
            }
            // building locations and child insertion points
            for (let line of info) {
                switch (line.type) {
                    case "text": {
                        const refIdx = line.refIndex;
                        locations.push({
                            idx: line.index,
                            refIdx,
                            setData: setText,
                            updateData: setText,
                        });
                        break;
                    }
                    case "attribute": {
                        const refIdx = line.refIndex;
                        let updater;
                        let setter;
                        if (isProp(line.tag, line.name)) {
                            const setProp = makePropSetter(line.name);
                            setter = setProp;
                            updater = setProp;
                        }
                        else if (line.name === "class") {
                            setter = setClass;
                            updater = updateClass;
                        }
                        else {
                            setter = createAttrUpdater(line.name);
                            updater = setter;
                        }
                        locations.push({
                            idx: line.index,
                            refIdx,
                            setData: setter,
                            updateData: updater,
                        });
                        break;
                    }
                    case "attributes": {
                        const refIdx = line.refIndex;
                        locations.push({
                            idx: line.index,
                            refIdx,
                            setData: attrsSetter,
                            updateData: attrsUpdater,
                        });
                        break;
                    }
                    case "handler": {
                        const refIdx = line.refIndex;
                        const setupHandler = createEventHandler(line.event);
                        setupSyntheticEvent(line.event);
                        locations.push({
                            idx: line.index,
                            refIdx,
                            setData: setupHandler,
                            updateData: setupHandler,
                        });
                        break;
                    }
                    case "child":
                        if (line.isOnlyChild) {
                            children.push({
                                parentRefIdx: line.refIndex,
                                singleNode: true,
                            });
                        }
                        else {
                            const prevIdx = refMap[line.parentPath.join()];
                            children.push({
                                parentRefIdx: prevIdx,
                                afterRefIdx: line.refIndex, // current ref is textnode anchor
                            });
                        }
                        break;
                    case "ref": {
                        const refIdx = line.refIndex;
                        refs.push(line.index);
                        locations.push({
                            idx: line.index,
                            refIdx,
                            setData: setRef,
                            updateData: NO_OP,
                        });
                    }
                }
            }
        }
        let B = createBlockClass(template, collectors, locations, children, isDynamic);
        if (refs.length) {
            B = class extends B {
                remove() {
                    super.remove();
                    for (let ref of refs) {
                        let fn = this.data[ref];
                        fn(null);
                    }
                }
            };
        }
        if (children.length) {
            B = class extends B {
                beforeRemove() {
                    // todo: share that code with multi?
                    const children = this.children;
                    for (let i = 0, l = children.length; i < l; i++) {
                        const child = children[i];
                        if (child) {
                            child.beforeRemove();
                        }
                    }
                }
            };
            return (data, children) => new B(data, children);
        }
        return (data) => new B(data);
    }
    function setRef(fn) {
        fn(this);
    }
    function createBlockClass(template, collectors, locations, childrenLocs, isDynamic) {
        let colLen = collectors.length;
        let locLen = locations.length;
        let childN = childrenLocs.length;
        const refN = colLen + 1;
        const nodeCloneNode = nodeProto$3.cloneNode;
        const nodeInsertBefore = nodeProto$3.insertBefore;
        const elementRemove = elementProto.remove;
        return class Block {
            constructor(data, children) {
                this.data = data;
                this.children = children;
            }
            beforeRemove() { }
            remove() {
                elementRemove.call(this.el);
            }
            firstNode() {
                return this.el;
            }
            moveBefore(other, afterNode) {
                const target = other ? other.el : afterNode;
                nodeInsertBefore.call(this.parentEl, this.el, target);
            }
            mount(parent, afterNode) {
                const el = nodeCloneNode.call(template, true);
                // console.warn(colLen)
                nodeInsertBefore.call(parent, el, afterNode);
                if (isDynamic) {
                    // collecting references
                    const refs = new Array(refN);
                    this.refs = refs;
                    refs[0] = el;
                    for (let i = 0; i < colLen; i++) {
                        const w = collectors[i];
                        refs[i + 1] = w.getVal.call(refs[w.prevIdx]);
                    }
                    this.refs = refs;
                    // console.warn(refs)
                    // applying data to all update points
                    if (locLen) {
                        const data = this.data;
                        for (let i = 0; i < locLen; i++) {
                            const loc = locations[i];
                            loc.setData.call(refs[loc.refIdx], data[loc.idx]);
                        }
                    }
                    // preparing all children
                    // console.warn(childN)
                    if (childN) {
                        const children = this.children;
                        if (children) {
                            for (let i = 0; i < childN; i++) {
                                const child = children[i];
                                if (child) {
                                    const loc = childrenLocs[i];
                                    const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
                                    child.singleNode = loc.singleNode;
                                    child.mount(refs[loc.parentRefIdx], afterNode);
                                }
                            }
                        }
                    }
                }
                this.el = el;
                this.parentEl = parent;
            }
            patch(other) {
                if (this === other) {
                    return;
                }
                const refs = this.refs;
                // update texts/attributes/
                if (locLen) {
                    const data1 = this.data;
                    const data2 = other.data;
                    for (let i = 0; i < locLen; i++) {
                        const loc = locations[i];
                        const idx = loc.idx;
                        const val1 = data1[idx];
                        const val2 = data2[idx];
                        if (val1 !== val2) {
                            loc.updateData.call(refs[loc.refIdx], val2, val1);
                        }
                    }
                    this.data = other.data;
                }
                // update children
                if (childN) {
                    let children1 = this.children;
                    if (!children1) {
                        this.children = children1 = [];
                    }
                    const children2 = other.children || [];
                    // console.warn(children1, children2)
                    for (let i = 0; i < childN; i++) {
                        const child1 = children1[i];
                        const child2 = children2[i];
                        if (child1) {
                            if (child2) {
                                child1.patch(child2);
                            }
                            else {
                                child1.beforeRemove();
                                child1.remove();
                                children1[i] = undefined;
                            }
                        }
                        else if (child2) {
                            const loc = childrenLocs[i];
                            const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
                            child2.mount(refs[loc.parentRefIdx], afterNode);
                            children1[i] = child2;
                        }
                    }
                }
            }
            toString() {
                const div = document.createElement("div");
                this.mount(div, null);
                return div.innerHTML;
            }
        };
    }

    const getDescriptor$1 = (o, p) => Object.getOwnPropertyDescriptor(o, p);
    const nodeProto$2 = Node.prototype;
    const nodeInsertBefore$2 = nodeProto$2.insertBefore;
    const nodeAppendChild = nodeProto$2.appendChild;
    const nodeRemoveChild$2 = nodeProto$2.removeChild;
    const nodeSetTextContent$1 = getDescriptor$1(nodeProto$2, "textContent").set;
    // -----------------------------------------------------------------------------
    // List Node
    // -----------------------------------------------------------------------------
    class VList {
        constructor(children, withBeforeRemove) {
            this.children = children;
            this.withBeforeRemove = withBeforeRemove;
        }
        mount(parent, afterNode) {
            const children = this.children;
            const _anchor = document.createTextNode("");
            this.anchor = _anchor;
            nodeInsertBefore$2.call(parent, _anchor, afterNode);
            const l = children.length;
            if (l) {
                const mount = children[0].mount;
                for (let i = 0; i < l; i++) {
                    mount.call(children[i], parent, _anchor);
                }
            }
            this.parentEl = parent;
        }
        moveBefore(other, afterNode) {
            // todo
        }
        patch(other) {
            if (this === other) {
                return;
            }
            const ch1 = this.children;
            const ch2 = other.children;
            if (ch2.length === 0 && ch1.length === 0) {
                return;
            }
            const proto = ch2[0] || ch1[0];
            const { mount: cMount, patch: cPatch, remove: cRemove, beforeRemove, moveBefore: cMoveBefore, firstNode: cFirstNode, } = proto;
            const _anchor = this.anchor;
            const isOnlyChild = this.singleNode;
            const withBeforeRemove = this.withBeforeRemove;
            const parent = this.parentEl;
            // fast path: no new child => only remove
            if (ch2.length === 0 && isOnlyChild) {
                if (withBeforeRemove) {
                    for (let i = 0, l = ch1.length; i < l; i++) {
                        beforeRemove.call(ch1[i]);
                    }
                }
                nodeSetTextContent$1.call(parent, "");
                nodeAppendChild.call(parent, _anchor);
                this.children = ch2;
                return;
            }
            let startIdx1 = 0;
            let startIdx2 = 0;
            let startVn1 = ch1[0];
            let startVn2 = ch2[0];
            let endIdx1 = ch1.length - 1;
            let endIdx2 = ch2.length - 1;
            let endVn1 = ch1[endIdx1];
            let endVn2 = ch2[endIdx2];
            let mapping = undefined;
            // let noFullRemove = this.hasNoComponent;
            while (startIdx1 <= endIdx1 && startIdx2 <= endIdx2) {
                // -------------------------------------------------------------------
                if (startVn1 === null) {
                    startVn1 = ch1[++startIdx1];
                }
                // -------------------------------------------------------------------
                else if (endVn1 === null) {
                    endVn1 = ch1[--endIdx1];
                }
                // -------------------------------------------------------------------
                else if (startVn1.key === startVn2.key) {
                    if (startVn1 !== startVn2) {
                        cPatch.call(startVn1, startVn2);
                        ch2[startIdx2] = startVn1;
                    }
                    startVn1 = ch1[++startIdx1];
                    startVn2 = ch2[++startIdx2];
                }
                // -------------------------------------------------------------------
                else if (endVn1.key === endVn2.key) {
                    if (endVn1 !== endVn2) {
                        cPatch.call(endVn1, endVn2);
                        ch2[endIdx2] = endVn1;
                    }
                    endVn1 = ch1[--endIdx1];
                    endVn2 = ch2[--endIdx2];
                }
                // -------------------------------------------------------------------
                else if (startVn1.key === endVn2.key) {
                    // bnode moved right
                    if (startVn1 !== endVn2) {
                        cPatch.call(startVn1, endVn2);
                        ch2[endIdx2] = startVn1;
                    }
                    const nextChild = ch2[endIdx2 + 1];
                    cMoveBefore.call(startVn1, nextChild, _anchor);
                    startVn1 = ch1[++startIdx1];
                    endVn2 = ch2[--endIdx2];
                }
                // -------------------------------------------------------------------
                else if (endVn1.key === startVn2.key) {
                    // bnode moved left
                    if (endVn1 !== startVn2) {
                        cPatch.call(endVn1, startVn2);
                        ch2[startIdx2] = endVn1;
                    }
                    const nextChild = ch1[startIdx1];
                    cMoveBefore.call(endVn1, nextChild, _anchor);
                    endVn1 = ch1[--endIdx1];
                    startVn2 = ch2[++startIdx2];
                }
                // -------------------------------------------------------------------
                else {
                    mapping = mapping || createMapping(ch1, startIdx1, endIdx1);
                    let idxInOld = mapping[startVn2.key];
                    if (idxInOld === undefined) {
                        cMount.call(startVn2, parent, cFirstNode.call(startVn1) || null);
                    }
                    else {
                        const elmToMove = ch1[idxInOld];
                        cMoveBefore.call(elmToMove, startVn1, null);
                        cPatch.call(elmToMove, startVn2);
                        ch2[startIdx2] = elmToMove;
                        ch1[idxInOld] = null;
                    }
                    startVn2 = ch2[++startIdx2];
                }
            }
            // ---------------------------------------------------------------------
            if (startIdx1 <= endIdx1 || startIdx2 <= endIdx2) {
                if (startIdx1 > endIdx1) {
                    const nextChild = ch2[endIdx2 + 1];
                    const anchor = nextChild ? cFirstNode.call(nextChild) || null : _anchor;
                    for (let i = startIdx2; i <= endIdx2; i++) {
                        cMount.call(ch2[i], parent, anchor);
                    }
                }
                else {
                    for (let i = startIdx1; i <= endIdx1; i++) {
                        let ch = ch1[i];
                        if (ch) {
                            if (withBeforeRemove) {
                                beforeRemove.call(ch);
                            }
                            cRemove.call(ch);
                        }
                    }
                }
            }
            this.children = ch2;
        }
        beforeRemove() {
            if (this.withBeforeRemove) {
                const children = this.children;
                const l = children.length;
                if (l) {
                    const beforeRemove = children[0].beforeRemove;
                    for (let i = 0; i < l; i++) {
                        beforeRemove.call(children[i]);
                    }
                }
            }
        }
        remove() {
            const { parentEl, anchor } = this;
            if (this.singleNode) {
                nodeSetTextContent$1.call(parentEl, "");
            }
            else {
                const children = this.children;
                const l = children.length;
                if (l) {
                    for (let i = 0; i < l; i++) {
                        children[i].remove();
                    }
                }
                nodeRemoveChild$2.call(parentEl, anchor);
            }
        }
        firstNode() {
            const child = this.children[0];
            return child ? child.firstNode() : undefined;
        }
        toString() {
            return this.children.map((c) => c.toString()).join("");
        }
    }
    function list(children, withBeforeRemove = false) {
        return new VList(children, withBeforeRemove);
    }
    function createMapping(ch1, startIdx1, endIdx2) {
        let mapping = {};
        for (let i = startIdx1; i <= endIdx2; i++) {
            mapping[ch1[i].key] = i;
        }
        return mapping;
    }

    const getDescriptor = (o, p) => Object.getOwnPropertyDescriptor(o, p);
    const nodeProto$1 = Node.prototype;
    const nodeInsertBefore$1 = nodeProto$1.insertBefore;
    const nodeSetTextContent = getDescriptor(nodeProto$1, "textContent").set;
    const nodeRemoveChild$1 = nodeProto$1.removeChild;
    // -----------------------------------------------------------------------------
    // Multi NODE
    // -----------------------------------------------------------------------------
    // TODO!!!!!
    // todo:  either keep a child or a anchor, but not both
    // and use same array!!!, and replacechild
    class VMulti {
        constructor(children) {
            this.children = children;
        }
        mount(parent, afterNode) {
            const children = this.children;
            const l = children.length;
            const anchors = new Array(l);
            for (let i = 0; i < l; i++) {
                let child = children[i];
                if (child) {
                    child.mount(parent, afterNode);
                }
                else {
                    const childAnchor = document.createTextNode("");
                    anchors[i] = childAnchor;
                    nodeInsertBefore$1.call(parent, childAnchor, afterNode);
                }
            }
            this.anchors = anchors;
            this.parentEl = parent;
        }
        moveBefore(other, afterNode) {
            if (other) {
                const next = other.children[0];
                afterNode = (next ? next.firstNode() : other.anchors[0]) || null;
            }
            const children = this.children;
            const parent = this.parentEl;
            const anchors = this.anchors;
            for (let i = 0, l = children.length; i < l; i++) {
                let child = children[i];
                if (child) {
                    child.moveBefore(null, afterNode);
                }
                else {
                    const anchor = anchors[i];
                    nodeInsertBefore$1.call(parent, anchor, afterNode);
                }
            }
        }
        patch(other) {
            if (this === other) {
                return;
            }
            const children1 = this.children;
            const children2 = other.children;
            const anchors = this.anchors;
            const parentEl = this.parentEl;
            for (let i = 0, l = children1.length; i < l; i++) {
                const vn1 = children1[i];
                const vn2 = children2[i];
                if (vn1) {
                    if (vn2) {
                        vn1.patch(vn2);
                    }
                    else {
                        const afterNode = vn1.firstNode();
                        const anchor = document.createTextNode("");
                        anchors[i] = anchor;
                        nodeInsertBefore$1.call(parentEl, anchor, afterNode);
                        vn1.beforeRemove();
                        vn1.remove();
                        children1[i] = undefined;
                    }
                }
                else if (vn2) {
                    children1[i] = vn2;
                    const anchor = anchors[i];
                    vn2.mount(parentEl, anchor);
                    nodeRemoveChild$1.call(parentEl, anchor);
                }
            }
        }
        beforeRemove() {
            const children = this.children;
            for (let i = 0, l = children.length; i < l; i++) {
                const child = children[i];
                if (child) {
                    child.beforeRemove();
                }
            }
        }
        remove() {
            const parentEl = this.parentEl;
            if (this.singleNode) {
                // todo: check if this should not be fixed. it looks like we still need
                // to call the beforeRemove hook
                nodeSetTextContent.call(parentEl, "");
            }
            else {
                const children = this.children;
                const anchors = this.anchors;
                for (let i = 0, l = children.length; i < l; i++) {
                    const child = children[i];
                    if (child) {
                        child.remove();
                    }
                    else {
                        nodeRemoveChild$1.call(parentEl, anchors[i]);
                    }
                }
            }
        }
        firstNode() {
            const child = this.children[0];
            return child ? child.firstNode() : this.anchors[0];
        }
        toString() {
            return this.children.map((c) => c.toString()).join("");
        }
    }
    function multi(children) {
        return new VMulti(children);
    }

    const nodeProto = Node.prototype;
    const nodeInsertBefore = nodeProto.insertBefore;
    const nodeRemoveChild = nodeProto.removeChild;
    class VHtml {
        constructor(html) {
            this.content = [];
            this.html = html;
        }
        mount(parent, afterNode) {
            this.parentEl = parent;
            const div = document.createElement("div");
            div.innerHTML = this.html;
            this.content = [...div.childNodes];
            for (let elem of this.content) {
                nodeInsertBefore.call(parent, elem, afterNode);
            }
            if (!this.content.length) {
                const textNode = document.createTextNode("");
                this.content.push(textNode);
                nodeInsertBefore.call(parent, textNode, afterNode);
            }
        }
        moveBefore(other, afterNode) {
            const target = other ? other.content[0] : afterNode;
            const parent = this.parentEl;
            for (let elem of this.content) {
                nodeInsertBefore.call(parent, elem, target);
            }
        }
        patch(other) {
            const html2 = other.html;
            if (this.html !== html2) {
                const parent = this.parentEl;
                // insert new html in front of current
                const afterNode = this.content[0];
                const div = document.createElement("div");
                div.innerHTML = html2;
                const content = [...div.childNodes];
                for (let elem of content) {
                    nodeInsertBefore.call(parent, elem, afterNode);
                }
                if (!content.length) {
                    const textNode = document.createTextNode("");
                    content.push(textNode);
                    nodeInsertBefore.call(parent, textNode, afterNode);
                }
                // remove current content
                this.remove();
                this.content = content;
            }
        }
        beforeRemove() { }
        remove() {
            const parent = this.parentEl;
            for (let elem of this.content) {
                nodeRemoveChild.call(parent, elem);
            }
        }
        firstNode() {
            return this.content[0];
        }
        toString() {
            return this.html;
        }
    }
    function html(str) {
        return new VHtml(str);
    }

    function mount(vnode, fixture) {
        vnode.mount(fixture, null);
    }
    function patch(vnode1, vnode2) {
        vnode1.patch(vnode2);
    }
    function remove(vnode) {
        vnode.beforeRemove();
        vnode.remove();
    }

    exports.config = config;
    exports.createBlock = createBlock;
    exports.html = html;
    exports.list = list;
    exports.mount = mount;
    exports.multi = multi;
    exports.patch = patch;
    exports.remove = remove;
    exports.text = text;
    exports.toggler = toggler;

    Object.defineProperty(exports, '__esModule', { value: true });

}(this.blockdom = this.blockdom || {}));
