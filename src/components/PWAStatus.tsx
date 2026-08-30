import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Share2, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean
}

const installDismissedKey = 'shizhang-pwa-install-dismissed'
const dismissDuration = 7 * 24 * 60 * 60 * 1000

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as StandaloneNavigator).standalone)

const wasRecentlyDismissed = () => {
  try {
    const dismissedAt = Number(localStorage.getItem(installDismissedKey) ?? 0)
    return dismissedAt > 0 && Date.now() - dismissedAt < dismissDuration
  } catch {
    return false
  }
}

export function PWAStatus() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showInstall, setShowInstall] = useState(() => !isStandalone() && !wasRecentlyDismissed())
  const [online, setOnline] = useState(navigator.onLine)
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    immediate: true,
  })
  const [needsRefresh, setNeedsRefresh] = needRefresh
  const [isOfflineReady, setIsOfflineReady] = offlineReady

  const isIOS = useMemo(() => {
    const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || touchMac
  }, [])

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setShowInstall(!wasRecentlyDismissed())
    }
    const handleInstalled = () => {
      setInstalled(true)
      setShowInstall(false)
      setInstallEvent(null)
      try {
        localStorage.removeItem(installDismissedKey)
      } catch {
        // Installation still succeeds when browser storage is restricted.
      }
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const dismissInstall = () => {
    try {
      localStorage.setItem(installDismissedKey, String(Date.now()))
    } catch {
      // Dismiss for this page view when browser storage is restricted.
    }
    setShowInstall(false)
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setShowInstall(false)
      setInstallEvent(null)
    }
  }

  const canOfferInstall = showInstall && !installed && (Boolean(installEvent) || isIOS)

  return (
    <>
      {!online && (
        <div className="network-banner" role="status">
          <WifiOff size={15} />当前处于离线状态，已保存的页面仍可打开，账目同步需要联网。
        </div>
      )}

      {canOfferInstall && (
        <section className="pwa-toast install-toast" aria-label="安装拾账">
          <button className="pwa-toast-close" type="button" onClick={dismissInstall} aria-label="稍后提醒">
            <X size={16} />
          </button>
          <span className="pwa-toast-icon">{isIOS && !installEvent ? <Share2 size={20} /> : <Download size={20} />}</span>
          <div>
            <strong>把拾账放到手机桌面</strong>
            <p>{isIOS && !installEvent ? '在 Safari 中轻点“分享”，选择“添加到主屏幕”。' : '安装后点桌面图标即可直接打开，无需再输入网址。'}</p>
          </div>
          {installEvent && <button className="pwa-action" type="button" onClick={() => void install()}>立即安装</button>}
          {isIOS && !installEvent && <button className="pwa-action" type="button" onClick={dismissInstall}>知道了</button>}
        </section>
      )}

      {(needsRefresh || isOfflineReady) && (
        <section className="pwa-toast update-toast" role="status">
          <span className="pwa-toast-icon"><RefreshCw size={20} /></span>
          <div>
            <strong>{needsRefresh ? '拾账有新版本' : '基础页面已可离线打开'}</strong>
            <p>{needsRefresh ? '更新将在你确认后进行，不会打断正在填写的账目。' : '云端账目仍需联网读取和同步。'}</p>
          </div>
          {needsRefresh ? (
            <button className="pwa-action" type="button" onClick={() => void updateServiceWorker(true)}>立即更新</button>
          ) : (
            <button className="pwa-action" type="button" onClick={() => setIsOfflineReady(false)}>知道了</button>
          )}
          {needsRefresh && (
            <button className="pwa-toast-close" type="button" onClick={() => setNeedsRefresh(false)} aria-label="稍后更新">
              <X size={16} />
            </button>
          )}
        </section>
      )}
    </>
  )
}
