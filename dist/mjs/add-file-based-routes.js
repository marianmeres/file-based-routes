import { totalist } from 'totalist/sync';
import { createClog } from '@marianmeres/clog';
import { isObject } from './utils/object-utils.js';
const clog = createClog('file-based-routes');
const isFn = (v) => typeof v === 'function';
export const addFileBasedRoutes = async (router, routesDir, { verbose = false, prefix = '', errHandler = null, } = {}) => {
    const dirLabel = routesDir.slice(process.cwd().length);
    // prettier-ignore
    verbose && clog(`--> ${dirLabel} ${prefix ? `(prefix '${prefix}')` : ''} ...`);
    // if any segment starts with "_", consider it hidden (won't be added to router)
    const isForbidden = (name) => name.split('/').some((v) => v.startsWith('_'));
    const files = [];
    totalist(routesDir, (name, abs, stats) => {
        if (/\.js$/.test(name) && !isForbidden(name)) {
            // remove extension, and "index" means parent directory root
            files.push({
                route: `${prefix}/` + name.slice(0, -3).replace(/(^|\/)index$/, ''),
                abs,
            });
        }
    });
    // the order SHOULD NOT matter... (but sort it anyway)
    files.sort((a, b) => a.route.localeCompare(b.route));
    const seen = {};
    // https://swagger.io/docs/specification/paths-and-operations/
    let schemaPaths = {};
    let schemaComponents = {};
    for (let { route, abs } of files) {
        const handler = (await import(abs)).default || {};
        ['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'].forEach((method) => {
            const METHOD = method.toUpperCase();
            const rClog = createClog(`${METHOD} ${route}`);
            try {
                let middleware;
                let handlerFn;
                // schemas
                let paths;
                let components;
                // supported shapes are:
                // { method: fn }
                if (isFn(handler[method])) {
                    handlerFn = handler[method];
                }
                // or { method: { middleware: [...fns], handler: fn, paths: any } }
                else if (isObject(handler[method]) && isFn(handler[method].handler)) {
                    handlerFn = handler[method].handler;
                    middleware = handler[method].middleware;
                    paths = handler[method].schemaPaths;
                    components = handler[method].schemaComponents;
                }
                // normalize + cleanup middlewares stack
                if (!Array.isArray(middleware))
                    middleware = [middleware];
                middleware = middleware.filter(isFn);
                // make sure to notify response in case...
                if (handler[method] && !isFn(handlerFn)) {
                    handlerFn = () => {
                        throw new Error(`Invalid route handler for: ${METHOD} ${route}`);
                    };
                }
                //
                if (isFn(handlerFn)) {
                    // to avoid ambiguity: /a/b.js vs /a/b/index.js
                    if (seen[METHOD + route])
                        throw new Error(`Route '${route}' already added!`);
                    seen[METHOD + route] = true;
                    // prettier-ignore
                    verbose && clog([
                        METHOD,
                        route,
                        middleware.length ? `(with ${middleware.length} middlewares)` : '',
                    ].filter(Boolean).join(' '));
                    // polka compatible - middlewares only via `.use(...)`
                    middleware.forEach((m) => router.use(route, m));
                    // polka compatible signature: `(req, res)` not `(req, res, next)`
                    router[method](route, async (req, res) => {
                        try {
                            await handlerFn(req, res);
                        }
                        catch (err) {
                            if (isFn(errHandler)) {
                                errHandler(res, err);
                            }
                            else {
                                throw err;
                            }
                        }
                    });
                    // collect schemas
                    if (paths) {
                        paths = isFn(paths) ? paths() : paths;
                        paths = { [_toOpenApiLike(route)]: { [method]: paths } };
                        schemaPaths = { ...schemaPaths, ...paths };
                    }
                    if (components) {
                        components = isFn(components) ? components() : components;
                        schemaComponents = { ...schemaComponents, ...components };
                    }
                }
            }
            catch (e) {
                rClog.error(e.toString());
            }
        });
    }
    verbose && clog(`✔ Done ${dirLabel}`);
    return { router, schemaPaths, schemaComponents };
};
// for now, just the most common use case (named param via ":" notation), so just:
// /a/:b/c -> /a/{b}/c
const _toOpenApiLike = (route) => route
    .split('/')
    .map((segment) => {
    if (segment.startsWith(':'))
        segment = `{${segment.slice(1)}}`;
    return segment;
})
    .join('/');
