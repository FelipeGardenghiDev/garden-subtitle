import React, { useState, useRef } from 'react';
import { Layers, Sliders, Type, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';

import { KineticConfig, KineticStyle } from './types';
import { KINETIC_PRESETS } from './core/kinetic-styles';
import { DEMO_SUBTITLE_SEGMENTS, generateSegmentsFromText } from './core/demo-data';
import { isNonNativeFormat, transcodeOrRemuxVideo, convertWebMToMP4 } from './core/ffmpeg-transcoder';
import { parseSubtitleFile } from './core/subtitle-parsers';
import { isSpeechRecognitionSupported, transcribeMediaElement, transcribeWithWhisperWasm } from './core/speech-transcriber';
import { exportToFCPXML, exportToPremiereProject, exportToAfterEffectsScript } from './core/nle-exporters';
import { 
  exportToSRT, 
  exportToVTT, 
  exportToGardenCut, 
  exportVideoWithBurnIn, 
  exportToASS, 
  exportTransparentOverlay 
} from './core/exporters';

// Custom Hooks
import { useSubtitleState } from './hooks/useSubtitleState';
import { useVideoPlayback } from './hooks/useVideoPlayback';
import { useOBSLive } from './hooks/useOBSLive';

// Modular UI Components
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitleEditor } from './components/SubtitleEditor';
import { KineticStyleCustomizer } from './components/KineticStyleCustomizer';
import { ExportSection } from './components/ExportSection';
import { OBSLiveOverlay } from './components/OBSLiveOverlay';
import { TextModal } from './components/TextModal';
import { TranscodeModal } from './components/TranscodeModal';
import { ToastNotification } from './components/ToastNotification';

