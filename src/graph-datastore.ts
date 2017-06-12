import { JsonGraph } from './json-graph/json-graph';
import { IGraphSchema, IGraphSchemaEditor, IGraphType, IRefKeyType } from './json-graph/schema';
import { isSentinel, ref } from './json-graph/sentinel';

import {
    cloneDeep
} from 'lodash';

class GraphType implements IGraphType {

    get $name() {
        return this._name;
    }

    get $atomKeys() {
        return this._atomKeys;
    }

    get $refKeys() {
        return this._refKeys;
    }

    get $idKeys() {
        return this._idKeys;
    }

    private _name: string = '';
    private _atomKeys: { [keyName: string]: boolean } = {};
    private _refKeys: { [name: string]: IRefKeyType } = {};
    private _idKeys: string[] = [];

    constructor() {

    }

    setName(name: string) {
        if (!this._name && name) {
            this._name = name;
        } else {
            if (!name) {
                throw 'Must specify a name';
            } else if (this._name) {
                throw 'The name cannot be redefined';
            }
        }
        return this;
    }

    setIdKeys(idKeys: string[]) {
        if (!this._idKeys.length) {
            this._idKeys = [].concat(idKeys);
            idKeys.forEach((key) => this.addAtomKey(key));
        } else {
            throw 'The ID cannot be redefined';
        }
        return this;
    }

    addAtomKeys(keys: string[]) {
        keys.forEach(key => this.addAtomKey(key));
        return this;
    }

    addAtomKey(keyName: string) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._atomKeys[keyName] = true;
        } else {
            if (this._refKeys[keyName]) {
                throw 'This key has already been defined as a reference type, it cannot be defined as an atom.'
            }
        }
        return this;
    }

    addRefKey(keyName: string, refKey: IRefKeyType) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._refKeys[keyName] = refKey;
        } else {
            if (this._atomKeys[keyName]) {
                throw 'This key has already been defined as a reference type, it cannot be defined as an atom.'
            }
        }
        return this;
    }
}


class GraphSchema implements IGraphSchema {
    /**
     * The types in the graph.
     */
    $types: { [typeName: string]: GraphType } = {};

    /**
     * A definition of the root of the graph.
     */
    $root: IGraphType = {
        $name: '__root',
        $atomKeys: {},
        $refKeys: {},
        $idKeys: ['$name']
    };

    /**
     * The string which will be used to concatenate ID keys, for composite keys
     */
    $concatenationStrategy: string;

    constructor() {

    }

    private _getType(name: string) {
        return this.$types[name];
    }

    getType(name: string) {
        return this.$types[name];
    }

    addGraphType<T>(typeName: string, idKeys: Array<keyof T>, atomKeys: Array<keyof T>, refKeys: {[p in keyof T]?: IRefKeyType}) {
        if (this._getType(typeName)) {
            throw 'The type is already defined.'
        }
        let type = new GraphType().setName(typeName).setIdKeys(idKeys).addAtomKeys(atomKeys);

        this.$types[typeName] = type;
        this.addRefKeys<T>(typeName, refKeys);
    };

    addAtomKeys<T>(typeName: string, keyNames: Array<keyof T>) {
        this._getType(typeName).addAtomKeys(keyNames);
    };

    addRefKeys<T>(typeName: string, keys: {[p in keyof T]?: IRefKeyType}) {
        let t = this._getType(typeName);

        for (let key in keys) {
            t.addRefKey(key, keys[key]);
        }
    };
}

/**
 * A graph datastore allows graph data to be efficiently cached in memory, and retrieved.
 */
export class GraphDatastore implements IGraphSchemaEditor {

    private _schema = new GraphSchema();

    private _graph = new JsonGraph();

    constructor() {

    }

    addGraphType<T>(typeName: string, idKeys: Array<keyof T>, atomKeys: Array<keyof T>, refKeys: {[p in keyof T]?: IRefKeyType}) {
        this._schema.addGraphType<T>(typeName, idKeys, atomKeys, refKeys);
    };

    addAtomKeys<T>(typeName: string, ...keyNames: Array<keyof T>) {
        this._schema.addAtomKeys<T>(typeName, keyNames);
    };

    addRefKeys<T>(typeName: string, keys: {[p in keyof T]: IRefKeyType}) {
        this._schema.addRefKeys<T>(typeName, keys);
    };

    /**
     * Add a type
     * @param typeName The type of object being imported
     * @param values The values being imported
     */
    set<T>(typeName: string, values: T[]) {
        const type = this._schema.getType(typeName);

        values.forEach(value => {
            this._set<T>(type, value, false);
        });
    }

    patch<T>(typeName: string, values: Partial<T>[]) {
        const type = this._schema.getType(typeName);

        values.forEach(value => {
            this._set<T>(type, value, true);
        });
    }

    getSync<T>(typeName: string, ...idValues: Array<string | number>): T {
        const type = this._schema.getType(typeName);

        let path = this._getPathForEntity(type, idValues.map(v => `${v}`));

        return this._graph.getSync(path.path, {
            flatten: true
        });
    }

    private _getPathForEntity(type: GraphType, idKeyValues: string[]) {

        const {
            $idKeys,
            $name
        } = type;

        const entityId: string = idKeyValues.join('.');
        const pathForGraph = [$name, entityId];

        return {
            id: entityId,
            path: pathForGraph
        };
    }

    private _flatPathForEntity<T>(type: GraphType, entity: Partial<T>) {

        const {
            $idKeys
        } = type;

        let idKeyValues: Array<string> = [];

        $idKeys.forEach((idKey: keyof T) => {
            idKeyValues.push(`${entity[idKey]}`);
        });

        return this._getPathForEntity(type, idKeyValues);
    }

    private _set<T>(type: GraphType, value: Partial<T>, usePatchMode: boolean) {
        if (!value) {
            return;
        }



        const {
            $atomKeys,
            $refKeys,
            $idKeys,
            $name
        } = type;

        const {
            id,
            path
        } = this._flatPathForEntity<T>(type, value);

        let original: T;
        if (usePatchMode) {
            original = this._graph.getSync(path);
        }

        const cloned: any = cloneDeep(value);

        for (let key in $refKeys) {
            const refKey = $refKeys[key];
            if (refKey) {
                let refType = this._schema.getType(refKey.$typeName);
                let refValue = cloned[key];

                if (usePatchMode && refValue === undefined) {
                    continue;
                }

                if (refKey.$isSingular) {
                    if (!isSentinel(refValue) || refValue.$type !== 'ref') {
                        let path = this._flatPathForEntity(refType, refValue).path;
                        cloned[key] = ref(path);
                        this._set<any>(refType, refValue, usePatchMode);
                    }
                }
                if (refKey.$isArray) {
                    if (refValue instanceof Array) {
                        refValue.forEach((arrayItemValue, index) => {
                            if (arrayItemValue === undefined && usePatchMode) {
                                // This is undefined, keep the old value.
                                refValue[index] = original[key][index];
                            } else if (!isSentinel(arrayItemValue) || arrayItemValue.$type !== 'ref') {
                                let path = this._flatPathForEntity(refType, arrayItemValue).path;
                                refValue[index] = ref(path);
                                this._set<any>(refType, arrayItemValue, usePatchMode);
                            }
                        });
                    }
                }
            }
        }

        if (usePatchMode) {
            let original = this._graph.getSync(path, { flatten: false });
            if (original) {
                let newValue = Object.assign(original, cloned);
                this._graph.set(path, newValue);
            } else {
                this._graph.set(path, cloned);
            }
        } else {
            this._graph.set(path, cloned);
        }
    }
}