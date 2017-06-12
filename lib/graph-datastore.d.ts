import { IGraphSchemaEditor, IRefKeyType } from './json-graph/schema';
/**
 * A graph datastore allows graph data to be efficiently cached in memory, and retrieved.
 */
export declare class GraphDatastore implements IGraphSchemaEditor {
    private _schema;
    private _graph;
    constructor();
    addGraphType<T>(typeName: string, idKeys: Array<keyof T>, atomKeys: Array<keyof T>, refKeys: {
        [p in keyof T]?: IRefKeyType;
    }): void;
    addAtomKeys<T>(typeName: string, ...keyNames: Array<keyof T>): void;
    addRefKeys<T>(typeName: string, keys: {
        [p in keyof T]: IRefKeyType;
    }): void;
    /**
     * Add a type
     * @param typeName The type of object being imported
     * @param values The values being imported
     */
    set<T>(typeName: string, values: T[]): void;
    getSync<T>(typeName: string, ...idValues: Array<string | number>): T;
    private _getPathForEntity(type, idKeyValues);
    private _flatPathForEntity<T>(type, entity);
    private _set<T>(type, value);
}
