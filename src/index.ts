import { totalist } from 'totalist/sync';
import { isObject } from './object-utils.js';
import { createClog } from '@marianmeres/clog';

const clog = createClog('file-based-routes');

const isFn = (v) => typeof v === 'function';

interface AddFileBasedRoutesOptions {
	verbose: boolean;
	prefix: string;
	errHandler: (res, err) => void;
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
}

export const addFileBasedRoutes = async (
	router: Partial<RouterLike>,
	routesDir: string,
	{
		verbose = false,
		prefix = '',
		errHandler = null,
	}: Partial<AddFileBasedRoutesOptions> = {}
) => {
	const dirLabel = routesDir.slice(process.cwd().length);
	// prettier-ignore
	verbose && clog(`--> ${dirLabel} ${prefix ? `(prefix '${prefix}')` : ''} ...`);

	// if starts with "_", consider it hidden
	const isForbidden = (name) => name.split('/').some((v) => v.startsWith('_'));

	const files = [];
	totalist(routesDir, (name, abs, stats) => {
		if (/\.[tj]s$/.test(name) && !isForbidden(name)) {
			// remove extension, and "index" means parent directory root
			files.push({
				route: `${prefix}/` + name.slice(0, -3).replace(/(^|\/)index$/, ''),
				abs,
			});
		}
	});

	// the order should/must not matter. If it does, it smells... but sort it anyway
	files.sort((a, b) => a.route.localeCompare(b.route));

	const seen = {};

	// https://swagger.io/docs/specification/paths-and-operations/
	let paths = {};

	for (let { route, abs } of files) {
		const handler = (await import(abs)).default || {};

		['get', 'post', 'put', 'patch', 'del', 'delete', 'all', 'options'].forEach(
			(method) => {
				const METHOD = method.toUpperCase();
				let middleware;
				let handlerFn;
				let schema;

				// supported shapes are:
				// { method: fn }
				if (isFn(handler[method])) {
					handlerFn = handler[method];
				}
				// or { method: { middleware: [...fns], handler: fn, schema: any } }
				else if (isObject(handler[method]) && isFn(handler[method].handler)) {
					handlerFn = handler[method].handler;
					middleware = handler[method].middleware;
					schema = handler[method].schema;
				}

				// normalize + cleanup middlewares stack
				if (!Array.isArray(middleware)) middleware = [middleware];
				middleware = middleware.filter(Boolean);

				// make sure to notify response in case...
				if (handler[method] && !isFn(handlerFn)) {
					handlerFn = () => {
						throw new Error(`Invalid route handler for: ${METHOD} ${route}`);
					};
				}

				//
				if (isFn(handlerFn)) {
					// throw on ambiguity: /a/b.ts vs /a/b/index.ts
					if (seen[METHOD + route]) throw new Error(`Route '${route}' already added!`);
					seen[METHOD + route] = true;

					// prettier-ignore
					verbose && clog([
						METHOD,
						route,
						middleware.length ? `(with ${middleware.length} middlewares)` : '',
					].filter(Boolean).join(' '));

					router[method](route, middleware, async (req, res, next) => {
						try {
							await handlerFn(req, res, next);
						} catch (err) {
							if (isFn(errHandler)) {
								errHandler(res, err);
							} else {
								throw err;
							}
						}
					});

					// collect schemas
					if (schema) {
						schema = { [route]: { [method]: isFn(schema) ? schema() : schema } };
						paths = { ...paths, ...schema };
					}
				}
			}
		);
	}

	verbose && clog(`✔ Done ${dirLabel}`);
	return { router, paths };
};
