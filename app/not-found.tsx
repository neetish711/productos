import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-gradient-to-br from-violet-50 to-indigo-50">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <div className="flex gap-3 mt-2">
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to Products
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
