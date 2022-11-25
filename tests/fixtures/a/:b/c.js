export default {
	get: {
		middleware: [() => null, () => null],
		handler: () => {
			return 'a/b/c';
		},
	},
};
