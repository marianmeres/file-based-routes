import {
	$ref,
	parameters,
	requestBody,
	responses,
} from '../../../dist/mjs/lib/schema.js';
import { createClog } from '@marianmeres/clog';

const clog = createClog('/hello');

class FooIn {
	static schema = {
		type: 'object',
		properties: {
			foo: { type: 'string' },
		},
		required: ['foo'],
	};
}

class FooOut {
	static schema = {
		type: 'object',
		properties: {
			id: { type: 'integer' },
			foo: { type: 'string' },
		},
		required: ['id', 'foo'],
	};
}

// console.log(
// 	JSON.stringify(
// 		{
// 			summary: 'KOKOS',
// 			...parameters(['foo']),
// 			...requestBody($ref('FooIn')),
// 			...responses($ref('FooOut'))
// 		},
// 		null,
// 		4
// 	)
// );

export default {
	// get(req, res) {
	// 	res.end('hello');
	// },
	get: {
		// handler: (req, res) => res.end('hello'),
		// factory example
		createHandler: (app) => (req, res) => res.end('hello'),
		schemaPaths: {
			...responses($ref('Any')),
		},
	},
	post: {
		handler: async (req, res) => {
			res.json({ ...req.body, id: 123 }); // echo with id
		},
		schemaPaths: {
			// summary: 'Foo hello summary',
			// ...parameters(['foo']),
			...requestBody($ref('FooIn')),
			...responses($ref('FooOut')),
			// attach raw
			// ...requestBody(FooIn.schema),
			// ...responses(FooOut.schema, 'foo out'),
		},
		// not used above
		schemaComponents: {
			FooIn: FooIn.schema,
			FooOut: FooOut.schema,
		},
	},
};
