import path from 'node:path';
import { strict as assert } from 'assert';
import { TestRunner } from '@marianmeres/test-runner';
import { fileURLToPath } from 'node:url';
import { createClog } from '@marianmeres/clog';
import { fetch } from 'undici';
import { STATUS_CODES } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __basename = path.basename(__filename);

const PORT = 9999;
const PORT2 = 9998;
const HOST = '0.0.0.0';
const url = (path = '/') => `http://${HOST}:${PORT}${path}`;
const url2 = (path = '/') => `http://${HOST}:${PORT2}${path}`;

const post = async (url, body) =>
	fetch(url, {
		method: 'POST',
		body: JSON.stringify(body),
		headers: { 'Content-Type': 'application/json' },
	});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clog = createClog(__basename);

// prettier-ignore
const suite = new TestRunner(__basename);

suite.test('hello', async () => {
	const r = await fetch(url('/hello'));
	assert('hello' === (await r.text()));
	assert(200 === r.status);
});

suite.test('hello 2', async () => {
	const r = await fetch(url2('/hello'));
	assert('hello' === (await r.text()));
	assert(200 === r.status);
});

suite.test('params validation works', async () => {
	// invalid
	let r = await fetch(url(`/hello/this-is-string`));
	assert(400 === r.status);
	assert((await r.json()).errors.length);

	// valid
	r = await fetch(url(`/hello/123`));
	assert(200 === r.status);
	assert('123' === (await r.text()));
});

suite.test('schema', async () => {
	const s = await (await fetch(url('/spec'))).json();
	// clog(JSON.stringify(s, null, 2));

	assert(s.paths['/hello'].post);
	assert(s.paths['/hello/{name}'].get);
	assert(s.components.schemas.FooIn);
	assert(s.components.schemas.FooOut);
});

suite.test('request body validation works', async () => {
	// valid
	let r = await post(url(`/hello`), { foo: 'bar' });
	// clog(r.status, STATUS_CODES.OK, await r.json());
	assert(r.status === 200);
	let data = await r.json();
	assert(data.id === 123);
	assert(data.foo === 'bar');

	// invalid
	r = await post(url(`/hello`), { hey: 'ho' });
	assert(r.status === 400);
	data = await r.json();
	assert(data.errors.length);
});

suite.test('request body validation works 2', async () => {
	// valid
	let r = await post(url2(`/hello`), { foo: 'bar' });
	// clog(r.status, await r.json());
	assert(r.status === 200);
	let data = await r.json();
	assert(data.id === 123);
	assert(data.foo === 'bar');

	// invalid
	r = await post(url2(`/hello`), { hey: 'ho' });
	assert(r.status === 400);
	data = await r.json();
	// clog(data);
	assert(data.errors.length);
});

export default suite;
