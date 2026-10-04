const capacity = [
    12,
    10,
    10,
    8,
    8,
    6,
    6,
    6
];
export function initialAllocation() {
    return {
        weights: Array(8).fill(0),
        gate: Array(8).fill(0),
        levels: Array(8).fill(0),
        zones: Array(4).fill(0),
        previous: null
    };
}
function vector(x, size, max = Number.MAX_VALUE) {
    if (!Array.isArray(x) || x.length !== size || x.some((n)=>!Number.isFinite(n) || n < 0 || n > max)) throw new Error('BAD_ALLOCATION_VECTOR');
}
export function allocateReference(state, input) {
    vector(state.weights, 8, 1);
    vector(state.gate, 8, 1);
    vector(state.levels, 8, 2);
    vector(state.zones, 4, 2);
    if (state.previous !== null) vector(state.previous, 8);
    vector(input.waits, 8);
    vector(input.spotGiven, 8);
    if (typeof input.boundary !== 'boolean' || ![
        input.nudge,
        input.budget,
        input.given
    ].every((n)=>Number.isFinite(n) && n >= 0) || input.nudge > 8) throw new Error('BAD_ALLOCATION_INPUT');
    const raw = input.waits.map((m, k)=>{
        let w = Math.min(1, Math.max(0, 1 - m / 8)) ** 2;
        if (state.previous !== null && (m - state.previous[k]) / .5 > .3) w *= .25;
        return w;
    });
    const weights = raw.map((w, k)=>state.weights[k] + (w - state.weights[k]) * Math.min(1, .5 / (w > state.weights[k] ? 6 : .5)));
    const chances = weights.map((w)=>Math.min(.9, .5 * input.nudge / 2) * w), gate = input.boundary ? [
        ...weights
    ] : [
        ...state.gate
    ];
    const eligible = weights.map((w, k)=>Math.min(w, gate[k]));
    const capLeft = input.spotGiven.map((n)=>n < Math.ceil(.25 * input.budget) && input.given < input.budget);
    const amounts = eligible.map((w, k)=>w * capacity[k] * (w > .05 ? 1 : 0) * (capLeft[k] ? 1 : 0));
    const sum = amounts.reduce((a, b)=>a + b, 0), suggestions = sum > 0 ? amounts.map((w)=>w / sum) : null;
    const level = (w)=>w > .6 ? 2 : w > .3 ? 1 : 0;
    const newLevels = weights.map(level), newZones = Array.from({
        length: 4
    }, (_, z)=>level(Math.min(weights[2 * z], weights[2 * z + 1])));
    const levels = input.boundary ? newLevels : newLevels.map((v, k)=>Math.min(v, state.levels[k]));
    const zones = input.boundary ? newZones : newZones.map((v, k)=>Math.min(v, state.zones[k]));
    return {
        state: {
            weights,
            gate,
            levels,
            zones,
            previous: [
                ...input.waits
            ]
        },
        chances,
        suggestions,
        capLeft
    };
}
export function allocate(state, input) {
    const r = allocateReference(state, input);
    if (!input.boundary) r.state.gate = r.state.gate.map((w, k)=>Math.min(w, r.state.weights[k]));
    const amounts = r.state.weights.map((w, k)=>{
        const allowed = Math.min(w, r.state.gate[k]);
        return allowed * capacity[k] * (allowed > .05 ? 1 : 0) * (r.capLeft[k] ? 1 : 0);
    });
    const sum = amounts.reduce((a, b)=>a + b, 0);
    r.suggestions = sum > 0 ? amounts.map((w)=>w / sum) : null;
    return r;
}
export function earlyMultiplier(time, enabled) {
    if (!Number.isFinite(time) || time < 0 || typeof enabled !== 'boolean') throw new Error('BAD_GOVERNOR_INPUT');
    return enabled ? 1 + .5 * Math.max(0, 1 - time / 90) : 1;
}
export function initialGovernor(target = 2, early = false, windowMinutes = 6) {
    if (!Number.isFinite(target) || target < 0 || target > 8 || !Number.isFinite(windowMinutes) || windowMinutes < 6 || windowMinutes > 12) throw new Error('BAD_GOVERNOR_INPUT');
    return {
        effective: target,
        hot: false,
        lastCut: -1e9,
        windowBudget: 30 * target * earlyMultiplier(0, early) * windowMinutes / 10
    };
}
export function governReference(state, input) {
    vector(input.waits, 8);
    vector(input.induced10, 8);
    if (input.induced10.some((n)=>!Number.isInteger(n)) || typeof input.boundary !== 'boolean' || typeof state.hot !== 'boolean' || ![
        input.time,
        input.target,
        input.windowMinutes,
        state.effective,
        state.windowBudget
    ].every((n)=>Number.isFinite(n) && n >= 0) || !Number.isFinite(state.lastCut) || input.target > 8 || state.effective > 8 || input.windowMinutes < 6 || input.windowMinutes > 12 || input.time < state.lastCut) throw new Error('BAD_GOVERNOR_INPUT');
    const next = {
        ...state
    };
    if (input.boundary) {
        if (!next.hot) next.effective = Math.min(input.target, next.effective + 1);
        next.hot = false;
        next.windowBudget = 30 * next.effective * earlyMultiplier(input.time, input.early) * input.windowMinutes / 10;
    } else earlyMultiplier(input.time, input.early);
    const effectiveForFrame = next.effective;
    const warning = input.waits.some((wait, k)=>wait > 6 && input.induced10[k] >= capacity[k]);
    let cut = false;
    if (warning) {
        next.hot = true;
        if (input.time - next.lastCut >= 2) {
            next.effective = Math.max(1, next.effective / 2);
            next.lastCut = input.time;
            cut = true;
        }
    }
    return {
        state: next,
        effectiveForFrame,
        warning,
        cut
    };
}
export function govern(state, input) {
    if (!Number.isFinite(state.effective) || state.effective < 0 || state.effective > 8) throw new Error('BAD_GOVERNOR_INPUT');
    const capped = {
        ...state,
        effective: Math.min(state.effective, input.target)
    };
    const r = governReference(capped, input);
    r.state.effective = Math.min(input.target, r.state.effective);
    return r;
}
