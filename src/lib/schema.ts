import merge from 'lodash/merge.js';

// all opinionated, "type json" based

export const $ref = (ref) => ({ $ref: `#/components/schemas/${ref}` });

export const parameters = (params: any[], other = {}) =>
	merge({}, other, {
		parameters: (params || []).reduce((m, p) => {
			if (typeof p === 'string') p = { name: p };
			if (p.name) {
				m.push({
					...{ in: 'path' }, // overridable by p.in
					...(p.in || {}),
					name: p.name,
					...{ required: true }, // overridable by p.required
					...(p.required || {}),
					schema: {
						...{ type: 'string' }, // overridable by p.schema
						...(p.schema || {}),
					},
				});
			}
			return m;
		}, []),
	});

export const requestBody = (jsonIn, other = {}) =>
	merge({}, other, {
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: jsonIn,
				},
			},
		},
	});

export const responses = (
	jsonOut200,
	description200 = '200 OK',
	defaultResp = undefined,
	other = {}
) =>
	merge({}, other, {
		responses: {
			200: {
				description: description200,
				content: {
					'application/json': {
						schema: jsonOut200,
					},
				},
			},
			default: defaultResp,
		},
	});
