import { SubtitleSegment, KineticConfig } from '../types';

/**
 * Renderiza um frame do vídeo com as legendas cinéticas sobre o Canvas 2D
 */
export function renderKineticSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  videoElement: HTMLVideoElement | null,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  segments: SubtitleSegment[],
  config: KineticConfig
) {
  // 1. Limpar canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 2. Desenhar o frame do vídeo se disponível
  if (videoElement && videoElement.readyState >= 2) {
    ctx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
  } else {
    // Fundo degradê escuro caso o vídeo não esteja carregado
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 3. Localizar o segmento ativo no tempo atual
  const activeSegment = segments.find(
    seg => currentTime >= seg.start && currentTime <= seg.end
  );

  if (!activeSegment || activeSegment.words.length === 0) {
    return;
  }

  // 4. Configurar tipografia conforme o estilo
  let fontFamily = "'Montserrat', sans-serif";
  let fontWeight = '900';
  let isUpperCase = true;

  if (config.style === 'mrbeast') {
    fontFamily = "'Titan One', 'Montserrat', sans-serif";
    fontWeight = '900';
    isUpperCase = true;
  } else if (config.style === 'tiktok-glow') {
    fontFamily = "'Plus Jakarta Sans', sans-serif";
    fontWeight = '800';
    isUpperCase = true;
  } else if (config.style === 'minimal-clean') {
    fontFamily = "'Plus Jakarta Sans', sans-serif";
    fontWeight = '700';
    isUpperCase = false;
  }

  // Ajuste de escala proporcional para resolução do canvas
  const scaleFactor = Math.min(canvasWidth / 720, canvasHeight / 1280);
  const calculatedFontSize = Math.max(24, Math.round(config.fontSize * (scaleFactor > 0 ? scaleFactor : 1)));
  ctx.font = `${fontWeight} ${calculatedFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 5. Medir palavras e calcular quebra de linha
  const wordsToRender = activeSegment.words.slice(0, config.maxWordsPerLine || 4);
  const wordSpacings = calculatedFontSize * 0.35;

  let totalLineWidth = 0;
  const wordWidths: number[] = wordsToRender.map(w => {
    const rawText = isUpperCase ? w.word.toUpperCase() : w.word;
    const width = ctx.measureText(rawText).width;
    totalLineWidth += width;
    return width;
  });
  totalLineWidth += (wordsToRender.length - 1) * wordSpacings;

  // Posição Y da linha na tela
  const baselineY = (canvasHeight * (config.positionY / 100));

  // 6. Desenhar Emoji no topo se habilitado
  if (config.enableEmojis && activeSegment.emoji) {
    const emojiFontSize = calculatedFontSize * 1.35;
    ctx.save();
    ctx.font = `${emojiFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    
    // Pequena animação de flutuação no emoji
    const bounceOffset = Math.sin(currentTime * 8) * 4;
    ctx.fillText(activeSegment.emoji, canvasWidth / 2, baselineY - calculatedFontSize * 1.2 + bounceOffset);
    ctx.restore();
  }

  // 7. Desenhar cada palavra (inativa vs ativa)
  let currentX = (canvasWidth - totalLineWidth) / 2;

  wordsToRender.forEach((w, idx) => {
    const isWordActive = currentTime >= w.start && currentTime <= w.end;
    const rawText = isUpperCase ? w.word.toUpperCase() : w.word;
    const wordWidth = wordWidths[idx];
    const wordCenterX = currentX + wordWidth / 2;

    ctx.save();

    if (isWordActive) {
      // Efeito de Zoom / Pop na palavra ativa
      const zoomScale = config.animationScale || 1.2;
      ctx.translate(wordCenterX, baselineY);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-wordCenterX, -baselineY);

      // Fundo Hormozi (Pill / Caixa preta ou amarela)
      if (config.style === 'hormozi') {
        const paddingX = calculatedFontSize * 0.25;
        const paddingY = calculatedFontSize * 0.15;
        const boxX = wordCenterX - (wordWidth / 2) - paddingX;
        const boxY = baselineY - (calculatedFontSize / 2) - paddingY;
        const boxW = wordWidth + (paddingX * 2);
        const boxH = calculatedFontSize + (paddingY * 2);

        // Fundo escuro atrás do destaque
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fill();

        // Pílula com a cor de destaque
        ctx.fillStyle = config.highlightColor;
        ctx.beginPath();
        ctx.roundRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4, 6);
        ctx.fill();

        // Texto preto sobre a pílula amarela
        ctx.fillStyle = '#000000';
        ctx.fillText(rawText, wordCenterX, baselineY);
        ctx.restore();
        currentX += wordWidth + wordSpacings;
        return;
      }

      // Estilo TikTok Glow (Sombra / Brilho Neon)
      if (config.style === 'tiktok-glow' && config.glowColor) {
        ctx.shadowColor = config.glowColor;
        ctx.shadowBlur = 18;
      }

      // Contorno espesso
      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor || '#000000';
        ctx.lineWidth = Math.round(config.strokeWidth * (scaleFactor > 0 ? scaleFactor : 1) * 1.2);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(rawText, wordCenterX, baselineY);
      }

      // Preenchimento com cor de destaque
      ctx.fillStyle = config.highlightColor;
      ctx.fillText(rawText, wordCenterX, baselineY);

    } else {
      // Palavra inativa
      if (config.style === 'tiktok-glow') {
        ctx.shadowBlur = 0;
      }

      // Contorno
      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor || '#000000';
        ctx.lineWidth = Math.round(config.strokeWidth * (scaleFactor > 0 ? scaleFactor : 1));
        ctx.lineJoin = 'round';
        ctx.strokeText(rawText, wordCenterX, baselineY);
      }

      // Preenchimento branco padrão
      ctx.fillStyle = config.textColor || '#ffffff';
      ctx.fillText(rawText, wordCenterX, baselineY);
    }

    ctx.restore();
    currentX += wordWidth + wordSpacings;
  });
}
