/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWooksCtx, createWooksResponder, useWooksCtx } from '@wooksjs/composables'
import { Express } from 'express'
import { IncomingMessage, ServerResponse } from 'http'

const methods = [
    'get', 'post', 'delete', 'patch', 'options',
]

export function applyExpressAdapter(app: Express) {
    const responder = createWooksResponder()

    function useWooksDecorator(fn: () => unknown) {
        return async () => {
            const { restoreCtx, clearCtx } = useWooksCtx()
            try {
                const result = await fn()
                restoreCtx()
                responder.respond(result)
            } catch (e) {
                responder.respond(e)
            }
            clearCtx()
        }
    }

    app.use(wooksContext)

    for (const m of methods) {
        const defFn: (...args: any[]) => void = (app[m as keyof Express] as (...args: any[]) => void).bind(app)
        const newFn: (...args: any[]) => void = ((...args: Parameters<typeof defFn>) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
            return defFn(...args.map(a => typeof a === 'function' ? useWooksDecorator(a as (() => unknown)) : a))
        }).bind(app)
        Object.defineProperty(app, m, { value: newFn })
    }
}

function wooksContext(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) {
    createWooksCtx({ req, res })
    next()
}
