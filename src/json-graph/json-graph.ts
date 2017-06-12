import { ISentinel, isSentinel } from './sentinel';
import {
    cloneDeep
} from 'lodash';

import {
    Observable,
    Subject,
    Subscriber
} from 'rxjs';

export type IPath = Array<string | boolean | number | null>;

export class Path {
    constructor(keys: any[]) {
        this._path = keys.map(v => {
            let type = typeof v;
            if (v === 'string' ||
                v === 'number' ||
                v === 'boolean' ||
                v === null) {
                return v;
            }
            return '' + v;
        });
    }

    get path(): IPath {
        return this._path;
    }

    private _path: IPath;
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
    }
}

const PATH_JOINER = 'ௐ';

function pathsAreEqual(path: any[], otherPath: any[]) {
    return !!path && !!otherPath && path.length === otherPath.length && path.join(PATH_JOINER) === otherPath.join(PATH_JOINER);
}

export class JsonGraph {

    private _data: any = Object.create(null);

    private _pathReferences: {
        [joinedPath: string]: {
            [joinedPath: string]: IPath;
        };
    } = Object.create(null);


    private _setPaths$ = new Subject<{
        path: string[],
        value: any
    }>();

    private _deletedPaths$ = new Subject<{
        path: string[]
    }>();

    get __data() {
        return this._data;
    }

    constructor() {
    }

    /**
     * Set a value in the path
     */
    set(path: any[], value: any) {
        const p = new Path(path);
        this._innerSet(p.path, value);
    }

    /**
     * Set a value in the path
     */
    getSync(path: any[], options?: {
        /**
         * Whether or not references should be flattened.
         */
        flatten?: boolean;
    }, prefetchedValues?: {[refPath: string]: any}): any {
        const p = new Path(path);
        let object = this._innerGetSync(p.path);

        if (options && options.flatten) {
            if (! prefetchedValues) {
                prefetchedValues = Object.create(null);
            }
            prefetchedValues[this._dereferencePath(p.path).join(PATH_JOINER)] = object;


            for (let key in object) {
                let value = object[key];
                if (isSentinel(value)) {
                    if (value.$type === 'ref') {
                        let dereferencedPath = this._dereferencePath(value.value);
                        let flattenedPath = dereferencedPath.join(PATH_JOINER);
                        let referencedValue = prefetchedValues[flattenedPath];
                        if (!referencedValue) {
                            referencedValue = this.getSync(dereferencedPath, {
                                flatten: true
                            }, prefetchedValues);
                            if (referencedValue instanceof Array) {
                                prefetchedValues[flattenedPath] = referencedValue.map(v => {
                                    if (isSentinel(v) && v.$type === 'ref') {
                                        return this.getSync(v.value, {flatten: true}, prefetchedValues);
                                    }
                                    return v;
                                });
                            } else {
                                prefetchedValues[flattenedPath] = referencedValue;
                            }
                        }
                        object[key] = referencedValue;
                    } else if (value.$type === 'atom') {
                        object[key] = value.value;
                    }
                }
                if (value instanceof Array) {
                    object[key] = value.map(v => {
                        if (isSentinel(v) && v.$type === 'ref') {
                            return this.getSync(v.value, {flatten: true}, prefetchedValues);
                        }
                        return v;
                    });
                }
            }
            return object;
        } else {
            return object;
        }
    }

    delete(path: any[]) {
        const p = new Path(path);
        this._innerDelete(p.path);
    }

