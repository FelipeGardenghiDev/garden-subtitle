import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Play, Pause, RotateCcw, Volume2, VolumeX,
  Upload, Download, FileText, Film, Sliders, Type,
  Smile, Plus, Trash2, Check, ArrowRight, Wand2, Cpu,
  Mic, Layers, Zap, Radio, X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  SubtitleSegment, 
  KineticConfig, 
  KineticStyle
} from './types';
import { KINETIC_PRESETS } from './core/kinetic-styles';
import { autoAssignEmojis, detectContextEmoji } from './core/emoji-detector';
import { renderKineticSubtitleOnCanvas } from './core/canvas-renderer';
import { 
  exportToSRT, 
  exportToVTT, 
  exportToGardenCut, 
  exportVideoWithBurnIn,
  exportToASS,
  exportTransparentOverlay
} from './core/exporters';
import { DEMO_SUBTITLE_SEGMENTS, generateSegmentsFromText } from './core/demo-data';
import { isNonNativeFormat, transcodeOrRemuxVideo, convertWebMToMP4 } from './core/ffmpeg-transcoder';
import { parseSubtitleFile, createWordTimestamps } from './core/subtitle-parsers';
import { isSpeechRecognitionSupported, transcribeMediaElement } from './core/speech-transcriber';
import { exportToFCPXML, exportToPremiereProject, exportToAfterEffectsScript } from './core/nle-exporters';

