import { createHttpContext, HttpError, TWooksHttpOptions, WooksHttp } from '@wooksjs/event-http'
import Express from 'express'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { TWooksHandler } from 'wooks'

export class WooksExpress extends WooksHttp {
    constructor(protected expressApp: Express.Application, protected opts?: TWooksHttpOptions & { raise404?: boolean}) {
        super(opts)
        expressApp.use(this.getServerCb() as unknown as () => Express.RequestHandler)
    }

    public async listen(...args: Parameters<Server['listen']>) {
        const server = this.server = this.expressApp.listen(...args)
        return new Promise((resolve, reject) => {
            server.once('listening', resolve)
            server.once('error', reject)
        })
    }

    getServerCb() {
        return async (req: IncomingMessage, res: ServerResponse, next?: Express.NextFunction) => {
            const { restoreCtx, clearCtx } = createHttpContext(
                { req, res },
                this.mergeEventOptions(this.opts?.eventOptions),
            )
            const { handlers } = this.wooks.lookup(req.method as string, req.url as string)
            if (handlers || this.opts?.onNotFound) {
                try {
                    await this.processHandlers(handlers || [this.opts?.onNotFound as TWooksHandler])
                } catch (e) {
                    console.error('Internal error, please report: ', e as Error)
                    if ((e as Error).stack) {
                        console.warn((e as Error).stack)
                    }                        
                    restoreCtx()
                    this.respond(e)
                    clearCtx()
                }
            } else {
                // not found
                this.logger.debug(
                    `404 Not found (${req.method as string})${
                        req.url as string
                    }`
                )
                if (this.opts?.raise404) {
                    this.respond(new HttpError(404))
                    clearCtx()
                } else if (next) {
                    next()
                }
            }    
        }
    }    
}
