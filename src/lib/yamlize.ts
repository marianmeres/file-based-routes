import yaml from 'js-yaml';
import { createClog } from '@marianmeres/clog';

const clog = createClog('yamlize');

// quick-n-dirty
export const yamlize = (s, tabWidth = 4) => {
	// first, try to normalize indent to yaml convention, that is:
	// 1. replace tabs with spaces (tabWidth is important, must respect source formatting)
	// 2. find min indent, and cut if off from each line, in other words
	//    unindent to the left as much as possible, while not loosing the signicant formatting
	const lines = `${s}`.replace(/\t/g, ' '.repeat(tabWidth)).split('\n').filter(Boolean);
	const minIndent = lines.reduce(
		(m, l) => Math.min(m, ((l.match(/^\s+/) || [])[0] || '').length),
		0
	);
	const validYaml = lines.map((l) => l.slice(minIndent)).join('\n');

	// then, yaml parse
	try {
		return yaml.load(validYaml);
	} catch (e) {
		clog(s);
		throw e;
	}
};
