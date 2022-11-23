import fs from 'node:fs';
import { totalist } from 'totalist/sync';
import merge from 'lodash/merge.js';
import { createClog } from '@marianmeres/clog';
import { isObject } from './lib/object.js';
import Ajv from 'ajv';
const clog = createClog('file-based-routes');
const isFn = (v) => typeof v === 'function';
class ValidationError extends Error {
}
// @ts-ignore
const ajv = new Ajv({ strict: false, validateFormats: false });
export const fileBasedRoutes = async (routesDir, 
// openapi schema into which the paths description will be deep merged (if available)
schema = {}, { verbose = false, prefix = '', 
// custom validators outside of the openapi validation
validateRouteParams = false, validateRequestBody = false, } = {}) => {
    if (!fs.existsSync(routesDir)) {
        verbose && clog.warn(`Dir ${routesDir} not found...`);
        return { apply: () => null, schema: null };
    }
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
    const _seen = {};
    // https://swagger.io/docs/specification/paths-and-operations/
    let schemaPaths = {};
    let schemaComponents = {
        // convenience helper out of the box
        Any: { type: 'object' },
    };
    const methodFns = [];
    for (let { route, abs } of files) {
        const handler = (await import(abs)).default || {};
        // "global endpoint" middlewares
        let moduleMiddlewares = handler.middlewares || [];
        ['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'].forEach((method) => {
            const METHOD = method.toUpperCase();
            try {
                // using factory instead of plain handler to allow more control
                let createHandlerFn;
                //
                let middlewares = [...moduleMiddlewares];
                // schemas
                let paths;
                let components;
                // supported shapes are:
                // { method: fn }
                if (isFn(handler[method])) {
                    // normalize to factory
                    createHandlerFn = () => handler[method];
                }
                // or { method: { middlewares: [...fns], handler: fn, schemas... } }
                // or { method: { middlewares: [...fns], createHandler: () => handler, schemas... } }
                else if (isObject(handler[method])) {
                    // factory has higher priority
                    if (isFn(handler[method].createHandler)) {
                        createHandlerFn = handler[method].createHandler;
                    }
                    else if (isFn(handler[method].handler)) {
                        // normalize to factory
                        createHandlerFn = () => handler[method].handler;
                    }
                    middlewares = handler[method].middleware;
                    paths = handler[method].schemaPaths;
                    components = handler[method].schemaComponents;
                }
                // normalize + cleanup middlewares stack
                if (!Array.isArray(middlewares))
                    middlewares = [middlewares];
                middlewares = middlewares.filter(isFn);
                // fail early on invalid route def...
                if (handler[method] && !isFn(createHandlerFn)) {
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
                        METHOD,
                        route,
                        middlewares.length ? `(with ${middlewares.length} middlewares)` : '',
                    ].filter(Boolean).join(' '));
                    // collect & deep merge schemas
                    if (components) {
                        components = isFn(components) ? components() : components;
                        schemaComponents = merge({}, schemaComponents, components);
                    }
                    if (paths) {
                        paths = isFn(paths) ? paths() : paths;
                        paths = merge({ summary: method.toUpperCase(), responses: {} }, paths);
                        validateRouteParams &&
                            middlewares.push(_createParamsValidator(paths?.parameters, schemaComponents));
                        validateRequestBody &&
                            middlewares.push(_createRequestBodyValidator(paths?.requestBody, schemaComponents));
                        paths = { [_toOpenApiLike(route)]: { [method]: paths } };
                        schemaPaths = merge({}, schemaPaths, paths);
                    }
                    // collect all "method" functions into an array...
                    methodFns.push(async (app) => {
                        const handlerFn = await createHandlerFn(app, route, method);
                        // note: NOT polka compatible...
                        app[method](route, middlewares, async (req, res, next) => {
                            try {
                                await handlerFn(req, res, next);
                            }
                            catch (err) {
                                next(err);
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
        apply: async (app) => {
            for (const fn of methodFns)
                await fn(app);
        },
        schema: _buildSchema(schemaPaths, schemaComponents, schema),
    };
};
//
const _buildSchema = (paths, components, existing = {}) => merge({}, existing, { paths, components: { schemas: components } });
//
const _createParamsValidator = (parameters, components) => {
    const validator = (parameters || []).reduce((m, p) => {
        if (p.name && p.schema)
            m[p.name] = ajv.compile(p.schema);
        return m;
    }, {});
    return (req, res, next) => {
        try {
            Object.entries(validator).forEach((entry) => {
                const [name, validate] = entry;
                if (!validate(req.params[name])) {
                    const e = new ValidationError(`Param '${name}' is not valid`);
                    e.errors = validate.errors;
                    e.status = 400; // bad request
                    throw e;
                }
            });
            next();
        }
        catch (e) {
            next(e);
        }
    };
};
//
const _createRequestBodyValidator = (requestBody, components) => {
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
            next(e);
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
