import { createHttpContext, HttpError, TWooksHttpOptions, WooksHttp } from '@wooksjs/event-http'
import { current } from '@wooksjs/event-core'
import type { Application, NextFunction } from 'express'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import type { TWooksHandler } from 'wooks'

export interface TWooksExpressOptions extends TWooksHttpOptions {
    /**
     * When true, respond with 404 for unmatched Wooks routes
     * instead of passing to the next Express middleware.
     * @default false
     */
    raise404?: boolean
}

/**
 * Express adapter for Wooks.
 *
 * Uses Wooks routing and composables on top of an Express application.
 * Registers itself as Express middleware — requests matching Wooks routes
 * are handled by Wooks; unmatched requests fall through to Express.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { WooksExpress } from '@wooksjs/express-adapter'
 * import { useRouteParams } from '@wooksjs/event-http'
 *
 * const app = express()
 * const wooks = new WooksExpress(app)
 *
 * wooks.get('/hello/:name', () => {
 *     const { get } = useRouteParams()
 *     return { hello: get('name') }
 * })
 *
 * app.listen(3000)
 * ```
 */
export class WooksExpress extends WooksHttp {
    protected expressApp: Application
    protected expressOpts: TWooksExpressOptions

    constructor(expressApp: Application, opts?: TWooksExpressOptions) {
        super(opts)
        this.expressApp = expressApp
        this.expressOpts = opts ?? {}
        this.expressApp.use(this.getExpressMiddleware())
    }

    /**
     * Start the Express server and return a promise that resolves when listening.
     */
    override listen(...args: unknown[]): Promise<void> {
        const server = (this.server = (this.expressApp.listen as (...a: unknown[]) => Server)(
            ...args,
        ))
        return new Promise((resolve, reject) => {
            server.once('listening', () => resolve())
            server.once('error', reject)
        })
    }

    /**
     * Returns Express middleware that routes requests through Wooks.
     * Matched routes are handled by Wooks; unmatched requests call `next()`.
     */
    getExpressMiddleware() {
        const ctxOptions = this.eventContextOptions
        const requestLimits = this.expressOpts.requestLimits
        const defaultHeaders = this.expressOpts.defaultHeaders
        const notFoundHandler = this.expressOpts.onNotFound
        const raise404 = this.expressOpts.raise404

        return (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
            const response = new this.ResponseClass(res, req, ctxOptions.logger, defaultHeaders)
            const method = req.method || ''
            const url = req.url || ''

            createHttpContext(ctxOptions, { req, response, requestLimits }, () => {
                const ctx = current()
                const handlers = this.wooks.lookupHandlers(method, url, ctx)

                if (handlers || notFoundHandler) {
                    const result = this.processHandlers(
                        handlers || [notFoundHandler as TWooksHandler],
                        ctx,
                        response,
                    )
                    if (
                        result !== null &&
                        result !== undefined &&
                        typeof (result as Promise<unknown>).then === 'function'
                    ) {
                        ;(result as Promise<unknown>).catch((error: unknown) => {
                            this.logger.error('Internal error, please report', error as Error)
                            this.respond(error, response, ctx)
                        })
                    }
                    return result
                }

                // No Wooks route matched
                if (raise404) {
                    const error = new HttpError(404)
                    this.respond(error, response, ctx)
                    return error
                }

                // Pass through to next Express middleware
                next()
            })
        }
    }
}
