'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md px-4"><div className="text-center text-muted-foreground">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/products'
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        if (result.error === 'PENDING') {
          setServerError('Your account has been created successfully and is pending admin approval.')
        } else if (result.error === 'REJECTED') {
          setServerError('Your account request has been rejected. Please contact the administrator.')
        } else if (result.error === 'DEACTIVATED') {
          setServerError('Your account has been deactivated. Please contact the administrator.')
        } else if (result.error === 'CredentialsSignin') {
          setServerError('Invalid email or password.')
        } else {
          setServerError('An unexpected error occurred. Please try again.')
        }
        return
      }

      if (result?.ok) {
        // Hard redirect to ensure the new JWT cookie is picked up by middleware
        window.location.href = callbackUrl
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-gray-900">ProductOS</span>
        </div>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          {serverError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {searchParams.get('registered') && (
            <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
              <AlertDescription>
                Account created successfully! Please sign in.
              </AlertDescription>
            </Alert>
          )}

          {(searchParams.get('error') === 'pending' || searchParams.get('error') === 'OAuthAccountNotLinked') && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800">
              <AlertDescription>
                {searchParams.get('error') === 'OAuthAccountNotLinked'
                  ? 'This email is already registered with a password. Please sign in with your email and password.'
                  : 'Your account is pending approval. You will be able to log in once an admin approves your request.'}
              </AlertDescription>
            </Alert>
          )}

          {searchParams.get('error') === 'rejected' && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>Your account request has been rejected.</AlertDescription>
            </Alert>
          )}

          {searchParams.get('error') === 'deactivated' && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>Your account has been deactivated.</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                disabled={isLoading}
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
                {...register('password')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-0">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Create one free
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Need access to an existing workspace?{' '}
            <Link
              href="/request-access"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Request access
            </Link>
          </p>
        </CardFooter>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="hover:text-primary underline underline-offset-4">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="hover:text-primary underline underline-offset-4">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
