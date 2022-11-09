interface AddFileBasedRoutesOptions {
    verbose: boolean;
    prefix: string;
    errHandler: (res: any, err: any) => void;
}
interface RouterLike {
    get: Function;
    post: Function;
    put: Function;
    patch: Function;
    del: Function;
    delete: Function;
    all: Function;
    options: Function;
    use: Function;
}
export declare const addFileBasedRoutes: (router: Partial<RouterLike>, routesDir: string, { verbose, prefix, errHandler, }?: Partial<AddFileBasedRoutesOptions>) => Promise<{
    router: Partial<RouterLike>;
    schemaPaths: any;
    schemaComponents: any;
}>;
export {};
