import { IGraphSchema, IGraphSchemaEditor, IGraphType, IRefKeyType } from './json-graph/schema';

class GraphType implements IGraphType {

    get $name() {
        return this._name;
    }

    get $atomKeys() {
        return this._atomKeys;
    }

    get $refKeys () {
        return this._refKeys;
    }

    get $idKeys() {
        return this._idKeys;
    }

    private _name:string = '';
    private _atomKeys:{[keyName:string]:boolean} = {};
    private _refKeys: {[name:string]: IRefKeyType} = {};
    private _idKeys: string[] = [];

    constructor() {

    }

    setName(name:string) {
        if (!this._name && name) {
            this._name = name;
        }else{
            if(!name) {
                throw 'Must specify a name';
            }else if(this._name) {
                throw 'The name cannot be redefined';
            }
        }
        return this;
    }

    setIdKeys(idKeys: string[]) {
        if (!this._idKeys.length) {
            this._idKeys = [].concat(idKeys);
            idKeys.forEach((key)=>this.addAtomKey(key));
        }else{
            throw 'The ID cannot be redefined';
        }
        return this;
    }

    addAtomKeys(keys: string[]) {
        keys.forEach(key=>this.addAtomKey(key));
        return this;
    }

    addAtomKey(keyName: string) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._atomKeys[keyName] = true;
        }else {
            if (this._refKeys[keyName]) {
                throw 'This key has already been defined as a reference type, it cannot be defined as an atom.'
            }
        }
        return this;
    }

    addRefKey(keyName: string, refKey: IRefKeyType) {
        if (!this._atomKeys[keyName] && !this._refKeys[keyName]) {
            this._refKeys[keyName] = refKey;
        }else {
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
    $types: {[typeName:string]: GraphType} = {};

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

    addGraphType(typeName: string, idKeys:string[], atomKeys: string[], refKeys:[string,  IRefKeyType][]) {
        if (this._getType(typeName)) {
            throw 'The type is already defined.'
        }
        let type =  new GraphType().setName(typeName).setIdKeys(idKeys).addAtomKeys(atomKeys);

        this.$types[typeName] = type;
        this.addRefKeys(typeName, refKeys);
    };

    addAtomKeys(typeName: string, keyNames:string[]) {
        this._getType(typeName).addAtomKeys(keyNames);
    };

    addRefKeys(typeName: string, keys:[string, IRefKeyType][]) {
        let t = this._getType(typeName);
        
        keys.forEach(([keyName, ref])=>{
            t.addRefKey(keyName, ref);
        });
    };
}

/**
 * A graph datastore allows graph data to be efficiently cached in memory, and retrieved.
 */
export class GraphDatastore implements IGraphSchemaEditor {

    private _schema = new GraphSchema();

    constructor() {
        
    }

    addGraphType(typeName: string, idKeys:string[], atomKeys: string[], refKeys: [string, IRefKeyType][]) {
        this._schema.addGraphType(typeName, idKeys, atomKeys, refKeys);
    };

    addAtomKeys(typeName: string, ...keyNames:string[]) {
        this._schema.addAtomKeys(typeName, keyNames);
    };

    addRefKeys(typeName: string, ...keys:[string, IRefKeyType][]) {
        this._schema.addRefKeys(typeName, keys);
    };

}