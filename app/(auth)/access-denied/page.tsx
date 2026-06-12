'use client'
import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AccessDeniedPage() {
  const router = useRouter()

  return (
    <div className="w-full max-w-md px-4">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <ShieldX className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            You do not have permission to access this page.
            Please contact your administrator if you believe this is an error.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => router.push('/products')}>
              Go to Products
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
