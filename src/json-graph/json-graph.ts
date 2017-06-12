import { isExpired, isSentinel, ISentinel } from './sentinel';
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
    private _pathPrefix: string;

    get __data() {
        return this._data;
    }

    dateNow() {
        return Date.now();
    }

    constructor(pathPrefix: string = '') {
        this._pathPrefix = pathPrefix;
    }

    /**
     * Set a value in the path
     */
    set(path: any[], value: any, pathPrefix = this._pathPrefix) {
        const p = this._newPath(path, pathPrefix);
        this._innerSet(p.path, value);
    }


    has(path: any[]): any {
        const p = this._newPath(path);
        return this._innerGetSync(p.path).exists;
    }

    /**
     * Returns a serialized version of the JsonGraph
     */
    getSync(path: any[], options?: {

        /**
         * The default value to retrieve
         */
        defaultValue?: any;
        /**
         * Whether or not references should be flattened.
         */
        flatten?: boolean;
    }, prefetchedValues?: {[refPath: string]: any}): any {
        const p = new Path(path);
        let v = this._innerGetSync(p.path);

        let defaultValue = options ? options.defaultValue : undefined;


        if (v.isExpired || !v.exists) {
            return defaultValue;
        } else {
            let object = v.value;
            if (isSentinel(object) && isExpired(object, ()=>this.dateNow())) {
                return defaultValue;
            }
            object = this._unbox(object);

            if (options && options.flatten) {
                if (! prefetchedValues) {
                    prefetchedValues = Object.create(null);
                }
                prefetchedValues[this._dereferencePath(p.path).path.join(PATH_JOINER)] = object;


                for (let key in object) {
                    let value = object[key];
                    if (isSentinel(value)) {
                        if (value.$type === 'ref') {
                            let dereferencedPath = this._dereferencePath(value.value).path;
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
                dereferencedPath = this._dereferencePath(path).path;

            const pathValuesMatch = (pathValue: string[]) => {
                const pathsAreExactlyEqual = pathsAreEqual(pathValue, dereferencedPath);
                if (!pathsAreExactlyEqual) {
                    let updatedDereferencedPath = this._dereferencePath(pathValue).path,
                        nextDereferencedPath = this._dereferencePath(path).path;
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

    serialize(): string {
        return JSON.stringify(
            {
                _data: this.__data,
                _pathPrefix: this._pathPrefix
            }
        );
    }

    /**
     * Creates a new JsonGraph from a deserialized string
     * @param input 
     */
    static deserialize(input: string): JsonGraph {
        let data = JSON.parse(input);
        if (data) {
            let d = data._data,
                p = data._pathPrefix;
            let g = new JsonGraph(p);

            let theData = Object.create(null);
            Object.assign(theData, d);

            g._setData(theData);

            return g;
        } else {
            throw 'No data'
        }
    }

    private _unbox(value: any): any {
        if (isSentinel(value) && value.$type === 'atom') {
            return value.value;
        }
        return value;
    }

    private _isExpired(value: any | ISentinel) {
        if (isSentinel(value)) {
            return isExpired(value, () => this.dateNow());
        }
        return false;
    }

    private _setData(data: any) {
        this._data = data;
    }

    private _newPath(path: any[], pathPrefix = this._pathPrefix) {
        let p = path;
        if (pathPrefix) {
            p = [].concat(pathPrefix).concat(path);
        }
        return new Path(p);
    }

    private _innerSet(path: IPath, value: any) {
        let deref = this._dereferencePath(path);
        if (deref.isExpired) {
            throw 'Path expired';
        }
        let resolvedPath = deref.path;
        this._makePath(resolvedPath);
        this._setAtPath(resolvedPath, value);
    }

    private _innerGetSync(path: IPath): {
        value: any,
        exists: boolean,
        isExpired: boolean
    } {
        let deref = this._dereferencePath(path);
        let isExpired = deref.isExpired;
        let vals = this._getAtPath(deref.path);
        return {
            isExpired: isExpired,
            value: vals.value,
            exists: vals.exists
        }
    }

    /**
     * Delete a path
     * @param p The path to delete
     */
    private _innerDelete(path: IPath) {
        let resolvedPath = this._dereferencePath(path).path;
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

    private _getAtPath(path: string[]): {
        exists: boolean;
        value: any;
    } {
        let exists: boolean = true,
            value: any;
        var p = [].concat(path);
        var cursorIndex, cursor = this._data;
        while (cursorIndex = p.shift()) {
            let nextCursor = cursorIndex + '';
            if (cursor[nextCursor]) {
                cursor = cursor[nextCursor];
                exists = true;
            } else {
                exists = false;
            }
        }

        if (exists) {
            return {
                value: cloneDeep(cursor),
                exists
            }
        } else {
            return {
                value: undefined,
                exists
            }
        }
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
    private _dereferencePath(path: IPath): {
        path: string[];
        isExpired: boolean;
    } {
        let p = [].concat(path);
        let cursor: any, cursorIndex: string;
        cursor = this._data;
        const dateNow = () => this.dateNow();
        let completePath: string[] = [];
        let pathExpired = false;

        // Walk down the path until it's completely walked down.
        while (p.length && (cursorIndex = p.shift() + '')) {
            try {
                let v: any | ISentinel = cursor[cursorIndex];
                // If this is a reference, we are going to walk down a new path
                if (isSentinel(v) && v.$type === 'ref') {
                    if (!pathExpired) {
                        pathExpired = isExpired(v, dateNow);
                    }

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
        return {
            path: completePath,
            isExpired: pathExpired
        };
    }



}