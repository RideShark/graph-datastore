import { Observable } from 'rxjs';
export declare type IPath = Array<string | boolean | number | null>;
export declare class Path {
    constructor(keys: any[]);
    readonly path: IPath;
    private _path;
}
/**
 * IObservedPathChange represents any change in a path.
 */
export interface IObservedPathChange {
    /**
     * The type of change.
     * valueChange:
     * This is emitted when the value at the end of the path changes.
     * If the value does not change, but the references do (thereby causing a change)
     * this will be emitted _after_ any refChange changes.
     *
     * valueDeleted:
     * The value was deleted.
     *
     * initialValue:
     * This is the initial value
     *
     * refChange:
     * This is emitted when any referenced values change.
     * @example
     *  A[1] is a reference to B[1]. (value at A[1]: {$type:'ref' value: ['B', 1]})
     *  A[1] changes to {$type: 'ref', value: ['B', 2]}
     *
     * A 'refChange' event will be emitted, noting that A[1]'s reference has changed.
     *
     * pathRemoved:
     * The path has been entirely removed.
     *
     * @example
     * A[1] is observed.
     * Before it can be subscribed to, A is removed from the JSON Graph. As a result, the path A[1] is completely invalidated.
     *
     * When the observable is subscribed to, 'pathRemoved' will be emitted.
     * pathRemoved is always the last value in an observable of IObservedPathChange.
     */
    $type: 'initialValue' | 'valueChange' | 'valueDeleted' | 'refChange' | 'pathRemoved';
    value?: any;
    refChange?: {
        /**
         * The path leading up to the point that changed
         */
        path: IPath;
        /**
         * The old reference which was stored at IPath;
         */
        oldRef: IPath;
        /**
         * The new reference which was stored at IPath;
         */
        newRef: IPath;
    };
}
export declare class JsonGraph {
    private _data;
    private _pathReferences;
    private _setPaths$;
    private _deletedPaths$;
    readonly __data: any;
    constructor();
    /**
     * Set a value in the path
     */
    set(path: any[], value: any): void;
    /**
     * Set a value in the path
     */
    getSync(path: any[], options?: {
        /**
         * Whether or not references should be flattened.
         */
        flatten?: boolean;
    }): any;
    private _flatten(object, retrievedReferences?);
    delete(path: any[]): void;
    /**
     * Observe a path change.
     * @param path The path to observe
     */
    observe(path: any[]): Observable<IObservedPathChange>;
    private _innerSet(path, value);
    private _innerGetSync(path);
    /**
     * Delete a path
     * @param p The path to delete
     */
    private _innerDelete(path);
    private _makePath(path);
    private _setAtPath(path, value);
    private _getAtPath(path);
    private _deleteAtPath(path);
    /**
     * Removes all references from a path, allowing simple modifications.
     */
    private _dereferencePath(path);
}
