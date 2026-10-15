import { useState, useRef, useEffect, useCallback } from 'react';
import { SubtitleSegment, KineticConfig } from '../types';
import { renderKineticSubtitleOnCanvas } from '../core/canvas-renderer';

export function useVideoPlayback(
  segments: SubtitleSegment[],
  kineticConfig: KineticConfig
) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('video-demo.mp4');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(11.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Alterna Play / Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (videoSrc && video) {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [videoSrc]);

  // Busca tempo específico
  const seek = useCallback((time: number) => {
    const target = Math.max(0, Math.min(time, duration));
    setCurrentTime(target);
    if (videoRef.current && videoSrc) {
      videoRef.current.currentTime = target;
    }
  }, [duration, videoSrc]);

  // Alterna Mudo
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(prev => !prev);
  }, [isMuted]);

  // Loop de renderização no Canvas Preview
  const renderFrame = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    const time = videoSrc && video ? video.currentTime : currentTime;

    renderKineticSubtitleOnCanvas(
      ctx,
      videoSrc && video ? video : null,
      canvas.width,
      canvas.height,
      time,
      segments,
      kineticConfig
    );
  }, [videoSrc, currentTime, segments, kineticConfig]);

  // Loop contínuo quando estiver dando play
  useEffect(() => {
    if (isPlaying) {
      const loop = () => {
        if (!videoSrc) {
          setCurrentTime(prev => {
            const next = prev + 0.033;
            if (next >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        } else if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
        renderFrame();
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      renderFrame();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, videoSrc, duration, renderFrame]);

  // Atualiza tela ao alterar parâmetros estáticos
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  return {
    videoSrc,
    setVideoSrc,
    videoName,
    setVideoName,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isMuted,
    aspectRatio,
    setAspectRatio,
    videoRef,
    previewCanvasRef,
    togglePlay,
    seek,
    toggleMute,
    renderFrame
  };
}
