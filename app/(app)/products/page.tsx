'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trophy, Package, ArrowRight, Map, Puzzle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type Product = {
  id: string
  name: string
  description: string
  status: string
  _count: { roadmapItems: number; ourFeatures: number }
}

export default function ProductSelectionPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/products')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectProduct = async (productId: string) => {
    // Store selected product in cookie (for server components) and localStorage (for client components)
    localStorage.setItem('selectedProductId', productId)
    const name = products.find((p) => p.id === productId)?.name || null
    if (name) localStorage.setItem('selectedProductName', name)
    await fetch('/api/user/select-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })
    router.push('/dashboard')
  }

  const isAdminUser = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ADMIN'

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Select a Product</h1>
          <p className="text-muted-foreground">
            Choose a product workspace to continue
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Package className="h-16 w-16 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">No Products Available</h2>
              <p className="text-muted-foreground text-sm">
                {isAdminUser
                  ? 'Create your first product to get started.'
                  : 'You have not been assigned to any products yet. Please contact your admin.'}
              </p>
              {isAdminUser && (
                <Button onClick={() => router.push('/admin/products')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Product
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                onClick={() => selectProduct(product.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-lg mt-2">{product.name}</CardTitle>
                  {product.description && (
                    <CardDescription className="line-clamp-2">{product.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Badge variant="secondary" className="text-xs">
                      <Map className="h-3 w-3 mr-1" />
                      {product._count.roadmapItems} Roadmap Items
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Puzzle className="h-3 w-3 mr-1" />
                      {product._count.ourFeatures} Features
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
