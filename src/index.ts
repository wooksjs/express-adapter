/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHttpContext, createWooksResponder, useHttpContext } from '@wooksjs/event-http'
import { Express, Request } from 'express'
import { ServerResponse } from 'http'

const methods = [
    'get', 'post', 'delete', 'put', 'patch', 'options', 'head', 'all',
]

export function applyExpressAdapter(app: Express) {
    const responder = createWooksResponder()

    function useWooksDecorator(fn: () => unknown) {
        return async () => {
            const { restoreCtx, clearCtx } = useHttpContext()
            try {
                const result = await fn()
                restoreCtx()
                await responder.respond(result)
            } catch (e) {
                restoreCtx()
                await responder.respond(e)
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

function wooksContext(req: Request, res: ServerResponse, next: (err?: unknown) => void) {
    const { store } = createHttpContext({ req, res })
    store('routeParams').value = new Proxy({}, {
        get(target, prop, receiver) {
            return req.params && req.params[prop as keyof typeof req.params]
        },
    })
    next()
}
