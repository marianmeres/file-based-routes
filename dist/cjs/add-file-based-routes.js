"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addFileBasedRoutes = void 0;
const sync_1 = require("totalist/sync");
const merge_js_1 = __importDefault(require("lodash/merge.js"));
const clog_1 = require("@marianmeres/clog");
const object_utils_js_1 = require("./utils/object-utils.js");
const clog = (0, clog_1.createClog)('file-based-routes');
const isFn = (v) => typeof v === 'function';
const addFileBasedRoutes = async (router, routesDir, 
// openapi schema into which the paths description will be deep merged (if available)
schema = {}, { verbose = false, prefix = '', errHandler = null, } = {}) => {
    const dirLabel = routesDir.slice(process.cwd().length);
    // prettier-ignore
    verbose && clog(`--> ${dirLabel} ${prefix ? `(prefix '${prefix}')` : ''} ...`);
    // if any segment starts with "_", consider it hidden (won't be added to router)
    const isForbidden = (name) => name.split('/').some((v) => v.startsWith('_'));
    const files = [];
    (0, sync_1.totalist)(routesDir, (name, abs, stats) => {
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
        const handler = (await Promise.resolve().then(() => __importStar(require(abs)))).default || {};
        ['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'].forEach((method) => {
            const METHOD = method.toUpperCase();
            const rClog = (0, clog_1.createClog)(`${METHOD} ${route}`);
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
                else if ((0, object_utils_js_1.isObject)(handler[method]) && isFn(handler[method].handler)) {
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
                    // collect & deep merge schemas
                    if (paths) {
                        paths = isFn(paths) ? paths() : paths;
                        paths = { [_toOpenApiLike(route)]: { [method]: paths } };
                        schemaPaths = (0, merge_js_1.default)({}, schemaPaths, paths);
                    }
                    if (components) {
                        components = isFn(components) ? components() : components;
                        schemaComponents = (0, merge_js_1.default)({}, schemaComponents, components);
                    }
                }
            }
            catch (e) {
                rClog.error(e.toString());
            }
        });
    }
    verbose && clog(`✔ ${dirLabel}`);
    return {
        router,
        // merge provided with
        schema: (0, merge_js_1.default)({}, schema, {
            paths: schemaPaths,
            components: {
                schemas: schemaComponents,
            },
        }),
    };
};
exports.addFileBasedRoutes = addFileBasedRoutes;
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
