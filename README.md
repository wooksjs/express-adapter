# Express Adapter (Wooks Composables)

**!!! This is work-in-progress library, breaking changes are expected !!!**

<p align="center">
<img src="./docs/icon.png" height="156px"><br>
<a  href="https://github.com/wooksjs/express-adapter/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

Want to use [Wooks Composables](https://github.com/wooksjs/composables) but your project is coupled with express? ✅ This is not a problem with this Express Adapter for [Wooks Composables](https://github.com/wooksjs/composables)

🔥 Get power of [Wooks Composables](https://github.com/wooksjs/composables) in your express project!

## Install

`npm install @wooksjs/express-adapter`

## Usage

```ts
import { applyExpressAdapter } from '@wooksjs/express-adapter'
import { useBody } from '@wooksjs/body'
import { useRouteParams, WooksError } from '@wooksjs/composables'

const app = express()

applyExpressAdapter(app)

app.get('/test/:param', () => {
    const { getRouteParam } = useRouteParams()
    return { message: 'it works', param: getRouteParam('param') }
})

app.post('/post', () => {
    const { parseBody } = useBody()
    return parseBody()
})

app.get('/error', () => {
    throw new WooksError(400, 'test error')
})

app.listen(3000, () => console.log('listening 3000'))
```
