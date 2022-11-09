import { yamlize } from '../../../../dist/mjs/index.js';

export default {
	get() {
		return 'a/b';
	},
	post: {
		handler: () => 'a/b (post)',
		// https://swagger.io/docs/specification/paths-and-operations/
		// idea here is to output just the "paths.path.method" inner spec, the known
		// path and method will be auto added
		// prettier-ignore
		schemaPaths: yamlize(`
			description: hey ho
			parameters:
				- foo: id
			responses:
				200:
					content:
						description: hey ho
						application/json:
							schema:
								$ref: '#/components/schemas/User'
		`),

		// "register" any component schemas, will be used in final schema build
		// prettier-ignore
		schemaComponents: yamlize(`
			User:
				type: object
				properties:
					id:
						type: integer
			Foo:
				type: object
				properties:
					bar:
						type: string
		`),
	},
};
