import { useState, useRef, useEffect, useCallback } from 'react';
import { SubtitleSegment, KineticConfig } from '../types';
import { renderKineticSubtitleOnCanvas } from '../core/canvas-renderer';
import { isSpeechRecognitionSupported } from '../core/speech-transcriber';
import { detectContextEmoji } from '../core/emoji-detector';

interface UseOBSLiveProps {
  segments: SubtitleSegment[];
  setSegments: (segments: SubtitleSegment[]) => void;
  kineticConfig: KineticConfig;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showToast: (msg: string) => void;
}

export function useOBSLive({
  segments,
  setSegments,
  kineticConfig,
  currentTime,
  videoRef,
  showToast
}: UseOBSLiveProps) {
  const [isOBSLiveMode, setIsOBSLiveMode] = useState<boolean>(false);
  const [obsChromaMode, setObsChromaMode] = useState<'transparent' | 'green' | 'magenta' | 'black'>('transparent');
  const [isLiveMicActive, setIsLiveMicActive] = useState<boolean>(false);

  const liveRecognitionRef = useRef<any>(null);
  const obsCanvasRef = useRef<HTMLCanvasElement>(null);

  // Tecla ESC para sair do Modo OBS Live
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOBSLiveMode) {
        setIsOBSLiveMode(false);
        if (liveRecognitionRef.current) {
          liveRecognitionRef.current.stop();
          liveRecognitionRef.current = null;
          setIsLiveMicActive(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOBSLiveMode]);

  // Loop de renderização contínuo do Modo OBS Live
  useEffect(() => {
    if (!isOBSLiveMode) return;

    let animId: number;
    const canvas = obsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderObs = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (obsChromaMode === 'green') {
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (obsChromaMode === 'magenta') {
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (obsChromaMode === 'black') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const activeTime = videoRef.current ? videoRef.current.currentTime : currentTime;

      renderKineticSubtitleOnCanvas(
        ctx,
        null,
        canvas.width,
        canvas.height,
        activeTime,
        segments,
        kineticConfig,
        obsChromaMode === 'transparent'
      );

      animId = requestAnimationFrame(renderObs);
    };

    animId = requestAnimationFrame(renderObs);
    return () => cancelAnimationFrame(animId);
  }, [isOBSLiveMode, obsChromaMode, currentTime, segments, kineticConfig, videoRef]);

  // Alternar microfone ao vivo para OBS
  const toggleLiveMic = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      alert('Reconhecimento de fala não suportado neste navegador. Use Google Chrome ou Edge.');
      return;
    }

    if (isLiveMicActive) {
      if (liveRecognitionRef.current) {
        liveRecognitionRef.current.stop();
        liveRecognitionRef.current = null;
      }
      setIsLiveMicActive(false);
      showToast('Microfone OBS desativado.');
    } else {
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          const transcript = lastResult[0].transcript.trim();
          if (transcript) {
            const now = videoRef.current ? videoRef.current.currentTime : currentTime;
            const words = transcript.split(/\s+/).map((w: string, idx: number) => ({
              id: `live-w-${Date.now()}-${idx}`,
              word: w,
              start: now + idx * 0.25,
              end: now + (idx + 1) * 0.25
            }));
            const emoji = detectContextEmoji(transcript);
            const liveSeg: SubtitleSegment = {
              id: 'live-seg-active',
              start: now,
              end: now + Math.max(2.5, words.length * 0.4),
              text: transcript,
              emoji: emoji || undefined,
              words
            };
            setSegments([...segments.filter(s => s.id !== 'live-seg-active'), liveSeg]);
          }
        };

        recognition.onerror = (e: any) => {
          console.error('Speech recognition error:', e);
        };

        recognition.onend = () => {
          if (isLiveMicActive && liveRecognitionRef.current) {
            try {
              liveRecognitionRef.current.start();
            } catch {
              // Ignore restart error
            }
          }
        };

        recognition.start();
        liveRecognitionRef.current = recognition;
        setIsLiveMicActive(true);
        showToast('🎙️ Microfone ao vivo ATIVO! Suas falas serão legendadas na tela.');
      } catch (err: any) {
        console.error(err);
        alert('Erro ao ativar microfone: ' + (err.message || err));
      }
    }
  }, [isLiveMicActive, segments, setSegments, currentTime, videoRef, showToast]);

  const closeOBS = useCallback(() => {
    setIsOBSLiveMode(false);
    if (liveRecognitionRef.current) {
      liveRecognitionRef.current.stop();
      liveRecognitionRef.current = null;
      setIsLiveMicActive(false);
    }
  }, []);

  return {
    isOBSLiveMode,
    setIsOBSLiveMode,
    obsChromaMode,
    setObsChromaMode,
    isLiveMicActive,
    toggleLiveMic,
    obsCanvasRef,
    closeOBS
  };
}
