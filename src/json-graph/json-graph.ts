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
    $type: 'valueChange' | 'refChange' | 'pathRemoved';
    newValue?: any;

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
    } = {};


    private _setPaths$ = new Subject<{
        path: string[],
        value: any
    }>();

    get __data() {
        return this._data;
    }

    constructor() {
        this._data = {};
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
    getSync(path: any[]): any {
        const p = new Path(path);
        return this._innerGetSync(p.path);
    }

    /**
     * Observe a path change.
     * @param path The path to observe
     */
    observe(path: any[]): Observable<IObservedPathChange> {
        return new Observable<IObservedPathChange>((subscriber: Subscriber<IObservedPathChange>)=>{

            let originalPath = path,
                setPaths$ = this._setPaths$,
                dereferencedPath = this._dereferencePath(path);

                


                let subsc = setPaths$
                .filter(o=>pathsAreEqual(o.path, dereferencedPath))
                .subscribe(next=>{
                    subscriber.next({
                        $type: 'valueChange',
                        newValue: next.value
                    });
                }, err=>{
                    subscriber.error(err);
                }, ()=>{
                });

                return {
                    unsubscribe() {
                        subsc.unsubscribe();
                    }
                };
        });
    }

    private _innerSet(path: IPath, value: any) {
        let resolvedPath = this._dereferencePath(path);
        this._makePath(resolvedPath);
        this._setAtPath(resolvedPath, value);
    }

    private _innerGetSync(path: IPath) : any {
        let resolvedPath = this._dereferencePath(path);
        return this._getAtPath(resolvedPath);
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
            this._trackRef(path, value);
        }

        this._setPaths$.next({
            path,
            value
        });
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
                    } catch(e) {
                    }
                }

            } catch (e) {
                // Allow undefined paths to be referenced still.
                completePath.push(cursorIndex);
            }

        }
        return completePath;
    }

    private _trackRef(path: string[], reference: ISentinel) {
        let joinedPath = path.join(PATH_JOINER);
        let pathReferences = this._pathReferences;
        if (!pathReferences[joinedPath]) {
            pathReferences[joinedPath] = {};
        }
        pathReferences[joinedPath][reference.value.join(PATH_JOINER)] = [].concat(reference.value);
    }

}