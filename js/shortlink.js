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
} from './shortlink-logic.js?v=90';

const EDGE_BYPASS_ENDPOINT = '/api/shortlink-bypass';
const EDGE_TIMEOUT_MS = 24000;
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
  reachedDestination,
  stillOnShortener,
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
    `Tautan Terakhir Terbaca: ${finalUrl}`,
    `Status Bypass: ${reachedDestination ? 'Berhasil tembus ke tujuan akhir' : stillOnShortener ? 'Belum tembus (tertahan tantangan anti-bot / server shortlink)' : 'Tautan langsung'}`,
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

  const activePanel = AI_ENSEMBLE_MODELS.slice(0, 5);
  const byokProviderIds = new Set(byokKeys.map((k) => k.providerId));

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

  const settled = await Promise.allSettled(perspectives.slice(0, 2).map(runSinglePerspective));
  if (signal?.aborted) throw new Error('ABORTED');

  const reports = settled
    .filter((s) => s.status === 'fulfilled' && s.value)
    .map((s) => s.value);

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

  // Layer 2: Collaborative Edge Cookie-Jar Tracer + Native Solvers + Open-Source/Public APIs
  onStage('Menjalankan Solver Native, BypassX, TRW, Unshorten & Edge Tracer...');
  const edgeResponse = await callEdgeShortlinkApi(edgeTargetUrl, signal);
  if (signal?.aborted) throw new Error('ABORTED');

  // Re-run local unwrapper on any resolved remote URL (handles safelink/UTM wrappers inside API output)
  const solvedCandidates = [
    edgeResponse?.edgeTrace?.resolvedUrl,
    ...(Array.isArray(edgeResponse?.engines)
      ? edgeResponse.engines.filter((e) => e?.ok && e?.resolvedUrl).map((e) => e.resolvedUrl)
      : []),
  ].filter(Boolean);

  let postLocal = null;
  for (const cand of solvedCandidates) {
    const testLocal = runLocalInstantBypass(cand);
    if (testLocal.unwrapped || (testLocal.removedParams?.length || 0) > 0) {
      postLocal = testLocal;
      break;
    }
  }

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
      reachedDestination: merged.reachedDestination,
      stillOnShortener: merged.stillOnShortener,
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

  let resolvedFinalUrl = merged.finalUrl;
  let reachedDestination = merged.reachedDestination;
  let partialAdvance = merged.partialAdvance;
  let stillOnShortener = merged.stillOnShortener;

  if (finalSafety.aiExtractedUrl && finalSafety.aiExtractedUrl !== resolvedFinalUrl) {
    const aiCheck = normalizeAndValidateUrl(finalSafety.aiExtractedUrl);
    if (aiCheck.valid) {
      resolvedFinalUrl = stripTrackingParams(aiCheck.url).cleanUrl;
      reachedDestination = true;
      partialAdvance = false;
      stillOnShortener = false;
    }
  }

  return {
    ok: true,
    inputUrl: check.url,
    finalUrl: resolvedFinalUrl,
    bypassed: reachedDestination || resolvedFinalUrl !== check.url,
    reachedDestination,
    partialAdvance,
    stillOnShortener,
    cfBlocked: merged.cfBlocked,
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