export function App() {
  // Estado do Vídeo
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('video-demo.mp4');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(11.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  // Estado das Legendas
  const [segments, setSegments] = useState<SubtitleSegment[]>(DEMO_SUBTITLE_SEGMENTS);
  const [activeTab, setActiveTab] = useState<'editor' | 'styles' | 'export'>('editor');

  // Configuração Cinética Ativa
  const [kineticConfig, setKineticConfig] = useState<KineticConfig>(KINETIC_PRESETS.hormozi);

  // Estado de Exportação
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal para colar texto
  const [isTextModalOpen, setIsTextModalOpen] = useState<boolean>(false);
  const [rawTextInput, setRawTextInput] = useState<string>('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Estado de Transcodificação / Remuxing FFmpeg Wasm
  const [isTranscoding, setIsTranscoding] = useState<boolean>(false);
  const [transcodeProgress, setTranscodeProgress] = useState<number>(0);
  const [transcodeStatus, setTranscodeStatus] = useState<string>('');
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);

  // Estados Adicionais: Drag & Drop, Transcrição IA, Emojis
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [liveTranscriptionText, setLiveTranscriptionText] = useState<string>('');
  const [editingEmojiSegmentId, setEditingEmojiSegmentId] = useState<string | null>(null);

  // Estados OBS Studio Live Mode & Broadcast
  const [isOBSLiveMode, setIsOBSLiveMode] = useState<boolean>(false);
  const [obsChromaMode, setObsChromaMode] = useState<'transparent' | 'green' | 'magenta' | 'black'>('transparent');
  const [isLiveMicActive, setIsLiveMicActive] = useState<boolean>(false);
  const liveRecognitionRef = useRef<any>(null);
  const obsCanvasRef = useRef<HTMLCanvasElement>(null);

  // Executa transcode ou remuxing de um arquivo usando FFmpeg Wasm
  const processTranscode = async (file: File) => {
    setIsTranscoding(true);
    setTranscodeProgress(0);
    setTranscodeStatus('Carregando motor FFmpeg WebAssembly...');

    try {
      const result = await transcodeOrRemuxVideo(file, (pct, msg) => {
        setTranscodeProgress(pct);
        setTranscodeStatus(msg);
      });

      setVideoSrc(result.url);
      setVideoName(result.fileName);
      setCurrentTime(0);
      setIsPlaying(false);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast(result.isRemuxed
        ? `⚡ Remuxing concluído! "${result.fileName}" pronto para reprodução.`
        : `🎉 Vídeo convertido para MP4 com sucesso via WebAssembly!`
      );
    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar vídeo no navegador: ' + (err.message || err));
    } finally {
      setIsTranscoding(false);
      setTranscodeProgress(0);
    }
  };

  // Importar arquivo de legenda (.srt, .vtt, .garden-sub)
  const loadSubtitleFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSubtitleFile(file.name, text);
      if (parsed.length > 0) {
        setSegments(parsed);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        showToast(`🎉 ${parsed.length} blocos de legenda importados de "${file.name}"!`);
        setActiveTab('editor');
      } else {
        alert('Nenhuma legenda válida encontrada no arquivo.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao ler arquivo de legenda: ' + err.message);
    }
  };

  const handleSubFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadSubtitleFromFile(file);
    if (e.target) e.target.value = '';
  };

  // Carregar arquivo de mídia a partir de um File object (usado tanto por upload quanto por drag & drop)
  const loadMediaFile = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (['srt', 'vtt', 'garden-sub', 'json'].includes(ext)) {
      await loadSubtitleFromFile(file);
      return;
    }

    setLastUploadedFile(file);

    // Se o formato for sabidamente não-nativo (.mkv, .avi, .wmv, .flv, .mts, etc.)
    if (isNonNativeFormat(file.name)) {
      await processTranscode(file);
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);
    showToast(`Mídia "${file.name}" carregada com sucesso!`);
  };

  // Upload convencional via botão
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadMediaFile(file);
    if (e.target) e.target.value = '';
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await loadMediaFile(file);
    }
  };

  // Transcrever áudio por IA nativa no navegador
  const handleTranscribeWithAI = async () => {
    if (!videoRef.current || !videoSrc) {
      alert('Carregue um vídeo ou áudio primeiro para transcrever.');
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert('O reconhecimento de fala nativo não está disponível neste navegador. Use o Google Chrome ou Edge.');
      return;
    }

    try {
      setIsTranscribingAudio(true);
      setLiveTranscriptionText('Iniciando escuta e alinhamento...');
      showToast('🎙️ Ouvindo áudio e gerando legendas cinéticas...');

      const generated = await transcribeMediaElement(videoRef.current, (text) => {
        setLiveTranscriptionText(text);
      });

      if (generated.length > 0) {
        setSegments(generated);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        showToast(`🎉 IA transcreveu ${generated.length} segmentos com sucesso!`);
        setActiveTab('editor');
      } else {
        showToast('Nenhuma fala detectada no áudio.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao transcrever áudio: ' + (err.message || err));
    } finally {
      setIsTranscribingAudio(false);
      setLiveTranscriptionText('');
    }
  };

  // Selecionar emoji manualmente para um segmento
  const handleSelectEmoji = (segmentId: string, emoji: string | null) => {
    setSegments(prev => prev.map(s => {
      if (s.id === segmentId) {
        return { ...s, emoji: emoji || undefined };
      }
      return s;
    }));
    setEditingEmojiSegmentId(null);
    showToast(emoji ? `Emoji ${emoji} atualizado!` : 'Emoji removido.');
  };

  // Atualizar texto do segmento em tempo real
  const handleUpdateSegmentText = (segmentId: string, newText: string) => {
    setSegments(prev => prev.map(s => {
      if (s.id === segmentId) {
        const segStart = s.start;
        const segEnd = s.end;
        const words = createWordTimestamps(newText, segStart, segEnd, segmentId);
        return {
          ...s,
          text: newText,
          words,
          emoji: s.emoji || detectContextEmoji(newText) || undefined
        };
      }
      return s;
    }));
  };

  // Carregar vídeo demo interativo procedural
  const handleLoadDemo = () => {
    setVideoSrc(null); // Usará background dinâmico do Canvas
    setVideoName('video-demo-hormozi.mp4');
    setSegments(DEMO_SUBTITLE_SEGMENTS);
    setDuration(11.5);
    setCurrentTime(0);
    setIsPlaying(false);
    showToast('Modo demonstração ativado com legendas de exemplo!');
  };

  // Sincronização do Player de Vídeo
  const togglePlay = () => {
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
      // Modo procedural/sem arquivo de vídeo
      setIsPlaying(prev => !prev);
    }
  };

  // Loop de Renderização em Tempo Real no Canvas Preview
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

  // Loop contínuo quando estiver tocando
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

  // Atualizar quando mudar de tempo ou configuração
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

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

  // Loop de renderização contínuo do Modo OBS Live (Overlay limpo / Chroma)
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
  }, [isOBSLiveMode, obsChromaMode, currentTime, segments, kineticConfig]);

  // Alternar microfone ao vivo para OBS
  const toggleLiveMic = () => {
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
            setSegments(prev => {
              const filtered = prev.filter(s => s.id !== 'live-seg-active');
              return [...filtered, liveSeg];
            });
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
  };

  // Trocar Preset de Estilo
  const handleSelectPreset = (style: KineticStyle) => {
    setKineticConfig(KINETIC_PRESETS[style]);
    showToast(`Estilo alterado para ${style.toUpperCase()}`);
  };

  // Auto-detectar emojis em toda a trilha
  const handleAutoEmojis = () => {
    const updated = autoAssignEmojis(segments);
    setSegments(updated);
    showToast('✨ Emojis contextuais adicionados automaticamente!');
  };

  // Criar segmentos a partir de texto colado
  const handleConvertText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTextInput.trim()) return;
    const newSegments = generateSegmentsFromText(rawTextInput, kineticConfig.maxWordsPerLine || 4);
    const withEmojis = autoAssignEmojis(newSegments);
    setSegments(withEmojis);
    if (withEmojis.length > 0) {
      setDuration(withEmojis[withEmojis.length - 1].end + 0.5);
    }
    setIsTextModalOpen(false);
    setRawTextInput('');
    showToast('Legendas geradas a partir do texto com sucesso!');
  };

  // MODO 1: Exportar Vídeo com Legenda Queimada (Burn-in)
  const handleExportBurnInVideo = async (forceUniversalMP4: boolean = false) => {
    if (!videoSrc || !videoRef.current) {
      alert('Por favor, carregue um arquivo de vídeo para gravar as legendas no vídeo final.');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);
      setIsPlaying(false);

      const finalBlob = await exportVideoWithBurnIn(
        videoRef.current,
        segments,
        kineticConfig,
        (pct) => setExportProgress(pct)
      );

      let outputBlob = finalBlob;
      let ext = finalBlob.type.includes('mp4') ? 'mp4' : 'webm';

      // Se o usuário solicitou explicitamente MP4 Universal e o navegador gerou WebM
      if (forceUniversalMP4 && ext !== 'mp4') {
        showToast('Convertendo vídeo para MP4 Universal via FFmpeg Wasm...');
        outputBlob = await convertWebMToMP4(finalBlob, videoName, (pct) => setExportProgress(pct));
        ext = 'mp4';
      }

      // Baixar o vídeo final gravado
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garden_subtitle_${videoName.replace(/\.[^/.]+$/, '')}_legendado.${ext}`;
      a.click();

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      showToast('🎉 Vídeo legendado exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar vídeo: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // MODO 2A: Exportar para GardenCut (.garden-sub)
  const handleExportGardenCut = () => {
    const project = exportToGardenCut(segments, kineticConfig, duration);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.garden-sub`;
    a.click();
    showToast('Projeto .garden-sub pronto para importação no GardenCut!');
  };

  // MODO 2B: Exportar SRT
  const handleExportSRT = () => {
    const srtContent = exportToSRT(segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.srt`;
    a.click();
    showToast('Arquivo .SRT baixado com sucesso!');
  };

  // MODO 2C: Exportar VTT
  const handleExportVTT = () => {
    const vttContent = exportToVTT(segments);
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.vtt`;
    a.click();
    showToast('Arquivo .VTT baixado com sucesso!');
  };

  // MODO 1C: Exportar Legenda em Fundo Transparente (Alpha WebM Overlay)
  const handleExportTransparentOverlay = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      setIsPlaying(false);
      showToast('Renderizando overlay transparente (Alpha WebM)...');

      const w = aspectRatio === '9:16' ? 720 : 1280;
      const h = aspectRatio === '9:16' ? 1280 : 720;

      const blob = await exportTransparentOverlay(
        segments,
        kineticConfig,
        duration,
        w,
        h,
        (pct) => setExportProgress(pct)
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garden_subtitle_${videoName.replace(/\.[^/.]+$/, '')}_overlay_transparente.webm`;
      a.click();

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      showToast('🎉 Overlay transparente exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar overlay transparente: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // MODO 2D: Exportar ASS (Advanced SubStation Alpha)
  const handleExportASS = () => {
    const w = aspectRatio === '9:16' ? 1080 : 1920;
    const h = aspectRatio === '9:16' ? 1920 : 1080;
    const assContent = exportToASS(segments, kineticConfig, w, h);
    const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.ass`;
    a.click();
    showToast('Arquivo de legendas avançadas .ASS baixado com sucesso!');
  };

  // MODO 3A: Exportar Projeto Adobe Premiere Pro (.prproj)
  const handleExportPremiere = async () => {
    try {
      const w = aspectRatio === '9:16' ? 1080 : 1920;
      const h = aspectRatio === '9:16' ? 1920 : 1080;
      const blob = await exportToPremiereProject(segments, kineticConfig, videoName, duration, w, h, 30);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, '')}_premiere.prproj`;
      a.click();
      URL.revokeObjectURL(url);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast('🎬 Projeto Adobe Premiere (.prproj) gerado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gerar projeto Premiere: ' + (err.message || err));
    }
  };

  // MODO 3B: Exportar Timeline Universal XML (DaVinci Resolve / Sony Vegas Pro / Final Cut Pro)
  const handleExportFCPXML = () => {
    try {
      const w = aspectRatio === '9:16' ? 1080 : 1920;
      const h = aspectRatio === '9:16' ? 1920 : 1080;
      const xmlContent = exportToFCPXML(segments, kineticConfig, videoName, duration, w, h, 30);
      const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, '')}_timeline.xml`;
      a.click();
      URL.revokeObjectURL(url);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast('🎞️ Timeline XML exportada para DaVinci Resolve, Sony Vegas e Final Cut!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar XML: ' + (err.message || err));
    }
  };

  // MODO 3C: Exportar Script Adobe After Effects (.jsx)
  const handleExportAfterEffects = () => {
    try {
      const w = aspectRatio === '9:16' ? 1080 : 1920;
      const h = aspectRatio === '9:16' ? 1920 : 1080;
      const scriptContent = exportToAfterEffectsScript(segments, kineticConfig, videoName, duration, w, h, 30);
      const blob = new Blob([scriptContent], { type: 'text/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, '')}_subtitles.jsx`;
      a.click();
      URL.revokeObjectURL(url);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast('⚡ Script After Effects (.jsx) exportado! Execute em Arquivo > Scripts no AE.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar script After Effects: ' + (err.message || err));
    }
  };

  // Formatação de Tempo (00:00.0)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay Visual de Drag & Drop */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-500 pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-white">Solte o arquivo para carregar</h2>
          <p className="text-sm text-slate-400 mt-1 text-center max-w-md">
            Vídeos (.mp4, .webm, .mov, .mkv, .avi), Áudios (.mp3, .wav, .m4a) ou Legendas (.srt, .vtt, .garden-sub)
          </p>
        </div>
      )}

      {/* Toast Notificação */}
      {statusMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header Superior */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
              GS
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                Garden Subtitle
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  v0.2.0 &middot; 100% Web
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Estúdio Web de Legendas Cinéticas & Word-by-Word</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => subFileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 transition cursor-pointer"
              title="Importar arquivo .SRT, .VTT ou .GARDEN-SUB"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Importar Legenda</span>
            </button>
            <input
              type="file"
              ref={subFileInputRef}
              onChange={handleSubFileUpload}
              accept=".srt,.vtt,.garden-sub,.json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subir Mídia</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="video/*,audio/*,.mp4,.webm,.mov,.m4v,.ogg,.ogv,.mkv,.avi,.flv,.wmv,.mts,.mp3,.wav,.m4a,.aac"
              className="hidden"
            />

            <button
              onClick={handleLoadDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Usar Demo</span>
            </button>

            <button
              onClick={() => setIsOBSLiveMode(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-xs font-bold text-purple-300 transition cursor-pointer"
              title="Abrir Modo Live Overlay para OBS Studio e Streaming"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Modo OBS Studio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Área Principal de Trabalho (Split Screen) */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            COLUNA ESQUERDA: PLAYER DE VÍDEO & PREVIEW DAS LEGENDAS (CANVAS 60FPS)
        ========================================================================= */}
        <section className="lg:col-span-6 flex flex-col items-center gap-4">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col items-center">
            {/* Controles de Formato (9:16 vs 16:9) */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 truncate max-w-[200px]" title={videoName}>
                🎬 {videoName}
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setAspectRatio('9:16')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    aspectRatio === '9:16' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  9:16 (Reels/TikTok)
                </button>
                <button
                  onClick={() => setAspectRatio('16:9')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    aspectRatio === '16:9' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  16:9 (YouTube)
                </button>
              </div>
            </div>

            {/* Container do Vídeo / Canvas de Legendas */}
            <div className="relative my-3 flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800/80">
              <canvas
                ref={previewCanvasRef}
                width={aspectRatio === '9:16' ? 720 : 1280}
                height={aspectRatio === '9:16' ? 1280 : 720}
                className="max-h-[520px] w-auto object-contain cursor-pointer"
                onClick={togglePlay}
              />

              {/* Elemento de Vídeo oculto usado para decodificação */}
              {videoSrc && (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  muted={isMuted}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    setDuration(v.duration || 10);
                  }}
                  onError={() => {
                    if (lastUploadedFile && !isTranscoding) {
                      showToast('⚠️ Codec não suportado nativamente. Convertendo via FFmpeg WebAssembly...');
                      processTranscode(lastUploadedFile);
                    } else {
                      showToast('⚠️ O navegador não conseguiu decodificar esta mídia nativamente.');
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}

              {/* Botão Play flutuante central quando pausado */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 flex items-center justify-center text-white hover:scale-110 transition shadow-2xl cursor-pointer"
                >
                  <Play className="w-6 h-6 ml-1 fill-white" />
                </button>
              )}
            </div>

            {/* Barra de Progresso / Scrubbing Timeline */}
            <div className="w-full space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-white font-bold">{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.05"
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) {
                    videoRef.current.currentTime = val;
                  }
                  renderFrame();
                }}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              {/* Controles de Transporte */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-white transition cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTime(0);
                      if (videoRef.current) videoRef.current.currentTime = 0;
                      renderFrame();
                    }}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Reiniciar vídeo"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-[11px] text-slate-400">
                  Estilo: <strong className="text-emerald-400 uppercase">{kineticConfig.style}</strong>
                </div>
              </div>
            </div>

            {/* Barra de Ação de Transcrição por IA */}
            <div className="w-full mt-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isTranscribingAudio ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Transcrição com IA Local
                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-mono">pt-BR</span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isTranscribingAudio 
                      ? (liveTranscriptionText ? `Ouvindo: "${liveTranscriptionText}"` : 'Escutando fala do vídeo em tempo real...')
                      : 'Gera as palavras e timestamps automaticamente a partir da fala'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleTranscribeWithAI}
                disabled={isTranscribingAudio}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                  isTranscribingAudio 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' 
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isTranscribingAudio ? 'Transcrevendo...' : 'Transcrever Áudio'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            COLUNA DIREITA: EDITOR DE LEGENDAS, ESTILOS CINÉTICOS & EXPORTAÇÃO
        ========================================================================= */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          {/* Abas Superiores do Painel */}
          <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-lg">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'editor' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>1. Legendas & Palavras</span>
            </button>

            <button
              onClick={() => setActiveTab('styles')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'styles' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>2. Estilos Cinéticos</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'export' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>3. Exportar</span>
            </button>
          </div>

          {/* =========================================================================
              ABA 1: EDITOR DE LEGENDAS WORD-BY-WORD
          ========================================================================= */}
          {activeTab === 'editor' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Type className="w-4 h-4 text-emerald-400" />
                    Editor de Falas e Palavras
                  </h3>
                  <p className="text-[10px] text-slate-400">Word-level timestamps & emojis contextuais</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleAutoEmojis}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] font-bold transition cursor-pointer"
                    title="Detecta palavras-chave e adiciona emojis correspondentes automaticamente"
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>Auto Emojis</span>
                  </button>

                  <button
                    onClick={() => setIsTextModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Colar Texto</span>
                  </button>
                </div>
              </div>

              {/* Lista de Segmentos */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {segments.map((seg, segIdx) => {
                  const isCurrentActive = currentTime >= seg.start && currentTime <= seg.end;
                  return (
                    <div
                      key={seg.id}
                      className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                        isCurrentActive 
                          ? 'bg-slate-950 border-emerald-500/50 shadow-lg shadow-emerald-500/5' 
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                            {formatTime(seg.start)} ➔ {formatTime(seg.end)}
                          </span>

                          {/* Seletor Manual de Emoji */}
                          <div className="relative">
                            <button
                              onClick={() => setEditingEmojiSegmentId(prev => prev === seg.id ? null : seg.id)}
                              className="text-sm px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition cursor-pointer flex items-center gap-1"
                              title="Clique para escolher ou trocar o emoji deste bloco"
                            >
                              <span>{seg.emoji || '➕'}</span>
                            </button>

                            {editingEmojiSegmentId === seg.id && (
                              <div className="absolute left-0 top-8 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl flex flex-wrap gap-1.5 w-60">
                                {['🔥', '💰', '💡', '🚀', '🎯', '⚡', '🤯', '👏', '📈', '💎', '❤️', '👑', '🎬', '✨', '🏆', '👀'].map(em => (
                                  <button
                                    key={em}
                                    onClick={() => handleSelectEmoji(seg.id, em)}
                                    className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-emerald-500/20 hover:scale-110 transition text-base flex items-center justify-center cursor-pointer"
                                  >
                                    {em}
                                  </button>
                                ))}
                                <button
                                  onClick={() => handleSelectEmoji(seg.id, null)}
                                  className="w-full mt-1 py-1 rounded-lg bg-slate-950 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold transition cursor-pointer"
                                >
                                  Remover Emoji ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setCurrentTime(seg.start);
                              if (videoRef.current) videoRef.current.currentTime = seg.start;
                              renderFrame();
                            }}
                            className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                          >
                            Ir para
                          </button>
                          <button
                            onClick={() => setSegments(prev => prev.filter(s => s.id !== seg.id))}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            title="Remover bloco"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Texto editável do bloco */}
                      <input
                        type="text"
                        value={seg.text}
                        onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                        placeholder="Texto da fala..."
                      />

                      {/* Palavras individuais do segmento */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {seg.words.map((w, wIdx) => {
                          const isWordNow = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <div
                              key={w.id}
                              className={`px-2 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                                isWordNow 
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 scale-105 shadow-md' 
                                  : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="text"
                                value={w.word}
                                onChange={(e) => {
                                  const updatedWords = [...seg.words];
                                  updatedWords[wIdx] = { ...w, word: e.target.value };
                                  const updatedText = updatedWords.map(x => x.word).join(' ');
                                  const updatedSegments = [...segments];
                                  updatedSegments[segIdx] = {
                                    ...seg,
                                    text: updatedText,
                                    words: updatedWords,
                                    emoji: detectContextEmoji(updatedText) || seg.emoji
                                  };
                                  setSegments(updatedSegments);
                                }}
                                className="bg-transparent border-none outline-none font-bold w-auto max-w-[120px] text-center"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botão Adicionar Segmento */}
              <button
                onClick={() => {
                  const lastEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
                  const newSeg: SubtitleSegment = {
                    id: `seg_${Date.now()}`,
                    start: Number((lastEnd + 0.2).toFixed(2)),
                    end: Number((lastEnd + 2.0).toFixed(2)),
                    text: 'Nova frase de exemplo',
                    emoji: '✨',
                    words: [
                      { id: `w_${Date.now()}_1`, word: 'Nova', start: lastEnd + 0.2, end: lastEnd + 0.6 },
                      { id: `w_${Date.now()}_2`, word: 'frase', start: lastEnd + 0.6, end: lastEnd + 1.1 },
                      { id: `w_${Date.now()}_3`, word: 'de', start: lastEnd + 1.1, end: lastEnd + 1.4 },
                      { id: `w_${Date.now()}_4`, word: 'exemplo', start: lastEnd + 1.4, end: lastEnd + 2.0 }
                    ]
                  };
                  setSegments([...segments, newSeg]);
                  setDuration(Math.max(duration, newSeg.end + 0.5));
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Novo Bloco de Legenda</span>
              </button>
            </div>
          )}

          {/* =========================================================================
              ABA 2: ESTILOS CINÉTICOS (HORMOZI, MRBEAST, TIKTOK, MINIMAL)
          ========================================================================= */}
          {activeTab === 'styles' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Presets de Estilos Cinéticos
                </h3>
                <p className="text-[10px] text-slate-400">Escolha uma estética viral pronta ou customize os parâmetros</p>
              </div>

              {/* Grid dos 6 Presets Visuais */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Hormozi */}
                <div
                  onClick={() => handleSelectPreset('hormozi')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'hormozi'
                      ? 'bg-amber-500/10 border-amber-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Hormozi Pop</span>
                    {kineticConfig.style === 'hormozi' && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="my-2 p-1.5 bg-black/80 rounded-lg text-center font-hormozi text-xs font-black">
                    <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded mr-1">PALAVRA</span>
                    <span className="text-white">ATIVA</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Caixa amarela com alto contraste</span>
                </div>

                {/* MrBeast */}
                <div
                  onClick={() => handleSelectPreset('mrbeast')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'mrbeast'
                      ? 'bg-emerald-500/10 border-emerald-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">MrBeast Bold</span>
                    {kineticConfig.style === 'mrbeast' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="my-2 p-1.5 rounded-lg text-center font-mrbeast text-xs font-black">
                    <span className="text-emerald-400 stroke-black text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">EXPLOSIVO</span> 💥
                  </div>
                  <span className="text-[9px] text-slate-400">Contorno espesso & salto vibrante</span>
                </div>

                {/* TikTok Glow */}
                <div
                  onClick={() => handleSelectPreset('tiktok-glow')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'tiktok-glow'
                      ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">TikTok Glow</span>
                    {kineticConfig.style === 'tiktok-glow' && <Check className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <div className="my-2 p-1.5 rounded-lg text-center font-extrabold text-xs">
                    <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">NEON PULSE</span> ⚡
                  </div>
                  <span className="text-[9px] text-slate-400">Brilho neon e quebras curtas</span>
                </div>

                {/* Ali Abdaal */}
                <div
                  onClick={() => handleSelectPreset('ali-abdaal')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'ali-abdaal'
                      ? 'bg-amber-400/10 border-amber-300 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Ali Abdaal</span>
                    {kineticConfig.style === 'ali-abdaal' && <Check className="w-4 h-4 text-amber-300" />}
                  </div>
                  <div className="my-2 p-1 rounded-lg text-center font-bold text-xs">
                    <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black -rotate-2 inline-block">
                      MARCA-TEXTO
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400">Caneta fluorescente & rotação -2°</span>
                </div>

                {/* Karaoke Wave */}
                <div
                  onClick={() => handleSelectPreset('karaoke-wave')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'karaoke-wave'
                      ? 'bg-pink-500/10 border-pink-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Karaoke Wave</span>
                    {kineticConfig.style === 'karaoke-wave' && <Check className="w-4 h-4 text-pink-400" />}
                  </div>
                  <div className="my-2 p-1.5 rounded-lg text-center font-black text-xs">
                    <span className="text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">KARAOKÊ GLOW</span> 🌊
                  </div>
                  <span className="text-[9px] text-slate-400">Preenchimento suave na voz</span>
                </div>

                {/* Minimal Clean */}
                <div
                  onClick={() => handleSelectPreset('minimal-clean')}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    kineticConfig.style === 'minimal-clean'
                      ? 'bg-sky-500/10 border-sky-400 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Minimal Clean</span>
                    {kineticConfig.style === 'minimal-clean' && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <div className="my-2 p-1.5 rounded-lg text-center font-medium text-xs text-slate-200">
                    Elegante e discreto
                  </div>
                  <span className="text-[9px] text-slate-400">Para podcasts e vlogs</span>
                </div>
              </div>

              {/* Sliders de Customização Fina */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Personalização Detalhada:</span>

                {/* Tamanho da Fonte */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Tamanho da Fonte:</span>
                    <span className="font-mono font-bold text-emerald-400">{kineticConfig.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="28"
                    max="72"
                    value={kineticConfig.fontSize}
                    onChange={(e) => setKineticConfig({ ...kineticConfig, fontSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Posição Vertical na Tela */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Posição Vertical (Y):</span>
                    <span className="font-mono font-bold text-emerald-400">{kineticConfig.positionY}%</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    value={kineticConfig.positionY}
                    onChange={(e) => setKineticConfig({ ...kineticConfig, positionY: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Cores */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Cor do Destaque:</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                      <input
                        type="color"
                        value={kineticConfig.highlightColor}
                        onChange={(e) => setKineticConfig({ ...kineticConfig, highlightColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                      />
                      <span className="font-mono text-xs font-bold text-slate-200">{kineticConfig.highlightColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Palavras por Linha:</label>
                    <select
                      value={kineticConfig.maxWordsPerLine}
                      onChange={(e) => setKineticConfig({ ...kineticConfig, maxWordsPerLine: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="2">2 palavras</option>
                      <option value="3">3 palavras</option>
                      <option value="4">4 palavras (Padrão)</option>
                      <option value="5">5 palavras</option>
                    </select>
                  </div>
                </div>

                {/* Rotação e Marca-Texto */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Rotação do Texto:</span>
                      <span className="font-mono font-bold text-amber-400">{kineticConfig.rotation || 0}°</span>
                    </div>
                    <input
                      type="range"
                      min="-8"
                      max="8"
                      value={kineticConfig.rotation || 0}
                      onChange={(e) => setKineticConfig({ ...kineticConfig, rotation: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-white block">Marca-Texto</span>
                      <span className="text-[9px] text-slate-400">Caneta fluorescente</span>
                    </div>
                    <button
                      onClick={() => setKineticConfig(prev => ({ ...prev, highlighter: !prev.highlighter }))}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        kineticConfig.highlighter ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {kineticConfig.highlighter ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>
                </div>

                {/* Toggle de Emojis */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-white block">Emojis Contextuais</span>
                    <span className="text-[10px] text-slate-400">Exibir emojis sincronizados flutuando acima da legenda</span>
                  </div>
                  <button
                    onClick={() => setKineticConfig(prev => ({ ...prev, enableEmojis: !prev.enableEmojis }))}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      kineticConfig.enableEmojis ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {kineticConfig.enableEmojis ? 'Ativado' : 'Desativado'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 3: EXPORTAÇÃO (MODO 1: VÍDEO FINAL COM LEGENDA & MODO 2: GARDENCUT / SRT / ASS)
          ========================================================================= */}
          {activeTab === 'export' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Opções de Exportação (Os 2 Modos)
                </h3>
                <p className="text-[10px] text-slate-400">Exporte o vídeo final pronto ou envie para sua suíte de edição</p>
              </div>

              {/* CARD MODO 1: GRAVAR E BAIXAR VÍDEO FINAL (BURN-IN) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-teal-950/30 border border-emerald-500/30 space-y-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                      Modo 1: Vídeo Completo com Legendas Gravadas
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">1-Clique</span>
                    </h4>
                    <p className="text-[10px] text-slate-400">O navegador processa e gera o arquivo de vídeo final pronto para postar</p>
                  </div>
                </div>

                {isExporting ? (
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-emerald-300">Gravando legendas no vídeo...</span>
                      <span className="font-mono text-emerald-400">{exportProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleExportBurnInVideo(false)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                    >
                      <Film className="w-4 h-4 fill-slate-950" />
                      <span>Exportar Vídeo Final com Legenda (.webm / .mp4 rápido)</span>
                    </button>
                    <button
                      onClick={() => handleExportBurnInVideo(true)}
                      className="w-full py-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Converter para MP4 Universal (H.264 via FFmpeg Wasm)</span>
                    </button>
                    <button
                      onClick={handleExportTransparentOverlay}
                      className="w-full py-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Exportar Legenda em Fundo Transparente (Alpha WebM Overlay)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* CARD MODO 2: ARQUIVOS & INTEGRAÇÃO GARDEN CUT */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white">
                      Modo 2: Arquivos de Legendas & Ecossistema
                    </h4>
                    <p className="text-[10px] text-slate-400">Envie para o GardenCut ou use no Premiere, DaVinci e CapCut</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {/* Pacote GardenCut */}
                  <button
                    onClick={handleExportGardenCut}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-cyan-400 block mb-0.5">🌿 GardenCut</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Pacote .garden-sub para timeline</p>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-300 mt-2 flex items-center gap-1 font-bold">
                      Baixar .garden-sub <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* SRT */}
                  <button
                    onClick={handleExportSRT}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block mb-0.5">📄 Arquivo .SRT</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Padrão universal SubRip</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-300 mt-2 flex items-center gap-1 font-bold">
                      Baixar .srt <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* VTT */}
                  <button
                    onClick={handleExportVTT}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block mb-0.5">🌐 Arquivo .VTT</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Legendas WebVTT para web</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-300 mt-2 flex items-center gap-1 font-bold">
                      Baixar .vtt <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* ASS */}
                  <button
                    onClick={handleExportASS}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-400 block mb-0.5">🎭 Arquivo .ASS</span>
                      <p className="text-[10px] text-slate-400 leading-tight">SubStation Alpha com fontes e estilos</p>
                    </div>
                    <span className="text-[9px] font-mono text-amber-300 mt-2 flex items-center gap-1 font-bold">
                      Baixar .ass <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD MODO 3: SOFTWARES INDUSTRIAIS NLE (PREMIERE, DAVINCI, VEGAS, AFTER EFFECTS) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white">
                      Modo 3: Editores Profissionais NLE
                    </h4>
                    <p className="text-[10px] text-slate-400">Projetos nativos para Adobe Premiere Pro, DaVinci Resolve, Sony Vegas e After Effects</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Adobe Premiere Pro .prproj */}
                  <button
                    onClick={handleExportPremiere}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-purple-400">🎬 Adobe Premiere Pro</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">.prproj</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Projeto nativo compactado em gzip. Abre com 2 cliques no Windows/Mac com timeline pronta.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                      Baixar .prproj <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* DaVinci Resolve & Sony Vegas .xml */}
                  <button
                    onClick={handleExportFCPXML}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-pink-400">🎞️ DaVinci & Sony Vegas</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold">.xml</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Timeline Universal FCP 7 XML com cortes sincronizados e geradores de títulos por palavra.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-pink-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                      Baixar .xml <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  {/* Adobe After Effects .jsx */}
                  <button
                    onClick={handleExportAfterEffects}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-400">⚡ Adobe After Effects</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">.jsx</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Script ExtendScript que cria camadas de texto vetoriais com keyframes de pop/zoom nativos.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                      Baixar .jsx <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD MODO 4: OBS STUDIO & BROADCAST LIVE */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase text-white flex items-center gap-2">
                        Modo 4: OBS Studio & Broadcast Live
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">Streaming</span>
                      </h4>
                      <p className="text-[10px] text-slate-400">Use legendas dinâmicas ao vivo em suas streams na Twitch, YouTube ou gravações</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => setIsOBSLiveMode(true)}
                    className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 hover:bg-purple-900/30 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Radio className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-purple-300">Abrir Janela OBS Live Overlay</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Exibe tela limpa com fundo transparente ou Chroma Key para capturar no OBS Studio via "Captura de Janela" ou "Navegador".
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                      Abrir Overlay Live <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>

                  <button
                    onClick={handleExportTransparentOverlay}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-cyan-300">Vídeo WebM Alpha para OBS</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Gera vídeo com canal Alpha transparente para colocar como "Fonte de Mídia" (Media Source) no OBS Studio.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                      Exportar Alpha WebM <Download className="w-3 h-3" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* MODAL: COLAR TEXTO COMPLETO */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Gerar Legendas a partir de Texto
              </h3>
              <button onClick={() => setIsTextModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConvertText} className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Cole o roteiro ou fala do vídeo (as palavras serão divididas automaticamente):
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Ex: O segredo para vídeos virais é prender a atenção nos primeiros 3 segundos..."
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg hover:bg-emerald-400 transition"
              >
                Gerar Legendas e Timestamps
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROCESSAMENTO FFMPEG WEBASSEMBLY */}
      {isTranscoding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Processamento WebAssembly (FFmpeg)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Remuxando ou transcodificando mídia para formato compatível com o navegador
              </p>
            </div>
            <div className="space-y-2 py-2 text-left">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-300 truncate max-w-[260px]">{transcodeStatus}</span>
                <span className="font-mono text-emerald-400 font-bold">{transcodeProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, transcodeProgress)}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              🔒 100% no seu navegador: nenhum arquivo é enviado para servidores externos.
            </p>
          </div>
        </div>
      )}

      {/* TELA DE OVERLAY OBS STUDIO (STREAMING / LIVE BROADCAST) */}
      {isOBSLiveMode && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col items-center justify-between ${
            obsChromaMode === 'green' ? 'bg-[#00FF00]' :
            obsChromaMode === 'magenta' ? 'bg-[#FF00FF]' :
            obsChromaMode === 'black' ? 'bg-black' :
            'bg-slate-950/90 backdrop-blur-xs'
          }`}
        >
          {/* Barra Flutuante de Controle OBS (Minimalista) */}
          <div className="w-full max-w-5xl mx-auto p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800 m-4 shadow-2xl z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" />
                OBS Studio Live Overlay
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                {aspectRatio} &middot; 60 FPS
              </span>
            </div>

            {/* Controles de Fundo / Chroma */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-2 font-medium">Fundo:</span>
              <button
                onClick={() => setObsChromaMode('transparent')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  obsChromaMode === 'transparent' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Transparente (Navegador)
              </button>
              <button
                onClick={() => setObsChromaMode('green')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  obsChromaMode === 'green' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Verde Chroma
              </button>
              <button
                onClick={() => setObsChromaMode('magenta')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  obsChromaMode === 'magenta' ? 'bg-pink-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Magenta Chroma
              </button>
              <button
                onClick={() => setObsChromaMode('black')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  obsChromaMode === 'black' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Preto
              </button>
            </div>

            {/* Ações e Fechar */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLiveMic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isLiveMicActive
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Transcrever e legendar sua fala em tempo real na live"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isLiveMicActive ? 'Ouvindo Microfone...' : 'Legendar Voz ao Vivo'}</span>
              </button>

              <button
                onClick={togglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
              </button>

              <button
                onClick={() => {
                  setIsOBSLiveMode(false);
                  if (liveRecognitionRef.current) {
                    liveRecognitionRef.current.stop();
                    liveRecognitionRef.current = null;
                    setIsLiveMicActive(false);
                  }
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Sair do Modo OBS (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área Central: Canvas OBS */}
          <div className="flex-1 w-full flex items-center justify-center p-4 relative overflow-hidden">
            <canvas
              ref={obsCanvasRef}
              width={aspectRatio === '9:16' ? 1080 : 1920}
              height={aspectRatio === '9:16' ? 1920 : 1080}
              className={`max-h-full max-w-full object-contain ${
                obsChromaMode === 'transparent' ? 'drop-shadow-2xl' : ''
              }`}
            />
          </div>

          {/* Dica de Configuração do OBS no Rodapé */}
          <div className="w-full max-w-3xl mx-auto p-2.5 mb-3 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800/80 text-center text-[11px] text-slate-400">
            💡 <strong className="text-white">Como usar no OBS Studio:</strong> Adicione esta janela como <span className="text-purple-300 font-bold">Captura de Janela</span> (Window Capture) e adicione o filtro <span className="text-purple-300 font-bold">Color Key / Chroma Key</span> se usar fundo verde, ou use como <span className="text-purple-300 font-bold">Fonte de Navegador</span> (Browser Source).
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
