import { yamlize } from '../../../dist/mjs/lib/yamlize.js';
import { parameters, responses } from '../../../dist/mjs/lib/schema.js';

export default {
	get: {
		handler: (req, res) => {
			res.end(req.params.name);
		},
		schemaPaths: {
			// summary: 'Foo hello summary',
			...parameters([{ name: 'name', schema: { type: 'string', pattern: '^\\d+$' } }]),
			...responses({
				type: 'object',
				properties: { name: { type: 'string' } },
				// required: ['name'],
			}),
		},
		// schemaPaths: yamlize(`
		// 	summary: Hey ho
		// 	parameters:
		// 		-
		// 			in: path
		// 			name: name
		// 			required: true
		// 			schema:
		// 				type: string
		// 				pattern: ^\\d+$
		// `),
	},
};
