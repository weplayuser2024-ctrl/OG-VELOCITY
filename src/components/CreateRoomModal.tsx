import React, { useRef, useState } from 'react';
import { Camera, Lock, RotateCw, Unlock, X } from 'lucide-react';
import { ZayroCoinArt } from '../graphics/SpriteArtwork';
import { uploadImageAsset } from '../utils/mediaUpload';
import type { VoiceRoom } from '../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  coins: number;
  authToken?: string | null;
  hasCreatedRoom?: boolean;
  onClose: () => void;
  onCreateRoom: (data: {
    title: string;
    topic: string;
    category: VoiceRoom['category'];
    ambiance: VoiceRoom['ambiance'];
    roomType: VoiceRoom['roomType'];
    seatCapacity: 10 | 15 | 19;
    roomCode?: string;
    dpUrl?: string;
    isRoomLocked?: boolean;
    roomPasscode?: string;
  }) => Promise<boolean | void> | boolean | void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  coins,
  authToken,
  hasCreatedRoom = false,
  onClose,
  onCreateRoom,
}) => {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [dpUrl, setDpUrl] = useState<string>('');
  const [dpUploading, setDpUploading] = useState(false);
  const [dpProgress, setDpProgress] = useState(0);
  const [lastDpFile, setLastDpFile] = useState<File | null>(null);
  const [category, setCategory] = useState<VoiceRoom['category']>('Popular');
  const [ambiance, setAmbiance] = useState<VoiceRoom['ambiance']>('indigo');
  const [seatCapacity, setSeatCapacity] = useState<10 | 15 | 19>(15);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [roomPasscode, setRoomPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const canAfford = coins >= 500;

  const runDpUpload = async (file: File) => {
    setErrorMsg('');
    setLastDpFile(file);
    setDpUploading(true);
    setDpProgress(10);
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 720,
        quality: 0.84,
        maxCompressedBytes: 520_000,
        onProgress: (pct) => setDpProgress(pct),
      });
      setDpUrl(uploadedUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload selected image.');
    } finally {
      setDpUploading(false);
    }
  };

  const handleDpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void runDpUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAfford || submitting || dpUploading || hasCreatedRoom) return;
    setErrorMsg('');

    const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode && (cleanCode.length < 3 || cleanCode.length > 24)) {
      setErrorMsg('Custom Room ID must be 3 to 24 characters (A-Z, 0-9, -, _).');
      return;
    }
    if (isRoomLocked && roomPasscode.trim().length < 4) {
      setErrorMsg('Enter a 4-digit room password when Lock is enabled.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onCreateRoom({
        title: title.trim() || 'OG VELOCITY Lounge',
        topic: topic.trim() || `${seatCapacity}-Seat Voice Sanctuary · Music & Chat`,
        category,
        ambiance,
        roomType: 'voice',
        seatCapacity,
        roomCode: cleanCode || undefined,
        dpUrl: dpUrl || undefined,
        isRoomLocked,
        roomPasscode: isRoomLocked ? roomPasscode.trim() : undefined,
      });
      if (result !== false) {
        setTitle('');
        setTopic('');
        setRoomCode('');
        setDpUrl('');
        setIsRoomLocked(false);
        setRoomPasscode('');
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-heading"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-indigo-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-violet-400/25 dark:bg-[#11152A] dark:text-white"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
          <h2 id="create-room-heading" className="font-display text-2xl font-bold">
            Create Voice Room
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-amber-400/35 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <span>Permanent Room Setup Fee:</span>
            <span className="inline-flex items-center gap-1.5 font-mono-tabular font-bold">
              <ZayroCoinArt size={15} />
              500 Coins
            </span>
          </div>

          {hasCreatedRoom && (
            <div className="rounded-xl border border-amber-400/45 bg-amber-500/15 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
              Each user can create at most 1 personal Voice Room. Enter or customize your existing room from the Rooms directory.
            </div>
          )}

          {errorMsg && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-500 dark:text-rose-200">
              <span>{errorMsg}</span>
              {lastDpFile && !dpUploading && (
                <button
                  type="button"
                  onClick={() => void runDpUpload(lastDpFile)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold hover:bg-rose-500/30"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* Room DP Cover Upload */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-violet-400/60 bg-violet-50 transition-colors hover:border-violet-500 dark:bg-[#1A203E]"
              title="Upload Room DP / Cover Image"
            >
              {dpUrl ? (
                <img src={dpUrl} alt="Room cover" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-violet-500 dark:text-violet-300" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold">Room Cover / DP</div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Upload a custom room photo saved permanently in your room card (3 MB+ supported).
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={dpUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-violet-600/15 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-600/25 disabled:opacity-50 dark:text-violet-200"
                >
                  {dpUploading ? `Uploading (${dpProgress}%)...` : dpUrl ? 'Change DP' : 'Upload Image'}
                </button>
                {dpUrl && !dpUploading && (
                  <button
                    type="button"
                    onClick={() => setDpUrl('')}
                    className="text-[11px] font-semibold text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {dpUploading && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-violet-500 transition-all duration-200"
                    style={{ width: `${dpProgress}%` }}
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleDpUpload}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="room-title" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Room Name *
            </label>
            <input
              id="room-title"
              type="text"
              required
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., OG Legends Lounge"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room-custom-id" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Custom Room ID (Optional)
              </label>
              <input
                id="room-custom-id"
                type="text"
                maxLength={24}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Auto RM-XXXXXX"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-tabular text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label htmlFor="room-seats" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Seat Capacity
              </label>
              <select
                id="room-seats"
                value={seatCapacity}
                onChange={(e) => setSeatCapacity(Number(e.target.value) as 10 | 15 | 19)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white"
              >
                <option value={10}>10 Seats</option>
                <option value={15}>15 Seats (Standard)</option>
                <option value={19}>19 Seats (Grand)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="room-topic" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Room Topic / Welcome Note
            </label>
            <input
              id="room-topic"
              type="text"
              maxLength={120}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Music, voice chat & live games"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room-category" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Category
              </label>
              <select
                id="room-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as VoiceRoom['category'])}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white"
              >
                <option value="Popular">Popular</option>
                <option value="Music">Music</option>
                <option value="Chats">Chats</option>
                <option value="Teenagers">Teenagers</option>
              </select>
            </div>

            <div>
              <label htmlFor="room-ambiance" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Stage Ambiance
              </label>
              <select
                id="room-ambiance"
                value={ambiance}
                onChange={(e) => setAmbiance(e.target.value as VoiceRoom['ambiance'])}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#090C1C] dark:text-white"
              >
                <option value="indigo">Velvet Indigo</option>
                <option value="saffron">Saffron Gold</option>
                <option value="emerald">Emerald Oasis</option>
                <option value="crimson">Crimson Arena</option>
              </select>
            </div>
          </div>

          {/* Optional Room Lock Password */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#090C1C]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                {isRoomLocked ? (
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>Room Password Lock</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRoomLocked((v) => !v);
                  if (isRoomLocked) setRoomPasscode('');
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                  isRoomLocked
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {isRoomLocked ? 'Locked ON' : 'Public Open'}
              </button>
            </div>
            {isRoomLocked && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={roomPasscode}
                onChange={(e) => setRoomPasscode(e.target.value)}
                placeholder="Enter 4-digit passcode (e.g. 1234)"
                className="mt-2.5 w-full rounded-xl border border-amber-400/45 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:bg-[#141A33] dark:text-white"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-[#1A203E] dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canAfford || submitting || hasCreatedRoom}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/25 hover:brightness-110 disabled:opacity-40"
            >
              {hasCreatedRoom
                ? 'Room Limit Reached (1/1)'
                : submitting
                  ? 'Creating...'
                  : 'Create Room (500 Coins)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
