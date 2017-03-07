(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
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
    function isExpired(value, dateNow) {
        var $expires = value.$expires;
        if (typeof $expires !== 'number') {
            return false;
        }
        switch ($expires) {
            case 0:
                return true;
            case 1:
                return false;
            default:
                var now = dateNow();
                return value.$expires < now;
        }
    }
    exports.isExpired = isExpired;
});
//# sourceMappingURL=sentinel.js.map