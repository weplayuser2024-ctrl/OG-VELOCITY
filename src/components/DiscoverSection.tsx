import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gift,
  Heart,
  Image,
  MapPin,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Send,
  Share2,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import cpMallCardImg from '../assets/images/discover_cpmall_1795594821002.jpg';
import momentsCardImg from '../assets/images/discover_moments_1795594821007.jpg';
import nearbyCardImg from '../assets/images/discover_nearby_1795594821826.jpg';
import { SHOP_ITEMS, getVipNameStyle } from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { RingSpriteArt, VipBadgeArt } from '../graphics/SpriteArtwork';
import type {
  AvatarConfig,
  BackendEventRecord,
  FriendRecord,
  MomentPost,
  PublicUserProfile,
  ShopItem,
  VoiceRoom,
} from '../types';
import { uploadImageAsset, uploadVideoAsset } from '../utils/mediaUpload';

type DiscoverHubTab = 'moments' | 'church' | 'nearby';

interface MomentCommentItem {
  id: number | string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPublicId?: string;
  body: string;
  createdAt?: string;
}

interface DiscoverSectionProps {
  moments: MomentPost[];
  rooms?: VoiceRoom[];
  friends?: FriendRecord[];
  ownedItemIds?: string[];
  shopItems?: ShopItem[];
  events?: BackendEventRecord[];
  authToken?: string | null;
  onToggleLikeMoment: (momentId: string) => void;
  onAddMoment: (
    caption: string,
    mediaType: 'photo' | 'video',
    mediaUrl?: string,
    visibility?: 'public' | 'selected',
    allowedUids?: string[]
  ) => void;
  onInspectUser: (profile: PublicUserProfile) => void;
  onInspectUserById?: (uid: string) => void;
  onJoinRoom?: (roomId: string) => void;
  onClaimGiftPack?: () => void;
  onJoinEvent?: (eventId: string) => Promise<void> | void;
  onReportContent?: (targetType: 'post' | 'user', targetId: string, reason: string) => void;
  onProposeCp?: (
    toUid: string,
    toName: string,
    toAvatarId: string,
    ringNumber: number,
    ringName: string
  ) => void;
  onOpenRingShop?: () => void;
}

