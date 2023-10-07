import { Application, Express, Request, Response } from 'express';
interface AddFileBasedRoutesOptions {
    verbose: boolean;
    prefix: string;
    validateParams: boolean;
    validateRequestBody: boolean;
    errHandler: (res: Response, err: Error, req: Request) => void;
}
interface RouterLike {
    get: CallableFunction;
    post: CallableFunction;
    put: CallableFunction;
    patch: CallableFunction;
    del: CallableFunction;
    delete: CallableFunction;
    all: CallableFunction;
    options: CallableFunction;
    use: CallableFunction;
}
export declare const fileBasedRoutes: (routesDir: string, schema?: object, { verbose, prefix, validateParams, validateRequestBody, errHandler, }?: Partial<AddFileBasedRoutesOptions>) => Promise<{
    apply: (app: Partial<RouterLike> | Express | Application) => any;
    schema: any;
}>;
export {};
