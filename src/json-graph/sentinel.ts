export function isSentinel(v :any): v is ISentinel {
    let $type = v ? v.$type : '';
    return $type === 'ref' || $type === 'atom' || $type ==='error';
}

export interface ISentinel {
    $type: 'ref' | 'atom' | 'error';
    value: any;

    /**
     * Unix time of when this was created
     */
    $timestamp: number;

    /**
     * Either:
     *  0: This value is expired
     *  1: This value never expires
     * A unix time: This value is expired when $expires < Date.now();
     */
    $expires: number;
}

function sentinel(type: 'ref' | 'atom' | 'error', value?: any, props?: any) {
    var copy = Object.create(null);
    if (props !== null) {
        for (var key in props) {
            copy[key] = props[key];
        }

        copy['$type'] = type;
        copy.value = value;
        return copy;
    }
    else {
        return {$type: type, value: value};
    }
}

export function ref(path: string[], props?) {
    return sentinel('ref', path, props);
}

export function atom(value, props) {
    return sentinel('atom', value, props);
}

export function undefined() {
    return sentinel('atom');
}

export function pathValue(path, value) {
    return {
        path: path,
        value: value
    };
}

export function pathInvalidation(path) {
    return {
        path: path,
        invalidated: true
    };
}