'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Trophy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  department: z.string().min(1, 'Please select a department'),
  reason: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

const DEPARTMENTS = [
  { value: 'PRODUCT', label: 'Product Management' },
  { value: 'CSM', label: 'Customer Success (CSM)' },
  { value: 'SALES', label: 'Sales' },
  { value: 'PSD', label: 'Product Strategy & Design (PSD)' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'OTHER', label: 'Other' },
]

const FEATURES = [
  'AI-powered competitive intelligence',
  'Auto-generated feature specs',
  'Real-time roadmap collaboration',
  'Battle cards & win/loss analysis',
]

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { department: '' },
  })

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          organizationName: data.organizationName,
          department: data.department,
          reason: data.reason,
          password: data.password,
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        setServerError(body.error || 'Registration failed. Please try again.')
        return
      }

      if (body.pending) {
        setSubmitted(true)
      } else {
        router.push('/login?registered=1')
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
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
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Account Created</h2>
            <p className="text-muted-foreground text-sm">
              Your account has been created and is pending admin approval.
              You will be able to log in once an admin approves your request.
            </p>
            <Button variant="outline" onClick={() => router.push('/login')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl px-4 py-8">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-gray-900">ProductOS</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left: Feature highlights */}
        <div className="hidden md:flex flex-col justify-center space-y-6 pt-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 leading-tight">
              Build better products with competitive intelligence
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">
              ProductOS automates competitive research, generates detailed feature specs,
              and keeps your roadmap ahead of the competition.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Registration form */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold">Create your account</CardTitle>
            <CardDescription>
              Set up your profile — an admin will review and approve your access
            </CardDescription>
          </CardHeader>

          <CardContent>
            {serverError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Jane Smith" disabled={isLoading}
                  {...register('name')} className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input id="email" type="email" placeholder="jane@company.com" disabled={isLoading}
                  {...register('email')} className={errors.email ? 'border-destructive' : ''} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization</Label>
                <Input id="organizationName" placeholder="Acme Corp" disabled={isLoading}
                  {...register('organizationName')} className={errors.organizationName ? 'border-destructive' : ''} />
                {errors.organizationName && <p className="text-xs text-destructive">{errors.organizationName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Department / Role</Label>
                <Select onValueChange={(v) => setValue('department', v)}>
                  <SelectTrigger className={errors.department ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Why do you need access? (optional)</Label>
                <Textarea id="reason" placeholder="Brief description of your role and what products you'll work on"
                  rows={2} disabled={isLoading} {...register('reason')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Min 8 chars" disabled={isLoading}
                    {...register('password')} className={errors.password ? 'border-destructive' : ''} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm</Label>
                  <Input id="confirmPassword" type="password" placeholder="Repeat" disabled={isLoading}
                    {...register('confirmPassword')} className={errors.confirmPassword ? 'border-destructive' : ''} />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>) : 'Create account'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center pt-0">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">Sign in</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
