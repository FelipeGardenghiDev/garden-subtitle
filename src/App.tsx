import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Play, Pause, RotateCcw, Volume2, VolumeX,
  Upload, Download, FileText, Film, Sliders, Type,
  Smile, Plus, Trash2, Check, ArrowRight, Wand2
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
import { exportToSRT, exportToVTT, exportToGardenCut, exportVideoWithBurnIn } from './core/exporters';
import { DEMO_SUBTITLE_SEGMENTS, generateSegmentsFromText } from './core/demo-data';

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
  const animFrameRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Carregar vídeo via upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);
    showToast(`Vídeo "${file.name}" carregado com sucesso!`);
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
  const handleExportBurnInVideo = async () => {
    if (!videoSrc || !videoRef.current) {
      alert('Por favor, carregue um arquivo de vídeo (.mp4 ou .webm) para gravar as legendas no vídeo final.');
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

      // Baixar o vídeo final gravado
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garden_subtitle_${videoName.replace(/\.[^/.]+$/, '')}_legendado.webm`;
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

  // Formatação de Tempo (00:00.0)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
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
                  v0.1.0 &middot; 100% Web
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Estúdio Web de Legendas Cinéticas & Word-by-Word</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subir Vídeo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
            />

            <button
              onClick={handleLoadDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Usar Demo</span>
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
                          {seg.emoji && (
                            <span className="text-base" title="Emoji contextual ativo">{seg.emoji}</span>
                          )}
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

              {/* Grid dos 4 Presets Visuais */}
              <div className="grid grid-cols-2 gap-3">
                {/* Hormozi */}
                <div
                  onClick={() => handleSelectPreset('hormozi')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
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
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
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
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
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

                {/* Minimal Clean */}
                <div
                  onClick={() => handleSelectPreset('minimal-clean')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
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
              ABA 3: EXPORTAÇÃO (MODO 1: VÍDEO FINAL COM LEGENDA & MODO 2: GARDENCUT / SRT)
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
                  <button
                    onClick={handleExportBurnInVideo}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                  >
                    <Film className="w-4 h-4 fill-slate-950" />
                    <span>Exportar Vídeo Final com Legenda (.webm / .mp4)</span>
                  </button>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                  {/* Pacote GardenCut */}
                  <button
                    onClick={handleExportGardenCut}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-cyan-400 block mb-0.5">🌿 GardenCut</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Pacote .garden-sub para importar na timeline</p>
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
                      <p className="text-[10px] text-slate-400 leading-tight">Padrão universal SubRip para qualquer editor</p>
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
                      <p className="text-[10px] text-slate-400 leading-tight">Legendas WebVTT para players de internet</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-300 mt-2 flex items-center gap-1 font-bold">
                      Baixar .vtt <ArrowRight className="w-3 h-3" />
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
    </div>
  );
}

export default App;
