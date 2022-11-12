import { type KingWorld, SCHEMA } from 'kingworld'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

import staticPlugin from '@kingworldjs/static'

import type { OpenAPIV2 } from 'openapi-types'

const defaultConfig: Partial<OpenAPIV2.Document> = {
    swagger: '2.0',
    schemes: ['http', 'https'],
    consumes: ['application/json', 'text/plain'],
    produces: ['application/json', 'text/plain']
}

const filterPaths = (
    paths: Record<string, any>,
    {
        excludeStaticFile = true,
        exclude = []
    }: {
        excludeStaticFile: boolean
        exclude: (string | RegExp)[]
    }
) => {
    const newPaths: Record<string, any> = {}

    for (const [key, value] of Object.entries(paths))
        if (
            !exclude.some((x) => {
                if (typeof x === 'string') return key === x

                return x.test(key)
            }) &&
            !key.includes('/swagger') &&
            !key.includes('*') &&
            (excludeStaticFile ? !key.includes('.') : true)
        ) {
            Object.keys(value).forEach((method) => {
                const schema = value[method]

                if (key.includes('{') && !schema.parameters)
                    schema.parameters = key
                        .split('/')
                        .filter((x) => x.startsWith('{'))
                        .map((x) => ({
                            in: 'path',
                            name: x.slice(1, x.length - 1),
                            type: 'string',
                            required: true
                        }))

                if (!schema.responses)
                    schema.responses = {
                        200: {}
                    }
            })

            newPaths[key] = value
        }

    return newPaths
}

/**
 * A plugin for [kingworld](https://github.com/saltyaom/kingworld) that auto-generate Swagger page.
 * 
 * @see https://github.com/saltyaom/kingworld-swagger
 */
export const swagger = (
    app: KingWorld,
    {
        swagger = {},
        excludeStaticFile = true,
        path = '/swagger',
        exclude = []
    }: {
        /**
         * Customize Swagger config, refers to Swagger 2.0 config
         *
         * @see https://swagger.io/specification/v2/
         */
        swagger?: Partial<OpenAPIV2.Document>
        /**
         * Determine if Swagger should exclude static files.
         *
         * @default true
         */
        excludeStaticFile?: boolean
        /**
         * The endpoint to expose Swagger
         *
         * @default '/swagger'
         */
        path?: string
        /**
         * Paths to exclude from Swagger endpoint
         *
         * @default []
         */
        exclude?: string | RegExp | (string | RegExp)[]
    } = {
        swagger: {},
        excludeStaticFile: true,
        path: '/swagger',
        exclude: []
    }
) =>
    app
        .get(path, (context) => {
            context.set.redirect = `${path}/static/index.html`
        })
        .get(
            `${path}/static/swagger-initializer.js`,
            ({ store }) =>
                new Response(
                    `window.onload = function() {
    window.ui = SwaggerUIBundle({
        url: "${path}/json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
        ],
        plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
    });
};`,
                    {
                        headers: {
                            'content-type': 'text/javascript;charset=utf-8'
                        }
                    }
                )
        )
        .get(`${path}/json`, (context) => ({
            ...{
                ...defaultConfig,
                ...swagger,
                info: {
                    title: 'KingWorld Documentation',
                    description: 'Developement documentation',
                    version: '0.0.0',
                    ...swagger.info
                }
            },
            // @ts-ignore
            paths: filterPaths(context.store[SCHEMA], {
                excludeStaticFile,
                exclude: Array.isArray(exclude) ? exclude : [exclude]
            })
        }))
        .use(staticPlugin, {
            prefix: `${path}/static`,
            path: getAbsoluteFSPath()
        })

export default swagger
