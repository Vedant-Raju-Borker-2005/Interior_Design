'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ProjectExecutionRedirectPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()

  useEffect(() => {
    if (projectId) {
      router.replace(`/track/${projectId}`)
    }
  }, [projectId, router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
