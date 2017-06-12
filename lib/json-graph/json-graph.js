"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    function JsonGraph(pathPrefix) {
        if (pathPrefix === void 0) { pathPrefix = ''; }
        this._data = Object.create(null);
        this._pathReferences = Object.create(null);
        this._setPaths$ = new rxjs_1.Subject();
        this._deletedPaths$ = new rxjs_1.Subject();
        this._pathPrefix = pathPrefix;
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
    JsonGraph.prototype.has = function (path) {
        var p = this._newPath(path);
        return this._innerGetSync(p.path).exists;
    };
    /**
     * Returns a serialized version of the JsonGraph
     */
    JsonGraph.prototype.getSync = function (path, options, prefetchedValues) {
        var _this = this;
        var p = new Path(path);
        var v = this._innerGetSync(p.path);
        var defaultValue = options ? options.defaultValue : undefined;
        if (v.isExpired || !v.exists) {
            return defaultValue;
        }
        else {
            var object = v.value;
            if (sentinel_1.isSentinel(object) && sentinel_1.isExpired(object, function () { return _this.dateNow(); })) {
                return defaultValue;
            }
            object = this._unbox(object);
            if (options && options.flatten) {
                if (!prefetchedValues) {
                    prefetchedValues = Object.create(null);
                }
                prefetchedValues[this._dereferencePath(p.path).path.join(PATH_JOINER)] = object;
                for (var key in object) {
                    var value = object[key];
                    if (sentinel_1.isSentinel(value)) {
                        if (value.$type === 'ref') {
                            var dereferencedPath = this._dereferencePath(value.value).path;
                            var flattenedPath = dereferencedPath.join(PATH_JOINER);
                            var referencedValue = prefetchedValues[flattenedPath];
                            if (!referencedValue) {
                                referencedValue = this.getSync(dereferencedPath, {
                                    flatten: true
                                }, prefetchedValues);
                                if (referencedValue instanceof Array) {
                                    prefetchedValues[flattenedPath] = referencedValue.map(function (v) {
                                        if (sentinel_1.isSentinel(v) && v.$type === 'ref') {
                                            return _this.getSync(v.value, { flatten: true }, prefetchedValues);
                                        }
                                        return v;
                                    });
                                }
                                else {
                                    prefetchedValues[flattenedPath] = referencedValue;
                                }
                            }
                            object[key] = referencedValue;
                        }
                        else if (value.$type === 'atom') {
                            object[key] = value.value;
                        }
                    }
                    if (value instanceof Array) {
                        object[key] = value.map(function (v) {
                            if (sentinel_1.isSentinel(v) && v.$type === 'ref') {
                                return _this.getSync(v.value, { flatten: true }, prefetchedValues);
                            }
                            return v;
                        });
                    }
                }
                return object;
            }
            else {
                return object;
            }
        }
    };
    JsonGraph.prototype.delete = function (path) {
        var p = new Path(path);
        this._innerDelete(p.path);
    };
    /**
     * Observe a path change.
     * @param path The path to observe
     */
    JsonGraph.prototype.observe = function (path) {
        var _this = this;
        return new rxjs_1.Observable(function (subscriber) {
            var initialValue = _this.getSync(path);
            subscriber.next({
                $type: 'initialValue',
                value: initialValue
            });
            var originalPath = path, setPaths$ = _this._setPaths$, dereferencedPath = _this._dereferencePath(path).path;
            var pathValuesMatch = function (pathValue) {
                var pathsAreExactlyEqual = pathsAreEqual(pathValue, dereferencedPath);
                if (!pathsAreExactlyEqual) {
                    var updatedDereferencedPath = _this._dereferencePath(pathValue).path, nextDereferencedPath = _this._dereferencePath(path).path;
                    var pathsAreReferentiallyEqual = pathsAreEqual(updatedDereferencedPath, nextDereferencedPath);
                    return pathsAreReferentiallyEqual;
                }
                return pathsAreExactlyEqual;
            };
            var subsc = setPaths$
                .filter(function (o) { return pathValuesMatch(o.path); })
                .subscribe(function (next) {
                subscriber.next({
                    $type: 'valueChange',
                    value: next.value
                });
            }, function (err) {
                subscriber.error(err);
            }, function () {
            });
            var subscd = _this._deletedPaths$
                .filter(function (o) { return pathValuesMatch(o.path); })
                .subscribe(function (next) {
                subscriber.next({
                    $type: 'valueChange',
                    value: undefined
                });
            }, function (err) {
                subscriber.error(err);
            }, function () {
            });
            return {
                unsubscribe: function () {
                    subsc.unsubscribe();
                    subscd.unsubscribe();
                }
            };
        });
    };
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
    /**
     * Delete a path
     * @param p The path to delete
     */
    JsonGraph.prototype._innerDelete = function (path) {
        var resolvedPath = this._dereferencePath(path).path;
        this._deleteAtPath(resolvedPath);
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
            // Todo: Make this async.
            var valueToEmit = this.getSync(value.value);
            this._setPaths$.next({
                path: path,
                value: valueToEmit
            });
        }
        else {
            this._setPaths$.next({
                path: path,
                value: value
            });
        }
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
    JsonGraph.prototype._deleteAtPath = function (path) {
        var p = [].concat(path);
        var lastCursor = p.pop();
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            var nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
            }
        }
        delete cursor[lastCursor];
        this._deletedPaths$.next({
            path: path
        });
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
//# sourceMappingURL=json-graph.js.map