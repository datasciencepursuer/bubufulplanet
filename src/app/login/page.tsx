import { OAuthSignIn } from '@/components/auth/OAuthSignIn'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string; redirect?: string }>
}) {
  const params = await searchParams
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center px-4 py-8">
      <OAuthSignIn redirectTo={params.redirect} />
    </div>
  )
}