"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var json_graph_1 = require("./json-graph/json-graph");
var sentinel_1 = require("./json-graph/sentinel");
var lodash_1 = require("lodash");
var GraphType = (function () {
    function GraphType() {
        this._name = '';
        this._atomKeys = {};
        this._refKeys = {};
        this._idKeys = [];
    }
    Object.defineProperty(GraphType.prototype, "$name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GraphType.prototype, "$atomKeys", {
        get: function () {
            return this._atomKeys;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GraphType.prototype, "$refKeys", {
        get: function () {
            return this._refKeys;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GraphType.prototype, "$idKeys", {
        get: function () {
            return this._idKeys;
        },
        enumerable: true,
        configurable: true
    });
    GraphType.prototype.setName = function (name) {
        if (!this._name && name) {
            this._name = name;
        }
        else {
            if (!name) {
                throw 'Must specify a name';
            }
            else if (this._name) {
                throw 'The name cannot be redefined';
            }
        }
        return this;
    };
    GraphType.prototype.setIdKeys = function (idKeys) {
        var _this = this;
        if (!this._idKeys.length) {
            this._idKeys = [].concat(idKeys);
            idKeys.forEach(function (key) { return _this.addAtomKey(key); });
        }
        else {
            throw 'The ID cannot be redefined';
        }
        return this;
    };
    GraphType.prototype.addAtomKeys = function (keys) {
        var _this = this;
        keys.forEach(function (key) { return _this.addAtomKey(key); });
        return this;
    };
    GraphType.prototype.addAtomKey = function (keyName) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._atomKeys[keyName] = true;
        }
        else {
            if (this._refKeys[keyName]) {
                throw 'This key has already been defined as a reference type, it cannot be defined as an atom.';
            }
        }
        return this;
    };
    GraphType.prototype.addRefKey = function (keyName, refKey) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._refKeys[keyName] = refKey;
        }
        else {
            if (this._atomKeys[keyName]) {
                throw 'This key has already been defined as a reference type, it cannot be defined as an atom.';
            }
        }
        return this;
    };
    return GraphType;
}());
var GraphSchema = (function () {
    function GraphSchema() {
        /**
         * The types in the graph.
         */
        this.$types = {};
        /**
         * A definition of the root of the graph.
         */
        this.$root = {
            $name: '__root',
            $atomKeys: {},
            $refKeys: {},
            $idKeys: ['$name']
        };
    }
    GraphSchema.prototype._getType = function (name) {
        return this.$types[name];
    };
    GraphSchema.prototype.getType = function (name) {
        return this.$types[name];
    };
    GraphSchema.prototype.addGraphType = function (typeName, idKeys, atomKeys, refKeys) {
        if (this._getType(typeName)) {
            throw 'The type is already defined.';
        }
        var type = new GraphType().setName(typeName).setIdKeys(idKeys).addAtomKeys(atomKeys);
        this.$types[typeName] = type;
        this.addRefKeys(typeName, refKeys);
    };
    ;
    GraphSchema.prototype.addAtomKeys = function (typeName, keyNames) {
        this._getType(typeName).addAtomKeys(keyNames);
    };
    ;
    GraphSchema.prototype.addRefKeys = function (typeName, keys) {
        var t = this._getType(typeName);
        for (var key in keys) {
            t.addRefKey(key, keys[key]);
        }
    };
    ;
    return GraphSchema;
}());
/**
 * A graph datastore allows graph data to be efficiently cached in memory, and retrieved.
 */
