import isObject from 'lodash/isObject.js';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import { TestRunner } from '@marianmeres/test-runner';
import { fileURLToPath } from 'node:url';
import { createClog } from '@marianmeres/clog';
import { addFileBasedRoutes } from '../dist/mjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));
const clog = createClog(false);

suite.test('adding routes works', async () => {
	const routes = {};
	const mdlwrs = {};

	// dummy test handler
	const createHandler = (m) => (route, handler) => (routes[`${m}: ${route}`] = true);

	// mock
	const router = {
		get: createHandler('get  '),
		post: createHandler('post '),
		use: (route, mdlwr) => {
			mdlwrs[route] ||= 0;
			mdlwrs[route]++;
		},
	};

	const { schema } = await addFileBasedRoutes(
		router,
		path.join(__dirname, './fixtures'),
		{
			openapi: '3.0.0',
			info: {
				title: 'Foo bar',
			},
			servers: [{ url: 'http://foo.com' }],
		},
		{
			verbose: false,
			prefix: '/foo',
		}
	);

	// clog(routes, mdlwrs, JSON.stringify(schemaPaths, null, 2));
	// clog(JSON.stringify(schemaComponents, null, 2));

	// routes
	assert(routes['get  : /foo/a']);
	assert(routes['get  : /foo/a/:b']);
	assert(routes['post : /foo/a/:b']);
	assert(routes['get  : /foo/a/:b/c']);
	assert(routes['get  : /foo/a/:b/c/:d']);
	assert(Object.keys(routes).length === 5);

	// middlewares
	assert(mdlwrs['/foo/a/:b/c'] === 2);
	assert(Object.keys(mdlwrs).length === 1);

	// clog(JSON.stringify(schema, null, 4));
	assert(schema.openapi);

	// paths, note the "{b}" segment
	assert(schema.paths['/foo/a/{b}'].post.description === 'hey ho');

	// components schemas
	assert(isObject(schema.components.schemas.User));
	assert(isObject(schema.components.schemas.Foo));
});

export default suite;
