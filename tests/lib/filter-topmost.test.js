import { TestRunner } from '@marianmeres/test-runner';
import isEqual from 'lodash/isEqual.js';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterTopMost } from '../../dist/lib/filter-topmost.js';

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));

suite.test('test runner sanity check template', () => {
	const expected = ['/baz', '/foo'];
	const actual = filterTopMost(['/baz', '/foo', '/foo/bar']);
	assert(isEqual(expected, actual));
});

suite.only('test runner sanity check template', () => {
	const expected = ['/foo/bar'];
	const actual = filterTopMost(['/foo/bar']);
	assert(isEqual(expected, actual));
});

export default suite;
