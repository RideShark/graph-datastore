export declare function isSentinel(v: any): v is ISentinel;
export interface ISentinel {
    $type: 'ref' | 'atom' | 'error';
    value: any;
    /**
     * Unix time of when this was created
     */
    $timestamp?: number;
    /**
     * Either:
     *  0: This value is expired
     *  1: This value never expires
     * A unix time: This value is expired when $expires < Date.now();
     */
    $expires?: number;
}
export declare function ref(path: string[], props?: any): any;
export declare function atom(value: any, props: any): any;
export declare function undefined(): any;
export declare function pathValue(path: any, value: any): {
    path: any;
    value: any;
};
export declare function pathInvalidation(path: any): {
    path: any;
    invalidated: boolean;
};
