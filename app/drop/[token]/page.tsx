import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Dashboard from '@/components/Dashboard'

export default function DropPage({ params }: { params: { token: string } }) {
  const validToken = process.env.SECRET_ACCESS_TOKEN

  if (params.token !== validToken) {
    redirect('/')
  }

  return <Dashboard />
}
