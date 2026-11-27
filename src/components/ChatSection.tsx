import React, { useEffect, useRef, useState } from 'react';
import {
  Ban,
  Check,
  ChevronLeft,
  Flag,
  Gift,
  ImagePlus,
  MessageCircle,
  Mic,
  Search,
  Send,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ROOM_EMOTES, USER_PROFILE, getVipNameStyle } from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { GiftArtwork } from '../graphics/GiftArtwork';
import {
  ChatFrameMessage,
  EmoteSpriteArt,
  VipBadgeArt,
  resolveChatFrameNumber,
} from '../graphics/SpriteArtwork';
import type { AvatarConfig, ChatThread, FriendRelationStatus, MomentPost, VirtualGift } from '../types';
import { uploadImageAsset } from '../utils/mediaUpload';

interface PendingFriendRequestItem {
  id: number;
  requesterUid: string;
  name: string;
  publicId: string;
  photoUrl?: string;
}

interface SearchUserResult {
  uid: string;
  publicId: string;
  name: string;
  handle: string;
  photoUrl?: string | null;
  vipLevel: number;
  online: boolean;
  lastSeenAt?: string | null;
  equippedFrameId?: string | null;
  friendStatus?: FriendRelationStatus;
}

interface ChatSectionProps {
  threads: ChatThread[];
  coins: number;
  gifts: VirtualGift[];
  userProfile?: AvatarConfig;
  authToken?: string | null;
  equippedBubbleId?: string;
  equippedBubbleColor?: string;
  pendingFriendRequests?: PendingFriendRequestItem[];
  outgoingPendingFriendUids?: string[];
  sharedMoments?: MomentPost[];
  onSelectThread: (friendUid: string) => void;
  onSendChatMessage: (friendUid: string, text: string, imageUrl?: string) => void;
  onSendGift: (
    gift: VirtualGift,
    recipientName: string,
    quantity?: number,
    recipientUid?: string,
    customMessage?: string
  ) => void;
  onJoinFriendVoiceRoom: (roomUid: string) => void;
  onAddFriendByUid: (uid: string) => Promise<string> | string;
  onCancelFriendRequest?: (targetUid: string) => Promise<string> | string;
  onRespondFriendRequest?: (relationId: number, accept: boolean) => void;
  onUnfriendUser?: (targetUid: string, targetName: string) => void;
  onBlockUser?: (targetUid: string, targetName: string) => void;
  onUnblockUser?: (targetUid: string, targetName: string) => void;
  onReportUser?: (targetUid: string, targetName: string, reason: string) => void;
  onLoadOlderMessages?: (friendUid: string) => void;
  hasMoreMessagesByUid?: Record<string, boolean>;
  onInspectUserById?: (uid: string) => void;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  threads,
  coins,
  gifts,
  userProfile = USER_PROFILE,
  authToken = null,
  equippedBubbleId,
  equippedBubbleColor,
  pendingFriendRequests = [],
  outgoingPendingFriendUids = [],
  sharedMoments = [],
  onSelectThread,
  onSendChatMessage,
  onSendGift,
  onJoinFriendVoiceRoom,
  onAddFriendByUid,
  onCancelFriendRequest,
  onRespondFriendRequest,
  onUnfriendUser,
  onBlockUser,
  onUnblockUser,
  onReportUser,
  onLoadOlderMessages,
  hasMoreMessagesByUid = {},
  onInspectUserById,
}) => {
  const [showIdSearch, setShowIdSearch] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showSharedMoments, setShowSharedMoments] = useState(false);
  const [idQuery, setIdQuery] = useState('');
  const [addUidInput, setAddUidInput] = useState('');
  const [addNotice, setAddNotice] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlyInRoom, setOnlyInRoom] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string>(threads[0]?.friendUid || '');
  const [mobileConvoOpen, setMobileConvoOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [bigGiftMsg, setBigGiftMsg] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [liveReaction, setLiveReaction] = useState<{
    emoteNumber: number;
    label: string;
    motion: 'bounce' | 'sway' | 'shake' | 'pulse';
    key: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selfChatFrameNum = resolveChatFrameNumber(equippedBubbleId);

  const visibleThreads = threads.filter((t) => {
    const matchesQuery =
      !idQuery.trim() ||
      t.friendUid.toLowerCase().includes(idQuery.trim().toLowerCase()) ||
      t.friendName.toLowerCase().includes(idQuery.trim().toLowerCase());
    const matchesInRoom = !onlyInRoom || (t.status === 'In Voice Room' && !!t.voiceRoomUid);
    return matchesQuery && matchesInRoom;
  });

  const activeThread =
    visibleThreads.find((t) => t.friendUid === selectedUid) ?? visibleThreads[0] ?? threads[0];
  const quickGifts = gifts.slice(0, 4);

  useEffect(() => {
    if (mobileConvoOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mobileConvoOpen, activeThread?.messages.length]);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [lastPhotoFile, setLastPhotoFile] = useState<File | null>(null);

  const handleSelect = (uid: string) => {
    setSelectedUid(uid);
    setMobileConvoOpen(true);
    onSelectThread(uid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || photoUploading || (!draft.trim() && !pendingPhotoUrl)) return;
    onSendChatMessage(
      activeThread.friendUid,
      draft.trim() || (pendingPhotoUrl ? 'Sent a photo' : ''),
      pendingPhotoUrl ?? undefined
    );
    setDraft('');
    setPendingPhotoUrl(null);
    setPhotoUploadError(null);
  };

  const runPhotoUpload = async (file: File) => {
    if (!activeThread) return;
    setLastPhotoFile(file);
    setPhotoUploadError(null);
    setPhotoUploading(true);
    setPhotoProgress(10);
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1080,
        quality: 0.82,
        maxCompressedBytes: 680_000,
        onProgress: (pct) => setPhotoProgress(pct),
      });
      setPendingPhotoUrl(uploadedUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not upload photo.';
      setPhotoUploadError(msg);
      setAddNotice(msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeThread) return;
    void runPhotoUpload(file);
  };

  useEffect(() => {
    setSearchPage(1);
  }, [addUidInput]);

  useEffect(() => {
    const q = addUidInput.trim();
    if (!showAddFriend || q.length < 2) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(q)}&page=${searchPage}&limit=12`, {
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ok?: boolean; users?: SearchUserResult[]; hasMore?: boolean } | null) => {
          if (cancelled) return;
          setSearchLoading(false);
          if (data?.ok && Array.isArray(data.users)) {
            const filtered = data.users.filter((u) => u.uid !== userProfile.uid);
            setSearchResults((prev) =>
              searchPage > 1
                ? [
                    ...prev,
                    ...filtered.filter((u) => !prev.some((existing) => existing.uid === u.uid)),
                  ]
                : filtered
            );
            setSearchHasMore(Boolean(data.hasMore));
          }
        })
        .catch(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addUidInput, searchPage, showAddFriend, authToken, userProfile.uid]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUidInput.trim()) return;
    const msg = await Promise.resolve(onAddFriendByUid(addUidInput.trim()));
    setAddNotice(msg);
    setAddUidInput('');
  };

  return (
    <div className="space-y-4">
      {/* Chats Header Bar matching Screenshot 2 */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-white">Chats</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddFriend((v) => !v)}
            title="Add Friend by UID"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              showAddFriend
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-white/10 bg-[#132038] text-slate-200 hover:bg-[#192946]'
            }`}
          >
            <UserPlus className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowIdSearch((v) => !v)}
            title="Search by User ID"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              showIdSearch
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-white/10 bg-[#132038] text-slate-200 hover:bg-[#192946]'
            }`}
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSharedMoments((v) => !v)}
            title="Shared Moments with You"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              showSharedMoments
                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                : 'border-white/10 bg-[#132038] text-slate-200 hover:bg-[#192946]'
            }`}
          >
            <Sparkles className="h-4.5 w-4.5" />
            {sharedMoments.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 font-mono-tabular text-[9px] font-black text-white">
                {sharedMoments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Top User ID Search Bar + In-Room Filter */}
      {showIdSearch && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={idQuery}
              onChange={(e) => setIdQuery(e.target.value)}
              placeholder="Search friend by User ID (e.g. 100001) or name..."
              className="w-full rounded-2xl border border-white/10 bg-[#0D1526] py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyInRoom(false)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                !onlyInRoom
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-white/10 bg-[#0D1526] text-slate-300'
              }`}
            >
              All Friends
            </button>
            <button
              type="button"
              onClick={() => setOnlyInRoom(true)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                onlyInRoom
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-white/10 bg-[#0D1526] text-slate-300'
              }`}
            >
              <Users className="h-3 w-3" />
              <span>In Voice Room</span>
            </button>
          </div>
        </div>
      )}

      {/* Shared Moments Panel */}
      {showSharedMoments && (
        <div className="space-y-2.5 rounded-2xl border border-purple-400/30 bg-[#0D1526] p-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-300" />
              <span className="font-display text-sm font-bold text-white">
                Shared Moments ({sharedMoments.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSharedMoments(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {sharedMoments.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              No private friend moments shared with you yet.
            </p>
          ) : (
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {sharedMoments.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-[#070B14] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectUserById?.(m.authorUid)}
                      className="font-bold text-cyan-200 hover:underline"
                    >
                      {m.authorName}
                    </button>
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                      Selected Friends
                    </span>
                  </div>
                  {m.mediaUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {m.mediaType === 'video' ? (
                        <video src={m.mediaUrl} controls className="max-h-44 w-full object-contain" />
                      ) : (
                        <img
                          src={m.mediaUrl}
                          alt={m.caption || 'Shared moment'}
                          className="max-h-44 w-full object-cover"
                        />
                      )}
                    </div>
                  )}
                  {m.caption && <p className="mt-2 text-slate-200">{m.caption}</p>}
                  <div className="mt-1 text-[10px] text-slate-400">{m.timestamp}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optional Add Friend Inline Bar + Live Directory Search */}
      {showAddFriend && (
        <div className="space-y-2 rounded-2xl border border-cyan-400/25 bg-[#0D1526] p-3">
          <form onSubmit={handleAddFriend} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={addUidInput}
              onChange={(e) => setAddUidInput(e.target.value)}
              placeholder="Search Name or OG VELOCITY ID (e.g. 100001)..."
              className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 py-2 text-xs font-bold text-slate-950 hover:from-cyan-400 hover:to-teal-300"
            >
              Add Friend
            </button>
            {addNotice && <span className="w-full text-xs text-emerald-300">{addNotice}</span>}
          </form>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {searchResults.map((u) => {
                  const isAlreadyFriend =
                    u.friendStatus === 'friends' ||
                    threads.some(
                      (t) =>
                        t.friendUid === u.uid ||
                        t.friendUid === u.publicId ||
                        t.friendPublicId === u.uid ||
                        t.friendPublicId === u.publicId
                    );
                  const isOutgoingPending =
                    u.friendStatus === 'pending_outgoing' ||
                    outgoingPendingFriendUids.includes(u.uid) ||
                    outgoingPendingFriendUids.includes(u.publicId);
                  const status: FriendRelationStatus = isAlreadyFriend
                    ? 'friends'
                    : isOutgoingPending
                      ? 'pending_outgoing'
                      : (u.friendStatus ?? 'none');
                  return (
                    <div
                      key={u.uid}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectUserById?.(u.publicId || u.uid)}
                        className="min-w-0 flex-1 text-left hover:opacity-90"
                      >
                        <div className="truncate font-bold text-white">
                          {u.name}{' '}
                          {u.online && (
                            <span className="text-[10px] text-emerald-400">● Online</span>
                          )}
                        </div>
                        <div className="font-mono-tabular text-[10px] text-slate-400">
                          {u.publicId} · {u.handle}
                        </div>
                      </button>
                      {status === 'friends' ? (
                        <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                          Friends
                        </span>
                      ) : status === 'pending_outgoing' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!onCancelFriendRequest) return;
                            const msg = await Promise.resolve(onCancelFriendRequest(u.publicId || u.uid));
                            setAddNotice(msg);
                            setSearchResults((prev) =>
                              prev.map((row) =>
                                row.uid === u.uid ? { ...row, friendStatus: 'none' } : row
                              )
                            );
                          }}
                          className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-200"
                        >
                          Cancel Req
                        </button>
                      ) : status === 'pending_incoming' ? (
                        <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[10px] font-bold text-cyan-200">
                          Requested You
                        </span>
                      ) : status === 'blocked_by_me' ? (
                        <button
                          type="button"
                          onClick={() => {
                            onUnblockUser?.(u.publicId || u.uid, u.name);
                            setSearchResults((prev) =>
                              prev.map((row) =>
                                row.uid === u.uid ? { ...row, friendStatus: 'none' } : row
                              )
                            );
                          }}
                          className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-200"
                        >
                          Unblock
                        </button>
                      ) : status === 'blocked_by_them' ? (
                        <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] text-slate-400">
                          Unavailable
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const msg = await Promise.resolve(onAddFriendByUid(u.publicId || u.uid));
                            setAddNotice(msg);
                            setSearchResults((prev) =>
                              prev.map((row) =>
                                row.uid === u.uid
                                  ? { ...row, friendStatus: 'pending_outgoing' }
                                  : row
                              )
                            );
                          }}
                          className="rounded-lg bg-cyan-500 px-2.5 py-1 text-[10px] font-extrabold text-slate-950"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {searchHasMore && (
                <button
                  type="button"
                  disabled={searchLoading}
                  onClick={() => setSearchPage((p) => p + 1)}
                  className="w-full rounded-xl border border-white/10 bg-[#070B14] py-1.5 text-[11px] font-bold text-cyan-300 hover:bg-white/5 disabled:opacity-50"
                >
                  {searchLoading ? 'Loading...' : 'Load More Users'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-Width Chat Threads List */}
      <div className="space-y-2.5">
        {pendingFriendRequests.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-3">
            <div className="text-[11px] font-bold text-amber-200 uppercase">
              Pending Friend Requests ({pendingFriendRequests.length})
            </div>
            {pendingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#0D1526] px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{req.name}</div>
                  <div className="font-mono-tabular text-[10px] text-slate-400">{req.publicId}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest?.(req.id, true)}
                    className="rounded-lg bg-emerald-500 p-1.5 text-slate-950"
                    title="Accept"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest?.(req.id, false)}
                    className="rounded-lg bg-rose-500/20 p-1.5 text-rose-300"
                    title="Decline"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleThreads.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#0D1526] p-6 text-center text-xs text-slate-400">
            No friends in your chat list yet. Tap the <strong className="text-cyan-300">+</strong> icon above to search real OG VELOCITY users by name or ID and send a friend request.
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const avatar: AvatarConfig = {
              id: thread.avatarId || 'av-neutral',
              uid: thread.friendUid,
              publicId: thread.friendPublicId || thread.friendUid,
              name: thread.friendName,
              handle: `@${thread.friendName.toLowerCase().replace(/\s+/g, '')}`,
              photoUrl: thread.friendPhotoUrl ?? thread.photoUrl ?? undefined,
              skinTone: '#D69E76',
              hairColor: '#1E293B',
              robeColor: '#06B6D4',
              accentColor: '#A5F3FC',
              ornament: 'crown',
            };
            const isSelected = activeThread?.friendUid === thread.friendUid && mobileConvoOpen;
            const lastMsg = thread.messages[thread.messages.length - 1];
            const inRoom = thread.status === 'In Voice Room' && thread.voiceRoomUid;
            const isOnline = inRoom || thread.status === 'Online';
            const friendVip = thread.friendVipLevel ?? 0;

            return (
              <div
                key={thread.friendUid}
                onClick={() => handleSelect(thread.friendUid)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(thread.friendUid);
                  }
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-cyan-400/50 bg-[#132038]'
                    : 'border-white/5 bg-[#0D1526] hover:border-white/20'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0 overflow-visible">
                    <AvatarArt
                      avatar={avatar}
                      size={44}
                      frameId={thread.equippedFrameId ?? undefined}
                    />
                    {isOnline && (
                      <span className="absolute right-0 bottom-0 z-30 h-3 w-3 rounded-full border-2 border-[#0D1526] bg-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="truncate text-sm font-bold"
                        style={getVipNameStyle(friendVip)}
                      >
                        {thread.friendName}
                      </span>
                      {friendVip >= 1 && <VipBadgeArt level={friendVip} size={22} />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {inRoom
                        ? 'In Voice Room'
                        : lastMsg?.imageUrl
                          ? `📷 ${lastMsg.text || 'Photo'}`
                          : lastMsg
                            ? lastMsg.text
                            : 'Tap to message'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono-tabular text-[10px] text-slate-500">
                    {lastMsg?.timestamp || thread.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {thread.unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 font-mono-tabular text-[10px] font-bold text-white">
                        {thread.unread}
                      </span>
                    )}
                    {inRoom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJoinFriendVoiceRoom(thread.voiceRoomUid!);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/30"
                      >
                        <Mic className="h-2.5 w-2.5" />
                        In Voice Room
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dedicated Full-Screen Active Conversation Window */}
      {mobileConvoOpen && activeThread && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0C1426] via-[#070B14] to-[#050810] text-white">
          {/* Top Sticky Conversation Header */}
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0A101D]/95 px-4 py-3 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMobileConvoOpen(false);
                  setPendingPhotoUrl(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-100 hover:bg-white/15"
                aria-label="Back to chat list"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onInspectUserById?.(activeThread.friendPublicId || activeThread.friendUid)
                }
                className="flex min-w-0 items-center gap-2.5 text-left hover:opacity-90"
              >
                <AvatarArt
                  avatar={{
                    id: activeThread.avatarId || 'av-neutral',
                    uid: activeThread.friendUid,
                    publicId: activeThread.friendPublicId || activeThread.friendUid,
                    name: activeThread.friendName,
                    handle: `@${activeThread.friendName.toLowerCase().replace(/\s+/g, '')}`,
                    photoUrl: activeThread.friendPhotoUrl ?? activeThread.photoUrl ?? undefined,
                    skinTone: '#D69E76',
                    hairColor: '#1E293B',
                    robeColor: '#06B6D4',
                    accentColor: '#A5F3FC',
                    ornament: 'crown',
                  }}
                  size={36}
                  frameId={activeThread.equippedFrameId ?? undefined}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2
                      className="font-display truncate text-base font-bold sm:text-lg"
                      style={getVipNameStyle(activeThread.friendVipLevel ?? 0)}
                    >
                      {activeThread.friendName}
                    </h2>
                    {(activeThread.friendVipLevel ?? 0) >= 1 && (
                      <VipBadgeArt level={activeThread.friendVipLevel ?? 1} size={18} />
                    )}
                  </div>
                  <p className="font-mono-tabular truncate text-[11px] text-slate-400">
                    ID: {activeThread.friendPublicId || activeThread.friendUid} ·{' '}
                    <span
                      className={
                        activeThread.status === 'Online' || activeThread.status === 'In Voice Room'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      {activeThread.status === 'In Voice Room' && activeThread.voiceRoomTitle
                        ? `In ${activeThread.voiceRoomTitle}`
                        : activeThread.status}
                    </span>
                  </p>
                </div>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {activeThread.voiceRoomUid && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileConvoOpen(false);
                    onJoinFriendVoiceRoom(activeThread.voiceRoomUid!);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>Join Room</span>
                </button>
              )}
              {onUnfriendUser && (
                <button
                  type="button"
                  onClick={() => onUnfriendUser(activeThread.friendUid, activeThread.friendName)}
                  className="rounded-xl border border-white/10 bg-[#070B14] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:border-amber-400/50 hover:text-amber-200"
                >
                  Unfriend
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onReportUser?.(
                    activeThread.friendUid,
                    activeThread.friendName,
                    'Inappropriate DM behavior'
                  );
                  setAddNotice(`Reported ${activeThread.friendName} to moderators.`);
                }}
                title="Report User"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#070B14] text-slate-400 hover:border-amber-400/50 hover:text-amber-300"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onBlockUser?.(activeThread.friendUid, activeThread.friendName);
                  setMobileConvoOpen(false);
                }}
                title="Block User"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#070B14] text-slate-400 hover:border-rose-400/50 hover:text-rose-300"
              >
                <Ban className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* Scrollable Messages Area */}
          <div className="zayro-scroll relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {hasMoreMessagesByUid[activeThread.friendUid] && onLoadOlderMessages && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={() => onLoadOlderMessages(activeThread.friendUid)}
                  className="rounded-full border border-white/10 bg-[#0D1526] px-3.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-white/5"
                >
                  Load older messages
                </button>
              </div>
            )}

            {liveReaction && (
              <div
                key={liveReaction.key}
                className="pointer-events-none sticky top-2 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-cyan-400/40 bg-[#070B14]/90 px-3 py-1.5 shadow-[0_0_24px_rgba(34,211,238,0.4)] backdrop-blur-md"
              >
                <EmoteSpriteArt
                  emoteNumber={liveReaction.emoteNumber}
                  size={32}
                  alt={liveReaction.label}
                  animated
                  motion={liveReaction.motion}
                />
                <span className="text-xs font-extrabold text-cyan-200">
                  Live Reaction: {liveReaction.label}
                </span>
              </div>
            )}

            {activeThread.messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <MessageCircle className="h-8 w-8 text-cyan-300/70" />
                <p className="mt-2 text-xs">
                  Say hello to {activeThread.friendName} — send a message, emote, gift, or photo!
                </p>
              </div>
            ) : (
              activeThread.messages.map((msg) => {
                const emoteMatch = /^\[EMOTE:(\d+):([^\]]+)\]$/.exec(msg.text || '');
                const matchedEmote = emoteMatch
                  ? ROOM_EMOTES.find((e) => e.emoteNumber === Number(emoteMatch[1]))
                  : undefined;
                const friendAv: AvatarConfig = {
                  id: activeThread.avatarId || 'av-neutral',
                  uid: activeThread.friendUid,
                  publicId: activeThread.friendPublicId || activeThread.friendUid,
                  name: activeThread.friendName,
                  handle: `@${activeThread.friendName.toLowerCase().replace(/\s+/g, '')}`,
                  photoUrl: activeThread.friendPhotoUrl ?? activeThread.photoUrl ?? undefined,
                  skinTone: '#D69E76',
                  hairColor: '#1E293B',
                  robeColor: '#06B6D4',
                  accentColor: '#A5F3FC',
                  ornament: 'crown',
                };
                const msgAvatar = msg.isSelf ? userProfile : friendAv;
                const useChatFrame = msg.isSelf && !!selfChatFrameNum && !msg.imageUrl && !matchedEmote;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}
                  >
                    {matchedEmote ? (
                      <div className="flex flex-col items-center gap-1 rounded-2xl border border-cyan-400/30 bg-[#132038]/85 px-4 py-2.5 shadow-lg">
                        <EmoteSpriteArt
                          emoteNumber={matchedEmote.emoteNumber}
                          size={52}
                          alt={matchedEmote.label}
                          animated
                          motion={matchedEmote.motion}
                        />
                        <span className="font-mono-tabular text-[10px] text-cyan-200">
                          {matchedEmote.label} · {msg.timestamp}
                        </span>
                      </div>
                    ) : useChatFrame && selfChatFrameNum ? (
                      <ChatFrameMessage
                        frameNumber={selfChatFrameNum}
                        avatarNode={<AvatarArt avatar={msgAvatar} size={34} />}
                      >
                        {msg.text && <p className="text-xs leading-snug font-bold">{msg.text}</p>}
                        <div className="mt-0.5 text-right font-mono-tabular text-[9px] opacity-75">
                          {msg.timestamp}
                        </div>
                      </ChatFrameMessage>
                    ) : (
                      <div
                        style={
                          msg.isSelf && (msg.bubbleColor || equippedBubbleColor)
                            ? {
                                borderColor: msg.bubbleColor || equippedBubbleColor,
                                backgroundColor: `${msg.bubbleColor || equippedBubbleColor}22`,
                              }
                            : undefined
                        }
                        className={`max-w-[82%] rounded-2xl border px-3.5 py-2.5 text-sm backdrop-blur-md shadow-[0_6px_22px_rgba(0,0,0,0.22)] sm:max-w-[70%] ${
                          msg.isSelf
                            ? 'border-cyan-300/35 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-white'
                            : 'border-white/15 bg-white/10 text-slate-100'
                        }`}
                      >
                        {msg.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxImage(msg.imageUrl!)}
                            className="mb-1.5 block overflow-hidden rounded-xl border border-white/15"
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Shared DM"
                              className="max-h-60 w-full object-cover transition-transform hover:scale-[1.02]"
                            />
                          </button>
                        )}
                        {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                        <div className="mt-1 text-right font-mono-tabular text-[10px] text-slate-400">
                          {msg.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Sticky Composer Bar */}
          <div className="shrink-0 border-t border-white/10 bg-[#0A101D]/95 px-3.5 py-3 backdrop-blur-md">
            <div className="mx-auto max-w-3xl space-y-2.5">
              {/* Emotes + Quick Gifts Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="zayro-scroll flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
                  {ROOM_EMOTES.map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => {
                        onSendChatMessage(
                          activeThread.friendUid,
                          `[EMOTE:${em.emoteNumber}:${em.label}]`
                        );
                        setLiveReaction({
                          emoteNumber: em.emoteNumber,
                          label: em.label,
                          motion: em.motion,
                          key: Date.now(),
                        });
                      }}
                      title={`Send live ${em.label} reaction`}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-xs text-slate-200 transition-transform hover:scale-110 hover:border-cyan-400/50"
                    >
                      <EmoteSpriteArt
                        emoteNumber={em.emoteNumber}
                        size={20}
                        alt={em.label}
                        animated
                        motion={em.motion}
                      />
                    </button>
                  ))}
                </div>

                {quickGifts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-300">
                      <Gift className="h-3.5 w-3.5" />
                      Gift:
                    </span>
                    <input
                      type="text"
                      maxLength={30}
                      value={bigGiftMsg}
                      onChange={(e) => setBigGiftMsg(e.target.value)}
                      placeholder="Note (max 30)..."
                      className="w-28 rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none"
                    />
                    {quickGifts.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        disabled={coins < g.cost}
                        onClick={() => {
                          const msg = bigGiftMsg.trim().slice(0, 30);
                          onSendGift(
                            g,
                            activeThread.friendName,
                            1,
                            activeThread.friendUid,
                            msg || undefined
                          );
                          onSendChatMessage(
                            activeThread.friendUid,
                            `Sent ${g.name} (${g.cost} Coins)${msg ? ` — "${msg}"` : ''} — +${g.charmValue} Charm!`
                          );
                          setBigGiftMsg('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-400/50 disabled:opacity-40"
                      >
                        <GiftArtwork giftId={g.id} gift={g} size={18} />
                        <span>{g.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {photoUploading && (
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-[#111C33] px-3 py-2 text-xs text-cyan-200">
                  <span>Uploading photo ({photoProgress}%)...</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-200"
                      style={{ width: `${photoProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {photoUploadError && lastPhotoFile && !photoUploading && (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  <span>{photoUploadError}</span>
                  <button
                    type="button"
                    onClick={() => void runPhotoUpload(lastPhotoFile)}
                    className="rounded-lg bg-rose-500/25 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500/35"
                  >
                    Retry
                  </button>
                </div>
              )}

              {pendingPhotoUrl && (
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-[#111C33] p-2">
                  <img
                    src={pendingPhotoUrl}
                    alt="Ready to send"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div className="flex-1 text-xs text-cyan-200">
                    Photo ready to send. Add an optional caption below or tap Send.
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingPhotoUrl(null)}
                    aria-label="Remove pending photo"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <label
                  title="Attach Photo"
                  aria-label="Attach Photo"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-[#070B14] text-cyan-300 hover:border-cyan-400/60 hover:text-white"
                >
                  <ImagePlus className="h-4.5 w-4.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${activeThread.friendName}...`}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() && !pendingPhotoUrl}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 text-xs font-extrabold text-slate-950 hover:from-cyan-400 hover:to-teal-300 disabled:opacity-45"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          role="presentation"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label="Close photo"
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full preview"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
