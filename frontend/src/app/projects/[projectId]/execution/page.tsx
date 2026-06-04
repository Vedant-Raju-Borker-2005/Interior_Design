'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import { ExecutionProgressBar } from '@/components/vendor/ExecutionProgressBar';
import { IssueTracker } from '@/components/vendor/IssueTracker';
import { TimelineView } from '@/components/vendor/TimelineView';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Plus, Image as ImageIcon, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectExecutionPage() {
  const { projectId } = useParams() as { projectId: string };
  const router = useRouter();
  
  const {
    progress,
    photos,
    members,
    tracking,
    fetchProgress,
    fetchPhotos,
    fetchMembers,
    fetchTracking,
    updateTracking,
    uploadPhoto,
  } = useProjectTeamStore();

  const [photoRoom, setPhotoRoom] = useState('');
  const [photoCategory, setPhotoCategory] = useState('SITE_VISIT');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchProgress(projectId);
    fetchPhotos(projectId);
    fetchMembers(projectId);
    fetchTracking(projectId);
  }, [projectId, fetchProgress, fetchPhotos, fetchMembers, fetchTracking]);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      await updateTracking(projectId, itemId, newStatus, 'Status updated via project team execution panel');
      toast.success('Status updated, progress recalculated! 🔨');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingPhoto(true);

    const unsplashPics = [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace',
      'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e',
      'https://images.unsplash.com/photo-1617806118233-18e1db207f62',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
    ];
    const randomPic = unsplashPics[Math.floor(Math.random() * unsplashPics.length)];

    try {
      await uploadPhoto(projectId, {
        roomName: photoRoom,
        category: photoCategory,
        imageUrl: randomPic,
      });
      setPhotoRoom('');
      toast.success('Verification photo added successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add photo');
    }
    setIsUploadingPhoto(false);
  };

  // Maps timeline items for the Gantt Chart View
  const timelineResources = tracking.map((i) => ({
    id: i.id,
    title: `[${i.room_name}] ${i.item_name}`,
    status: i.status?.toUpperCase() || 'ORDERED',
    createdAt: new Date(),
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/dashboard`)}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Project Execution Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor construction milestones, items shipping status, and site visit photos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Progress, Timeline, and Item list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Bar */}
            <ExecutionProgressBar progress={progress} status={progress < 40 ? 'DELAYED' : 'ON_TRACK'} />

            {/* Gantt Timeline */}
            <TimelineView resources={timelineResources} />

            {/* Item Tracking List */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">
                Item Sourcing & Installation
              </h3>
              <div className="overflow-hidden border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-250">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Tracking Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {tracking.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-700">
                          <span className="text-slate-400 font-bold uppercase text-[9px] mr-1.5 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.room_name}
                          </span>
                          {item.item_name}
                        </td>
                        <td className="p-3">
                          <select
                            value={item.status?.toLowerCase()}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-[10px] text-slate-650 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          >
                            <option value="ordered">Ordered</option>
                            <option value="accepted">Accepted</option>
                            <option value="production">Production</option>
                            <option value="ready">Ready</option>
                            <option value="dispatched">Dispatched</option>
                            <option value="delivered">Delivered</option>
                            <option value="installed">Installed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Issues Tracker, Photo Uploads and Brief Team */}
          <div className="space-y-6">
            {/* Issue Tracker */}
            <IssueTracker projectId={projectId} />

            {/* Photo Gallery & Upload */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  Site Verification Photos
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Verify installation proof from the site.</p>
              </div>

              {/* Photo Stepper Form */}
              <form onSubmit={handleAddPhoto} className="space-y-3 p-3.5 bg-slate-55 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Context / Room
                  </label>
                  <input
                    type="text"
                    placeholder="Master Bedroom, Kitchen, etc."
                    value={photoRoom}
                    onChange={(e) => setPhotoRoom(e.target.value)}
                    required
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600 transition-all"
                  >
                    <option value="SITE_VISIT">Site Visit</option>
                    <option value="PRODUCTION_CHECK">Production Check</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="INSTALLATION">Installation</option>
                    <option value="FINAL_HANDOVER">Final Handover</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm"
                >
                  {isUploadingPhoto ? 'Uploading...' : 'Add Verification Photo'}
                </button>
              </form>

              {/* Photos List Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden shadow-sm aspect-video border border-slate-100 bg-slate-50">
                    <img
                      src={photo.imageUrl}
                      alt={photo.roomName || 'Site Photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                      <span className="text-[10px] font-bold">{photo.roomName || 'Site'}</span>
                      <span className="text-[8px] opacity-75 font-semibold uppercase">{photo.category}</span>
                    </div>
                  </div>
                ))}

                {photos.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-slate-400 text-xs font-semibold">
                    No site photos yet.
                  </div>
                )}
              </div>
            </div>

            {/* Active Team Brief */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">
                Project Team
              </h3>
              <div className="space-y-3">
                {members.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 text-xs flex-shrink-0">
                      {member.user?.name ? member.user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {member.user?.name}
                      </div>
                      <div className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider">{member.role}</div>
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="text-center py-2 text-slate-400 text-xs font-semibold">
                    No team assigned.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
