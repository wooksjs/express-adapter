import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import express from 'express'
import { WooksExpress } from './wooks-express'
import { useRequest, useRouteParams, HttpError, useResponse, useHeaders } from '@wooksjs/event-http'
import type { Server } from 'http'

function getPort(): number {
    return 10000 + Math.floor(Math.random() * 50000)
}

async function fetch(url: string, opts?: RequestInit) {
    return globalThis.fetch(url, opts)
}

describe('WooksExpress', () => {
    describe('basic routing', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app)

            wooks.get('/hello', () => {
                return 'Hello World'
            })

            wooks.get('/json', () => {
                return { message: 'ok' }
            })

            wooks.post('/echo', async () => {
                const { rawBody } = useRequest()
                const body = await rawBody()
                return body.toString()
            })

            wooks.get('/users/:id', () => {
                const { get } = useRouteParams()
                return { id: get('id') }
            })

            wooks.get('/error', () => {
                throw new HttpError(400, 'bad request')
            })

            wooks.get('/server-error', () => {
                throw new HttpError(500, 'internal server error')
            })

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should handle GET request and return text', async () => {
            const res = await fetch(`http://localhost:${port}/hello`)
            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toBe('Hello World')
        })

        it('should handle GET request and return JSON', async () => {
            const res = await fetch(`http://localhost:${port}/json`)
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toEqual({ message: 'ok' })
        })

        it('should handle route parameters', async () => {
            const res = await fetch(`http://localhost:${port}/users/42`)
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toEqual({ id: '42' })
        })

        it('should handle POST requests', async () => {
            const res = await fetch(`http://localhost:${port}/echo`, {
                method: 'POST',
                body: 'hello body',
                headers: { 'Content-Type': 'text/plain' },
            })
            expect(res.status).toBe(201)
            const text = await res.text()
            expect(text).toBe('hello body')
        })

        it('should handle HttpError', async () => {
            const res = await fetch(`http://localhost:${port}/error`)
            expect(res.status).toBe(400)
        })

        it('should handle 500 errors', async () => {
            const res = await fetch(`http://localhost:${port}/server-error`)
            expect(res.status).toBe(500)
        })
    })

    describe('express fallthrough', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app)

            wooks.get('/wooks-route', () => {
                return 'from wooks'
            })

            // Express route registered after wooks
            app.get('/express-route', (_req, res) => {
                res.send('from express')
            })

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should handle wooks routes', async () => {
            const res = await fetch(`http://localhost:${port}/wooks-route`)
            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toBe('from wooks')
        })

        it('should fall through to express for unmatched wooks routes', async () => {
            const res = await fetch(`http://localhost:${port}/express-route`)
            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toBe('from express')
        })

        it('should return 404 for completely unknown routes', async () => {
            const res = await fetch(`http://localhost:${port}/unknown`)
            expect(res.status).toBe(404)
        })
    })

    describe('raise404 option', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app, { raise404: true })

            wooks.get('/known', () => 'found')

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should return 404 from wooks when raise404 is true', async () => {
            const res = await fetch(`http://localhost:${port}/not-found`)
            expect(res.status).toBe(404)
        })

        it('should still handle known routes', async () => {
            const res = await fetch(`http://localhost:${port}/known`)
            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toBe('found')
        })
    })

    describe('composables', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app)

            wooks.get('/request-info', () => {
                const { method, url } = useRequest()
                return { method, url }
            })

            wooks.get('/headers', () => {
                const headers = useHeaders()
                return { host: headers.host, custom: headers['x-custom'] }
            })

            wooks.get('/response-header', () => {
                const response = useResponse()
                response.setHeader('x-custom-response', 'test-value')
                return 'ok'
            })

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should provide request info via useRequest', async () => {
            const res = await fetch(`http://localhost:${port}/request-info`)
            const data = await res.json()
            expect(data.method).toBe('GET')
            expect(data.url).toBe('/request-info')
        })

        it('should provide headers via useHeaders', async () => {
            const res = await fetch(`http://localhost:${port}/headers`, {
                headers: { 'x-custom': 'hello' },
            })
            const data = await res.json()
            expect(data.custom).toBe('hello')
        })

        it('should allow setting response headers via useResponse', async () => {
            const res = await fetch(`http://localhost:${port}/response-header`)
            expect(res.headers.get('x-custom-response')).toBe('test-value')
        })
    })

    describe('HTTP methods', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app)

            wooks.get('/method', () => 'GET')
            wooks.post('/method', () => 'POST')
            wooks.put('/method', () => 'PUT')
            wooks.patch('/method', () => 'PATCH')
            wooks.delete('/method', () => 'DELETE')
            wooks.head('/method-head', () => {
                const response = useResponse()
                response.setHeader('x-method', 'HEAD')
                return ''
            })
            wooks.options('/method', () => 'OPTIONS')

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should handle GET', async () => {
            const res = await fetch(`http://localhost:${port}/method`)
            expect(await res.text()).toBe('GET')
        })

        it('should handle POST', async () => {
            const res = await fetch(`http://localhost:${port}/method`, { method: 'POST' })
            expect(await res.text()).toBe('POST')
        })

        it('should handle PUT', async () => {
            const res = await fetch(`http://localhost:${port}/method`, { method: 'PUT' })
            expect(await res.text()).toBe('PUT')
        })

        it('should handle PATCH', async () => {
            const res = await fetch(`http://localhost:${port}/method`, { method: 'PATCH' })
            expect(await res.text()).toBe('PATCH')
        })

        it('should handle DELETE', async () => {
            const res = await fetch(`http://localhost:${port}/method`, { method: 'DELETE' })
            expect(await res.text()).toBe('DELETE')
        })

        it('should handle HEAD', async () => {
            const res = await fetch(`http://localhost:${port}/method-head`, { method: 'HEAD' })
            expect(res.status).toBe(204)
            expect(res.headers.get('x-method')).toBe('HEAD')
        })

        it('should handle OPTIONS', async () => {
            const res = await fetch(`http://localhost:${port}/method`, { method: 'OPTIONS' })
            expect(await res.text()).toBe('OPTIONS')
        })
    })

    describe('async handlers', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app)

            wooks.get('/async', async () => {
                await new Promise((r) => setTimeout(r, 10))
                return { async: true }
            })

            wooks.get('/async-error', async () => {
                await new Promise((r) => setTimeout(r, 10))
                throw new HttpError(422, 'validation error')
            })

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should handle async handlers', async () => {
            const res = await fetch(`http://localhost:${port}/async`)
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toEqual({ async: true })
        })

        it('should handle async errors', async () => {
            const res = await fetch(`http://localhost:${port}/async-error`)
            expect(res.status).toBe(422)
        })
    })

    describe('listen method', () => {
        it('should start server via wooks.listen()', async () => {
            const port = getPort()
            const app = express()
            const wooks = new WooksExpress(app)

            wooks.get('/test', () => 'works')

            await wooks.listen(port)

            const res = await fetch(`http://localhost:${port}/test`)
            expect(await res.text()).toBe('works')

            await wooks.close()
        })
    })

    describe('onNotFound handler', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()
            wooks = new WooksExpress(app, {
                onNotFound: () => {
                    const response = useResponse()
                    response.setStatus(404)
                    return { error: 'custom not found' }
                },
            })

            wooks.get('/exists', () => 'found')

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should use custom onNotFound handler', async () => {
            const res = await fetch(`http://localhost:${port}/not-there`)
            expect(res.status).toBe(404)
            const data = await res.json()
            expect(data).toEqual({ error: 'custom not found' })
        })

        it('should still handle matched routes', async () => {
            const res = await fetch(`http://localhost:${port}/exists`)
            expect(await res.text()).toBe('found')
        })
    })

    describe('express middleware integration', () => {
        let app: ReturnType<typeof express>
        let wooks: WooksExpress
        let server: Server
        let port: number

        beforeAll(async () => {
            port = getPort()
            app = express()

            // Express middleware before Wooks
            app.use((_req, _res, next) => {
                ;(_req as unknown as Record<string, string>).customProp = 'middleware-value'
                next()
            })

            wooks = new WooksExpress(app)

            wooks.get('/with-middleware', () => {
                return 'ok'
            })

            await new Promise<void>((resolve) => {
                server = app.listen(port, resolve)
            })
        })

        afterAll(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()))
            })
        })

        it('should work with express middleware', async () => {
            const res = await fetch(`http://localhost:${port}/with-middleware`)
            expect(res.status).toBe(200)
            expect(await res.text()).toBe('ok')
        })
    })
})
