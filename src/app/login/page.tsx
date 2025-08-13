import { OAuthSignIn } from '@/components/auth/OAuthSignIn'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string; redirect?: string }
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center px-4 py-8">
      <OAuthSignIn redirectTo={searchParams.redirect} />
    </div>
  )
}