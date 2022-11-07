import path from 'node:path';
import { strict as assert } from 'assert';
import { TestRunner } from '@marianmeres/test-runner';
import { fileURLToPath } from 'node:url';
import { createClog } from '@marianmeres/clog';
import { addFileBasedRoutes } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suite = new TestRunner(path.basename(__filename));
const clog = createClog(false);

suite.test('adding routes works', async () => {
	const routes = {};

	// dummy test handler
	const createHandler = (m) => (route, middleware, handler) =>
		(routes[`${m}:${route}`] = middleware.length);

	// mock
	const router = { get: createHandler('get'), post: createHandler('post') };

	const { paths } = await addFileBasedRoutes(router, path.join(__dirname, './fixtures'), {
		verbose: false,
		prefix: '/foo',
	});

	// clog(routes);
	assert(routes['get:/foo/a'] === 0);
	assert(routes['get:/foo/a/b'] === 0);
	assert(routes['post:/foo/a/b'] === 0);
	assert(routes['get:/foo/a/b/c'] === 2);
	assert(routes['get:/foo/a/b/c/d'] === 0);
	assert(Object.keys(routes).length === 5);

	assert(paths['/foo/a/b'].post.description === 'hey ho');
});

export default suite;
