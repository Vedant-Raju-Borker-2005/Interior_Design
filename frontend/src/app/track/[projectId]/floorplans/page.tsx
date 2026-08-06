'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCustomerStore } from '@/stores/customerStore'
import Navbar from '@/components/Navbar'
import { ArrowLeft, Upload, FileText, Trash2, Download, Eye, FileImage } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FloorPlanPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const { floorplans, fetchFloorplans, uploadFloorplan, deleteFloorplan } = useCustomerStore()

  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    fetchFloorplans(projectId)
  }, [projectId, fetchFloorplans])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        setSelectedFile(file)
      } else {
        toast.error("Only PDF and Image files are supported")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    try {
      await uploadFloorplan(projectId, selectedFile)
      toast.success("Floor plan uploaded successfully")
      setSelectedFile(null)
    } catch {
      toast.error("Failed to upload floor plan")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this floor plan?")) {
      try {
        await deleteFloorplan(projectId, id)
        toast.success("Floor plan deleted")
      } catch {
        toast.error("Failed to delete floor plan")
      }
    }
  }

  return (
    <div className="min-h-screen text-white pb-16" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)', backgroundAttachment: 'fixed' }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 space-y-8">
        {/* Back navigation */}
        <button
          onClick={() => router.push(`/track/${projectId}`)}
          className="flex items-center gap-2 text-indigo-950 hover:text-slate-900 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Project Tracker
        </button>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900">
            Floor Plan Manager
          </h1>
          <p className="text-sm text-indigo-950/70 mt-1 font-medium">
            Upload and view architectural 2D floor plans. PDF and image formats are supported.
          </p>
        </div>

        {/* Drag and Drop Uploader */}
        <div className="bg-[#0f1129] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all ${
              dragActive ? 'border-indigo-400 bg-indigo-900/20' : 'border-white/10 hover:border-indigo-500/50 bg-indigo-900/5'
            }`}
          >
            <Upload className="w-10 h-10 text-indigo-400 mb-3" />
            <p className="text-sm font-semibold text-white">Drag and drop your file here, or</p>
            <label className="mt-2 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-900/50 px-3 py-1.5 rounded-lg cursor-pointer border border-white/5 transition-all">
              Browse Files
              <input
                type="file"
                className="hidden"
                accept="application/pdf, image/*"
                onChange={handleFileChange}
              />
            </label>
            <p className="text-[10px] text-indigo-300/40 mt-2 font-medium">Supports PDF, PNG, JPG up to 10MB</p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-3 bg-indigo-900/20 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedFile.type === 'application/pdf' ? (
                  <FileText className="w-5 h-5 text-red-400" />
                ) : (
                  <FileImage className="w-5 h-5 text-blue-400" />
                )}
                <div>
                  <p className="text-xs font-bold text-white max-w-[250px] truncate">{selectedFile.name}</p>
                  <p className="text-[9px] text-indigo-300/60 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="px-2.5 py-1 text-[10px] text-indigo-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-850 text-white text-[11px] font-bold rounded-lg transition-all"
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Uploaded List */}
        <div className="bg-[#0f1129] border border-white/10 p-6 rounded-2xl shadow-card backdrop-blur-md space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Uploaded Floor Plans</h2>

          <div className="space-y-3">
            {floorplans.map((fp) => (
              <div key={fp.id} className="p-4 bg-indigo-900/10 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {fp.file_type === 'application/pdf' ? (
                    <FileText className="w-6 h-6 text-red-400" />
                  ) : (
                    <FileImage className="w-6 h-6 text-blue-400" />
                  )}
                  <div>
                    <h3 className="font-bold text-xs text-white">Floor Plan {fp.id.substring(0, 5)}</h3>
                    <p className="text-[10px] text-indigo-300/60 mt-0.5 font-medium">Uploaded: {new Date(fp.uploaded_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`http://localhost:8000${fp.file_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-900/30 rounded-lg transition-all"
                    title="View File"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <a
                    href={`http://localhost:8000${fp.file_url}`}
                    download
                    className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-900/30 rounded-lg transition-all"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(fp.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {floorplans.length === 0 && (
              <p className="text-xs text-indigo-300/40 text-center py-6">No floor plans uploaded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
