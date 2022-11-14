"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasGetterFor = exports.hasSetterFor = exports.getPrototypeChain = exports.isEmptyObject = exports.isPlainObject = exports.isObject = void 0;
const isObject = (o) => Object.prototype.toString.call(o) === '[object Object]';
exports.isObject = isObject;
//
const isPlainObject = (o) => {
    let ctor, prot;
    if ((0, exports.isObject)(o) === false)
        return false;
    // If has modified constructor
    ctor = o.constructor;
    if (ctor === undefined)
        return true;
    // If has modified prototype
    prot = ctor.prototype;
    if ((0, exports.isObject)(prot) === false)
        return false;
    // If constructor does not have an Object-specific method
    if (prot.hasOwnProperty('isPrototypeOf') === false)
        return false;
    // Most likely a plain Object
    return true;
};
exports.isPlainObject = isPlainObject;
//
const isEmptyObject = (o) => o && Object.keys(o).length === 0 && o.constructor === Object;
exports.isEmptyObject = isEmptyObject;
//
const getPrototypeChain = (o) => {
    if (o === null)
        return null;
    if (typeof o !== 'object')
        return null;
    let proto = Object.getPrototypeOf(o);
    const out = [];
    while (!(0, exports.isPlainObject)(proto)) {
        out.push(proto);
        proto = Object.getPrototypeOf(proto);
    }
    return out.length ? out : null;
};
exports.getPrototypeChain = getPrototypeChain;
//
const hasSetterFor = (o, prop) => ((0, exports.getPrototypeChain)(o) || []).some((proto) => {
    let desc = Object.getOwnPropertyDescriptor(proto, prop);
    return desc && !!desc.set;
});
exports.hasSetterFor = hasSetterFor;
//
const hasGetterFor = (o, prop) => ((0, exports.getPrototypeChain)(o) || []).some((proto) => {
    let desc = Object.getOwnPropertyDescriptor(proto, prop);
    return desc && !!desc.get;
});
exports.hasGetterFor = hasGetterFor;
