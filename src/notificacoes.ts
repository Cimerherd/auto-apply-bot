import https from 'https';
import { log } from './logger.js';

let telegramConfig: { botToken: string; chatId: string } | null = null;

export function configurarTelegram(botToken: string, chatId: string): void {
  if (!botToken || !chatId) {
    log('WARN', 'Telegram: BOT_TOKEN ou CHAT_ID não configurados. Notificações desativadas.');
    return;
  }
  telegramConfig = { botToken, chatId };
  log('INFO', 'Telegram: Notificações configuradas com sucesso.');
}

export function enviarTelegram(mensagem: string): Promise<boolean> {
  if (!telegramConfig) return Promise.resolve(false);

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: telegramConfig!.chatId,
      text: mensagem,
      parse_mode: 'Markdown',
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${telegramConfig!.botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('INFO', 'Telegram: Mensagem enviada com sucesso.');
          resolve(true);
        } else {
          log('ERRO', `Telegram: Erro ${res.statusCode} — ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      log('ERRO', `Telegram: Erro de rede — ${err.message}`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// Notificações pré-formatadas
export async function notificarCandidatura(empresa: string, vaga: string, score: number, dryRun: boolean): Promise<void> {
  const modo = dryRun ? '🔵 DRY-RUN' : '🟢 APLICADO';
  const msg = `${modo}\n*${vaga}* — ${empresa}\nScore: ${score}/10`;
  await enviarTelegram(msg);
}

export async function notificarResumo(total: number, erros: number, dryRun: boolean): Promise<void> {
  const modo = dryRun ? '(DRY-RUN)' : '';
  const msg = `📊 *Resumo da Execução* ${modo}\nCandidaturas: ${total}\nErros: ${erros}`;
  await enviarTelegram(msg);
}

export async function notificarErro(mensagem: string): Promise<void> {
  await enviarTelegram(`🔴 *ERRO*\n${mensagem}`);
}
