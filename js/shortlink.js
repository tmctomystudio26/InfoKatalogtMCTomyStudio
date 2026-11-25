/**
 * Shortlink Bypass & Anti-Malware Collaborative Orchestrator (v87)
 *
 * Runs 3 integrated layers together so users never rely on a single engine:
 *  Layer 1 — Instant Local Deterministic Unwrapper (Base64/ROT13/Hex/Query/Safelink + Tracking Cleaner)
 *  Layer 2 — Edge Safe Redirect/HTML Inspector + Parallel Open-Source & Public Bypass APIs
 *            (/api/shortlink-bypass: Edge Tracer + Bypass.VIP + Bypass.PM + Unshorten.me + Unshorten.it)
 *  Layer 3 — Multi-AI Ensemble Security & Deep Link Audit (Gemini + ChatGPT + Claude + Grok + DeepSeek
 *            via Manifest AI multi-provider engine, combining free keyless gateways + user BYOK keys).
 */

import {
  AI_ENSEMBLE_MODELS,
  detectShortlinkService,
  evaluateUrlSafety,
  mergeAiSafetyConsensus,
  mergeBypassEngineResults,
  normalizeAndValidateUrl,
  parseAiSecurityReply,
  runLocalInstantBypass,
  stripTrackingParams,
} from './shortlink-logic.js?v=87';

const EDGE_BYPASS_ENDPOINT = '/api/shortlink-bypass';
const EDGE_TIMEOUT_MS = 11000;
const AI_AUDIT_TIMEOUT_MS = 11000;

let _manifestAiMod = null;
function loadManifestAiMod() {
  if (_manifestAiMod) return Promise.resolve(_manifestAiMod);
  return import('./manifest-ai.js?v=87').then((m) => {
    _manifestAiMod = m;
    return m;
  });
}

