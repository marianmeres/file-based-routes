import isObject from 'lodash/isObject.js';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import { TestRunner } from '@marianmeres/test-runner';
import { fileURLToPath } from 'node:url';
import { createClog } from '@marianmeres/clog';
import { fileBasedRoutes } from '../dist/mjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __basename = path.basename(__filename);

const suite = new TestRunner(__basename);
const clog = createClog(__basename);

suite.test('adding routes works', async () => {
	const { apply, schema } = await fileBasedRoutes(
		path.join(__dirname, './fixtures'),
		{
			openapi: '3.0.0',
			info: { title: 'Foo bar', version: '1.2.3' },
			servers: [{ url: 'http://foo.com' }],
		},
		{
			verbose: false,
			prefix: '/foo',
		}
	);

	//
	const routes = {};
	const mdlwrs = {};

	// dummy mock factory
	const createHandler = (m) => (route, middlewares, handler) => {
		routes[`${m}: ${route}`] = true;
		middlewares.forEach((v) => {
			mdlwrs[route] ||= 0;
			mdlwrs[route]++;
		});
	};

	// mock
	const router = {
		get: createHandler('get  '),
		post: createHandler('post '),
	};

	// now add
	await apply(router);

	// clog(routes);
	// clog(JSON.stringify(schemaComponents, null, 2));

	// routes
	assert(routes['get  : /foo/a']);
	assert(routes['get  : /foo/a/:b']);
	assert(routes['post : /foo/a/:b']);
	assert(routes['get  : /foo/a/:b/c']);
	assert(routes['get  : /foo/a/:b/c/:d']);
	assert(Object.keys(routes).length === 5);

	// middlewares
	// clog(mdlwrs);
	// {                 '/foo/a/:b/c': 2, '/foo/a/:b/c/:d': 1 }
	// { '/foo/a/:b': 1, '/foo/a/:b/c': 2, '/foo/a/:b/c/:d': 3 }
	assert(mdlwrs['/foo/a/:b'] === 1);      // 1 "parent"
	assert(mdlwrs['/foo/a/:b/c'] === 2);    // 1 "parent" + 1 "self"
	assert(mdlwrs['/foo/a/:b/c/:d'] === 3); // 2 "parent" + 1 "self"
	assert(Object.keys(mdlwrs).length === 3);

	// clog(JSON.stringify(schema, null, 4));
	assert(schema.openapi);

	// paths, note the "{b}" segment
	assert(schema.paths['/foo/a/{b}'].post.description === 'hey ho');

	// components schemas
	assert(isObject(schema.components.schemas.User));
	assert(isObject(schema.components.schemas.Foo));
});

suite.test('non existing dir', async () => {
	const { apply, schema } = await fileBasedRoutes('./foo', {}, { verbose: false });
	assert(schema === null);
	assert(typeof apply === 'function');
});

export default suite;