export function App() {
  // Configuração Cinética Ativa
  const [kineticConfig, setKineticConfig] = useState<KineticConfig>(KINETIC_PRESETS.hormozi);
  const [activeTab, setActiveTab] = useState<'editor' | 'styles' | 'export'>('editor');

  // Notificações Toast
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // 1. Hook de Gerenciamento de Legendas (Memento Pattern Undo/Redo & Auto-Save)
  const {
    segments,
    canUndo,
    canRedo,
    setSegments,
    undo,
    redo,
    addSegment,
    updateSegmentText,
    updateSegmentTiming,
    updateWord,
    splitSegment,
    mergeWithNextSegment,
    removeSegment,
    setSegmentEmoji,
    autoDetectEmojis,
    resetSegments
  } = useSubtitleState(DEMO_SUBTITLE_SEGMENTS);

  // 2. Hook de Player de Vídeo e Renderização Canvas 60 FPS
  const {
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
    toggleMute
  } = useVideoPlayback(segments, kineticConfig);

  // 3. Hook do Modo OBS Studio Live Stream & Broadcast
  const {
    isOBSLiveMode,
    setIsOBSLiveMode,
    obsChromaMode,
    setObsChromaMode,
    isLiveMicActive,
    toggleLiveMic,
    obsCanvasRef,
    closeOBS
  } = useOBSLive({
    segments,
    setSegments: (newSegs) => setSegments(newSegs, true),
    kineticConfig,
    currentTime,
    videoRef,
    showToast
  });

  // Estados de Exportação e Processamento
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Estados de Transcodificação WebAssembly
  const [isTranscoding, setIsTranscoding] = useState<boolean>(false);
  const [transcodeProgress, setTranscodeProgress] = useState<number>(0);
  const [transcodeStatus, setTranscodeStatus] = useState<string>('');

  // Estados de Transcrição por Áudio e Emojis
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [liveTranscriptionText, setLiveTranscriptionText] = useState<string>('');
  const [editingEmojiSegmentId, setEditingEmojiSegmentId] = useState<string | null>(null);

  // Modal de Texto
  const [isTextModalOpen, setIsTextModalOpen] = useState<boolean>(false);
  const [rawTextInput, setRawTextInput] = useState<string>('');

  // Drag & Drop
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Refs de Arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);

  // Processa arquivo através do FFmpeg WebAssembly caso seja formato não nativo
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

  // Carrega arquivos de mídia (vídeo ou áudio)
  const loadMediaFile = async (file: File) => {
    if (isNonNativeFormat(file.name)) {
      await processTranscode(file);
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);
    showToast(`Mídia carregada: ${file.name}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadMediaFile(file);
    }
  };

  const handleSubFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseSubtitleFile(file.name, text);
      setSegments(parsed, true);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast(`🎉 ${parsed.length} trechos importados de "${file.name}"!`);
      setActiveTab('editor');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao importar legendas: ' + (err.message || err));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleLoadDemo = () => {
    setVideoSrc(null);
    setVideoName('video-demo.mp4');
    setDuration(11.5);
    setCurrentTime(0);
    setIsPlaying(false);
    resetSegments(DEMO_SUBTITLE_SEGMENTS);
    setKineticConfig(KINETIC_PRESETS.hormozi);
    showToast('✨ Demonstração padrão recarregada!');
  };

  // Transcrição de Áudio por IA
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
        setSegments(generated, true);
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

  // Transcrição Acústica via Whisper WebAssembly (16kHz Offline)
  const handleTranscribeWithWhisperWasm = async () => {
    if (!videoSrc) {
      alert('Carregue um arquivo de vídeo ou áudio primeiro para transcrever com Whisper Wasm.');
      return;
    }

    try {
      setIsTranscribingAudio(true);
      setLiveTranscriptionText('Iniciando extração PCM 16kHz...');
      showToast('🧠 Processando áudio com Whisper WebAssembly (16kHz)...');

      const generated = await transcribeWithWhisperWasm(
        videoSrc,
        (text) => setLiveTranscriptionText(text),
        kineticConfig.maxWordsPerLine || 4
      );

      if (generated.length > 0) {
        setSegments(generated, true);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        showToast(`🎉 Whisper Wasm gerou ${generated.length} segmentos com Word-Level Timestamps!`);
        setActiveTab('editor');
      } else {
        showToast('Nenhuma fala detectada pelo Whisper Wasm.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao transcrever com Whisper Wasm: ' + (err.message || err));
    } finally {
      setIsTranscribingAudio(false);
      setLiveTranscriptionText('');
    }
  };

  // Conversão de Texto para Legendas
  const handleConvertText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTextInput.trim()) return;
    const newSegments = generateSegmentsFromText(rawTextInput, kineticConfig.maxWordsPerLine || 4);
    setSegments(newSegments, true);
    if (newSegments.length > 0) {
      setDuration(newSegments[newSegments.length - 1].end + 0.5);
    }
    setIsTextModalOpen(false);
    setRawTextInput('');
    showToast('Legendas geradas a partir do texto com sucesso!');
  };

  // Handlers de Exportação
  const handleExportBurnInVideo = async (convertMP4 = false) => {
    if (!videoRef.current) {
      alert('Carregue um arquivo de vídeo primeiro para exportar com legendas.');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const recordedBlob = await exportVideoWithBurnIn(
        videoRef.current,
        segments,
        kineticConfig,
        (progress: number) => setExportProgress(progress)
      );

      let finalBlob = recordedBlob;
      let extension = 'webm';

      if (convertMP4) {
        setExportProgress(100);
        showToast('Convertendo vídeo para MP4 via FFmpeg WebAssembly...');
        finalBlob = await convertWebMToMP4(
          recordedBlob,
          `${videoName.replace(/\.[^/.]+$/, '')}_legendado.mp4`,
          (progress: number) => {
            setExportProgress(progress);
          }
        );
        extension = 'mp4';
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, '')}_legendado.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      showToast(`🎉 Vídeo ${extension.toUpperCase()} exportado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      alert('Erro na gravação do vídeo: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const getExportDimensions = () => ({
    w: aspectRatio === '16:9' ? 1920 : 1080,
    h: aspectRatio === '9:16' ? 1920 : 1080
  });

  const handleExportTransparentOverlay = async () => {
    const { w, h } = getExportDimensions();

    setIsExporting(true);
    setExportProgress(0);

    try {
      const overlayBlob = await exportTransparentOverlay(
        segments,
        kineticConfig,
        duration,
        w,
        h,
        (progress) => setExportProgress(progress)
      );

      const url = URL.createObjectURL(overlayBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, '')}_overlay_transparente.webm`;
      a.click();
      URL.revokeObjectURL(url);

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

  const handleExportGardenCut = () => {
    const gardenData = exportToGardenCut(segments, kineticConfig, duration);
    const blob = new Blob([JSON.stringify(gardenData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.garden-sub`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Pacote .garden-sub baixado com sucesso!');
  };

  const handleExportSRT = () => {
    const srtContent = exportToSRT(segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo .SRT baixado com sucesso!');
  };

  const handleExportVTT = () => {
    const vttContent = exportToVTT(segments);
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo .VTT baixado com sucesso!');
  };

  const handleExportASS = () => {
    const { w, h } = getExportDimensions();
    const assContent = exportToASS(segments, kineticConfig, w, h);
    const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, '')}.ass`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo .ASS baixado com sucesso!');
  };

  const handleExportPremiere = async () => {
    try {
      const { w, h } = getExportDimensions();
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

  const handleExportFCPXML = () => {
    try {
      const { w, h } = getExportDimensions();
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

  const handleExportAfterEffects = () => {
    try {
      const { w, h } = getExportDimensions();
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

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 relative"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await loadMediaFile(file);
      }}
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
      <ToastNotification message={statusMessage} />

      {/* Header Superior com Undo/Redo e Ações */}
      <Header
        onImportSubtitleClick={() => subFileInputRef.current?.click()}
        onUploadMediaClick={() => fileInputRef.current?.click()}
        onLoadDemo={handleLoadDemo}
        onOpenOBS={() => setIsOBSLiveMode(true)}
        subFileInputRef={subFileInputRef}
        fileInputRef={fileInputRef}
        onSubFileUpload={handleSubFileUpload}
        onFileUpload={handleFileUpload}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        {/* Painel Esquerdo: Player de Vídeo e Canvas 60 FPS */}
        <VideoPlayer
          videoRef={videoRef}
          previewCanvasRef={previewCanvasRef}
          videoSrc={videoSrc}
          videoName={videoName}
          segments={segments}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isMuted={isMuted}
          aspectRatio={aspectRatio}
          togglePlay={togglePlay}
          seek={seek}
          toggleMute={toggleMute}
          setAspectRatio={setAspectRatio}
          onUpdateSegmentTiming={updateSegmentTiming}
          onVideoLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            setDuration(vid.duration || 10);
            if (vid.videoWidth && vid.videoHeight) {
              if (Math.abs(vid.videoWidth - vid.videoHeight) <= 20) {
                setAspectRatio('1:1');
              } else {
                setAspectRatio(vid.videoWidth < vid.videoHeight ? '9:16' : '16:9');
              }
            }
          }}
          onVideoTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onVideoEnded={() => setIsPlaying(false)}
        />

        {/* Painel Direito: Abas de Edição, Estilos e Exportação */}
        <section className="w-full lg:w-[480px] border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-slate-900/30 flex flex-col">
          {/* Navegação de Abas */}
          <div className="flex border-b border-slate-800/80 bg-slate-950/50 p-2 gap-1">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Legendas ({segments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('styles')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'styles'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Estilos Cinéticos</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
          </div>

          {/* Conteúdo da Aba Ativa */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'editor' && (
              <SubtitleEditor
                segments={segments}
                currentTime={currentTime}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={undo}
                redo={redo}
                onSeek={seek}
                onAddSegment={() => addSegment(currentTime, currentTime + 2.5)}
                onOpenTextModal={() => setIsTextModalOpen(true)}
                onTranscribeAI={handleTranscribeWithAI}
                onTranscribeWhisperWasm={handleTranscribeWithWhisperWasm}
                isTranscribingAudio={isTranscribingAudio}
                liveTranscriptionText={liveTranscriptionText}
                onAutoEmojis={autoDetectEmojis}
                onUpdateSegmentText={updateSegmentText}
                onUpdateSegmentTiming={updateSegmentTiming}
                onUpdateWord={updateWord}
                onSplitSegment={splitSegment}
                onMergeWithNextSegment={mergeWithNextSegment}
                onRemoveSegment={removeSegment}
                onSelectEmoji={setSegmentEmoji}
                editingEmojiSegmentId={editingEmojiSegmentId}
                setEditingEmojiSegmentId={setEditingEmojiSegmentId}
              />
            )}

            {activeTab === 'styles' && (
              <KineticStyleCustomizer
                kineticConfig={kineticConfig}
                onSelectPreset={(style: KineticStyle) => {
                  setKineticConfig(KINETIC_PRESETS[style]);
                  showToast(`Estilo alterado para ${style.toUpperCase()}`);
                }}
                onUpdateConfig={(updates) => setKineticConfig(prev => ({ ...prev, ...updates }))}
              />
            )}

            {activeTab === 'export' && (
              <ExportSection
                isExporting={isExporting}
                exportProgress={exportProgress}
                onExportBurnInVideo={handleExportBurnInVideo}
                onExportTransparentOverlay={handleExportTransparentOverlay}
                onExportGardenCut={handleExportGardenCut}
                onExportSRT={handleExportSRT}
                onExportVTT={handleExportVTT}
                onExportASS={handleExportASS}
                onExportPremiere={handleExportPremiere}
                onExportFCPXML={handleExportFCPXML}
                onExportAfterEffects={handleExportAfterEffects}
                onOpenOBSLive={() => setIsOBSLiveMode(true)}
              />
            )}
          </div>
        </section>
      </main>

      {/* Modal: Gerar Legendas a partir de Texto */}
      <TextModal
        isOpen={isTextModalOpen}
        rawTextInput={rawTextInput}
        setRawTextInput={setRawTextInput}
        onConvertText={handleConvertText}
        onClose={() => setIsTextModalOpen(false)}
      />

      {/* Modal: Processamento FFmpeg WebAssembly */}
      <TranscodeModal
        isOpen={isTranscoding}
        status={transcodeStatus}
        progress={transcodeProgress}
      />

      {/* Tela de Overlay OBS Studio (Streaming / Broadcast) */}
      <OBSLiveOverlay
        isOpen={isOBSLiveMode}
        obsChromaMode={obsChromaMode}
        setObsChromaMode={setObsChromaMode}
        isLiveMicActive={isLiveMicActive}
        toggleLiveMic={toggleLiveMic}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        aspectRatio={aspectRatio}
        obsCanvasRef={obsCanvasRef}
        onClose={closeOBS}
      />
    </div>
  );
}

export default App;
