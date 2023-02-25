import express from 'express';
import fs from 'node:fs';
import compression from 'compression';
import bodyParser from 'body-parser';
import { fileBasedRoutes } from '../dist/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClog } from '@marianmeres/clog';
import { gray, green, red, yellow } from 'kleur/colors';
import * as OpenApiValidator from 'express-openapi-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __basename = path.basename(__filename);

// prettier-ignore
const _setup = (k, c) => (...a) => console[k].apply(null, a.map((v) => c(v)));
createClog.CONFIG.WRITER = {
	debug: _setup('debug', gray),
	log: _setup('log', gray),
	info: _setup('info', green),
	warn: _setup('warn', yellow),
	error: _setup('error', red),
};

const PORT = 9998;
const PORT2 = 9999;
const PORT3 = 10000;
const HOST = '0.0.0.0';
const url = (path = '/') => `http://${HOST}:${PORT}${path}`;

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const clog = createClog('app');
const clog2 = createClog('app2');
const clog3 = createClog('app3');

const app = express();
const app2 = express();
// ako 1, ale bez openapi validacie
const app3 = express();

const fbr1 = await fileBasedRoutes(
	path.join(__dirname, './server-routes'),
	{
		openapi: '3.0.0',
		info: { title: 'Test server', version: pkg.version },
		servers: [{ url: `http://${HOST}:${PORT}` }],
	},
	{ verbose: true }
);

const fbr2 = await fileBasedRoutes(
	path.join(__dirname, './server-routes'),
	{},
	{ validateParams: true, validateRequestBody: true }
);

const fbr3 = await fileBasedRoutes(path.join(__dirname, './server-routes3'));

const common = (app, logger) =>
	app.use(
		compression(),
		bodyParser.json(),
		bodyParser.urlencoded({ extended: true }),
		(req, res, next) => {
			logger(req.method, req.path);
			next();
		}
	);

app.listen(PORT, HOST, async () => {
	common(app, clog);

	// serve schema
	const schemaPath = './tests/tmp/schema.json';
	app.get(`/spec`, (req, res) => res.json(fbr1.schema));

	// hackish... write schema to file, so that the validator can read it back
	// (id doesn't seem to support direct data spec)
	fs.writeFileSync(schemaPath, JSON.stringify(fbr1.schema, null, '\t'));

	//
	clog(`Using open api validator middleware...`);
	app.use(
		OpenApiValidator.middleware({
			apiSpec: schemaPath,
			validateRequests: true, // default true
			validateResponses: true, // default false
		})
	);

	// NOW apply (below validator middleware)
	await fbr1.apply(app);

	// app.use((err, req, res, next) => res.status(500).end(err.toString()));
	app.use((err, req, res, next) => {
		res.status(err.status || err.code || 500).json({
			message: err.message,
			errors: err.errors,
		});
	});

	clog.info(`http://${HOST}:${PORT} ...`);
});

// no
app2.listen(PORT2, HOST, async () => {
	common(app2, clog2);
	await fbr2.apply(app2);
	app2.use((err, req, res, next) => {
		res.status(err.status || err.code || 500).json({
			message: err.message,
			errors: err.errors,
		});
	});
	clog2.info(`http://${HOST}:${PORT2} ...`);
});

// no
app3.listen(PORT3, HOST, async () => {
	common(app3, clog3);
	await fbr3.apply(app3);
	app3.use((err, req, res, next) => {
		res.status(err.status || err.code || 500).json({
			message: err.message,
			errors: err.errors,
		});
	});
	clog3.info(`http://${HOST}:${PORT3} ...`);
});
