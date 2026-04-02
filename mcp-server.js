#!/usr/bin/env node
/**
 * Memorwise MCP Server
 *
 * Exposes Memorwise's full functionality as MCP tools.
 * Works with Claude Code, Cursor, Codex, or any MCP-compatible client.
 *
 * Usage:
 *   node mcp-server.js
 *
 * Claude Code (~/.claude/settings.json):
 *   "mcpServers": { "memorwise": { "command": "node", "args": ["/path/to/memorwise/mcp-server.js"] } }
 *
 * Cursor (.cursor/mcp.json):
 *   "mcpServers": { "memorwise": { "command": "node", "args": ["/path/to/memorwise/mcp-server.js"] } }
 */

// Bootstrap: register tsconfig paths so imports like @/* work
const path = require('path');
const Module = require('module');

// Set cwd to the project root so all relative imports work
const PROJECT_ROOT = __dirname;
process.chdir(PROJECT_ROOT);

// Register TypeScript transpiler so we can require .ts files directly
const ts = require('typescript');
const tsCompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2017,
  esModuleInterop: true,
  resolveJsonModule: true,
  jsx: ts.JsxEmit.React,
  strict: false,
};
require.extensions['.ts'] = function (module, filename) {
  const code = require('fs').readFileSync(filename, 'utf-8');
  const result = ts.transpileModule(code, { compilerOptions: tsCompilerOptions, fileName: filename });
  module._compile(result.outputText, filename);
};
require.extensions['.tsx'] = require.extensions['.ts'];

