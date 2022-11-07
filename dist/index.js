import { resolve, join } from 'path';
import { readdirSync, statSync } from 'fs';

function totalist(dir, callback, pre='') {
	dir = resolve('.', dir);
	let arr = readdirSync(dir);
	let i=0, abs, stats;
	for (; i < arr.length; i++) {
		abs = join(dir, arr[i]);
		stats = statSync(abs);
		stats.isDirectory()
			? totalist(abs, callback, join(pre, arr[i]))
			: callback(join(pre, arr[i]), abs, stats);
	}
}

const isObject = (o) => Object.prototype.toString.call(o) === '[object Object]';

var dist = {};

Object.defineProperty(dist, '__esModule', { value: true });

class ClogConfig {
    static log = true;
    static warn = true;
    static error = true;
    static none() {
        ClogConfig.log = false;
        ClogConfig.warn = false;
        ClogConfig.error = false;
    }
    static all() {
        ClogConfig.log = true;
        ClogConfig.warn = true;
        ClogConfig.error = true;
    }
}
const createClog = (ns, config = ClogConfig, writer = null) => {
    writer ||= console;
    if (ns !== false)
        ns = `[${ns}]`;
    if (config === true)
        config = { log: true, warn: true, error: true };
    if (config === false)
        config = { log: false, warn: false, error: false };
    const apply = (k, args) => config?.[k] && writer[k].apply(writer, ns ? [ns, ...args] : [...args]);
    const clog = (...args) => apply('log', args);
    clog.warn = (...args) => apply('warn', args);
    clog.error = (...args) => apply('error', args);
    clog.log = clog;
    return clog;
};

dist.ClogConfig = ClogConfig;
var createClog_1 = dist.createClog = createClog;

const clog = createClog_1('file-based-routes');
const isFn = (v) => typeof v === 'function';
const addFileBasedRoutes = async (router, routesDir, { verbose = false, prefix = '', errHandler = null, } = {}) => {
    const dirLabel = routesDir.slice(process.cwd().length);
    verbose && clog(`--> ${dirLabel} ${prefix ? `(prefix '${prefix}')` : ''} ...`);
    const isForbidden = (name) => name.split('/').some((v) => v.startsWith('_'));
    const files = [];
    totalist(routesDir, (name, abs, stats) => {
        if (/\.[tj]s$/.test(name) && !isForbidden(name)) {
            files.push({
                route: `${prefix}/` + name.slice(0, -3).replace(/(^|\/)index$/, ''),
                abs,
            });
        }
    });
    files.sort((a, b) => a.route.localeCompare(b.route));
    const seen = {};
    let paths = {};
    for (let { route, abs } of files) {
        const handler = (await import(abs)).default || {};
        ['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'].forEach((method) => {
            const METHOD = method.toUpperCase();
            let middleware;
            let handlerFn;
            let schema;
            if (isFn(handler[method])) {
                handlerFn = handler[method];
            }
            else if (isObject(handler[method]) && isFn(handler[method].handler)) {
                handlerFn = handler[method].handler;
                middleware = handler[method].middleware;
                schema = handler[method].schema;
            }
            if (!Array.isArray(middleware))
                middleware = [middleware];
            middleware = middleware.filter(Boolean);
            if (handler[method] && !isFn(handlerFn)) {
                handlerFn = () => {
                    throw new Error(`Invalid route handler for: ${METHOD} ${route}`);
                };
            }
            if (isFn(handlerFn)) {
                if (seen[METHOD + route])
                    throw new Error(`Route '${route}' already added!`);
                seen[METHOD + route] = true;
                verbose && clog([
                    METHOD,
                    route,
                    middleware.length ? `(with ${middleware.length} middlewares)` : '',
                ].filter(Boolean).join(' '));
                router[method](route, middleware, async (req, res, next) => {
                    try {
                        await handlerFn(req, res, next);
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
                if (schema) {
                    schema = { [route]: { [method]: isFn(schema) ? schema() : schema } };
                    paths = { ...paths, ...schema };
                }
            }
        });
    }
    verbose && clog(`✔ Done ${dirLabel}`);
    return { router, paths };
};

export { addFileBasedRoutes };
