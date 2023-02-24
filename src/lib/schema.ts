import merge from 'lodash/merge.js';

// set of quick-n-dirty pragmatic helpers, all opinionated, "type json" based

export const $ref = (ref) => ({ $ref: `#/components/schemas/${ref}` });

export const parameters = (params: any[], other = {}) =>
	merge({}, other, {
		parameters: (params || []).reduce((m, p) => {
			if (typeof p === 'string') p = { name: p };
			if (p.name) {
				const _in = p.in || 'path';
				const required = p.required !== undefined ? p.required : true;
				const schema = p.schema || { type: 'string' };
				m.push({
					in: _in,
					name: p.name,
					required,
					schema,
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
