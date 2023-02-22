import { parameters, requestBody, responses } from '../../dist/lib/schema.js';

class HeyIn {
	static schema = {
		type: 'object',
		properties: {
			foo: { type: 'string' },
		},
		required: ['foo'],
	};
}

export default {
	post: {
		handler: (req, res) => res.end('ho'),
		schemaPaths: {
			...requestBody(HeyIn.schema),
		},
		validateRequestBody: true,
	},
}
