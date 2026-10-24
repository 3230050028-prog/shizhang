import { withTimeout } from './timeout'

export interface ConnectionProbe {
  label: string
  result: string
}

export async function probeConnection(
  label: string,
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<ConnectionProbe> {
  const controller = new AbortController()
  try {
    const response = await withTimeout(
      fetcher(url, { ...init, cache: 'no-store', credentials: 'omit', signal: controller.signal }),
      8_000,
      'probe timeout',
    )
    return { label, result: response.ok ? '正常' : `HTTP ${response.status}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { label, result: message === 'probe timeout' ? '8 秒内未响应' : '请求未完成（网络、DNS 或浏览器拦截，尚不能区分）' }
  } finally {
    controller.abort()
  }
}

export async function inspectAuthConnection() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  const siteUrl = new URL(`${import.meta.env.BASE_URL}manifest.webmanifest`, window.location.origin)
  // A unique query avoids treating a Service Worker's precached page as proof
  // that the phone can currently reach the website server.
  siteUrl.searchParams.set('connection-check', String(Date.now()))
  const probes = [probeConnection('网页服务器', siteUrl.href)]
  if (url && key) {
    probes.push(probeConnection('账号服务', `${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: key } }))
  }
  const results = await Promise.all(probes)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return [
    `版本：${(import.meta.env.VITE_APP_VERSION as string | undefined)?.slice(0, 7) || '本地开发'}`,
    `打开方式：${standalone ? '桌面安装版' : '浏览器'}`,
    `设备联网状态：${navigator.onLine ? '在线' : '离线'}`,
    ...results.map((item) => `${item.label}：${item.result}`),
    ...(!url || !key ? ['账号配置：缺失'] : []),
  ].join('\n')
}
