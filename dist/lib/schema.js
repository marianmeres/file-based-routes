import merge from 'lodash/merge.js';
// set of quick-n-dirty pragmatic helpers, all opinionated, "type json" based
export const $ref = (ref) => ({ $ref: `#/components/schemas/${ref}` });
export const parameters = (params, other = {}) => merge({}, other, {
    parameters: (params || []).reduce((m, p) => {
        if (typeof p === 'string')
            p = { name: p };
        if (p.name) {
            const schema = p.schema || { type: 'string' };
            const spec = { in: p.in || 'path', name: p.name, schema };
            // By default, OpenAPI treats all request parameters as optional. You can
            // add required: true to mark a parameter as required. Note that path
            // parameters must have required: true, because they are always required.
            if (p.required === true || spec.in === 'path')
                spec.required = true;
            m.push(spec);
        }
        return m;
    }, []),
});
export const requestBody = (jsonIn, other = {}) => merge({}, other, {
    requestBody: {
        required: true,
        content: {
            'application/json': {
                schema: jsonIn,
            },
        },
    },
});
export const responses = (jsonOut200, description200 = '200 OK', defaultResp = undefined, other = {}) => merge({}, other, {
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