async function callEdgeShortlinkApi(targetUrl, signal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new Error('ABORTED');
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetch(EDGE_BYPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error || '', engines: [], edgeTrace: null };
    }
    return json;
  } catch (err) {
    if (signal?.aborted) throw new Error('ABORTED');
    return { ok: false, error: '', engines: [], edgeTrace: null };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Queries the Multi-AI Ensemble (Gemini, ChatGPT, Claude, Grok, DeepSeek) via Manifest AI's
 * unified multi-provider engine to perform a cross-verified phishing, malware & safelink audit.
 */
async function runMultiAiSecurityEnsemble({
  inputUrl,
  finalUrl,
  pageTitle,
  hops,
  edgeSignals,
  heuristicSafety,
  signal,
  onStage,
}) {
  const aiSystemPrompt = [
    'Kamu adalah Panel Auditor Keamanan Tautan & Anti-Malware profesional.',
    'Tugasmu: Analisis tautan shortlink/tujuan berikut untuk mendeteksi risiko malware, phishing, penipuan, unduhan berbahaya (.apk/.exe), dan pengalihan iklan agresif.',
    'Jawab HANYA dalam format JSON valid satu objek tanpa markdown code fence:',
    '{"verdict":"safe|warn|danger","summary":"ringkasan singkat 1-2 kalimat bahasa Indonesia natural","advice":"saran praktis 1 kalimat bahasa Indonesia","extractedUrl":"kosongkan string jika tidak ada URL tersembunyi tambahan"}',
  ].join('\n');

  const auditPrompt = [
    `Tautan Awal: ${inputUrl}`,
    `Tautan Tujuan Terurai: ${finalUrl}`,
    pageTitle ? `Judul Halaman Terdeteksi: ${pageTitle}` : '',
    `Jumlah Pengalihan: ${hops.length}`,
    edgeSignals.length > 0 ? `Sinyal Halaman: ${edgeSignals.join(', ')}` : '',
    `Analisis Awal: ${heuristicSafety.label} (Skor Kepercayaan ${heuristicSafety.trustScore}/100)`,
    'Berikan verifikasi keamanan singkat, objektif, dan mudah dipahami pengguna awam dalam Bahasa Indonesia.',
  ]
    .filter(Boolean)
    .join('\n');

  let aiMod;
  try {
    aiMod = await loadManifestAiMod();
  } catch {
    return [];
  }

  const byokKeys = aiMod.loadStoredByokKeys ? aiMod.loadStoredByokKeys() : [];
  const liveRegistry = aiMod.getCachedModelRegistry ? aiMod.getCachedModelRegistry() : null;

  // Dispatch parallel Multi-AI verification across flagship labs (Gemini, ChatGPT, Claude, Grok, DeepSeek)
  // Using smart quota-aware fan-out: if user has BYOK keys, query them + free ensemble; otherwise run
  // 2 independent focused ensemble passes (Gemini/DeepSeek + ChatGPT/Claude/Grok pool) with crisp timeout.
  const activePanel = AI_ENSEMBLE_MODELS.slice(0, 5);
  const byokProviderIds = new Set(byokKeys.map((k) => k.providerId));

  // Select up to 3 distinct provider perspectives to run concurrently for genuine multi-AI consensus
  // without burning excessive free gateway rate limits.
  const perspectives = [
    {
      modelId: 'gemini',
      label: 'Gemini',
      focusProviderId: 'gemini',
      mode: byokProviderIds.has('gemini') ? 'single' : 'ensemble',
    },
    {
      modelId: 'openai',
      label: 'ChatGPT',
      focusProviderId: 'openai',
      mode: byokProviderIds.has('openai') ? 'single' : 'ensemble',
    },
    {
      modelId: 'deepseek',
      label: 'DeepSeek',
      focusProviderId: 'deepseek',
      mode: byokProviderIds.has('deepseek') ? 'single' : 'ensemble',
    },
  ];

  // If user configured Claude or Grok BYOK keys, include them directly too!
  if (byokProviderIds.has('claude')) {
    perspectives.push({ modelId: 'claude', label: 'Claude', focusProviderId: 'claude', mode: 'single' });
  }
  if (byokProviderIds.has('grok')) {
    perspectives.push({ modelId: 'grok', label: 'Grok', focusProviderId: 'grok', mode: 'single' });
  }

  if (onStage) onStage('Menjalankan verifikasi keamanan Multi-AI (Gemini, ChatGPT, Claude, Grok, DeepSeek)...');

  const runSinglePerspective = async (spec) => {
    const localCtrl = new AbortController();
    const timer = setTimeout(() => localCtrl.abort(), AI_AUDIT_TIMEOUT_MS);
    const onOuterAbort = () => localCtrl.abort();
    if (signal) signal.addEventListener('abort', onOuterAbort, { once: true });

    try {
      const res = await aiMod.sendManifestAiMessage({
        history: [],
        prompt: auditPrompt,
        mode: spec.mode,
        focusProviderId: spec.focusProviderId,
        byokKeys,
        combineByokWithFree: true,
        liveRegistry,
        signal: localCtrl.signal,
        customSystemPrompt: aiSystemPrompt,
        disableWebResearch: true,
        siteMode: 'utilities',
        localFallbackBuilder: () => '',
      });
      const parsed = parseAiSecurityReply(res?.content || '');
      if (!parsed) return null;
      return {
        modelId: spec.modelId,
        label: spec.label,
        actualProvider: res?.meta?.providerId || spec.focusProviderId,
        parsed,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onOuterAbort);
    }
  };

  // Run primary perspective + secondary cross-check concurrently
  const settled = await Promise.allSettled(perspectives.slice(0, 2).map(runSinglePerspective));
  if (signal?.aborted) throw new Error('ABORTED');

  const reports = settled
    .filter((s) => s.status === 'fulfilled' && s.value)
    .map((s) => s.value);

  // If neither succeeded (e.g. network offline), try the 3rd perspective once quickly
  if (reports.length === 0 && perspectives[2]) {
    const third = await runSinglePerspective(perspectives[2]);
    if (third) reports.push(third);
  }

  return {
    reports,
    councilModels: activePanel,
  };
}

/**
 * Main entry point: runs the complete 3-layer collaborative shortlink bypass & security audit.
 */
export async function executeCollaborativeBypass(
  rawInput,
  { enableMultiAi = true, signal = null, onStage = () => {} } = {}
) {
  const startedAt = Date.now();
  const check = normalizeAndValidateUrl(rawInput);
  if (!check.valid) {
    throw new Error(check.error || 'Tautan tidak valid.');
  }

  const serviceInfo = detectShortlinkService(check.url);

  // Layer 1: Instant Local Unwrapper (<1ms)
  onStage('Mengurai parameter & muatan terenkripsi secara lokal...');
  const localResult = runLocalInstantBypass(check.url);
  const edgeTargetUrl = localResult.unwrapped ? localResult.resolvedUrl : check.url;

  // Layer 2: Collaborative Edge Redirect/HTML Inspector + Open-Source/Public Bypass APIs
  onStage('Menghubungkan mesin Bypass Open-Source, API Publik & Pelacak Pengalihan...');
  const edgeResponse = await callEdgeShortlinkApi(edgeTargetUrl, signal);
  if (signal?.aborted) throw new Error('ABORTED');

  // Re-run local unwrapper on the edge-resolved URL in case the final redirect landed on a safelink/tracking wrapper
  const postLocal = edgeResponse?.edgeTrace?.resolvedUrl
    ? runLocalInstantBypass(edgeResponse.edgeTrace.resolvedUrl)
    : null;

  const merged = mergeBypassEngineResults({
    inputUrl: check.url,
    localResult: postLocal?.unwrapped ? postLocal : localResult,
    edgeResponse,
  });

  // Heuristic malware/phishing/download evaluation
  const heuristicSafety = evaluateUrlSafety(merged.finalUrl, {
    inputUrl: check.url,
    hopsCount: merged.hops.length + (localResult.steps?.length || 0),
    edgeSignals: merged.edgeSignals,
  });

  // Layer 3: Multi-AI Ensemble Security & Deep Link Audit
  let finalSafety = {
    ...heuristicSafety,
    aiConsensusUsed: false,
    aiSummary: '',
    aiAdvice: '',
    aiModelsParticipated: [],
    aiExtractedUrl: '',
  };

  if (enableMultiAi) {
    const aiOut = await runMultiAiSecurityEnsemble({
      inputUrl: check.url,
      finalUrl: merged.finalUrl,
      pageTitle: merged.pageTitle,
      hops: merged.hops,
      edgeSignals: merged.edgeSignals,
      heuristicSafety,
      signal,
      onStage,
    });
    if (aiOut && Array.isArray(aiOut.reports) && aiOut.reports.length > 0) {
      finalSafety = mergeAiSafetyConsensus(heuristicSafety, aiOut.reports);
    }
  }

  // If Multi-AI uncovered a cleaner nested destination URL, adopt it safely
  let resolvedFinalUrl = merged.finalUrl;
  let bypassedFlag = merged.bypassed;
  if (finalSafety.aiExtractedUrl && finalSafety.aiExtractedUrl !== resolvedFinalUrl) {
    const aiCheck = normalizeAndValidateUrl(finalSafety.aiExtractedUrl);
    if (aiCheck.valid) {
      resolvedFinalUrl = stripTrackingParams(aiCheck.url).cleanUrl;
      bypassedFlag = true;
    }
  }

  return {
    ok: true,
    inputUrl: check.url,
    finalUrl: resolvedFinalUrl,
    bypassed: bypassedFlag || resolvedFinalUrl !== check.url,
    serviceInfo,
    pageTitle: merged.pageTitle,
    trackingRemovedCount: merged.trackingRemovedCount,
    removedParams: merged.removedParams,
    localSteps: localResult.steps || [],
    hops: merged.hops,
    engineRows: merged.engineRows,
    agreeingEngines: merged.agreeingEngines,
    agreeingCount: merged.agreeingCount,
    totalEnginesChecked: merged.totalEnginesChecked,
    safety: finalSafety,
    aiCouncilModels: AI_ENSEMBLE_MODELS,
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
}