// Register @/* path alias
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(PROJECT_ROOT, request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// ─── Now we can import project modules ───

const queries = require('./lib/db/queries.ts');
const generate = require('./lib/generate.ts');
const { registry } = require('./lib/llm/provider-registry.ts');
const { ingestSource } = require('./lib/rag/ingest.ts');
const { retrieveContext } = require('./lib/rag/retrieve.ts');
const { getDataDir, getNotebookSourcesPath } = require('./lib/paths.ts');
const fs = require('fs');

// ─── Tool Definitions ───

const TOOLS = [
  // Notebooks
  { name: 'memorwise_list_notebooks', description: 'List all notebooks', inputSchema: { type: 'object', properties: {} } },
  { name: 'memorwise_create_notebook', description: 'Create a new notebook', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Notebook name' }, description: { type: 'string', description: 'Optional description' } }, required: ['name'] } },
  { name: 'memorwise_delete_notebook', description: 'Delete a notebook and all its data', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_get_notebook', description: 'Get notebook details', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },

  // Sources
  { name: 'memorwise_list_sources', description: 'List sources in a notebook with status and chunk count', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_add_url_source', description: 'Add a URL or YouTube video as a source (auto-extracts and indexes)', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, url: { type: 'string', description: 'Web URL or YouTube URL' } }, required: ['notebookId', 'url'] } },
  { name: 'memorwise_add_text_source', description: 'Add raw text as a source', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, filename: { type: 'string', description: 'Name for source' }, content: { type: 'string', description: 'Text content' } }, required: ['notebookId', 'filename', 'content'] } },
  { name: 'memorwise_delete_source', description: 'Delete a source and its embeddings', inputSchema: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'] } },
  { name: 'memorwise_get_source_content', description: 'Get extracted text of a source', inputSchema: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'] } },

  // Chat / RAG
  { name: 'memorwise_chat', description: 'Ask a question about documents using RAG with citations', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, question: { type: 'string' }, sourceId: { type: 'string', description: 'Optional: focus on one source' } }, required: ['notebookId', 'question'] } },
  { name: 'memorwise_get_context', description: 'Get raw document context from a notebook', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, maxChars: { type: 'number', description: 'Max chars (default 5000)' } }, required: ['notebookId'] } },
  { name: 'memorwise_search', description: 'Search across sources, notes, and messages', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, query: { type: 'string' } }, required: ['notebookId', 'query'] } },

  // Notes
  { name: 'memorwise_list_notes', description: 'List notes in a notebook', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_create_note', description: 'Create a note', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string', description: 'Markdown content' } }, required: ['notebookId', 'title'] } },
  { name: 'memorwise_update_note', description: 'Update a note', inputSchema: { type: 'object', properties: { noteId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['noteId'] } },
  { name: 'memorwise_delete_note', description: 'Delete a note', inputSchema: { type: 'object', properties: { noteId: { type: 'string' } }, required: ['noteId'] } },
  { name: 'memorwise_get_note', description: 'Get a note with full content', inputSchema: { type: 'object', properties: { noteId: { type: 'string' } }, required: ['noteId'] } },

  // Generate
  { name: 'memorwise_generate_summary', description: 'AI summary of all sources', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_generate_quiz', description: 'Generate a multiple-choice quiz', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, count: { type: 'number', description: 'Number of questions (default 10)' } }, required: ['notebookId'] } },
  { name: 'memorwise_generate_flashcards', description: 'Generate flashcards', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_generate_study_guide', description: 'Generate a study guide (saved as a note)', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_generate_suggestions', description: 'Suggest questions to ask about documents', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },

  // Tags
  { name: 'memorwise_list_tags', description: 'List tags', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_create_tag', description: 'Create a tag', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } }, required: ['notebookId', 'name'] } },
  { name: 'memorwise_assign_tag', description: 'Assign tag to a source or note', inputSchema: { type: 'object', properties: { tagId: { type: 'string' }, targetId: { type: 'string' }, targetType: { type: 'string', enum: ['source', 'note'] } }, required: ['tagId', 'targetId', 'targetType'] } },

  // Folders
  { name: 'memorwise_list_folders', description: 'List folders', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_create_folder', description: 'Create a folder', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, name: { type: 'string' }, parentId: { type: 'string' } }, required: ['notebookId', 'name'] } },

  // Chat History
  { name: 'memorwise_list_chat_sessions', description: 'List chat sessions', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
  { name: 'memorwise_get_chat_history', description: 'Get full chat history', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },

  // Generations
  { name: 'memorwise_list_generations', description: 'List saved generations (quizzes, flashcards, etc.)', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' }, type: { type: 'string', description: 'Filter: quiz, flashcards, summary, study-guide' } }, required: ['notebookId'] } },

  // Settings
  { name: 'memorwise_get_settings', description: 'Get current settings (provider, model, etc.)', inputSchema: { type: 'object', properties: {} } },
  { name: 'memorwise_set_provider', description: 'Set active LLM provider', inputSchema: { type: 'object', properties: { provider: { type: 'string', enum: ['ollama', 'openai', 'anthropic', 'gemini', 'groq', 'mistral', 'openrouter', 'lmstudio'] } }, required: ['provider'] } },
  { name: 'memorwise_set_model', description: 'Set active chat model', inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'] } },

  // Knowledge Graph
  { name: 'memorwise_get_knowledge_graph', description: 'Get knowledge graph with concepts and connections', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },

  // Export
  { name: 'memorwise_export_notebook', description: 'Export full notebook data', inputSchema: { type: 'object', properties: { notebookId: { type: 'string' } }, required: ['notebookId'] } },
];

// ─── Tool Handler ───

async function handleTool(name, args) {
  switch (name) {
    case 'memorwise_list_notebooks': return queries.listNotebooks();
    case 'memorwise_create_notebook': return queries.createNotebook(args.name, args.description || '');
    case 'memorwise_delete_notebook': queries.deleteNotebook(args.notebookId); return { success: true };
    case 'memorwise_get_notebook': return queries.getNotebook(args.notebookId) || { error: 'Not found' };

    case 'memorwise_list_sources': return queries.listSources(args.notebookId);
    case 'memorwise_add_url_source': {
      const { extractFromUrl } = require('./lib/rag/web-extract.ts');
      const ex = await extractFromUrl(args.url);
      const dir = getNotebookSourcesPath(args.notebookId);
      const fp = path.join(dir, `${Date.now()}_${ex.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.txt`);
      fs.writeFileSync(fp, ex.text);
      const src = queries.createSource(args.notebookId, ex.title, fp, 'txt', ex.text.length, ex.sourceType);
      ingestSource(src.id, args.notebookId, fp, 'txt', ex.sourceType);
      return { id: src.id, filename: src.filename, status: 'processing', message: 'Indexing started' };
    }
    case 'memorwise_add_text_source': {
      const dir = getNotebookSourcesPath(args.notebookId);
      const fp = path.join(dir, `${Date.now()}_${args.filename}`);
      fs.writeFileSync(fp, args.content);
      const ext = path.extname(args.filename).slice(1) || 'txt';
      const src = queries.createSource(args.notebookId, args.filename, fp, ext, args.content.length, 'file');
      ingestSource(src.id, args.notebookId, fp, ext, 'file');
      return { id: src.id, filename: src.filename, status: 'processing', message: 'Indexing started' };
    }
    case 'memorwise_delete_source': {
      const s = queries.getSource(args.sourceId);
      if (s) { const { deleteSourceChunks } = require('./lib/rag/vectorstore.ts'); await deleteSourceChunks(s.notebook_id, args.sourceId); queries.deleteSource(args.sourceId); }
      return { success: true };
    }
    case 'memorwise_get_source_content': {
      const s = queries.getSource(args.sourceId);
      if (!s) return { error: 'Not found' };
      try { return { filename: s.filename, type: s.source_type, summary: s.summary, content: fs.readFileSync(s.filepath, 'utf-8').slice(0, 10000) }; }
      catch { return { filename: s.filename, summary: s.summary, content: '(not readable)' }; }
    }

    case 'memorwise_chat': {
      let ctx = '', cites = [];
      try { const r = await retrieveContext(args.notebookId, args.question, 8, args.sourceId); ctx = r.context; cites = r.citations; } catch {}
      if (!ctx) { ctx = generate.getNotebookContext(args.notebookId, 5000); cites = queries.listSources(args.notebookId).filter(s => s.status === 'ready' || s.status === 'error').map(s => ({ filename: s.filename })); }
      if (!ctx) return { answer: 'No documents in this notebook.', citations: [] };
      const answer = await registry.getActiveProvider().generate({ model: registry.getActiveChatModel(), messages: [{ role: 'system', content: `Answer using document context. Cite with [1],[2].\n\nContext:\n${ctx}` }, { role: 'user', content: args.question }] });
      return { answer, citations: [...new Map(cites.map(c => [c.filename, c])).values()] };
    }
    case 'memorwise_get_context': return { context: generate.getNotebookContext(args.notebookId, args.maxChars || 5000) };
    case 'memorwise_search': {
      const { getDb } = require('./lib/db/index.ts');
      const db = getDb(); const like = `%${args.query}%`; const r = [];
      db.prepare('SELECT id,filename,summary FROM sources WHERE notebook_id=? AND (filename LIKE ? OR summary LIKE ?) LIMIT 10').all(args.notebookId, like, like).forEach(s => r.push({ type: 'source', id: s.id, title: s.filename, snippet: (s.summary || '').slice(0, 150) }));
      db.prepare('SELECT id,title,content FROM notes WHERE notebook_id=? AND (title LIKE ? OR content LIKE ?) LIMIT 10').all(args.notebookId, like, like).forEach(n => r.push({ type: 'note', id: n.id, title: n.title, snippet: (n.content || '').slice(0, 150) }));
      return r;
    }

    case 'memorwise_list_notes': return queries.listNotes(args.notebookId);
    case 'memorwise_create_note': return queries.createNote(args.notebookId, args.title, args.content || '');
    case 'memorwise_update_note': queries.updateNote(args.noteId, args.title, args.content); return { success: true };
    case 'memorwise_delete_note': queries.deleteNote(args.noteId); return { success: true };
    case 'memorwise_get_note': return queries.getNote(args.noteId) || { error: 'Not found' };

    case 'memorwise_generate_summary': {
      const summary = await generate.generateNotebookSummary(args.notebookId);
      queries.saveGeneration(args.notebookId, 'summary', 'Summary', summary);
      return { summary };
    }
    case 'memorwise_generate_quiz': {
      const ctx = generate.getNotebookContext(args.notebookId, 2500);
      if (!ctx.trim()) return { error: 'No readable sources' };
      const result = await registry.getActiveProvider().generate({ model: registry.getActiveChatModel(), messages: [{ role: 'system', content: `Generate ${args.count || 10} quiz questions. Return JSON array with "question","options"(4),"correctIndex"(0-3),"explanation".` }, { role: 'user', content: ctx }] });
      const m = result.match(/\[[\s\S]*\]/); if (!m) return { error: 'Parse failed' };
      const q = JSON.parse(m[0]); queries.saveGeneration(args.notebookId, 'quiz', `Quiz (${q.length})`, JSON.stringify(q)); return q;
    }
    case 'memorwise_generate_flashcards': {
      const cards = await generate.generateFlashcards(args.notebookId);
      queries.saveGeneration(args.notebookId, 'flashcards', `Flashcards (${cards.length})`, JSON.stringify(cards)); return cards;
    }
    case 'memorwise_generate_study_guide': {
      const content = await generate.generateStudyGuide(args.notebookId);
      const note = queries.createNote(args.notebookId, 'Study Guide', content);
      queries.saveGeneration(args.notebookId, 'study-guide', 'Study Guide', content);
      return { noteId: note.id, content };
    }
    case 'memorwise_generate_suggestions': return await generate.generateSuggestions(args.notebookId);

    case 'memorwise_list_tags': return queries.listTags(args.notebookId);
    case 'memorwise_create_tag': return queries.createTag(args.notebookId, args.name, args.color);
    case 'memorwise_assign_tag': queries.assignTag(args.tagId, args.targetId, args.targetType); return { success: true };

    case 'memorwise_list_folders': return queries.listFolders(args.notebookId);
    case 'memorwise_create_folder': return queries.createFolder(args.notebookId, args.name, args.parentId);

    case 'memorwise_list_chat_sessions': return queries.listChatSessions(args.notebookId);
    case 'memorwise_get_chat_history': return queries.getMessages(args.sessionId);

    case 'memorwise_list_generations': return queries.listGenerations(args.notebookId, args.type);

    case 'memorwise_get_settings': return { provider: registry.getActiveProvider().id, chatModel: registry.getActiveChatModel(), embeddingModel: registry.getActiveEmbeddingModel(), embeddingProvider: registry.getEmbeddingProviderId(), transcription: registry.getTranscriptionProvider(), tts: registry.getTTSProvider(), dataDir: getDataDir() };
    case 'memorwise_set_provider': registry.setActiveProvider(args.provider); return { success: true, provider: args.provider };
    case 'memorwise_set_model': registry.setActiveChatModel(args.model); return { success: true, model: args.model };

    case 'memorwise_get_knowledge_graph': return await queries.getGraphData(args.notebookId);
    case 'memorwise_export_notebook': {
      const nb = queries.getNotebook(args.notebookId); if (!nb) return { error: 'Not found' };
      return { notebook: nb, sources: queries.listSources(args.notebookId), notes: queries.listNotes(args.notebookId), sessions: queries.listChatSessions(args.notebookId).map(s => ({ ...s, messages: queries.getMessages(s.id) })), tags: queries.listTags(args.notebookId), folders: queries.listFolders(args.notebookId), generations: queries.listGenerations(args.notebookId) };
    }

    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Protocol ───

function send(msg) {
  const json = JSON.stringify(msg);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

function handleRequest(req) {
  if (req.method === 'initialize') {
    send({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'memorwise', version: '1.0.8' } } });
  } else if (req.method === 'notifications/initialized') {
    // no response
  } else if (req.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } });
  } else if (req.method === 'tools/call') {
    const { name, arguments: args } = req.params;
    handleTool(name, args || {}).then(result => {
      send({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    }).catch(err => {
      send({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
    });
  } else {
    send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Unknown method: ${req.method}` } });
  }
}

// ─── Stdio Transport ───

let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }
    const len = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;
    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);
    try { handleRequest(JSON.parse(body)); } catch (e) { process.stderr.write(`[memorwise-mcp] Parse error: ${e}\n`); }
  }
});

process.stderr.write('[memorwise-mcp] Server started (' + TOOLS.length + ' tools)\n');
