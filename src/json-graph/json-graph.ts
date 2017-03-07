import { isExpired, isSentinel, ISentinel } from './sentinel';
import {
    cloneDeep
} from 'lodash';

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


export class JsonGraph {

    private _data: any = Object.create(null);

    private _pathPrefix: string;

    get __data() {
        return this._data;
    }

    dateNow() {
        return Date.now();
    }

    constructor(pathPrefix: string = '') {
        this._pathPrefix = pathPrefix;
        this._data = {};
    }

    /**
     * Set a value in the path
     */
    set(path: any[], value: any, pathPrefix = this._pathPrefix) {
        const p = this._newPath(path, pathPrefix);
        this._innerSet(p.path, value);
    }

    /**
     * Get a value synchronously in the path
     */
    getSync(path: any[], defaultValue = undefined): any {
        const p = this._newPath(path);
        let v = this._innerGetSync(p.path);

        if (v.isExpired || !v.exists) {
            return defaultValue;
        } else {
            let value = v.value;
            if (isSentinel(value) && isExpired(value, ()=>this.dateNow())) {
                return defaultValue
            }
            return this._unbox(value);
        }
    }

    has(path: any[]): any {
        const p = this._newPath(path);
        return this._innerGetSync(p.path).exists;
    }

    /**
     * Returns a serialized version of the JsonGraph
     */
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