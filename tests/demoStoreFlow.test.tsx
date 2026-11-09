// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../src/App'
import { demoKeys } from '../src/lib/demoStore'

vi.mock('../src/components/Dashboard', () => ({ Dashboard: () => <div>演示账本</div> }))
vi.mock('../src/components/SplashScreen', () => ({ SplashScreen: () => <div>正在打开</div> }))

let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('演示数据损坏时显示提示并保留原始内容', async () => {
  localStorage.setItem(demoKeys.transactions, '{broken')
  root = createRoot(container)
  await act(async () => root?.render(<App />))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1150)) })

  expect(container.querySelector('[role="alert"]')?.textContent).toContain('已暂停自动保存')
  expect(localStorage.getItem(demoKeys.transactions)).toBe('{broken')
})

it('演示数据写入失败时告知用户尚未保存', async () => {
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded') })
  root = createRoot(container)
  await act(async () => root?.render(<App />))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1150)) })

  expect(container.querySelector('[role="alert"]')?.textContent).toContain('未能保存到本机')
})
