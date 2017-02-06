import { isSentinel } from './sentinel';
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

}