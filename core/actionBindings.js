// core/actionBindings.js
// Helper to resolve action bindings for buttons+directions.
// Binding keys: 'P' or 'M' as base, optional direction prefixes: '↑','↓','←','→' or combinations like '→+P'

export function defaultBindingsForChar(charId) {
  // Per-character sensible defaults. Neutral-only actions by default.
  const neutralP = { onPress: 'p', onHold: null, onRelease: null };
  const neutralM = { onPress: 'm', onHold: null, onRelease: null };
  if (charId === 'sbluer') {
    return {
      'P': { onPress: 'p', onHold: 'spit', onRelease: null },
      'M': neutralM
    };
  }
  if (charId === 'tyeman') {
    // Tyeman uses a custom charge flow handled by Fighter; keep neutral press mapped
    return {
      'P': { onPress: 'p', onHold: null, onRelease: null },
      'M': neutralM
    };
  }
  if (charId === 'fernando') {
    // Fernando: hold should trigger thin_laser overlay (not spit)
    return {
      'P': { onPress: 'p', onHold: 'thin_laser', onRelease: null },
      'M': { onPress: 'm', onHold: 'thin_laser', onRelease: null }
    };
  }
  // fallback generic neutral mapping
  return {
    'P': neutralP,
    'M': neutralM
  };
}

// Resolve best matching binding given a bindings map, current dirSymbol and buttonKey
export function resolveBinding(bindingsMap = {}, dirSymbol = null, buttonKey = 'P') {
  if (!bindingsMap || typeof bindingsMap !== 'object') return null;
  // Prefer exact dir+button
  if (dirSymbol) {
    const key = `${dirSymbol}+${buttonKey}`;
    if (bindingsMap[key]) return bindingsMap[key];
    // try horizontal preferential mapping: map forward/back depending on facing handled by caller
    // also try single-direction fallback
  }
  // fallback to neutral button
  if (bindingsMap[buttonKey]) return bindingsMap[buttonKey];
  return null;
}
