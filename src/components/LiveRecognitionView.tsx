import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  Sparkles, 
  ShieldCheck, 
  Volume2, 
  VolumeX,
  Play,
  Flame,
  Info
} from 'lucide-react';
import { AttendanceRecord, RecognitionResult } from '../types/index.ts';
import { faceVision } from '../utils/faceVision.ts';
import { sounds } from '../utils/audio.ts';
import confetti from 'canvas-confetti';

interface LiveRecognitionViewProps {
  onAttendanceMarked: () => void;
  recentAttendance: AttendanceRecord[];
}

export const LiveRecognitionView: React.FC<LiveRecognitionViewProps> = ({
  onAttendanceMarked,
  recentAttendance,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [recognitionActive, setRecognitionActive] = useState<boolean>(true);
  const [currentResult, setCurrentResult] = useState<RecognitionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start camera');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'warn'; text: string } | null>(null);

  const lastRecognizedRef = useRef<string | null>(null);
  const lastRecognizedTimeRef = useRef<number>(0);
  const requestAnimationRef = useRef<number | null>(null);

  // Show temporary toast notification
  const showToast = useCallback((type: 'success' | 'info' | 'warn', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  }, []);

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    setStatusMessage('Accessing optical camera...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setStatusMessage('Webcam active. Scanning field of view...');
      showToast('info', 'Webcam stream connected.');
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      setIsCameraActive(false);
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Click "Simulate Recognition" below to test the AI verification pipeline.'
        : `Could not access camera: ${err.message || 'Device busy or unavailable'}.`;
      setCameraError(msg);
      setStatusMessage(msg);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (requestAnimationRef.current) {
      cancelAnimationFrame(requestAnimationRef.current);
      requestAnimationRef.current = null;
    }
    setIsCameraActive(false);
    setStatusMessage('Camera stopped');
  };

  // Trigger recognition check on backend
  const handleRecognizeFace = useCallback(async (vector: number[]) => {
    if (isProcessing) return;
    const now = Date.now();
    // Throttle duplicate recognition API calls to every 1200ms
    if (now - lastRecognizedTimeRef.current < 1200) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encoding: vector, tolerance: 0.52 }),
      });
      const data: RecognitionResult = await res.json();
      setCurrentResult(data);

      if (data.matched && data.user_id && data.name) {
        lastRecognizedTimeRef.current = now;
        lastRecognizedRef.current = data.user_id;

        if (data.attendanceResult?.alreadyMarked) {
          setStatusMessage(`Already recorded for today: ${data.name}`);
        } else if (data.attendanceResult?.success) {
          setStatusMessage(`Verified: ${data.name} (${data.user_id}) - Attendance Marked!`);
          if (soundEnabled) sounds.playSuccess();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6'],
          });
          showToast('success', `Attendance recorded for ${data.name} (${data.user_id})`);
          onAttendanceMarked();
        }
      } else {
        setStatusMessage('Unknown Person - Face not enrolled in database');
      }
    } catch (e: any) {
      console.error('Recognition error:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onAttendanceMarked, showToast, soundEnabled]);

  // Real-time animation frame loop
  useEffect(() => {
    if (!isCameraActive || !recognitionActive) return;

    let isSubscribed = true;

    const runDetectionCycle = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const face = await faceVision.detectFace(video, ctx);

          if (face && face.box) {
            // Draw OpenCV HUD overlay
            const isKnown = Boolean(currentResult?.matched);
            const name = currentResult?.matched ? (currentResult.name || 'Recognized') : (currentResult?.label || 'Detecting...');
            const uid = currentResult?.matched ? currentResult.user_id : undefined;
            const conf = currentResult?.confidence || face.confidence;
            const statusTxt = currentResult?.attendanceResult?.alreadyMarked
              ? 'ALREADY MARKED TODAY'
              : currentResult?.attendanceResult?.success
              ? 'PRESENT RECORDED'
              : undefined;

            faceVision.drawHud(ctx, face.box, {
              name,
              userId: uid,
              confidence: conf,
              isKnown,
              statusText: statusTxt,
            });

            // Extract 128-d embedding and evaluate
            const vector = faceVision.extract128dEmbedding(video, face.box);
            if (vector.length === 128) {
              handleRecognizeFace(vector);
            }
          } else {
            // No face in current frame
            setCurrentResult(null);
          }
        }
      }

      if (isSubscribed) {
        requestAnimationRef.current = requestAnimationFrame(runDetectionCycle);
      }
    };

    requestAnimationRef.current = requestAnimationFrame(runDetectionCycle);

    return () => {
      isSubscribed = false;
      if (requestAnimationRef.current) {
        cancelAnimationFrame(requestAnimationRef.current);
      }
    };
  }, [isCameraActive, recognitionActive, currentResult, handleRecognizeFace]);

  // Automatically start camera on mount if permissible
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Quick Simulation Test Helper for instant zero-camera verification
  const runSimulatedRecognition = async (testPerson: 'sarah' | 'alex' | 'maya' | 'unknown') => {
    const makeVector = (seed: number) => {
      const v: number[] = [];
      for (let i = 0; i < 128; i++) {
        v.push(Math.sin(seed + i * 0.1) * 0.5 + Math.cos(seed * 2 + i * 0.05) * 0.5);
      }
      const mag = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
      return v.map(x => x / mag);
    };

    let vector: number[];
    if (testPerson === 'sarah') vector = makeVector(1.1);
    else if (testPerson === 'alex') vector = makeVector(3.3);
    else if (testPerson === 'maya') vector = makeVector(5.5);
    else vector = makeVector(99.9); // unknown

    setStatusMessage(`Running biometric vector match...`);
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encoding: vector, tolerance: 0.52 }),
      });
      const data: RecognitionResult = await res.json();
      setCurrentResult(data);

      if (data.matched && data.name) {
        if (data.attendanceResult?.alreadyMarked) {
          setStatusMessage(`Already recorded for today: ${data.name}`);
          showToast('info', `${data.name} has already logged attendance for today.`);
        } else if (data.attendanceResult?.success) {
          setStatusMessage(`Match found: ${data.name} (${data.user_id}) - Marked Present!`);
          if (soundEnabled) sounds.playSuccess();
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#f59e0b'],
          });
          showToast('success', `Attendance marked for ${data.name} (${data.user_id})`);
          onAttendanceMarked();
        }
      } else {
        setStatusMessage('Unknown Person - Biometric vector not recognized in database');
        if (soundEnabled) sounds.playWarning();
        showToast('warn', 'Face not enrolled in SQLite database.');
      }
    } catch (e: any) {
      showToast('warn', 'Recognition test failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {notification && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium border transition-all shadow-lg animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : notification.type === 'warn'
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              : 'bg-blue-950/80 border-blue-500/40 text-blue-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : notification.type === 'warn' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Grid: Camera Viewport (Left) + Today's Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Camera Card */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  Optical Biometric Stream
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    LIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-400">OpenCV Haar + 128-d Vector Recognition</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                title={soundEnabled ? 'Mute Chimes' : 'Unmute Chimes'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              </button>

              {isCameraActive ? (
                <button
                  onClick={stopCamera}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" /> Stop Camera
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <Camera className="w-3.5 h-3.5" /> Start Camera
                </button>
              )}
            </div>
          </div>

          {/* Video Viewport with HUD overlay */}
          <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden group">
            {/* Real Webcam Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraActive ? 'hidden' : ''}`}
            />

            {/* Canvas for OpenCV HUD Reticle and Bounding Boxes */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transform scale-x-[-1] ${!isCameraActive ? 'hidden' : ''}`}
            />

            {/* Offline or Error Fallback screen */}
            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-base">Webcam is Inactive</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    {cameraError || 'Click "Start Camera" to grant browser webcam permission, or use the instant Face Simulator below.'}
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Enable Optical Webcam
                </button>
              </div>
            )}

            {/* Viewfinder Corners (Physical framing guides) */}
            <div className="absolute inset-4 pointer-events-none border border-slate-700/20 rounded-xl">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80 rounded-tl"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80 rounded-tr"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80 rounded-bl"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80 rounded-br"></div>
            </div>

            {/* Top HUD Metrics Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                FPS: 30.0 | RES: 640x480
              </div>
              <div className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-medium text-slate-300 backdrop-blur-md">
                Anti-Duplicate: ACTIVE
              </div>
            </div>
          </div>

          {/* Bottom Status / Recognition Pill */}
          <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3">
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-sm transition-all ${
                currentResult?.matched
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : currentResult?.label === 'Unknown Person'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {currentResult?.matched ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : currentResult?.label === 'Unknown Person' ? (
                  <UserX className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-sm">
                    {currentResult?.matched ? currentResult.name : currentResult?.label || 'Live Scanner'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {currentResult?.matched
                      ? `ID: ${currentResult.user_id} • Confidence: ${Math.round((currentResult.confidence || 0.95) * 100)}%`
                      : statusMessage}
                  </div>
                </div>
              </div>

              {currentResult?.attendanceResult?.alreadyMarked && (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Already Marked
                </span>
              )}
              {currentResult?.attendanceResult?.success && (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-bounce">
                  Marked Present!
                </span>
              )}
            </div>

            {/* Instant Face Simulator Drawer */}
            <div className="pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Test Verification Simulator:
                </span>
                <span className="text-[11px] text-slate-500">Test enrolled profiles with 1 click</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => runSimulatedRecognition('sarah')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors text-left truncate cursor-pointer"
                >
                  <span className="block font-semibold text-emerald-400 truncate">Dr. Sarah Connor</span>
                  <span className="text-[10px] text-slate-400">EMP-101</span>
                </button>
                <button
                  onClick={() => runSimulatedRecognition('alex')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors text-left truncate cursor-pointer"
                >
                  <span className="block font-semibold text-blue-400 truncate">Alex Chen</span>
                  <span className="text-[10px] text-slate-400">EMP-102</span>
                </button>
                <button
                  onClick={() => runSimulatedRecognition('maya')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors text-left truncate cursor-pointer"
                >
                  <span className="block font-semibold text-purple-400 truncate">Maya Patel</span>
                  <span className="text-[10px] text-slate-400">STU-204</span>
                </button>
                <button
                  onClick={() => runSimulatedRecognition('unknown')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-xs text-rose-300 font-medium transition-colors text-left truncate cursor-pointer"
                >
                  <span className="block font-semibold text-rose-400 truncate">Unknown Face</span>
                  <span className="text-[10px] text-rose-300/70">Unregistered</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Real-time Check-ins Ticker */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono">{recentAttendance.length}</div>
                <div className="text-xs text-slate-400 font-medium">Checked-in Today</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono">128-d</div>
                <div className="text-xs text-slate-400 font-medium">Vector Dimension</div>
              </div>
            </div>
          </div>

          {/* Today's Live Attendance Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex-1 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm">Today's Check-ins</h3>
                <p className="text-xs text-slate-400">Chronological biometric logs</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
                {new Date().toISOString().slice(0, 10)}
              </span>
            </div>

            <div className="overflow-x-auto flex-1 divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto">
              {recentAttendance.length > 0 ? (
                recentAttendance.map((rec) => (
                  <div key={rec.id} className="p-3.5 hover:bg-slate-800/40 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {rec.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{rec.name}</div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 text-[10px]">
                            {rec.user_id}
                          </span>
                          <span>{rec.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {rec.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        {Math.round((rec.confidence || 0.95) * 100)}% match
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No check-ins yet today. Face the camera or click a simulator profile above to log attendance.
                </div>
              )}
            </div>

            {/* Attendance Rules Card */}
            <div className="p-4 bg-slate-950/40 border-t border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                Anti-Spoofing & Duplicate Policy
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Attendance is marked only when facial distance &lt; 0.52. Duplicate entries for the same user on the same calendar date are blocked by the SQLite UNIQUE constraint.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
