import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, RefreshCw, RotateCcw, Send, X } from 'lucide-react'
import { api } from '../../api/client'
import { isoDate } from '../../lib/format'
import { toJpeg, videoDuration } from '../../lib/image'
import { Spinner } from '../../components/ui'

const MAX_SECONDS = 5

type Captured = { blob: Blob; type: 'PHOTO' | 'VIDEO'; url: string; duration?: number }

function pickVideoMime() {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

/** Camera kiểu Locket: chạm để chụp, chế độ video tự dừng ở 5 giây. */
export default function CameraSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [mode, setMode] = useState<'PHOTO' | 'VIDEO'>('PHOTO')
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startStream = useCallback(async () => {
    stopStream()
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: mode === 'VIDEO',
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch {
      setError('Không mở được camera. Hãy cho phép quyền camera, hoặc chọn ảnh/video có sẵn.')
    }
  }, [facing, mode])

  useEffect(() => {
    if (!captured) startStream()
    return stopStream
  }, [startStream, captured])

  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured.url) }, [captured])

  const takePhoto = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    // Cắt vuông ở giữa như Locket
    const side = Math.min(v.videoWidth, v.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(side, 1440)
    const ctx = canvas.getContext('2d')!
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((b) => b && setCaptured({ blob: b, type: 'PHOTO', url: URL.createObjectURL(b) }), 'image/jpeg', 0.88)
    stopStream()
  }

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = pickVideoMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined)
    } catch {
      setError('Trình duyệt không hỗ trợ quay video. Hãy chọn video có sẵn.')
      return
    }
    const chunks: Blob[] = []
    const started = performance.now()
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const duration = Math.min((performance.now() - started) / 1000, MAX_SECONDS)
      const blob = new Blob(chunks, { type: (rec.mimeType || mimeType || 'video/webm').split(';')[0] })
      setRecording(false)
      setProgress(0)
      setCaptured({ blob, type: 'VIDEO', url: URL.createObjectURL(blob), duration })
      stopStream()
    }
    recorderRef.current = rec
    rec.start(250)
    setRecording(true)
    const tick = () => {
      if (rec.state !== 'recording') return
      const t = (performance.now() - started) / 1000
      setProgress(Math.min(t / MAX_SECONDS, 1))
      if (t >= MAX_SECONDS) rec.stop()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const onShutter = () => {
    if (mode === 'PHOTO') takePhoto()
    else if (recording) recorderRef.current?.stop()
    else startRecording()
  }

  const onPickFile = async (file: File) => {
    setError(null)
    if (file.type.startsWith('video/')) {
      const d = await videoDuration(file).catch(() => NaN)
      if (!(d <= MAX_SECONDS + 0.5)) {
        setError(`Video tối đa ${MAX_SECONDS} giây${Number.isFinite(d) ? ` (video này dài ${d.toFixed(1)} giây)` : ''}.`)
        return
      }
      setCaptured({ blob: file, type: 'VIDEO', url: URL.createObjectURL(file), duration: d })
    } else {
      const jpeg = await toJpeg(file, 1440, 0.88, true)
      setCaptured({ blob: jpeg, type: 'PHOTO', url: URL.createObjectURL(jpeg) })
    }
    stopStream()
  }

  const upload = useMutation({
    mutationFn: () => {
      const c = captured!
      const fd = new FormData()
      const ext = c.type === 'PHOTO' ? 'jpg' : c.blob.type.includes('mp4') ? 'mp4' : c.blob.type.includes('quicktime') ? 'mov' : 'webm'
      fd.append('file', c.blob, `moment.${ext}`)
      fd.append('takenOn', isoDate())
      if (c.duration) fd.append('durationSec', c.duration.toFixed(2))
      if (caption.trim()) fd.append('caption', caption.trim())
      return api.post('/api/moments', fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moments'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['habits'] })
      onClose()
    },
  })

  const R = 44, C = 2 * Math.PI * R

  return (
    <div className="camera" role="dialog" aria-label="Chụp khoảnh khắc">
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = '' }} />

      <div className="top">
        <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        {!captured && !recording && (
          <button className="icon-btn" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="Đổi camera"><RefreshCw size={20} /></button>
        )}
        {captured && <span />}
      </div>

      <div className="stage">
        <div className="frame">
          {captured ? (
            captured.type === 'PHOTO'
              ? <img src={captured.url} alt="Ảnh vừa chụp" />
              : <video src={captured.url} autoPlay loop playsInline />
          ) : (
            <video ref={videoRef} className={facing === 'user' ? 'mirror' : ''} playsInline muted autoPlay />
          )}
          {recording && <b className="rec-time">{(progress * MAX_SECONDS).toFixed(1)}s / {MAX_SECONDS}s</b>}
        </div>
      </div>

      <div className="bottom">
        {error && <div className="error" style={{ maxWidth: 420 }}>{error}</div>}
        {upload.error && <div className="error" style={{ maxWidth: 420 }}>{(upload.error as Error).message}</div>}
        {captured ? (
          <>
            <input className="input" style={{ maxWidth: 420, background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none' }}
              placeholder="Thêm chú thích…" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="row" style={{ gap: 28 }}>
              <button className="icon-btn" style={{ width: 56, height: 56 }} onClick={() => { setCaptured(null); setCaption('') }} aria-label="Chụp lại"><RotateCcw size={22} /></button>
              <button className="send-btn" onClick={() => upload.mutate()} disabled={upload.isPending} aria-label="Lưu">
                {upload.isPending ? <Spinner /> : <Send size={30} />}
              </button>
              <span style={{ width: 56 }} />
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ gap: 28 }}>
              <button className="icon-btn" style={{ width: 56, height: 56 }} onClick={() => fileRef.current?.click()} aria-label="Chọn từ thư viện" disabled={recording}><ImagePlus size={22} /></button>
              <button className={`shutter ${mode === 'VIDEO' ? 'video' : ''} ${recording ? 'recording' : ''}`} onClick={onShutter}
                aria-label={mode === 'PHOTO' ? 'Chụp' : recording ? 'Dừng' : 'Quay'}>
                <i />
                {recording && (
                  <svg className="ring" width="88" height="88" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r={R} fill="none" stroke="#ffd60a" strokeWidth="6" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
                  </svg>
                )}
              </button>
              <span style={{ width: 56 }} />
            </div>
            {!recording && (
              <div className="mode-switch">
                <button className={mode === 'PHOTO' ? 'on' : ''} onClick={() => setMode('PHOTO')}>ẢNH</button>
                <button className={mode === 'VIDEO' ? 'on' : ''} onClick={() => setMode('VIDEO')}>VIDEO 5S</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
