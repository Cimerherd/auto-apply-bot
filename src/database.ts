import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Candidatura } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'candidaturas.db');

let db: Database.Database;

export function inicializarBanco(): Database.Database {
  db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS candidaturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plataforma TEXT NOT NULL,
      titulo_vaga TEXT NOT NULL,
      empresa TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      data_aplicacao TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      mensagem_enviada INTEGER DEFAULT 0,
      status TEXT DEFAULT 'aplicado',
      score INTEGER DEFAULT 0
    )
  `);

  // Migracoes (adicionar colunas novas em bancos existentes)
  const migracoes = [
    'ALTER TABLE candidaturas ADD COLUMN score INTEGER DEFAULT 0',
    'ALTER TABLE candidaturas ADD COLUMN screenshot_path TEXT',
  ];
  for (const sql of migracoes) {
    try { db.exec(sql); } catch { /* Coluna ja existe */ }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS vagas_vistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      titulo_vaga TEXT,
      empresa TEXT,
      plataforma TEXT,
      score INTEGER DEFAULT 0,
      motivo_pulo TEXT,
      data_vista TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS log_execucoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_execucao TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      total_candidaturas INTEGER DEFAULT 0,
      sites_processados TEXT,
      erros TEXT
    )
  `);

  return db;
}

export function verificarJaAplicou(url: string): boolean {
  const row = db.prepare('SELECT id FROM candidaturas WHERE url = ?').get(url);
  return !!row;
}

export function registrarCandidatura(candidatura: Omit<Candidatura, 'id' | 'data_aplicacao'>): boolean {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO candidaturas (plataforma, titulo_vaga, empresa, url, mensagem_enviada, status, score, screenshot_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidatura.plataforma,
      candidatura.titulo_vaga,
      candidatura.empresa,
      candidatura.url,
      candidatura.mensagem_enviada,
      candidatura.status,
      candidatura.score ?? 0,
      candidatura.screenshot_path ?? null
    );
    return true;
  } catch {
    return false;
  }
}

export function registrarVagaVista(dados: {
  url: string;
  titulo_vaga?: string;
  empresa?: string;
  plataforma?: string;
  score?: number;
  motivo_pulo?: string;
}): boolean {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO vagas_vistas (url, titulo_vaga, empresa, plataforma, score, motivo_pulo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      dados.url,
      dados.titulo_vaga ?? null,
      dados.empresa ?? null,
      dados.plataforma ?? null,
      dados.score ?? 0,
      dados.motivo_pulo ?? null
    );
    return true;
  } catch {
    return false;
  }
}

export function verificarVagaJaVista(url: string): boolean {
  const row = db.prepare('SELECT id FROM vagas_vistas WHERE url = ?').get(url);
  return !!row;
}

export function atualizarScreenshot(url: string, screenshotPath: string): void {
  db.prepare('UPDATE candidaturas SET screenshot_path = ? WHERE url = ?').run(screenshotPath, url);
}

export function obterEstatisticas() {
  const hoje = db.prepare(`
    SELECT COUNT(*) as total, AVG(score) as score_medio
    FROM candidaturas WHERE date(data_aplicacao) = date('now', 'localtime')
  `).get() as { total: number; score_medio: number | null };

  const total = db.prepare('SELECT COUNT(*) as total FROM candidaturas').get() as { total: number };

  const porPlataforma = db.prepare(`
    SELECT plataforma, COUNT(*) as total, AVG(score) as score_medio
    FROM candidaturas GROUP BY plataforma ORDER BY total DESC
  `).all() as Array<{ plataforma: string; total: number; score_medio: number | null }>;

  const porStatus = db.prepare(`
    SELECT status, COUNT(*) as total
    FROM candidaturas GROUP BY status
  `).all() as Array<{ status: string; total: number }>;

  return { hoje, total: total.total, porPlataforma, porStatus };
}

export function contarCandidaturasHoje(): number {
  const row = db.prepare(`
    SELECT COUNT(*) as total FROM candidaturas
    WHERE date(data_aplicacao) = date('now', 'localtime')
  `).get() as { total: number };
  return row.total;
}

export function listarCandidaturas(limite: number = 50): Candidatura[] {
  return db.prepare(`
    SELECT * FROM candidaturas ORDER BY data_aplicacao DESC LIMIT ?
  `).all(limite) as Candidatura[];
}

export function registrarExecucao(totalCandidaturas: number, sitesProcessados: string[], erros: string[]): void {
  db.prepare(`
    INSERT INTO log_execucoes (total_candidaturas, sites_processados, erros)
    VALUES (?, ?, ?)
  `).run(totalCandidaturas, JSON.stringify(sitesProcessados), JSON.stringify(erros));
}

export function fecharBanco(): void {
  if (db) {
    db.close();
  }
}
