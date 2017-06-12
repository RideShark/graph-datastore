export interface IGraphReference {
}
export interface IRefKeyType {
    /**
     * The type which is referenced
     */
    $typeName: string;
    /**
     * This is always a singular reference to another type
     */
    $isSingular?: boolean;
    /**
     * If this is an array, then inserted objects must always follow an array format, or be referenced by an in-bounds index.
     */
    $isArray?: boolean;
    /**
     * If this is a dictionary, then inserted objects must always specify a key, or be dictionaries themselves.
     */
    $isDictionary?: boolean;
}
export interface IGraphType {
    /**
     * The name of this graph type. It must be unique.
     */
    $name: string;
    /**
     * The keys which make up the ID of this graph.
     */
    $idKeys: string[];
    /**
     * Atom keys refer to keys which are either atoms, or scalar in nature.
     */
    $atomKeys: {
        [keyName: string]: boolean;
    };
    /**
     * Ref keys refer to keys which will always reference other keys in the graph.
     */
    $refKeys: {
        [keyName: string]: IRefKeyType;
    };
}
export interface IGraphSchemaEditor {
    addGraphType(typeName: string, idKeys: string[], atomKeys: string[], refKeys: [string, IRefKeyType][]): any;
    addAtomKeys(typeName: string, ...keyNames: string[]): any;
    addRefKeys(typeName: string, ...keys: [string, IRefKeyType][]): any;
}
export interface IGraphSchema {
    /**
     * The types in the graph.
     */
    $types: {
        [typeName: string]: IGraphType;
    };
    /**
     * A definition of the root of the graph.
     */
    $root: IGraphType;
    /**
     * The string which will be used to concatenate ID keys, for composite keys
     */
    $concatenationStrategy: string;
}
