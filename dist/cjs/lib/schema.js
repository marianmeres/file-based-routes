"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.responses = exports.requestBody = exports.parameters = exports.$ref = void 0;
const merge_js_1 = __importDefault(require("lodash/merge.js"));
// all opinionated, "type json" based
const $ref = (ref) => ({ $ref: `#/components/schemas/${ref}` });
exports.$ref = $ref;
const parameters = (params, other = {}) => (0, merge_js_1.default)({}, other, {
    parameters: (params || []).reduce((m, p) => {
        if (typeof p === 'string')
            p = { name: p };
        if (p.name) {
            m.push({
                ...{ in: 'path' },
                ...(p.in || {}),
                name: p.name,
                ...{ required: true },
                ...(p.required || {}),
                schema: {
                    ...{ type: 'string' },
                    ...(p.schema || {}),
                },
            });
        }
        return m;
    }, []),
});
exports.parameters = parameters;
const requestBody = (jsonIn, other = {}) => (0, merge_js_1.default)({}, other, {
    requestBody: {
        required: true,
        content: {
            'application/json': {
                schema: jsonIn,
            },
        },
    },
});
exports.requestBody = requestBody;
const responses = (jsonOut200, description200 = '200 OK', defaultResp = undefined, other = {}) => (0, merge_js_1.default)({}, other, {
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
exports.responses = responses;
