import { Leaf } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="正在打开拾账">
      <div className="splash-brand">
        <span className="splash-mark"><Leaf size={32} /></span>
        <div>
          <strong>拾账</strong>
          <small>认真生活，轻松记账</small>
        </div>
      </div>
      <span className="splash-progress" aria-hidden="true"><i /></span>
    </div>
  )
}
