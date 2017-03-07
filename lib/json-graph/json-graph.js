(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./sentinel", "lodash"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var sentinel_1 = require("./sentinel");
    var lodash_1 = require("lodash");
    var Path = (function () {
        function Path(keys) {
            this._path = keys.map(function (v) {
                var type = typeof v;
                if (v === 'string' ||
                    v === 'number' ||
                    v === 'boolean' ||
                    v === null) {
                    return v;
                }
                return '' + v;
            });
        }
        Object.defineProperty(Path.prototype, "path", {
            get: function () {
                return this._path;
            },
            enumerable: true,
            configurable: true
        });
        return Path;
    }());
    exports.Path = Path;
    var JsonGraph = (function () {
        function JsonGraph(pathPrefix) {
            if (pathPrefix === void 0) { pathPrefix = ''; }
            this._data = Object.create(null);
            this._pathPrefix = pathPrefix;
            this._data = {};
        }
        Object.defineProperty(JsonGraph.prototype, "__data", {
            get: function () {
                return this._data;
            },
            enumerable: true,
            configurable: true
        });
        JsonGraph.prototype.dateNow = function () {
            return Date.now();
        };
        /**
         * Set a value in the path
         */
        JsonGraph.prototype.set = function (path, value, pathPrefix) {
            if (pathPrefix === void 0) { pathPrefix = this._pathPrefix; }
            var p = this._newPath(path, pathPrefix);
            this._innerSet(p.path, value);
        };
        /**
         * Get a value synchronously in the path
         */
        JsonGraph.prototype.getSync = function (path, defaultValue) {
            var _this = this;
            if (defaultValue === void 0) { defaultValue = undefined; }
            var p = this._newPath(path);
            var v = this._innerGetSync(p.path);
            if (v.isExpired || !v.exists) {
                return defaultValue;
            }
            else {
                var value = v.value;
                if (sentinel_1.isSentinel(value) && sentinel_1.isExpired(value, function () { return _this.dateNow(); })) {
                    return defaultValue;
                }
                return this._unbox(value);
            }
        };
        JsonGraph.prototype.has = function (path) {
            var p = this._newPath(path);
            return this._innerGetSync(p.path).exists;
        };
        /**
         * Returns a serialized version of the JsonGraph
         */
        JsonGraph.prototype.serialize = function () {
            return JSON.stringify({
                _data: this.__data,
                _pathPrefix: this._pathPrefix
            });
        };
        /**
         * Creates a new JsonGraph from a deserialized string
         * @param input
         */
        JsonGraph.deserialize = function (input) {
            var data = JSON.parse(input);
            if (data) {
                var d = data._data, p = data._pathPrefix;
                var g = new JsonGraph(p);
                var theData = Object.create(null);
                Object.assign(theData, d);
                g._setData(theData);
                return g;
            }
            else {
                throw 'No data';
            }
        };
        JsonGraph.prototype._unbox = function (value) {
            if (sentinel_1.isSentinel(value) && value.$type === 'atom') {
                return value.value;
            }
            return value;
        };
        JsonGraph.prototype._isExpired = function (value) {
            var _this = this;
            if (sentinel_1.isSentinel(value)) {
                return sentinel_1.isExpired(value, function () { return _this.dateNow(); });
            }
            return false;
        };
        JsonGraph.prototype._setData = function (data) {
            this._data = data;
        };
        JsonGraph.prototype._newPath = function (path, pathPrefix) {
            if (pathPrefix === void 0) { pathPrefix = this._pathPrefix; }
            var p = path;
            if (pathPrefix) {
                p = [].concat(pathPrefix).concat(path);
            }
            return new Path(p);
        };
        JsonGraph.prototype._innerSet = function (path, value) {
            var deref = this._dereferencePath(path);
            if (deref.isExpired) {
                throw 'Path expired';
            }
            var resolvedPath = deref.path;
            this._makePath(resolvedPath);
            this._setAtPath(resolvedPath, value);
        };
        JsonGraph.prototype._innerGetSync = function (path) {
            var deref = this._dereferencePath(path);
            var isExpired = deref.isExpired;
            var vals = this._getAtPath(deref.path);
            return {
                isExpired: isExpired,
                value: vals.value,
                exists: vals.exists
            };
        };
        JsonGraph.prototype._makePath = function (path) {
            var p = [].concat(path);
            p.pop();
            var cursorIndex, cursor = this._data;
            while (p.length && (cursorIndex = p.shift())) {
                if (!cursor[cursorIndex + '']) {
                    cursor[cursorIndex + ''] = Object.create(null);
                }
                cursor = cursor[cursorIndex + ''];
            }
        };
        JsonGraph.prototype._setAtPath = function (path, value) {
            if (!path.length && typeof value === 'object') {
                Object.assign(this._data, value);
                return;
            }
            var p = [].concat(path);
            var lastCursor = p.pop();
            var cursorIndex, cursor = this._data;
            while (cursorIndex = p.shift()) {
                var nextCursor = cursorIndex + '';
                if (cursor[nextCursor]) {
                    cursor = cursor[nextCursor];
                }
            }
            cursor[lastCursor] = value;
        };
        JsonGraph.prototype._getAtPath = function (path) {
            var exists = true, value;
            var p = [].concat(path);
            var cursorIndex, cursor = this._data;
            while (cursorIndex = p.shift()) {
                var nextCursor = cursorIndex + '';
                if (cursor[nextCursor]) {
                    cursor = cursor[nextCursor];
                    exists = true;
                }
                else {
                    exists = false;
                }
            }
            if (exists) {
                return {
                    value: lodash_1.cloneDeep(cursor),
                    exists: exists
                };
            }
            else {
                return {
                    value: undefined,
                    exists: exists
                };
            }
        };
        /**
         * Removes all references from a path, allowing simple modifications.
         */
        JsonGraph.prototype._dereferencePath = function (path) {
            var _this = this;
            var p = [].concat(path);
            var cursor, cursorIndex;
            cursor = this._data;
            var dateNow = function () { return _this.dateNow(); };
            var completePath = [];
            var pathExpired = false;
            // Walk down the path until it's completely walked down.
            while (p.length && (cursorIndex = p.shift() + '')) {
                try {
                    var v = cursor[cursorIndex];
                    // If this is a reference, we are going to walk down a new path
                    if (sentinel_1.isSentinel(v) && v.$type === 'ref') {
                        if (!pathExpired) {
                            pathExpired = sentinel_1.isExpired(v, dateNow);
                        }
                        // Reset the "complete path", we have started anew at the root.
                        completePath = [];
                        // Reset our stack
                        p = [].concat(v.value, p);
                        // We have started walking at the top again, reset our cursor.
                        cursor = this._data;
                    }
                    else {
                        // We keep adding new values now, as we aren't referencing anymore.
                        completePath.push(cursorIndex);
                        // We are going to walk down this new path
                        try {
                            cursor = cursor[cursorIndex];
                        }
                        catch (e) {
                        }
                    }
                }
                catch (e) {
                    // Allow undefined paths to be referenced still.
                    completePath.push(cursorIndex);
                }
            }
            return {
                path: completePath,
                isExpired: pathExpired
            };
        };
        return JsonGraph;
    }());
    exports.JsonGraph = JsonGraph;
});
//# sourceMappingURL=json-graph.js.map