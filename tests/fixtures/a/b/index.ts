export default {
	get() {
		return 'a/b';
	},
	post: {
		handler: () => 'a/b (post)',
		schema: () => ({
			description: 'hey ho',
		}),
	},
};
