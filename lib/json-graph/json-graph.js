"use strict";
var sentinel_1 = require("./sentinel");
var lodash_1 = require("lodash");
var rxjs_1 = require("rxjs");
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
var PATH_JOINER = 'ௐ';
function pathsAreEqual(path, otherPath) {
    return !!path && !!otherPath && path.length === otherPath.length && path.join(PATH_JOINER) === otherPath.join(PATH_JOINER);
}
var JsonGraph = (function () {
    function JsonGraph() {
        this._data = Object.create(null);
        this._pathReferences = {};
        this._setPaths$ = new rxjs_1.Subject();
        this._data = {};
    }
    Object.defineProperty(JsonGraph.prototype, "__data", {
        get: function () {
            return this._data;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Set a value in the path
     */
    JsonGraph.prototype.set = function (path, value) {
        var p = new Path(path);
        this._innerSet(p.path, value);
    };
    /**
     * Set a value in the path
     */
    JsonGraph.prototype.getSync = function (path) {
        var p = new Path(path);
        return this._innerGetSync(p.path);
    };
    /**
     * Observe a path change.
     * @param path The path to observe
     */
    JsonGraph.prototype.observe = function (path) {
        var _this = this;
        return new rxjs_1.Observable(function (subscriber) {
            var originalPath = path, setPaths$ = _this._setPaths$, dereferencedPath = _this._dereferencePath(path);
            var subsc = setPaths$
                .filter(function (o) { return pathsAreEqual(o.path, dereferencedPath); })
                .subscribe(function (next) {
                subscriber.next({
                    $type: 'valueChange',
                    newValue: next.value
                });
            }, function (err) {
                subscriber.error(err);
            }, function () {
            });
            return {
                unsubscribe: function () {
                    subsc.unsubscribe();
                }
            };
        });
    };
    JsonGraph.prototype._innerSet = function (path, value) {
        var resolvedPath = this._dereferencePath(path);
        this._makePath(resolvedPath);
        this._setAtPath(resolvedPath, value);
    };
    JsonGraph.prototype._innerGetSync = function (path) {
        var resolvedPath = this._dereferencePath(path);
        return this._getAtPath(resolvedPath);
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
        if (sentinel_1.isSentinel(value) && value.$type === 'ref') {
            this._trackRef(path, value);
        }
        this._setPaths$.next({
            path: path,
            value: value
        });
    };
    JsonGraph.prototype._getAtPath = function (path) {
        var p = [].concat(path);
        var lastCursor = p.pop();
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            var nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
            }
        }
        return lodash_1.cloneDeep(cursor[lastCursor]);
    };
    /**
     * Removes all references from a path, allowing simple modifications.
     */
    JsonGraph.prototype._dereferencePath = function (path) {
        var p = [].concat(path);
        var cursor, cursorIndex;
        cursor = this._data;
        var completePath = [];
        // Walk down the path until it's completely walked down.
        while (p.length && (cursorIndex = p.shift() + '')) {
            try {
                var v = cursor[cursorIndex];
                // If this is a reference, we are going to walk down a new path
                if (sentinel_1.isSentinel(v) && v.$type === 'ref') {
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
        return completePath;
    };
    JsonGraph.prototype._trackRef = function (path, reference) {
        var joinedPath = path.join(PATH_JOINER);
        var pathReferences = this._pathReferences;
        if (!pathReferences[joinedPath]) {
            pathReferences[joinedPath] = {};
        }
        pathReferences[joinedPath][reference.value.join(PATH_JOINER)] = [].concat(reference.value);
    };
    return JsonGraph;
}());
exports.JsonGraph = JsonGraph;
//# sourceMappingURL=json-graph.js.map