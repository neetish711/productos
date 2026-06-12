'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    // Route changed — stop loading
    if (prevPathRef.current !== pathname) {
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    }
    prevPathRef.current = pathname
  }, [pathname, searchParams])

  useEffect(() => {
    // Intercept link clicks to detect navigation start
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      if (target.getAttribute('target') === '_blank') return
      if (href === pathname) return

      // Navigation is starting
      setLoading(true)
      setProgress(20)

      // Simulate progress
      if (timerRef.current) clearInterval(timerRef.current)
      let p = 20
      timerRef.current = setInterval(() => {
        p += Math.random() * 15
        if (p > 90) p = 90
        setProgress(p)
      }, 300)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
