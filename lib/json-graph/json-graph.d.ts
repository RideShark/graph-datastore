export declare type IPath = Array<string | boolean | number | null>;
export declare class Path {
    constructor(keys: any[]);
    readonly path: IPath;
    private _path;
}
export declare class JsonGraph {
    private _data;
    private _pathPrefix;
    readonly __data: any;
    dateNow(): number;
    constructor(pathPrefix?: string);
    /**
     * Set a value in the path
     */
    set(path: any[], value: any, pathPrefix?: string): void;
    /**
     * Get a value synchronously in the path
     */
    getSync(path: any[], defaultValue?: any): any;
    has(path: any[]): any;
    /**
     * Returns a serialized version of the JsonGraph
     */
    serialize(): string;
    /**
     * Creates a new JsonGraph from a deserialized string
     * @param input
     */
    static deserialize(input: string): JsonGraph;
    private _unbox(value);
    private _isExpired(value);
    private _setData(data);
    private _newPath(path, pathPrefix?);
    private _innerSet(path, value);
    private _innerGetSync(path);
    private _makePath(path);
    private _setAtPath(path, value);
    private _getAtPath(path);
    /**
     * Removes all references from a path, allowing simple modifications.
     */
    private _dereferencePath(path);
}
