import { Express, Application } from 'express';
interface AddFileBasedRoutesOptions {
    verbose: boolean;
    prefix: string;
    validateRouteParams: boolean;
    validateRequestBody: boolean;
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
export declare const fileBasedRoutes: (routesDir: string, schema?: object, { verbose, prefix, validateRouteParams, validateRequestBody, }?: Partial<AddFileBasedRoutesOptions>) => Promise<{
    apply: (app: Partial<RouterLike> | Express | Application) => any;
    schema: any;
}>;
export {};