var GraphDatastore = (function () {
    function GraphDatastore() {
        this._schema = new GraphSchema();
        this._graph = new json_graph_1.JsonGraph();
    }
    GraphDatastore.prototype.addGraphType = function (typeName, idKeys, atomKeys, refKeys) {
        this._schema.addGraphType(typeName, idKeys, atomKeys, refKeys);
    };
    ;
    GraphDatastore.prototype.addAtomKeys = function (typeName) {
        var keyNames = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            keyNames[_i - 1] = arguments[_i];
        }
        this._schema.addAtomKeys(typeName, keyNames);
    };
    ;
    GraphDatastore.prototype.addRefKeys = function (typeName, keys) {
        this._schema.addRefKeys(typeName, keys);
    };
    ;
    /**
     * Add a type
     * @param typeName The type of object being imported
     * @param values The values being imported
     */
    GraphDatastore.prototype.set = function (typeName, values) {
        var _this = this;
        var type = this._schema.getType(typeName);
        values.forEach(function (value) {
            _this._set(type, value, false);
        });
    };
    GraphDatastore.prototype.patch = function (typeName, values) {
        var _this = this;
        var type = this._schema.getType(typeName);
        values.forEach(function (value) {
            _this._set(type, value, true);
        });
    };
    GraphDatastore.prototype.getSync = function (typeName) {
        var idValues = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            idValues[_i - 1] = arguments[_i];
        }
        var type = this._schema.getType(typeName);
        var path = this._getPathForEntity(type, idValues.map(function (v) { return "" + v; }));
        return this._graph.getSync(path.path, {
            flatten: true
        });
    };
    GraphDatastore.prototype._getPathForEntity = function (type, idKeyValues) {
        var $idKeys = type.$idKeys, $name = type.$name;
        var entityId = idKeyValues.join('.');
        var pathForGraph = [$name, entityId];
        return {
            id: entityId,
            path: pathForGraph
        };
    };
    GraphDatastore.prototype._flatPathForEntity = function (type, entity) {
        var $idKeys = type.$idKeys;
        var idKeyValues = [];
        $idKeys.forEach(function (idKey) {
            idKeyValues.push("" + entity[idKey]);
        });
        return this._getPathForEntity(type, idKeyValues);
    };
    GraphDatastore.prototype._set = function (type, value, usePatchMode) {
        var _this = this;
        if (!value) {
            return;
        }
        var $atomKeys = type.$atomKeys, $refKeys = type.$refKeys, $idKeys = type.$idKeys, $name = type.$name;
        var _a = this._flatPathForEntity(type, value), id = _a.id, path = _a.path;
        var original;
        if (usePatchMode) {
            original = this._graph.getSync(path);
        }
        var cloned = lodash_1.cloneDeep(value);
        var _loop_1 = function (key) {
            var refKey = $refKeys[key];
            if (refKey) {
                var refType_1 = this_1._schema.getType(refKey.$typeName);
                var refValue_1 = cloned[key];
                if (usePatchMode && refValue_1 === undefined) {
                    return "continue";
                }
                if (refKey.$isSingular) {
                    if (!sentinel_1.isSentinel(refValue_1) || refValue_1.$type !== 'ref') {
                        var path_1 = this_1._flatPathForEntity(refType_1, refValue_1).path;
                        cloned[key] = sentinel_1.ref(path_1);
                        this_1._set(refType_1, refValue_1, usePatchMode);
                    }
                }
                if (refKey.$isArray) {
                    if (refValue_1 instanceof Array) {
                        refValue_1.forEach(function (arrayItemValue, index) {
                            if (arrayItemValue === undefined && usePatchMode) {
                                // This is undefined, keep the old value.
                                refValue_1[index] = original[key][index];
                            }
                            else if (!sentinel_1.isSentinel(arrayItemValue) || arrayItemValue.$type !== 'ref') {
                                var path_2 = _this._flatPathForEntity(refType_1, arrayItemValue).path;
                                refValue_1[index] = sentinel_1.ref(path_2);
                                _this._set(refType_1, arrayItemValue, usePatchMode);
                            }
                        });
                    }
                }
            }
        };
        var this_1 = this;
        for (var key in $refKeys) {
            _loop_1(key);
        }
        if (usePatchMode) {
            var original_1 = this._graph.getSync(path, { flatten: false });
            if (original_1) {
                var newValue = Object.assign(original_1, cloned);
                this._graph.set(path, newValue);
            }
            else {
                this._graph.set(path, cloned);
            }
        }
        else {
            this._graph.set(path, cloned);
        }
    };
    return GraphDatastore;
}());
exports.GraphDatastore = GraphDatastore;
//# sourceMappingURL=graph-datastore.js.map