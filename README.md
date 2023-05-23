# Express Adapter (Wooks Composables)

**!!! This is work-in-progress library, breaking changes are expected !!!**

<p align="center">
<img src="./docs/wooksjs-express.png" height="156px"><br>
<a  href="https://github.com/wooksjs/express-adapter/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

Want to use [@wooksjs/event-http](https://www.npmjs.com/package/@wooksjs/event-http) but your project is coupled with express? ✅ This is not a problem with this Express Adapter for [wooks](https://www.npmjs.com/package/wooks)

## Install

`npm install @wooksjs/express-adapter @wooksjs/event-http`

## Usage

There are two options to use express with wooks

### 1. Adapter for express API:
This one will modify express `get`, `post`, ..., methods. Take this one if you want to keep using express app API.
```ts
import express from 'express'
import { applyExpressAdapter } from '@wooksjs/express-adapter'
import { useBody } from '@wooksjs/http-body'
import { HttpError } from '@wooksjs/event-http'
import { useRouteParams } from '@wooksjs/event-core'

const app = express()

applyExpressAdapter(app)

app.get('/test/:param', () => {
    const { get } = useRouteParams()
    return { message: 'it works', param: get('param') }
})

app.post('/post', () => {
    const { parseBody } = useBody()
    return parseBody()
})

app.get('/error', () => {
    throw new HttpError(400, 'test error')
})

app.listen(3000, () => console.log('listening 3000'))
```

### 2. Adapter for WooksHttp API:
This one does not modify anything. It just applies express middleware and reroutes requests through wooks. Use this one if you want to use wooks app API (compatible with [@moostjs/event-http](https://www.npmjs.com/package/@moostjs/event-http))

```ts
import express from 'express'
import { WooksExpress } from '@wooksjs/express-adapter'
import { useBody } from '@wooksjs/http-body'
import { HttpError } from '@wooksjs/event-http'
import { useRouteParams } from '@wooksjs/event-core'

const expressApp = express()

const wooksApp = new WooksExpress(expressApp, { raise404: true })

wooksApp.get('/test/:param', () => {
    const { get } = useRouteParams()
    return { message: 'it works', param: get('param') }
})

wooksApp.post('/post', () => {
    const { parseBody } = useBody()
    return parseBody()
})

wooksApp.get('/error', () => {
    throw new HttpError(400, 'test error')
})

wooksApp.listen(3000, () => console.log('listening 3000'))
```


⚠️ Check out official [wooks documentation](https://wooksjs.org/guide/http/express.html).