import { SubtitleSegment } from '../types';

// Dicionário heurístico de palavras-chave para emojis dinâmicos (Português & Inglês)
const EMOJI_DICTIONARY: Record<string, string> = {
  // Finanças, negócios & vendas
  'dinheiro': '💰',
  'grana': '💵',
  'dolar': '💵',
  'dólar': '💵',
  'rico': '🤑',
  'riqueza': '💎',
  'milhão': '💰',
  'milhao': '💰',
  'milhões': '💰',
  'faturar': '📈',
  'lucro': '📈',
  'vendas': '🛍️',
  'preço': '🏷️',
  'preco': '🏷️',
  'investimento': '📊',
  'ações': '📈',
  'bitcoin': '🪙',
  'cripto': '🪙',

  // Energia, hype & viral
  'fogo': '🔥',
  'quente': '🔥',
  'estourou': '💥',
  'bomba': '💣',
  'viral': '🚀',
  'foguete': '🚀',
  'crescer': '🚀',
  'escala': '🚀',
  'energia': '⚡',
  'rápido': '⚡',
  'rapido': '⚡',
  'velocidade': '🏎️',
  'raio': '⚡',

  // Conhecimento, mente & estratégia
  'ideia': '💡',
  'insight': '💡',
  'pensar': '🧠',
  'mente': '🧠',
  'cérebro': '🧠',
  'cerebro': '🧠',
  'segredo': '🤫',
  'chave': '🔑',
  'estratégia': '♟️',
  'estrategia': '♟️',
  'plano': '📋',
  'livro': '📚',
  'aprender': '📖',
  'estudo': '🎓',

  // Sucesso, foco & metas
  'meta': '🎯',
  'alvo': '🎯',
  'foco': '🎯',
  'campeão': '🏆',
  'campeao': '🏆',
  'vitória': '🏆',
  'vitoria': '🏆',
  'troféu': '🏆',
  'vencer': '🥇',
  'sucesso': '🌟',
  'top': '🔝',
  'forte': '💪',
  'disciplina': '🧱',

  // Atenção, perigo & tempo
  'cuidado': '⚠️',
  'alerta': '🚨',
  'atenção': '⚠️',
  'atencao': '⚠️',
  'pare': '🛑',
  'erro': '❌',
  'tempo': '⏳',
  'hora': '⏰',
  'relógio': '⏱️',
  'relogio': '⏱️',
  'espera': '⏳',

  // Sentimentos & interações
  'amor': '❤️',
  'coração': '❤️',
  'coracao': '❤️',
  'topdemais': '👏',
  'palmas': '👏',
  'festa': '🎉',
  'comemorar': '🥳',
  'uau': '😱',
  'medo': '😨',
  'duvida': '🤔',
  'dúvida': '🤔',
  'concordo': '🤝',
  'acordo': '🤝',
  'parceria': '🤝',

  // Mídia & tecnologia
  'vídeo': '🎬',
  'video': '🎬',
  'gravar': '🎥',
  'câmera': '📸',
  'foto': '📸',
  'áudio': '🎙️',
  'audio': '🎙️',
  'microfone': '🎙️',
  'celular': '📱',
  'computador': '💻',
  'internet': '🌐',
  'código': '💻',
  'codigo': '💻',
  'robô': '🤖',
  'robo': '🤖',
  'ia': '🤖',

  // Comida & Bebida
  'café': '☕',
  'cafe': '☕',
  'água': '💧',
  'agua': '💧',
  'pizza': '🍕',
  'hambúrguer': '🍔',
  'lanche': '🍔'
};

/**
 * Detecta emoji com base nas palavras do segmento
 */
export function detectContextEmoji(text: string): string | undefined {
  const words = text.toLowerCase().replace(/[.,!?;:"'()]/g, '').split(/\s+/);
  
  for (const word of words) {
    if (EMOJI_DICTIONARY[word]) {
      return EMOJI_DICTIONARY[word];
    }
  }

  // Busca por substrings compostas
  const lowerText = text.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI_DICTIONARY)) {
    if (lowerText.includes(key)) {
      return emoji;
    }
  }

  return undefined;
}

/**
 * Aplica emojis automaticamente em uma lista de segmentos
 */
export function autoAssignEmojis(segments: SubtitleSegment[]): SubtitleSegment[] {
  return segments.map(seg => {
    const detected = detectContextEmoji(seg.text);
    return {
      ...seg,
      emoji: detected || seg.emoji
    };
  });
}
