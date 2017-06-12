"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isSentinel(v) {
    var $type = v ? v.$type : '';
    return $type === 'ref' || $type === 'atom' || $type === 'error';
}
exports.isSentinel = isSentinel;
function sentinel(type, value, props) {
    var copy = Object.create(null);
    if (props !== null) {
        for (var key in props) {
            copy[key] = props[key];
        }
        copy['$type'] = type;
        copy.value = value;
        return copy;
    }
    else {
        return { $type: type, value: value };
    }
}
function ref(path, props) {
    return sentinel('ref', path, props);
}
exports.ref = ref;
function atom(value, props) {
    return sentinel('atom', value, props);
}
exports.atom = atom;
function undefined() {
    return sentinel('atom');
}
exports.undefined = undefined;
function pathValue(path, value) {
    return {
        path: path,
        value: value
    };
}
exports.pathValue = pathValue;
function pathInvalidation(path) {
    return {
        path: path,
        invalidated: true
    };
}
exports.pathInvalidation = pathInvalidation;
//# sourceMappingURL=sentinel.js.map