export const DiscoverSection: React.FC<DiscoverSectionProps> = ({
  moments,
  rooms = [],
  friends = [],
  ownedItemIds = [],
  shopItems = SHOP_ITEMS,
  events = [],
  authToken = null,
  onToggleLikeMoment,
  onAddMoment,
  onInspectUser,
  onInspectUserById,
  onJoinRoom,
  onClaimGiftPack,
  onJoinEvent,
  onReportContent,
  onProposeCp,
  onOpenRingShop,
}) => {
  const bondRings = useMemo(() => shopItems.filter((i) => i.category === 'ring'), [shopItems]);
  const ownedRings = useMemo(
    () => bondRings.filter((r) => ownedItemIds.includes(r.id)),
    [bondRings, ownedItemIds]
  );

  const [fullScreenTab, setFullScreenTab] = useState<DiscoverHubTab | null>(null);
  const [selectedOwnedRingId, setSelectedOwnedRingId] = useState<string>('');
  const [showComposer, setShowComposer] = useState(false);
  const [captionInput, setCaptionInput] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | undefined>(undefined);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [lastMediaFile, setLastMediaFile] = useState<File | null>(null);
  const [playingMomentId, setPlayingMomentId] = useState<string | null>(null);
  const [followedUids, setFollowedUids] = useState<string[]>([]);
  const [pledgedCouple, setPledgedCouple] = useState<string | null>(null);
  const [giftPackClaimed, setGiftPackClaimed] = useState(false);
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, MomentCommentItem[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [sharedCounts, setSharedCounts] = useState<Record<string, number>>({});
  const [discoverNotice, setDiscoverNotice] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'selected'>('public');
  const [selectedFriendUids, setSelectedFriendUids] = useState<string[]>([]);

  const activeOwnedRing =
    ownedRings.find((r) => r.id === selectedOwnedRingId) ?? ownedRings[0] ?? null;

  const buildFallbackAvatar = (
    uid: string,
    name: string,
    avatarId?: string,
    photoUrl?: string
  ): AvatarConfig => ({
    id: avatarId || uid,
    uid,
    name: name || 'Player',
    handle: `@${(name || 'player').toLowerCase().replace(/\s+/g, '')}`,
    photoUrl,
    skinTone: '#D69E76',
    hairColor: '#1E293B',
    robeColor: '#7C3AED',
    accentColor: '#DDD6FE',
    ornament: 'lotus',
  });

  const runMediaUpload = async (file: File) => {
    setMediaUploadError(null);
    setLastMediaFile(file);
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'photo');
    setUploadedFileName(file.name);
    setMediaUploading(true);
    setMediaUploadProgress(10);
    try {
      const uploadedUrl = isVideo
        ? await uploadVideoAsset(file, {
            authToken,
            maxBytes: 5_000_000,
            onProgress: (pct) => setMediaUploadProgress(pct),
          })
        : await uploadImageAsset(file, {
            authToken,
            maxDim: 1280,
            quality: 0.84,
            maxCompressedBytes: 750_000,
            onProgress: (pct) => setMediaUploadProgress(pct),
          });
      setUploadedMediaUrl(uploadedUrl);
    } catch (err) {
      setMediaUploadError(err instanceof Error ? err.message : 'Could not upload media file. Tap Retry.');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void runMediaUpload(file);
  };

  const openCommentsDrawer = async (postId: string) => {
    setActiveCommentPostId(postId);
    try {
      const resp = await fetch(`/api/moments/${encodeURIComponent(postId)}/comments`, {
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (resp.ok) {
        const data = (await resp.json()) as { ok?: boolean; comments?: MomentCommentItem[] };
        if (data.ok && Array.isArray(data.comments)) {
          setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments! }));
        }
      }
    } catch {
      // ignore fetch error
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentPostId || !commentDraft.trim()) return;
    const text = commentDraft.trim();
    setCommentDraft('');
    try {
      const resp = await fetch(`/api/moments/${encodeURIComponent(activeCommentPostId)}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ body: text }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        comment?: MomentCommentItem;
      };
      if (resp.ok && data.ok && data.comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [activeCommentPostId]: [...(prev[activeCommentPostId] ?? []), data.comment!],
        }));
      }
    } catch {
      // ignore comment error
    }
  };

  const handleShareMoment = async (postId: string) => {
    setSharedCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    setDiscoverNotice('Moment shared with your OG VELOCITY squad!');
    window.setTimeout(() => setDiscoverNotice(null), 2400);
    fetch(`/api/moments/${encodeURIComponent(postId)}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    }).catch(() => {});
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captionInput.trim() && !uploadedMediaUrl) return;
    if (visibility === 'selected' && selectedFriendUids.length === 0) {
      setDiscoverNotice('Select at least one friend when posting with Selected Friends visibility.');
      window.setTimeout(() => setDiscoverNotice(null), 2600);
      return;
    }
    onAddMoment(
      captionInput.trim() ||
        (mediaType === 'video' ? 'Shared a video moment' : 'Shared a photo moment'),
      mediaType,
      uploadedMediaUrl,
      visibility,
      visibility === 'selected' ? selectedFriendUids : []
    );
    setCaptionInput('');
    setUploadedMediaUrl(undefined);
    setUploadedFileName('');
    setVisibility('public');
    setSelectedFriendUids([]);
    setShowComposer(false);
    setFullScreenTab('moments');
  };

  const toggleFollow = (uid: string) => {
    setFollowedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="relative mx-auto max-w-2xl space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-white">Discover</h1>
        <button
          type="button"
          onClick={() => {
            setFullScreenTab('moments');
            setShowComposer(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/25 hover:opacity-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Post Moment
        </button>
      </div>

      {/* Top 3-Column Rounded Visual Hub Strip matching reference */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Card 1: Moments (Warm cream-gold card + orange arrow) */}
        <button
          type="button"
          onClick={() => setFullScreenTab('moments')}
          className="group relative flex h-16 items-center justify-end overflow-hidden rounded-full border border-amber-200/70 bg-gradient-to-br from-[#FFFDF7] via-[#FFF3D1] to-[#FFE2A6] pr-2 shadow-lg transition-transform hover:scale-[1.02] sm:h-20 sm:pr-3"
        >
          <img
            src={momentsCardImg}
            alt="Moments"
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/2 object-cover object-left opacity-95"
          />
          <div className="relative z-10 flex items-center gap-1 rounded-full bg-[#FFF7E2]/90 py-1 pr-1 pl-2 shadow-sm backdrop-blur-xs">
            <span className="font-display text-[11px] font-black tracking-tight text-slate-900 sm:text-xs">
              Moments
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>

        {/* Card 2: CP MALL (Dark teal-navy card + emerald arrow) */}
        <button
          type="button"
          onClick={() => setFullScreenTab('church')}
          className="group relative flex h-16 items-center justify-end overflow-hidden rounded-full border border-emerald-400/40 bg-[#081A28] pr-2 shadow-lg transition-transform hover:scale-[1.02] sm:h-20 sm:pr-3"
        >
          <img
            src={cpMallCardImg}
            alt="CP Mall"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-left opacity-90"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#04141D]/55 to-[#04141D]/92"
          />
          <div className="relative z-10 flex items-center gap-1 rounded-full bg-[#061824]/85 py-1 pr-1 pl-2 backdrop-blur-xs">
            <span className="font-display text-[11px] font-black tracking-tight text-white sm:text-xs">
              CP MALL
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>

        {/* Card 3: Nearby (Electric violet-blue card + magenta arrow) */}
        <button
          type="button"
          onClick={() => setFullScreenTab('nearby')}
          className="group relative flex h-16 items-center justify-end overflow-hidden rounded-full border border-fuchsia-400/50 bg-gradient-to-br from-[#25166E] via-[#4C1D95] to-[#6D28D9] pr-2 shadow-lg transition-transform hover:scale-[1.02] sm:h-20 sm:pr-3"
        >
          <img
            src={nearbyCardImg}
            alt="Nearby"
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/2 object-cover object-left opacity-95"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#3B0764]/45 to-[#3B0764]/88"
          />
          <div className="relative z-10 flex items-center gap-1 rounded-full bg-[#2E1065]/80 py-1 pr-1 pl-2 backdrop-blur-xs">
            <span className="font-display text-[11px] font-black tracking-tight text-white sm:text-xs">
              Nearby
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-500 text-white shadow">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>
      </div>

      {/* Floating Gift Pack Promo Pill */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={giftPackClaimed}
          onClick={() => {
            setGiftPackClaimed(true);
            onClaimGiftPack?.();
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-[#281C12] via-[#3A2714] to-[#281C12] px-3.5 py-2 text-xs shadow-lg shadow-amber-500/15 transition-transform hover:scale-105 disabled:opacity-60"
        >
          <Gift className="h-4 w-4 text-amber-300" />
          <span className="font-bold text-amber-200">
            {giftPackClaimed ? 'Gift Pack Claimed (+1,500)' : 'Gift Pack'}
          </span>
          <span className="rounded-full bg-black/50 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-white">
            Active
          </span>
        </button>
      </div>

      {/* Live OG VELOCITY Events Feed */}
      {events.length > 0 && (
        <section className="space-y-2.5 rounded-3xl border border-amber-400/25 bg-[#171124]/90 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-300" />
              <h2 className="font-display text-base font-bold text-white">Live Events</h2>
            </div>
            <span className="font-mono-tabular text-[10px] font-bold text-emerald-300">
              {events.filter((e) => e.status === 'active').length} Active
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {events.map((evt) => {
              const joined = joinedEventIds.includes(evt.id);
              return (
                <div
                  key={evt.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0D1526] p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                        {evt.eventType}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-emerald-300">
                        {evt.status.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold text-white">{evt.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{evt.description}</p>
                    <div className="mt-2 font-mono-tabular text-[11px] font-bold text-amber-300">
                      Reward Pool: {evt.rewardCoins.toLocaleString()} Coins
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={joined}
                    onClick={async () => {
                      setJoinedEventIds((prev) => [...prev, evt.id]);
                      await onJoinEvent?.(evt.id);
                      setDiscoverNotice(`Joined event: ${evt.title}!`);
                      window.setTimeout(() => setDiscoverNotice(null), 2400);
                    }}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 py-1.5 text-xs font-extrabold text-slate-950 disabled:opacity-55"
                  >
                    {joined ? 'Joined ✓' : 'Join Event'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {discoverNotice && (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-200">
          {discoverNotice}
        </div>
      )}

      {/* FULL-SCREEN OVERLAY: MOMENTS */}
      {fullScreenTab === 'moments' && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-white">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-purple-400/20 bg-[#140F20]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setFullScreenTab(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-[#1D152E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-500/25"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <span className="font-display text-base font-extrabold text-white">Moments</span>
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 px-3 py-1.5 text-xs font-bold text-slate-950"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post</span>
            </button>
          </header>

          <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
            {showComposer && (
              <form
                onSubmit={handlePost}
                className="space-y-3 rounded-2xl border border-cyan-400/25 bg-[#0D1526] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-xl bg-[#070B14] p-1">
                    <button
                      type="button"
                      onClick={() => setMediaType('photo')}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        mediaType === 'photo'
                          ? 'bg-cyan-500 font-bold text-slate-950'
                          : 'text-slate-300'
                      }`}
                    >
                      <Image className="h-3.5 w-3.5" />
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType('video')}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        mediaType === 'video'
                          ? 'bg-cyan-500 font-bold text-slate-950'
                          : 'text-slate-300'
                      }`}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </button>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25">
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {mediaUploading
                        ? `Uploading (${mediaUploadProgress}%)...`
                        : uploadedFileName
                          ? uploadedFileName
                          : 'Upload Photo or Video'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {mediaUploading && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${mediaUploadProgress}%` }}
                    />
                  </div>
                )}

                {uploadedMediaUrl && (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/50 p-2">
                    {mediaType === 'video' ? (
                      <video
                        src={uploadedMediaUrl}
                        controls
                        className="max-h-56 w-full rounded-lg object-contain"
                      />
                    ) : (
                      <img
                        src={uploadedMediaUrl}
                        alt="Preview"
                        className="max-h-56 w-full rounded-lg object-cover"
                      />
                    )}
                  </div>
                )}

                {mediaUploadError && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                    <span>{mediaUploadError}</span>
                    {lastMediaFile && !mediaUploading && (
                      <button
                        type="button"
                        onClick={() => void runMediaUpload(lastMediaFile)}
                        className="rounded-lg bg-rose-500/25 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500/35"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-white/10 bg-[#070B14] p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-300">Visibility</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          visibility === 'public'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        Public
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('selected')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          visibility === 'selected'
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        Selected Friends ({selectedFriendUids.length})
                      </button>
                    </div>
                  </div>
                  {visibility === 'selected' && (
                    <div className="max-h-28 space-y-1 overflow-y-auto border-t border-white/10 pt-2">
                      {friends.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          No accepted friends available yet. Add friends first to share private moments.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {friends.map((fr) => {
                            const fId = fr.publicId || fr.uid;
                            const picked = selectedFriendUids.includes(fId);
                            return (
                              <button
                                key={fId}
                                type="button"
                                onClick={() =>
                                  setSelectedFriendUids((prev) =>
                                    prev.includes(fId) ? prev.filter((id) => id !== fId) : [...prev, fId]
                                  )
                                }
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                  picked
                                    ? 'border-purple-400 bg-purple-500/30 text-white'
                                    : 'border-white/10 bg-[#0D1526] text-slate-300'
                                }`}
                              >
                                {picked ? '✓ ' : ''}
                                {fr.name} ({fId})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={captionInput}
                    onChange={(e) => setCaptionInput(e.target.value)}
                    placeholder={`Write a caption for your ${mediaType}...`}
                    className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:from-cyan-400 hover:to-teal-300"
                  >
                    Publish
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {moments.length === 0 ? (
                <div className="col-span-full rounded-3xl border border-white/10 bg-[#0D1526] p-8 text-center text-xs text-slate-400">
                  No moments posted yet. Tap Post above to share your first OG VELOCITY moment!
                </div>
              ) : (
                moments.map((m) => {
                  const authorAv = buildFallbackAvatar(m.authorUid, m.authorName, m.avatarId);
                  const authorVip = m.authorVipLevel ?? 0;
                  const isFollowed = followedUids.includes(m.authorUid);
                  const isPlaying = playingMomentId === m.id;
                  return (
                    <article
                      key={m.id}
                      className="overflow-hidden rounded-3xl border border-white/10 bg-[#0D1526] p-4 shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-2 pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (onInspectUserById) {
                              onInspectUserById(m.authorUid);
                              return;
                            }
                            onInspectUser({
                              avatar: authorAv,
                              vipLevel: authorVip,
                              charm: 0,
                              ringNumber: 0,
                            });
                          }}
                          className="flex items-center gap-2.5 text-left"
                        >
                          <AvatarArt avatar={authorAv} size={38} />
                          <div>
                            <div className="flex items-center gap-1">
                              <span
                                className="text-sm font-bold"
                                style={getVipNameStyle(authorVip)}
                              >
                                {m.authorName}
                              </span>
                              {authorVip >= 1 && <VipBadgeArt level={authorVip} size={18} />}
                            </div>
                            <div className="font-mono-tabular text-[11px] text-slate-400">
                              {m.timestamp}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFollow(m.authorUid)}
                          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                            isFollowed
                              ? 'border border-white/15 bg-white/5 text-slate-300'
                              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                          }`}
                        >
                          {isFollowed ? 'Following' : 'Follow'}
                        </button>
                      </div>

                      {m.mediaUrl ? (
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                          {m.mediaType === 'video' ? (
                            <video
                              src={m.mediaUrl}
                              controls
                              className="h-48 w-full object-cover"
                            />
                          ) : (
                            <img
                              src={m.mediaUrl}
                              alt={m.caption}
                              className="h-48 w-full object-cover"
                            />
                          )}
                          <div className="bg-black/70 px-3 py-2 text-xs text-slate-200">
                            {m.caption}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="relative flex h-40 flex-col items-center justify-center rounded-2xl px-5 text-center"
                          style={{ background: m.mediaGradient }}
                        >
                          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {m.mediaType === 'video' ? (
                              <Video className="h-3 w-3 text-cyan-300" />
                            ) : (
                              <Camera className="h-3 w-3 text-amber-300" />
                            )}
                            <span>{m.mediaType === 'video' ? 'Video' : 'Photo'}</span>
                          </div>
                          {m.mediaType === 'video' ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white">
                              <Play className="ml-0.5 h-4 w-4" />
                            </div>
                          ) : (
                            <Sparkles className="h-6 w-6 text-amber-300" />
                          )}
                          <div className="font-display mt-1.5 text-base font-bold text-white">
                            {m.mediaTitle}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-200">{m.caption}</p>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onToggleLikeMoment(m.id)}
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              m.liked ? 'text-pink-400' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            <Heart className="h-4 w-4" />
                            <span className="font-mono-tabular">{m.likes}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCommentsDrawer(m.id)}
                            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-cyan-300"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="font-mono-tabular">
                              {commentsByPost[m.id]?.length ?? 0}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareMoment(m.id)}
                            className="inline-flex items-center gap-1 text-slate-300 hover:text-emerald-300"
                            title="Share Moment"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {(sharedCounts[m.id] ?? 0) > 0 && (
                              <span className="font-mono-tabular">{sharedCounts[m.id]}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onReportContent?.('post', m.id, 'Inappropriate moment content');
                              setDiscoverNotice('Reported moment to moderation team.');
                              window.setTimeout(() => setDiscoverNotice(null), 2400);
                            }}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-300"
                            title="Report Moment"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlayingMomentId(isPlaying ? null : m.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#132038] px-2.5 py-1 text-[11px] text-cyan-300 hover:text-white"
                        >
                          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          <span>{isPlaying ? 'Pause' : 'Play'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {activeCommentPostId && (
              <div
                onClick={() => setActiveCommentPostId(null)}
                role="presentation"
                className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-3xl border border-cyan-400/30 bg-[#0D1526] p-4 text-white shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <span className="font-display text-sm font-bold">Comments</span>
                    <button
                      type="button"
                      onClick={() => setActiveCommentPostId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="zayro-scroll my-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                    {(commentsByPost[activeCommentPostId] ?? []).length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        No comments yet. Start the conversation!
                      </p>
                    ) : (
                      (commentsByPost[activeCommentPostId] ?? []).map((c) => (
                        <div key={c.id} className="rounded-xl bg-[#132038] px-3 py-2 text-xs">
                          <div className="font-bold text-cyan-200">{c.authorName}</div>
                          <div className="mt-0.5 text-slate-200">{c.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-extrabold text-slate-950"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Post
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL-SCREEN OVERLAY: CP MALL / CHURCH (Strict Ring Ownership Required) */}
      {fullScreenTab === 'church' && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-white">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-rose-400/20 bg-[#140F20]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setFullScreenTab(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-[#1D152E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500/25"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <span className="font-display text-base font-extrabold text-white">
              CP MALL · Sanctuary
            </span>
            <div className="w-16" />
          </header>

          <div className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-6">
            <section className="space-y-4 rounded-3xl border border-rose-400/25 bg-[#161024]/90 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">CP MALL · Ring Ceremony</h2>
                  <p className="text-xs text-slate-400">
                    You must own a Ring from the Shop before proposing a CP partnership.
                  </p>
                </div>
                <RingSpriteArt
                  ringNumber={activeOwnedRing?.ringNumber ?? bondRings[0]?.ringNumber ?? 1}
                  imageUrl={activeOwnedRing?.imageUrl}
                  size={46}
                  alt="CP Ring"
                />
              </div>

              {ownedRings.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4 text-center">
                  <div className="text-sm font-bold text-amber-200">
                    No Owned Ring Found
                  </div>
                  <p className="text-xs text-slate-200">
                    Purchase any Ring in the Shop first to unlock CP proposals here.
                  </p>
                  {onOpenRingShop && (
                    <button
                      type="button"
                      onClick={() => {
                        setFullScreenTab(null);
                        onOpenRingShop();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-lg hover:brightness-105"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Buy Ring in Shop</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-rose-200">
                    Select Your Owned Ring:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ownedRings.map((ring) => {
                      const selected = activeOwnedRing?.id === ring.id;
                      return (
                        <button
                          key={ring.id}
                          type="button"
                          onClick={() => setSelectedOwnedRingId(ring.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                            selected
                              ? 'border-rose-400 bg-rose-500/25 text-white ring-1 ring-rose-400'
                              : 'border-white/10 bg-[#0D1526] text-slate-300 hover:border-cyan-400/40'
                          }`}
                        >
                          <RingSpriteArt
                            ringNumber={ring.ringNumber ?? 1}
                            imageUrl={ring.imageUrl}
                            size={26}
                            alt={ring.name}
                          />
                          <span>{ring.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {pledgedCouple && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-xs font-semibold text-rose-200">
                  Sent CP Ring request ({activeOwnedRing?.name || 'Owned Ring'}) to {pledgedCouple}! Waiting for acceptance.
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {friends.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-white/10 bg-[#132038] p-6 text-center text-xs text-slate-300">
                    Add friends first to send a synchronized Church CP proposal, or open Me → CP Life to propose by User ID.
                  </div>
                ) : (
                  friends.slice(0, 6).map((fr) => {
                    const av = buildFallbackAvatar(fr.uid, fr.name, fr.avatarId, fr.photoUrl);
                    return (
                      <div
                        key={fr.uid}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#132038] p-3"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onInspectUserById) {
                              onInspectUserById(fr.uid);
                              return;
                            }
                            onInspectUser({
                              avatar: { ...av, publicId: fr.publicId || fr.uid },
                              vipLevel: fr.vipLevel ?? 0,
                              charm: 0,
                              ringNumber: 0,
                              friendStatus: 'friends',
                              online: fr.status === 'Online' || fr.status === 'In Voice Room',
                              lastSeenAt: fr.lastSeenAt,
                            });
                          }}
                          className="flex items-center gap-2.5 text-left"
                        >
                          <AvatarArt avatar={av} size={40} />
                          <div>
                            <div
                              className="text-sm font-bold"
                              style={getVipNameStyle(fr.vipLevel ?? 0)}
                            >
                              {fr.name}
                            </div>
                            <div className="font-mono-tabular text-[10px] text-slate-400">
                              ID: {fr.publicId || fr.uid}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={!activeOwnedRing}
                          onClick={() => {
                            if (!activeOwnedRing) return;
                            onProposeCp?.(
                              fr.publicId || fr.uid,
                              fr.name,
                              fr.avatarId || fr.uid,
                              activeOwnedRing.ringNumber ?? 1,
                              activeOwnedRing.name
                            );
                            setPledgedCouple(fr.name);
                          }}
                          className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Pledge CP
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* FULL-SCREEN OVERLAY: NEARBY (Live Active Rooms & Hosts) */}
      {fullScreenTab === 'nearby' && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-white">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-emerald-400/20 bg-[#140F20]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setFullScreenTab(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/15 bg-[#1D152E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500/25"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <span className="font-display text-base font-extrabold text-white">
              Nearby Active Rooms
            </span>
            <div className="w-16" />
          </header>

          <div className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-6">
            <section className="space-y-4 rounded-3xl border border-emerald-400/25 bg-[#161024]/90 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Active Hosts &amp; Live Rooms
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real active voice rooms hosted by live users right now
                  </p>
                </div>
                <MapPin className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rooms.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-white/10 bg-[#132038] p-6 text-center text-xs text-slate-300">
                    No active voice rooms right now. Create one in the Voice tab!
                  </div>
                ) : (
                  rooms.map((rm) => {
                    const hostAv =
                      rm.seats.find((s) => s.occupant?.uid === rm.ownerUid)?.occupant ??
                      buildFallbackAvatar(rm.ownerUid, rm.hostName || 'Host');
                    const hostVip =
                      rm.seats.find((s) => s.occupant?.uid === rm.ownerUid)?.vipLevel ?? 0;
                    return (
                      <div
                        key={rm.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#132038] p-3"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onInspectUserById && rm.ownerUid) {
                              onInspectUserById(rm.ownerUid);
                              return;
                            }
                            onInspectUser({
                              avatar: hostAv,
                              vipLevel: hostVip,
                              charm: 0,
                              roomId: rm.id,
                              roomTitle: rm.title,
                              online: true,
                            });
                          }}
                          className="flex min-w-0 items-center gap-2.5 text-left"
                        >
                          <AvatarArt avatar={hostAv} size={40} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                className="truncate text-sm font-bold"
                                style={getVipNameStyle(hostVip)}
                              >
                                {rm.hostName || rm.title}
                              </span>
                              <VipBadgeArt level={hostVip} size={16} />
                            </div>
                            <div className="font-mono-tabular text-[11px] text-emerald-300">
                              {rm.title} · {rm.listenerCount} inside
                            </div>
                          </div>
                        </button>
                        {onJoinRoom && (
                          <button
                            type="button"
                            onClick={() => onJoinRoom(rm.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            <Users className="h-3 w-3" />
                            Join
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