    /**
     * Observe a path change.
     * @param path The path to observe
     */
    observe(path: any[]): Observable<IObservedPathChange> {
        return new Observable<IObservedPathChange>((subscriber: Subscriber<IObservedPathChange>) => {

            let initialValue = this.getSync(path);
            subscriber.next({
                $type: 'initialValue',
                value: initialValue
            });

            let originalPath = path,
                setPaths$ = this._setPaths$,
                dereferencedPath = this._dereferencePath(path);

            const pathValuesMatch = (pathValue: string[]) => {
                const pathsAreExactlyEqual = pathsAreEqual(pathValue, dereferencedPath);
                if (!pathsAreExactlyEqual) {
                    let updatedDereferencedPath = this._dereferencePath(pathValue),
                        nextDereferencedPath = this._dereferencePath(path);
                    let pathsAreReferentiallyEqual = pathsAreEqual(updatedDereferencedPath, nextDereferencedPath);
                    return pathsAreReferentiallyEqual;
                }
                return pathsAreExactlyEqual;
            };

            let subsc = setPaths$
                .filter(o => pathValuesMatch(o.path))
                .subscribe(next => {
                    subscriber.next({
                        $type: 'valueChange',
                        value: next.value
                    });
                }, err => {
                    subscriber.error(err);
                }, () => {
                });

            let subscd = this._deletedPaths$
                .filter(o => pathValuesMatch(o.path))
                .subscribe(next => {
                    subscriber.next({
                        $type: 'valueChange',
                        value: undefined
                    });
                }, err => {
                    subscriber.error(err);
                }, () => {
                });

            return {
                unsubscribe() {
                    subsc.unsubscribe();
                    subscd.unsubscribe();
                }
            };
        });
    }

    private _innerSet(path: IPath, value: any) {
        let resolvedPath = this._dereferencePath(path);
        this._makePath(resolvedPath);
        this._setAtPath(resolvedPath, value);
    }

    private _innerGetSync(path: IPath): any {
        let resolvedPath = this._dereferencePath(path);
        return this._getAtPath(resolvedPath);
    }

    /**
     * Delete a path
     * @param p The path to delete
     */
    private _innerDelete(path: IPath) {
        let resolvedPath = this._dereferencePath(path);
        this._deleteAtPath(resolvedPath);
    }

    private _makePath(path: string[]) {
        let p = [].concat(path);
        p.pop();
        let cursorIndex: string, cursor: any = this._data;
        while (p.length && (cursorIndex = p.shift())) {
            if (!cursor[cursorIndex + '']) {
                cursor[cursorIndex + ''] = Object.create(null);
            }
            cursor = cursor[cursorIndex + ''];
        }
    }

    private _setAtPath(path: string[], value: any) {
        if (!path.length && typeof value === 'object') {
            Object.assign(this._data, value);
            return;
        }
        var p = [].concat(path);
        let lastCursor: string = p.pop();
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            let nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
            }
        }

        cursor[lastCursor] = value;

        if (isSentinel(value) && value.$type === 'ref') {
            // Todo: Make this async.
            let valueToEmit = this.getSync(value.value);
            this._setPaths$.next({
                path,
                value: valueToEmit
            });
        } else {
            this._setPaths$.next({
                path,
                value
            });
        }
    }

    private _getAtPath(path: string[]) {
        var p = [].concat(path);
        let lastCursor: string = p.pop();
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            let nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
            }
        }

        return cloneDeep(cursor[lastCursor]);
    }

    private _deleteAtPath(path: string[]) {
        var p = [].concat(path);
        let lastCursor: string = p.pop();
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            let nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
            }
        }

        delete cursor[lastCursor];

        this._deletedPaths$.next({
            path
        });
    }

    /**
     * Removes all references from a path, allowing simple modifications.
     */
    private _dereferencePath(path: IPath) {
        let p = [].concat(path);
        let cursor: any, cursorIndex: string;
        cursor = this._data;

        let completePath: string[] = [];

        // Walk down the path until it's completely walked down.
        while (p.length && (cursorIndex = p.shift() + '')) {
            try {
                let v = cursor[cursorIndex];
                // If this is a reference, we are going to walk down a new path
                if (isSentinel(v) && v.$type === 'ref') {
                    // Reset the "complete path", we have started anew at the root.
                    completePath = [];

                    // Reset our stack
                    p = [].concat(v.value, p);

                    // We have started walking at the top again, reset our cursor.
                    cursor = this._data;
                } else {
                    // We keep adding new values now, as we aren't referencing anymore.
                    completePath.push(cursorIndex);

                    // We are going to walk down this new path
                    try {
                        cursor = cursor[cursorIndex];
                    } catch (e) {
                    }
                }

            } catch (e) {
                // Allow undefined paths to be referenced still.
                completePath.push(cursorIndex);
            }

        }
        return completePath;
    }

}