export function evaluatePromotion(candidateMetrics, bestMetrics, policy) {
  if (!bestMetrics) {
    return { promote: true, reasons: ['no prior best — seed best'], regressions: [] };
  }

  const reasons = [];
  const regressions = [];
  const minDelta = Number(policy.minRecallOrMrrDelta ?? 0.01);
  const maxReg = Number(policy.maxQualityRegression ?? 0.02);
  const maxNoResultReg = Number(policy.maxNoResultAccuracyRegression ?? 0.02);
  const maxLatencyRatio = Number(policy.maxP95LatencyIncreaseRatio ?? 0.3);

  const recallGain = (candidateMetrics.recallAt5 ?? 0) - (bestMetrics.recallAt5 ?? 0);
  const mrrGain = (candidateMetrics.mrr ?? 0) - (bestMetrics.mrr ?? 0);
  const qualityImproved = recallGain >= minDelta || mrrGain >= minDelta;
  if (!qualityImproved) {
    regressions.push(`no quality gain: recallΔ=${recallGain.toFixed(4)} mrrΔ=${mrrGain.toFixed(4)} < ${minDelta}`);
  } else {
    reasons.push(`quality gain recallΔ=${recallGain.toFixed(4)} mrrΔ=${mrrGain.toFixed(4)}`);
  }

  const qualityMetrics = Array.isArray(policy.qualityMetrics)
    ? policy.qualityMetrics
    : [
        'hitAt1',
        'hitAt3',
        'hitAt5',
        'recallAt5',
        'mrr',
        'ndcgAt5',
        'metadataFilterAccuracy',
      ];
  for (const key of qualityMetrics) {
    if (candidateMetrics[key] == null || bestMetrics[key] == null) {
      continue;
    }
    const drop = bestMetrics[key] - candidateMetrics[key];
    if (drop > maxReg) {
      regressions.push(`${key} regressed by ${drop.toFixed(4)} > ${maxReg}`);
    }
  }

  if (candidateMetrics.noResultAccuracy != null && bestMetrics.noResultAccuracy != null) {
    const drop = bestMetrics.noResultAccuracy - candidateMetrics.noResultAccuracy;
    if (drop > maxNoResultReg) {
      regressions.push(`noResultAccuracy regressed by ${drop.toFixed(4)} > ${maxNoResultReg}`);
    }
  }

  const latencyFloor = Number(policy.minP95LatencyFloorMs ?? 0);
  if (
    candidateMetrics.p95LatencyMs != null
    && bestMetrics.p95LatencyMs != null
    && bestMetrics.p95LatencyMs > 0
    && bestMetrics.p95LatencyMs >= latencyFloor
  ) {
    const increase = (candidateMetrics.p95LatencyMs - bestMetrics.p95LatencyMs) / bestMetrics.p95LatencyMs;
    if (increase > maxLatencyRatio) {
      regressions.push(`p95 latency increased by ${(increase * 100).toFixed(1)}% > ${maxLatencyRatio * 100}%`);
    }
  }

  if (policy.forbidDuplicateIncrease !== false) {
    const candDup = candidateMetrics.duplicateIncidentOrDocumentCount ?? 0;
    const bestDup = bestMetrics.duplicateIncidentOrDocumentCount ?? 0;
    if (candDup > bestDup) {
      regressions.push(`duplicates increased ${bestDup} -> ${candDup}`);
    }
  }

  return {
    promote: qualityImproved && regressions.length === 0,
    reasons,
    regressions,
  };
}
