// cleans up [ /baz, /foo, /foo/bar ] to just [ /baz, /foo ]
export const filterTopMost = (list: string[]) => {
	let topmost = [];
	list = [...list].sort();

	// quick-n-dirty, probably not the most optimal way... but this runs only once on
	// server bootstrap

	// 1. create blacklist
	const blacklist = [];
	for (let d of list) {
		if (list.find((v) => v.startsWith(`${d}/`))) {
			blacklist.push(`${d}/`);
		}
	}

	// 2. actual filter
	for (let d of blacklist) {
		topmost = [...topmost, ...list.filter((v) => !v.startsWith(d))];
	}

	return topmost;
};
