import { createClog } from '@marianmeres/clog';
import Ajv from 'ajv';
import merge from 'lodash/merge.js';
import fs from 'node:fs';
import path from 'node:path';
import { totalist } from 'totalist/sync';
import { isObject } from './lib/object.js';
import { filterTopMost } from './lib/filter-topmost.js';
const clog = createClog('file-based-routes');
const isFn = (v) => typeof v === 'function';
class ValidationError extends Error {
}
// @ts-ignore
const ajv = new Ajv({ strict: false, validateFormats: false });
export const fileBasedRoutes = async (routesDir, 
// openapi schema into which the paths description will be deep merged (if available)
schema = {}, { verbose = false, prefix = '', 
// custom validators outside of the openapi validation (if any)
validateParams = false, validateRequestBody = false, errHandler = null, 
//
allowStaticDirs = true, } = {}) => {
    routesDir = path.normalize(routesDir);
    if (!fs.existsSync(routesDir)) {
        verbose && clog.warn(`Dir ${routesDir} not found...`);
        return { apply: () => null, schema: null, staticDirs: [] };
    }
    const dirLabel = routesDir.slice(process.cwd().length);
    // prettier-ignore
    verbose && clog(`--> ${dirLabel} ${prefix ? `(prefix '${prefix}')` : ''} ...`);
    // if any segment starts with "_", consider it hidden (won't be added to router)
    const isForbidden = (name) => name.split('/').some((v) => v.startsWith('_'));
    const isStatic = (name) => name.split('/').at(-1) === '.static';
    const files = [];
    let staticDirs = [];
    const _staticMeta = {};
    totalist(routesDir, (name, abs, stats) => {
        // static check first
        if (isStatic(name)) {
            const route = `${prefix}/` + path.dirname(name);
            allowStaticDirs && staticDirs.push(route);
            _staticMeta[route] = path.dirname(abs);
        }
        //
        else if (/\.js$/.test(name) && !isForbidden(name)) {
            // remove extension, and "index" means parent directory root
            files.push({
                route: `${prefix}/` + name.slice(0, -3).replace(/(^|\/)index$/, ''),
                abs,
            });
        }
    });
    staticDirs = filterTopMost(staticDirs).map((v) => ({ route: v, abs: _staticMeta[v] }));
    // the order SHOULD NOT matter... (but sort it anyway)
    files.sort((a, b) => a.route.localeCompare(b.route));
    // clog(JSON.stringify(staticDirs, null, 2));
    const _seen = {};
    // https://swagger.io/docs/specification/paths-and-operations/
    let schemaPaths = {};
    let schemaComponents = {
        // convenience helper out of the box
        Any: { type: 'object' },
    };
    const _maybeImportMdlwr = async (file) => {
        let out = [];
        if (fs.existsSync(file)) {
            out = (await import(file)).default;
            if (!out || !Array.isArray(out)) {
                throw new Error(`Invalid top most middleware file (must default export array): ${file}`);
            }
            if (out.length && !out.every(isFn)) {
                throw new Error(`Invalid middleware file (must return array of middleware functions only): ${file}`);
            }
        }
        return out;
    };
    // special case topmost middlewares
    // "topmost" -> in the routes dir
    let topmostMiddlewares = await _maybeImportMdlwr(path.join(routesDir, '_middleware.js'));
    const methodFns = [];
    for (let { route, abs } of files) {
        // "global" -> somewhere in the ancestor dir segment
        let ancestorMiddlewares = [];
        let parent = path.dirname(abs);
        while (routesDir !== parent) {
            let _mf = path.join(parent, '_middleware.js');
            ancestorMiddlewares = ancestorMiddlewares.concat(await _maybeImportMdlwr(_mf));
            parent = path.dirname(parent);
        }
        // higher in tree must come first, so:
        ancestorMiddlewares.reverse();
        //
        const endpoint = (await import(abs)).default;
        if (!isObject(endpoint)) {
            throw new Error(`Invalid route endpoint file (must default export object): ${abs}`);
        }
        // "module endpoint" middlewares -> in the endpoint's dir
        let moduleMiddlewares = endpoint.middleware || [];
        const METHODS = ['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'];
        const padEndLength = METHODS.reduce((m, v) => (m = Math.max(m, v.length)), 0);
        METHODS.forEach((method) => {
            const METHOD = method.toUpperCase();
            try {
                // using factory instead of plain handler to allow more control
                let createHandlerFn;
                // schemas
                let paths;
                let components;
                let localMiddlewares = [];
                // supported shapes are:
                // { method: fn }
                if (isFn(endpoint[method])) {
                    // normalize to factory
                    createHandlerFn = () => endpoint[method];
                }
                // or { method: { middlewares: [...fns], handler: fn, schemas... } }
                // or { method: { middlewares: [...fns], createHandler: () => handler, schemas... } }
                else if (isObject(endpoint[method])) {
                    // factory has higher priority
                    if (isFn(endpoint[method].createHandler)) {
                        createHandlerFn = endpoint[method].createHandler;
                    }
                    else if (isFn(endpoint[method].handler)) {
                        // normalize to factory
                        createHandlerFn = () => endpoint[method].handler;
                    }
                    paths = endpoint[method].schemaPaths;
                    components = endpoint[method].schemaComponents;
                    localMiddlewares = endpoint[method].middleware || [];
                }
                if (!Array.isArray(localMiddlewares) || !localMiddlewares.every(isFn)) {
                    throw new Error(`Invalid ${METHOD} route endpoint (middleware key must return array of middleware functions): ${abs}`);
                }
                //
                let middlewares = [
                    ...topmostMiddlewares,
                    ...ancestorMiddlewares,
                    ...moduleMiddlewares,
                    ...localMiddlewares,
                ];
                // fail early on invalid route def...
                if (endpoint[method] && !isFn(createHandlerFn)) {
                    throw new Error(`Invalid route definition/handler...`);
                }
                //
                if (isFn(createHandlerFn)) {
                    // to avoid ambiguity: /a/b.js vs /a/b/index.js
                    if (_seen[METHOD + route])
                        throw new Error(`Route already added!`);
                    _seen[METHOD + route] = true;
                    // prettier-ignore
                    verbose && clog([
                        METHOD.padEnd(padEndLength, ' '),
                        route,
                        middlewares?.length ? `(with ${middlewares.length} middlewares)` : '',
                    ].filter(Boolean).join(' '));
                    // collect & deep merge schemas
                    if (components) {
                        components = isFn(components) ? components() : components;
                        schemaComponents = merge({}, schemaComponents, components);
                    }
                    if (paths) {
                        paths = isFn(paths) ? paths() : paths;
                        paths = merge({ summary: method.toUpperCase(), responses: {} }, paths);
                        if (validateParams || endpoint[method].validateParams) {
                            middlewares.push(_createParamsValidator(paths?.parameters, schemaComponents, errHandler));
                        }
                        if (validateRequestBody || endpoint[method].validateRequestBody) {
                            middlewares.push(_createRequestBodyValidator(paths?.requestBody, schemaComponents, errHandler));
                        }
                        paths = { [_toOpenApiLike(route)]: { [method]: paths } };
                        schemaPaths = merge({}, schemaPaths, paths);
                    }
                    // collect all "method" functions into an array...
                    methodFns.push((app) => {
                        const handlerFn = createHandlerFn(app, route, method);
                        // note: NOT polka compatible...
                        app[method](route, middlewares, async (req, res, next) => {
                            try {
                                await handlerFn(req, res, next);
                            }
                            catch (e) {
                                return isFn(errHandler) ? errHandler(res, e, req) : next(e);
                            }
                        });
                    });
                }
            }
            catch (e) {
                clog.error(`[${METHOD} ${route}]`, e);
            }
        });
    }
    verbose && clog(`✔ ${dirLabel}`);
    return {
        apply: (app) => {
            for (const fn of methodFns)
                fn(app);
        },
        schema: _buildSchema(schemaPaths, schemaComponents, schema),
        staticDirs,
    };
};
//
const _buildSchema = (paths, components, existing = {}) => merge({}, existing, { paths, components: { schemas: components } });
//
const _createParamsValidator = (parameters, components, errHandler = null) => {
    const type = {};
    const required = {};
    const validator = (parameters || []).reduce((m, p) => {
        if (p.name && p.schema) {
            m[p.name] = ajv.compile(p.schema);
            type[p.name] = p.in === 'query' ? 'query' : 'params';
            if (p.required)
                required[p.name] = true;
        }
        return m;
    }, {});
    return (req, res, next) => {
        try {
            Object.entries(validator).forEach((entry) => {
                const [name, validate] = entry;
                // if not marked as required AND not present in req skip... (in other words,
                // I can't get the validate to consider the param type as not required)
                if (!required[name] && req[type[name]][name] === undefined) {
                    return;
                }
                if (!validate(req[type[name]][name])) {
                    const e = new ValidationError(`Param '${name}' (in ${type[name]}) is not valid`);
                    e.errors = validate.errors;
                    e.status = 400; // bad request
                    throw e;
                }
            });
            next();
        }
        catch (e) {
            return isFn(errHandler) ? errHandler(res, e, req) : next(e);
        }
    };
};
//
const _createRequestBodyValidator = (requestBody, components, errHandler = null) => {
    let schema = requestBody?.content?.['application/json']?.schema;
    let validate = () => true;
    if (schema) {
        if (schema?.$ref) {
            const cmp = schema.$ref.split('/').slice(-1)[0];
            schema = components[cmp];
        }
        if (schema)
            validate = ajv.compile(schema);
    }
    //
    return (req, res, next) => {
        try {
            if (!validate(req.body)) {
                const e = new ValidationError(`Request body is not valid`);
                e.errors = validate.errors;
                e.status = 400;
                throw e;
            }
            next();
        }
        catch (e) {
            return isFn(errHandler) ? errHandler(res, e, req) : next(e);
        }
    };
};
// for now, just the most common ":named" param use case), so: /a/:b/c -> /a/{b}/c
const _toOpenApiLike = (route) => route
    .split('/')
    .map((segment) => {
    if (segment.startsWith(':'))
        segment = `{${segment.slice(1)}}`;
    return segment;
})
    .join('/');
//
const _validateErrorsToString = (errors) => (errors || [])
    .reduce((memo, e) => {
    memo.push(`${e.schemaPath} ${e.message}`);
    return memo;
}, [])
    .join(', ');
