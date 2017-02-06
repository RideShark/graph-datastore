export declare type IPath = Array<string | boolean | number | null>;
export declare class Path {
    constructor(keys: any[]);
    readonly path: IPath;
    private _path;
}
export declare class JsonGraph {
    private _data;
    readonly __data: any;
    constructor();
    /**
     * Set a value in the path
     */
    set(path: any[], value: any): void;
    /**
     * Set a value in the path
     */
    getSync(path: any[]): any;
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
