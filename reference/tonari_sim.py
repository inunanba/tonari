"""
TONARI rare-tile allocation: agent-based crowd simulation.

Compares how rare-tile placement strategies move a crowd across K checkpoints
(gates / toilets / stands) in the 3 h before a Tokyo Dome show.

Strategies
  none         : no rare tiles (reference)
  fixed        : (a) rare tiles always at one pre-chosen "quiet" spot, location public (pin)
  least_busy   : (b) rare tiles at whichever spot currently has the shortest measured wait,
                 recomputed every minute, location public (pin)
  damped       : (c) TONARI dynamic damped rule: inverse-congestion weight with a ceiling,
                 asymmetric smoothing (slow up / fast down), trend-based cooling,
                 per-spot cap per window, randomized window lengths. No public pin:
                 a fan who asks "where should I go?" gets a *personal* sticky suggestion sampled
                 in proportion to spare capacity (different fans -> different spots); idle
                 browsing shows only a coarse, conservative zone heat map
Ablations / stress tests of (c)
  damped_zone  : same algorithm, but only a public coarse zone heat map (no personal suggestion)
  damped_pin   : same algorithm, but exact per-spot drop chance is public (pin-like)
  damped_stress: personal suggestion, but fans over-believe it (perceived 0.8) and are
                 3x as eager to chase -> isolates the damping/cap/cooling mechanics

Everything except the allocation rule and what the app shows is identical across
strategies: same background crowd, same players, same rare budget per window,
same "one rare per ticket per window" rule, same random seeds.

Run:  .venv/bin/python tonari_sim.py            (v1: writes results.json, results.md, charts)
      .venv/bin/python tonari_sim.py v2 20      (v2 levers + exit model: writes results_v2.json/.md, tonari_v2_levers.png;
                                                 v1 files are not touched, and v1 numbers reproduce bit-for-bit)
"""
import json, math, sys
from collections import deque
import numpy as np

# ---------------- scenario ----------------
K = 8                                    # checkpoints
CAP = np.array([12, 10, 10, 8, 8, 6, 6, 6], float)       # service capacity, people/min
BG_SHARE = np.array([.30, .20, .13, .10, .09, .07, .06, .05])  # background crowd preference (skewed to main gates)
ZONE = np.array([0, 0, 1, 1, 2, 2, 3, 3])  # 4 concourse zones, 2 checkpoints each
NZ = 4
T_END = 180.0                            # minutes simulated (doors -> show start window)
DT = 0.5                                 # minutes per step
N_PLAYERS = 2000                         # active TONARI players
NEED_MEAN = 120.0                        # each player needs a checkpoint (toilet/stand/merch) every ~120 min
CHECK_MEAN = 10.0                        # idle players glance at the app every ~10 min
EAGER = 0.15                             # base probability scale of an extra "rare-chasing" trip
RETURN_MIN = 5.0                         # after service, player walks back / busy for 5 min
BUDGET = 30                              # rare drops per 10-minute-equivalent window (all strategies)
FIXED_SPOT = 7                           # (a) the venue's pre-chosen "quiet" spot
SENSE_LAG = 1.0                          # sensor/scan aggregation lag (min)
SENSE_NOISE = 0.10                       # +-10% multiplicative noise on the measured wait
HINT_LAG = 2.0                           # what fans see is ~2 min stale (offline phones, word of mouth) - all strategies

BG_BASE, BG_PEAK, BG_WIDTH = 22.0, 28.0, 40.0
def bg_rate(t):
    """background (non-player) arrivals per minute, peaking ~90 min after doors (the pre-show rush)."""
    return BG_BASE + BG_PEAK * math.exp(-((t - 90.0) / BG_WIDTH) ** 2)

# ---------------- damped-rule parameters ----------------
W_MAX = 8.0        # minutes of wait at which a spot's rare weight hits zero (the ceiling)
GAMMA = 2.0        # convexity of inverse-congestion weight
P_MAX = 0.5        # max rare chance per completed scan at a fully quiet spot
TAU_UP = 6.0       # min: weights rise slowly
TAU_DOWN = 0.5     # min: weights fall fast (cooling)
SLOPE_COOL = 0.3   # min of extra wait per min -> "load rising" -> cool immediately
COOL_FACTOR = 0.25
SPOT_CAP_SHARE = 0.25  # no spot may hand out more than 25% of a window's budget
WIN_MIN, WIN_MAX = 6.0, 12.0  # randomized window length (min)
LEVEL_VAL = {0: 0.0, 1: 0.10, 2: 0.25}   # perceived rare chance shown for hint levels
RARE_UTIL = 4.0    # utility of a sure rare, in units where 1 min of walking = 0.8
BALK_MIN, BALK_MAX = 10.0, 30.0  # rare-chasers (not need trips) give up if the visible queue exceeds this many minutes


DEFAULT_NUDGE = 2.0   # venue slider default for (c), picked from the nudge sweep (see frontier chart)

# ---------------- v2 lever parameters (all OFF by default -> v1 results reproduce bit-for-bit) ----------------
W_OFFER = W_MAX            # tail-scan / in-queue offer appears only when the measured wait is above the ceiling
URGENT_SHARE = 0.5         # share of need trips that are urgent (toilet); the rest are deferrable (stand / merch)
REDIR_ACC = 0.35           # P(accept "a quiet spot nearby, go now (+bonus)") for deferrable needs
REDIR_ACC_URGENT = 0.45    # ... for urgent needs (an empty toilet 2 min away is attractive)
TOK_ACC = 0.35             # P(accept a "come back at hh:mm, no wait + bonus" virtual-queue token), deferrable
TOK_ACC_URGENT = 0.05      # ... urgent needs rarely defer
TOK_MIN_DELAY, TOK_MAX_DELAY = 10.0, 60.0
LATER_ACC = 0.4            # of token takers, share who take the "come back after the peak, +bigger bonus" option
TOK_TARGET_WAIT = W_MAX / 2   # "later" return slot = earliest time the forecast wait is <= 4 min
PRIO_SLOT_SHARE = 0.5      # priority-lane returns per 5-min slot <= 50% of the spot's capacity in that slot
EARLY_PULL_UP, EARLY_PEAK_DOWN = 0.6, 0.5   # early responders: +60% discretionary visits before t=60, -50% in t=60..130
EARLY_BUDGET_BOOST = 0.5   # "early check-in luck": rare budget x1.5 at doors, fading linearly to x1 at t=90
GOV_WARN = 0.75            # AIMD governor: halve the nudge if a lucky spot reaches 75% of the ceiling


BG_TOTAL = sum(bg_rate(x) * DT for x in np.arange(0, 170.0 + 1e-9, DT))


def _arrival_cdf():
    tt = np.arange(0, 170.0 + 1e-9, 0.5)
    dens = np.array([bg_rate(x) for x in tt]); dens /= dens.sum()
    return tt, np.cumsum(dens), dens


def run(strategy, seed, n_players=N_PLAYERS, eager=EAGER, nudge=None,
        arrivals=False, early=0.0, token=False, governor=False, acc_scale=1.0, oracle=False):
    """nudge = venue "nudge budget" slider for (c): scales rare budget and hint strength.

    v2 levers (default off; v1 behaviour is unchanged when all are off):
      arrivals : players enter the venue over time (density ~ crowd curve) and their first visit is their
                 ticketed gate (fixed spot, no choice) -> only *time* can move gate load
      early    : share of players who respond to the pre-show "early check-in luck" window by arriving
                 20-60 min earlier (continuous fade, no cliff); rare budget boosted early
      token    : tail-scan / in-queue offers at spots whose measured wait > ceiling: (1) personal redirect to
                 a quiet spot now (space-shift), or (2) a virtual-queue token: leave the physical line and come
                 back to a priority lane when your turn is due ("hold"), or later, after the forecast peak, for a
                 bigger bonus ("later" = time-shift). Priority returns are capped per 5-min slot
      governor : AIMD safety governor on the nudge slider: halve at once if a spot reaches 75% of the ceiling
                 while TONARI-induced arrivals (suggested / chasing / redirected / token) there in the last 10 min
                 are >= 10% of its throughput; +1 per quiet window, up to the slider value. It watches the load
                 we cause, not natural load
      acc_scale: multiplies all offer acceptance probabilities (sensitivity)
      oracle   : upper bound for any player-only lever: players never use the hot spot 0 for need trips
                 (their ticketed gate visit still goes there)
    All extra randomness uses a separate generator so the base random stream is untouched."""
    if nudge is None:
        nudge = DEFAULT_NUDGE
    rng = np.random.default_rng(seed)
    rng2 = np.random.default_rng([seed, 7])
    damped = strategy.startswith("damped")
    steps = int(T_END / DT)
    # player home positions -> travel time (min) to each checkpoint
    # players are a subset of the same crowd: their habitual checkpoint follows the crowd's preference
    home_spot = rng.choice(K, n_players, p=BG_SHARE)
    zdist = np.abs(ZONE[home_spot][:, None] - ZONE[None, :])   # 0..3 zones away
    travel = 1.0 + 1.5 * zdist + 0.75 * (np.arange(K)[None, :] != home_spot[:, None]) + rng.uniform(0, 0.5, (n_players, K))

    eager_s = eager * (3.0 if strategy == "damped_stress" else 1.0)

    # player state: 0 idle, 1 travelling, 2 queued, 3 returning, 4 not yet in the venue
    state = np.zeros(n_players, int)
    t_arr = np.zeros(n_players)
    target = np.zeros(n_players, int)
    t_free = np.zeros(n_players)
    last_rare_win = np.full(n_players, -1)
    is_seeker = np.zeros(n_players, bool)
    balk = rng.uniform(BALK_MIN, BALK_MAX, n_players)
    balked = 0
    display_moves = 0

    # ---- v2 state ----
    is_gate = np.zeros(n_players, bool)
    urgent = np.zeros(n_players, bool)
    offers = np.zeros(n_players, int)
    has_token = np.zeros(n_players, bool)
    partial = np.zeros(n_players)
    n_redirect = n_token = n_token_served = n_token_ok = 0
    deferral = []
    t_enter = np.zeros(n_players)
    early_resp = np.zeros(n_players, bool)
    bg_scale = 1.0
    if arrivals:
        att, acdf, adens = _arrival_cdf()
        # players are part of the arriving crowd: the background is scaled down so expected arrivals are unchanged
        bg_scale = max(0.0, 1.0 - n_players / BG_TOTAL)
        t_enter = att[np.minimum(np.searchsorted(acdf, rng2.random(n_players)), len(att) - 1)]
        if early > 0:
            early_resp = rng2.random(n_players) < early
            resp = early_resp & (t_enter > 30.0)
            shift = rng2.uniform(0.0, 1.0, n_players)
            hi = np.minimum(60.0, t_enter - 5.0)
            new_t = t_enter - (20.0 + shift * np.maximum(0.0, hi - 20.0))
            t_enter = np.where(resp & (hi > 20.0), new_t, t_enter)
        state[:] = 4
    def bmult(t):
        return 1.0 + EARLY_BUDGET_BOOST * max(0.0, 1.0 - t / 90.0) if early > 0 else 1.0
    nudge_eff = nudge
    win_hot = False
    last_cut = -1e9
    lucky_recent = np.full(K, -1e9)
    over_prev = np.zeros(K, bool)
    herding = 0
    herding_ind = 0
    induced = np.zeros(n_players, bool)
    ind_log = [deque() for _ in range(K)]          # times of TONARI-induced arrivals per spot (suggested / chasing / offers)
    nudge_log = []
    # forecast inflow (venue's typical-day curve, with a per-show calibration error)
    if token:
        ferr = rng2.uniform(0.85, 1.15)
        tgrid = np.arange(0, T_END + TOK_MAX_DELAY + 1, DT)
        if arrivals:
            att, acdf, adens = _arrival_cdf()
            dens_t = np.interp(tgrid, att, adens / 0.5, left=0, right=0)
            present = np.interp(tgrid, att, acdf, left=0, right=1)
            prate = n_players * dens_t + n_players * present / NEED_MEAN
        else:
            prate = np.full(len(tgrid), n_players / NEED_MEAN)
        bg_g = np.array([bg_scale * max(0.0, bg_rate(x) - (0 if arrivals else (n_players - N_PLAYERS) / NEED_MEAN)) for x in tgrid])
        lam_f = ferr * (bg_g + prate)[:, None] * BG_SHARE[None, :]           # (time, K)
        nb = int((T_END + TOK_MAX_DELAY) // 5) + 2
        tok_used = np.zeros((K, nb)); tok_cap = PRIO_SLOT_SHARE * CAP * 5.0
        fq = np.zeros((K, int(TOK_MAX_DELAY / DT) + 1))
        redir_used = np.zeros(K)

    queues = [deque() for _ in range(K)]          # entries: (arrival_time, player_id or -1)
    prio = [deque() for _ in range(K)]            # virtual-queue returners (served first)
    hold_time = np.zeros(n_players)
    n_hold = n_later = 0
    serve_acc = np.zeros(K)
    bg_acc = 0.0

    hist_wait = []                                  # per step true expected wait per spot (min)
    hist_q = []
    waits = []                                      # individual queue waits (min)
    pwaits = []; pwaits_v = []
    rare_given = 0
    rare_given_quiet = 0
    seeker_trips = 0
    seeker_arrivals = np.zeros((steps, K))
    flips = 0
    last_top = -1
    meas_hist = deque()                             # for sensor lag
    disp_hist = deque()                             # for hint staleness

    # damped state
    w_s = np.zeros(K)
    w_gate = np.zeros(K)
    sugg_q = None
    level = np.zeros(K, int)                        # per-spot displayed level (for pin ablation) / zone
    zlevel = np.zeros(NZ, int)
    win_idx = 0
    win_end = rng.uniform(WIN_MIN, WIN_MAX) if damped else 10.0
    win_len = win_end
    budget = BUDGET * (nudge if damped else 1.0) * bmult(0.0)
    win_budget = budget * (win_len / 10.0) if damped else BUDGET
    win_spot_given = np.zeros(K)
    win_given = 0
    prev_meas = None
    p_drop = np.zeros(K)
    pin = -1

    def offer(pid, k, t, meas, pos_wait):
        """tail-scan / in-queue offer at a busy spot. Returns True if the player leaves the queue."""
        nonlocal n_redirect, n_token, n_hold, n_later
        urg = urgent[pid]
        # (1) space-shift: personal redirect to a quiet spot (capped per minute by its spare capacity)
        cand = (np.arange(K) != k) & (meas < W_MAX / 2) & (redir_used < np.maximum(1.0, 0.5 * CAP * (1 - meas / W_MAX)))
        if damped:
            wts = np.where(cand, np.maximum(w_s, 1e-3) * CAP, 0.0)
            if wts.sum() > 0:
                j = int(rng2.choice(K, p=wts / wts.sum()))
                tt = 1.75 + 1.5 * abs(int(ZONE[k]) - int(ZONE[j]))
                acc = (REDIR_ACC_URGENT if urg else REDIR_ACC) * math.exp(-(tt - 1.75) / 4.0) * acc_scale
                if rng2.random() < acc:
                    state[pid] = 1; target[pid] = j; t_arr[pid] = t + tt; induced[pid] = True
                    offers[pid] = 99; redir_used[j] += 1; n_redirect += 1
                    return True
        # (2) virtual-queue token: leave the physical line now; "hold" = come back when your turn is due,
        #     "later" = come back after the forecast peak for a bigger bonus (true time-shift)
        acc = (TOK_ACC_URGENT if urg else TOK_ACC) * acc_scale
        if rng2.random() >= acc:
            return False
        est = pos_wait
        tau = t + max(2.0, est - 2.0); later = False
        if rng2.random() < LATER_ACC:
            for i in range(int((tau - t + TOK_MIN_DELAY) / DT), fq.shape[1]):
                tl = t + i * DT
                if tl > T_END - 5:
                    break
                if fq[k, i] / CAP[k] <= TOK_TARGET_WAIT and tok_used[k, int(tl // 5)] < tok_cap[k]:
                    tau = tl; later = True
                    break
        b = int(tau // 5)
        if tok_used[k, b] >= tok_cap[k]:
            return False
        state[pid] = 1; target[pid] = k; t_arr[pid] = tau
        has_token[pid] = True; offers[pid] = 99; tok_used[k, b] += 1; n_token += 1
        if later:
            n_later += 1; deferral.append(tau - t)
        else:
            n_hold += 1; hold_time[pid] = tau - t
        return True

    def _mark2(pid):
        offers[pid] = 2
        return True

    for s in range(steps):
        t = s * DT
        # ---------- windows ----------
        if t >= win_end:
            win_idx += 1
            if damped:
                win_len = rng.uniform(WIN_MIN, WIN_MAX)
            else:
                win_len = 10.0
            win_end = t + win_len
            if governor and damped:
                if not win_hot:                      # additive increase after a quiet window
                    nudge_eff = min(nudge, nudge_eff + 1.0)
                win_hot = False
            if (governor or early > 0) and damped:
                budget = BUDGET * nudge_eff * bmult(t)
            win_budget = budget * (win_len / 10.0)
            win_spot_given[:] = 0
            win_given = 0
            window_boundary = True
        else:
            window_boundary = (s == 0)
        nudge_log.append(nudge_eff)

        # ---------- sensing (lagged, noisy) ----------
        true_wait = np.array([len(q) + len(pq) for q, pq in zip(queues, prio)]) / CAP
        meas_hist.append((t, true_wait.copy()))
        while meas_hist and meas_hist[0][0] < t - SENSE_LAG:
            meas_hist.popleft()
        meas = meas_hist[0][1] * rng.uniform(1 - SENSE_NOISE, 1 + SENSE_NOISE, K)

        # ---------- allocation + what the app shows ----------
        perceived = np.zeros(K)       # perceived rare chance per visit, as seen by fans
        zone_perc = np.zeros(K)
        personal = False
        if strategy == "fixed":
            pin = FIXED_SPOT
            p_drop[:] = 0; p_drop[FIXED_SPOT] = 1.0
            perceived[FIXED_SPOT] = 0.8
        elif strategy == "least_busy":
            if abs(t - round(t)) < 1e-9:   # recompute each minute
                new = int(np.argmin(meas))
                if new != pin and pin != -1:
                    flips += 1; display_moves += 1
                pin = new
            p_drop[:] = 0; p_drop[pin] = 1.0
            perceived[pin] = 0.8
        elif damped:
            w_raw = np.clip(1.0 - meas / W_MAX, 0, 1) ** GAMMA
            if prev_meas is not None:
                slope = (meas - prev_meas) / DT
                w_raw = np.where(slope > SLOPE_COOL, w_raw * COOL_FACTOR, w_raw)
            prev_meas = meas.copy()
            tau = np.where(w_raw > w_s, TAU_UP, TAU_DOWN)
            w_s += (w_raw - w_s) * np.minimum(1.0, DT / tau)
            p_drop = min(0.9, P_MAX * nudge_eff / 2.0) * w_s   # slider scales the per-scan chance too
            if window_boundary:
                w_gate = w_s.copy()
            w_sugg = np.minimum(w_s, w_gate)              # a spot can only *start* being suggested at a window boundary
            cap_left = (win_spot_given < math.ceil(SPOT_CAP_SHARE * win_budget)) & (win_given < win_budget)
            sugg_q = w_sugg * CAP * (w_sugg > 0.05) * cap_left   # never suggest a spot whose cap is used up
            sugg_q = sugg_q / sugg_q.sum() if sugg_q.sum() > 0 else None
            # displayed levels: down moves immediately (cooling is visible), up moves only at window boundaries
            new_level = np.where(w_s > 0.6, 2, np.where(w_s > 0.3, 1, 0))
            # conservative zone hint: a zone only lights up if *every* checkpoint in it is quiet
            zw = np.array([w_s[ZONE == z].min() for z in range(NZ)])
            new_z = np.where(zw > 0.6, 2, np.where(zw > 0.3, 1, 0))
            if window_boundary:
                if strategy in ("damped_pin", "damped", "damped_stress"):
                    display_moves += int(((new_level == 2) & (level < 2)).sum())
                else:
                    display_moves += int(((new_z == 2) & (zlevel < 2)).sum())
                level = new_level; zlevel = new_z
            else:
                level = np.minimum(level, new_level); zlevel = np.minimum(zlevel, new_z)
            top = int(np.argmax(w_s))
            if last_top != -1 and top != last_top and w_s[top] > w_s[last_top] + 0.05:
                flips += 1
                last_top = top
            elif last_top == -1:
                last_top = top
            if strategy == "damped_pin":
                perceived = p_drop.copy()
            if strategy == "damped_stress":
                zone_perc = np.array([{0: 0.0, 1: 0.4, 2: 0.8}[int(zlevel[ZONE[k]])] for k in range(K)])
            else:
                zone_perc = np.array([min(0.9, nudge_eff * LEVEL_VAL[int(zlevel[ZONE[k]])]) for k in range(K)])
            if strategy == "damped_zone":
                perceived = zone_perc
            elif strategy != "damped_pin":
                perceived = None   # personal suggestion, drawn per decision below

        # ---------- herding-incident KPI + governor early warning (no randomness) ----------
        lucky_recent = np.where(p_drop > 0.05, t, lucky_recent)
        for k in range(K):
            while ind_log[k] and ind_log[k][0] < t - 10.0:
                ind_log[k].popleft()
        ind10 = np.array([len(d) for d in ind_log])
        ind_heavy = ind10 >= 0.1 * CAP * 10.0                   # we caused >=10% of the spot's throughput in 10 min
        over = true_wait > W_MAX
        herding += int((over & ~over_prev & (t - lucky_recent <= 10.0)).sum())
        herding_ind += int((over & ~over_prev & ind_heavy).sum())
        over_prev = over
        if governor and damped and np.any(ind_heavy & (meas > GOV_WARN * W_MAX)):
            win_hot = True
            if t - last_cut >= 2.0:                  # multiplicative decrease, immediately (2-min refractory)
                nudge_eff = max(1.0, nudge_eff / 2.0); last_cut = t

        # ---------- what fans see is HINT_LAG minutes stale ----------
        disp_hist.append((t, None if perceived is None else perceived.copy(), None if sugg_q is None else sugg_q.copy(), p_drop.copy(), zone_perc.copy()))
        while len(disp_hist) > 1 and disp_hist[1][0] <= t - HINT_LAG:
            disp_hist.popleft()
        _, perceived_l, sugg_l, pdrop_l, zone_l = disp_hist[0]
        if perceived is not None and perceived_l is None:
            perceived_l = np.zeros(K)

        # ---------- forecast for virtual-queue tokens (venue curve + measured queue, fluid model) ----------
        if token and abs(t - round(t)) < 1e-9:
            redir_used[:] = 0
            q = meas * CAP
            fq[:, 0] = q
            for i in range(1, fq.shape[1]):
                q = np.maximum(0.0, q + (lam_f[s + i] - CAP) * DT)
                fq[:, i] = q

        # ---------- background arrivals ----------
        if arrivals:
            bg_acc += bg_scale * bg_rate(t) * DT
        else:
            bg_acc += max(0.0, bg_rate(t) - (n_players - N_PLAYERS) / NEED_MEAN) * DT   # same total crowd at higher adoption
        n_bg = int(bg_acc); bg_acc -= n_bg
        if n_bg:
            spots = rng.choice(K, n_bg, p=BG_SHARE)
            for k in spots:
                queues[k].append((t, -1))

        # ---------- players: entering the venue (v2) -> ticketed gate, no choice ----------
        if arrivals:
            ent = np.where((state == 4) & (t >= t_enter))[0]
            if ent.size:
                state[ent] = 1; target[ent] = home_spot[ent]; is_gate[ent] = True
                t_arr[ent] = t + rng2.uniform(0.5, 1.5, ent.size)

        # ---------- players: returning -> idle ----------
        back = (state == 3) & (t >= t_free)
        state[back] = 0

        # ---------- players: decisions ----------
        idle = np.where(state == 0)[0]
        if idle.size:
            need = rng.random(idle.size) < DT / NEED_MEAN
            check = rng.random(idle.size) < DT / CHECK_MEAN
            if early > 0:
                er = early_resp[idle]
                if t < 60.0:
                    need = need | (er & (rng2.random(idle.size) < EARLY_PULL_UP * DT / NEED_MEAN))
                elif t < 130.0:
                    need = need & ~(er & (rng2.random(idle.size) < EARLY_PEAK_DOWN))
            eligible = last_rare_win[idle] != win_idx
            # need trips: choose by travel time (logit) + rare attraction if eligible
            personal = perceived is None
            if not personal:
                perceived = perceived_l
            for i, pid in enumerate(idle):
                go = False; seeker = False
                if personal:
                    # pull-only: a personal (sticky, randomized) suggestion only when the fan asks for a facility;
                    # idle browsing only shows the coarse, conservative zone heat
                    if need[i]:
                        perceived = np.zeros(K)
                        if sugg_l is not None:
                            j = int(rng.choice(K, p=sugg_l))
                            perceived[j] = 0.8 if strategy == "damped_stress" else pdrop_l[j]
                    else:
                        perceived = zone_l
                u = -0.8 * travel[pid]
                if eligible[i]:
                    u = u + RARE_UTIL * perceived
                if need[i]:
                    go = True
                elif check[i] and eligible[i] and perceived.max() > 0:
                    attract = perceived * np.exp(-travel[pid] / 4.0)
                    if rng.random() < eager_s * attract.max():
                        go = True; seeker = True
                if go:
                    pr = np.exp(u - u.max())
                    if oracle:
                        pr[0] = 0.0
                    pr /= pr.sum()
                    k = int(rng.choice(K, p=pr))
                    induced[pid] = seeker or (personal and need[i] and perceived[k] > 0)
                    if seeker and not oracle:
                        # chasers head for the spot that looks luckiest (nearest among ties)
                        k = int(np.argmax(attract + 1e-6 * rng.random(K)))
                        seeker_trips += 1
                    is_seeker[pid] = seeker
                    if token:
                        urgent[pid] = (not seeker) and (rng2.random() < URGENT_SHARE)
                        offers[pid] = 0
                    state[pid] = 1; target[pid] = k; t_arr[pid] = t + travel[pid, k]

        # ---------- players: arrive & join queue ----------
        arriving = np.where((state == 1) & (t >= t_arr))[0]
        for pid in arriving:
            k = target[pid]
            # v2: with tail-scan offers on, a chaser's tail scan shows "luck here: none, line ~N min", so chasers
            # leave once the measured wait passes 75% of the ceiling instead of their personal 10-30 min patience
            balk_lim = min(balk[pid], GOV_WARN * W_MAX) if (token and damped) else balk[pid]
            if is_seeker[pid] and (len(queues[k]) / CAP[k] > balk[pid] or (token and damped and meas[k] > balk_lim)):
                balked += 1
                state[pid] = 3; t_free[pid] = t + RETURN_MIN; is_seeker[pid] = False
                continue
            if token and damped and (not is_gate[pid]) and offers[pid] == 0 and meas[k] > W_OFFER:
                offers[pid] = 1
                if offer(pid, k, t, meas, (len(queues[k]) + len(prio[k])) / CAP[k]):
                    continue
            if induced[pid] or has_token[pid]:
                ind_log[k].append(t); induced[pid] = False
            if has_token[pid]:
                prio[k].append((t, int(pid)))
            else:
                queues[k].append((t, int(pid)))
            state[pid] = 2
        # ---------- in-queue offer (once, after >= 5 min, if the remaining wait is still above the ceiling) ----------
        if token and damped:
            for k in range(K):
                if meas[k] <= W_OFFER:
                    continue
                keep = deque(); changed = False
                for pos, (ta, pid) in enumerate(queues[k]):
                    if (pid >= 0 and not is_gate[pid] and offers[pid] < 2 and t - ta >= 5.0
                            and pos / CAP[k] > W_OFFER and _mark2(pid) and offer(pid, k, t, meas, (pos + len(prio[k])) / CAP[k])):
                        partial[pid] += t - ta; changed = True
                        continue
                    keep.append((ta, pid))
                if changed:
                    queues[k] = keep
        # ---------- service ----------
        serve_acc += CAP * DT
        for k in range(K):
            n = int(serve_acc[k]); serve_acc[k] -= n
            for _ in range(min(n, len(queues[k]) + len(prio[k]))):
                ta, pid = prio[k].popleft() if prio[k] else queues[k].popleft()
                if pid >= 0:
                    wv = t - ta + partial[pid]
                    waits.append(wv); pwaits.append(wv); pwaits_v.append(wv + hold_time[pid])
                    partial[pid] = 0.0; hold_time[pid] = 0.0
                    if has_token[pid]:
                        n_token_served += 1; n_token_ok += int(t - ta <= 5.0); has_token[pid] = False
                    is_gate[pid] = False
                else:
                    waits.append(t - ta)
                if pid >= 0:
                    # drop token is scanned at the exit side of the checkpoint (after queuing)
                    if last_rare_win[pid] != win_idx and win_given < win_budget:
                        cap_ok = (not damped) or win_spot_given[k] < math.ceil(SPOT_CAP_SHARE * win_budget)
                        if cap_ok and rng.random() < p_drop[k]:
                            last_rare_win[pid] = win_idx
                            win_given += 1; win_spot_given[k] += 1; rare_given += 1
                            if true_wait[k] < W_MAX:
                                rare_given_quiet += 1
                    state[pid] = 3; t_free[pid] = t + RETURN_MIN; is_seeker[pid] = False
        hist_wait.append(np.array([len(q) + len(pq) for q, pq in zip(queues, prio)]) / CAP)
        hist_q.append(np.array([len(q) + len(pq) for q, pq in zip(queues, prio)]))

    hw = np.array(hist_wait); hq = np.array(hist_q)
    w = np.array(waits)
    early_steps = int(60 / DT)
    return {
        "peak_queue": int(hq.max()),
        "peak_queue_hot_spot0": int(hq[:, 0].max()),
        "peak_queue_quiet_spots": int(hq[:, 2:].max()),
        "max_expected_wait_quiet_spots": float(hw[:, 2:].max()),
        "peak_queue_spot": int(np.unravel_index(hq.argmax(), hq.shape)[1]),
        "max_wait": float(w.max()),
        "p95_wait": float(np.percentile(w, 95)),
        "mean_wait": float(w.mean()),
        "var_wait_across_spots": float(hw.var(axis=1).mean()),   # min^2, time-averaged cross-spot variance
        "std_wait_across_spots": float(hw.std(axis=1).mean()),
        "minutes_any_spot_over_15min_wait": float((hw.max(axis=1) > 15).sum() * DT),
        "rares": rare_given,
        "rares_at_quiet_spots_pct": (100.0 * rare_given_quiet / rare_given) if rare_given else 0.0,
        "seeker_trips": seeker_trips,
        "flips": display_moves,
        "balked": balked,
        # ---- v2 metrics (no effect on the v1 numbers above) ----
        "peak_wait_busiest_min": float(hw.max()),
        "peak_queue_first_60min": int(hq[:early_steps].max()),
        "player_mean_wait": float(np.mean(pwaits)) if pwaits else 0.0,
        "herding_incidents": herding,
        "herding_incidents_induced": herding_ind,
        "redirects": n_redirect,
        "tokens": n_token,
        "tokens_hold": n_hold,
        "tokens_later": n_later,
        "player_mean_wait_incl_virtual": float(np.mean(pwaits_v)) if pwaits_v else 0.0,
        "token_mean_deferral_min": float(np.mean(deferral)) if deferral else 0.0,
        "token_served_within_5min_pct": (100.0 * n_token_ok / n_token_served) if n_token_served else 0.0,
        "nudge_eff_mean": float(np.mean(nudge_log)),
        "_hist_wait": hw,
        "_hist_q": hq,
    }


STRATS = ["none", "fixed", "least_busy", "damped", "damped_zone", "damped_pin", "damped_stress"]
LABEL = {"none": "no rares (reference)", "fixed": "(a) fixed rare spot", "least_busy": "(b) static least-busy",
         "damped": "(c) dynamic damped", "damped_zone": "(c) ablation: zone heat only", "damped_pin": "(c) ablation: exact pin shown",
         "damped_stress": "(c) stress: 3x eager, over-believing"}

if __name__ == "__main__" and not (len(sys.argv) > 1 and sys.argv[1] == "v2"):
    seeds = list(range(int(sys.argv[1]) if len(sys.argv) > 1 else 20))
    out = {}
    example = {}
    for st in STRATS:
        rs = [run(st, sd) for sd in seeds]
        keys = [k for k in rs[0] if not k.startswith("_") and k != "peak_queue_spot"]
        out[st] = {k: {"mean": float(np.mean([r[k] for r in rs])), "sd": float(np.std([r[k] for r in rs]))} for k in keys}
        example[st] = rs[0]
        print(st, {k: round(v["mean"], 1) for k, v in out[st].items()}, flush=True)
    sweep = {}
    for st in ["none", "fixed", "least_busy", "damped"]:
        rs = [run(st, sd, n_players=5000) for sd in seeds]
        keys = [k for k in rs[0] if not k.startswith("_") and k != "peak_queue_spot"]
        sweep[st] = {k: {"mean": float(np.mean([r[k] for r in rs])), "sd": float(np.std([r[k] for r in rs]))} for k in keys}
        print("adoption5000", st, {k: round(v["mean"], 1) for k, v in sweep[st].items()}, flush=True)
    frontier = {}
    for m in [0.5, 1.0, 2.0, 4.0, 6.0, 8.0]:
        rs = [run("damped", sd, nudge=m) for sd in seeds[:10]]
        frontier[m] = {k: float(np.mean([r[k] for r in rs])) for k in ["peak_queue_hot_spot0", "max_expected_wait_quiet_spots", "peak_queue_quiet_spots", "mean_wait", "rares", "seeker_trips"]}
        print("nudge", m, {k: round(v, 1) for k, v in frontier[m].items()}, flush=True)
    json.dump({"seeds": len(seeds), "adoption_5000_players": sweep, "nudge_frontier_damped_10seeds": frontier, "params": {"K": K, "CAP": CAP.tolist(), "BG_SHARE": BG_SHARE.tolist(), "N_PLAYERS": N_PLAYERS,
               "T_END_min": T_END, "BUDGET_per_10min": BUDGET, "EAGER": EAGER, "W_MAX": W_MAX, "P_MAX": P_MAX,
               "TAU_UP": TAU_UP, "TAU_DOWN": TAU_DOWN, "SPOT_CAP_SHARE": SPOT_CAP_SHARE}, "results": out},
              open("results.json", "w"), indent=2)

    # markdown table
    cols = [("peak_queue", "Peak queue, any spot (people)"), ("peak_queue_hot_spot0", "Peak queue at the naturally hot spot 0"),
            ("peak_queue_quiet_spots", "Peak queue at normally-quiet spots 2-7"), ("max_wait", "Max wait (min)"), ("p95_wait", "p95 wait (min)"),
            ("mean_wait", "Mean wait (min)"), ("std_wait_across_spots", "Cross-spot SD of wait (min)"),
            ("var_wait_across_spots", "Cross-spot variance (min²)"),
            ("minutes_any_spot_over_15min_wait", "Minutes any spot >15 min wait"),
            ("rares", "Rares given"), ("rares_at_quiet_spots_pct", "% rares given at spots <8 min wait"),
            ("seeker_trips", "Rare-chasing trips"), ("flips", "Public hint moves")]
    lines = ["| Strategy | " + " | ".join(c[1] for c in cols) + " |", "|---|" + "---|" * len(cols)]
    for st in STRATS:
        lines.append(f"| {LABEL[st]} | " + " | ".join(f"{out[st][c]['mean']:.1f} ± {out[st][c]['sd']:.1f}" for c, _ in cols) + " |")
    lines2 = ["| Strategy (5,000 players, same total crowd) | " + " | ".join(c[1] for c in cols) + " |", "|---|" + "---|" * len(cols)]
    for st in sweep:
        lines2.append(f"| {LABEL[st]} | " + " | ".join(f"{sweep[st][c]['mean']:.1f} ± {sweep[st][c]['sd']:.1f}" for c, _ in cols) + " |")
    open("results.md", "w").write(f"Mean ± SD over {len(seeds)} seeds. N={N_PLAYERS} players + background crowd, K={K} checkpoints, 180 min.\n\n" + "\n".join(lines) + "\n\nAdoption sensitivity: 5,000 players (background reduced so the total crowd is unchanged).\n\n" + "\n".join(lines2) + "\n")
    print("\n".join(lines))

    # charts
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(2, 3, figsize=(17, 9.5))
    tt = np.arange(int(T_END / DT)) * DT
    for ax, st in zip(axes[0], ["fixed", "least_busy", "damped"]):
        hq = example[st]["_hist_q"]
        for k in range(K):
            ax.plot(tt, hq[:, k], lw=1.2, label=f"spot {k} (cap {int(CAP[k])}/min)")
        ax.set_title(LABEL[st] + " — queue length per spot (seed 0)")
        ax.set_xlabel("minutes after doors"); ax.set_ylabel("people in queue"); ax.grid(alpha=.3)
    ymax = max(axes[0][i].get_ylim()[1] for i in range(3))
    for i in range(3):
        axes[0][i].set_ylim(0, ymax)
    axes[0][0].legend(fontsize=7, loc="upper left")
    names = [LABEL[s] for s in STRATS]
    metrics = [("peak_queue_quiet_spots", "Peak queue at normally-quiet spots (people)"), ("max_wait", "Max individual wait (min)"),
               ("std_wait_across_spots", "Cross-spot SD of wait (min, time-avg)")]
    colors = ["#999", "#d62728", "#ff7f0e", "#2ca02c", "#bcbd22", "#98df8a", "#1f77b4"]
    for ax, (m, title) in zip(axes[1], metrics):
        vals = [out[s][m]["mean"] for s in STRATS]; errs = [out[s][m]["sd"] for s in STRATS]
        ax.bar(range(len(STRATS)), vals, yerr=errs, color=colors, capsize=3)
        ax.set_xticks(range(len(STRATS))); ax.set_xticklabels(names, rotation=25, ha="right", fontsize=8)
        ax.set_title(title + f" — mean ± SD, {len(seeds)} seeds"); ax.grid(axis="y", alpha=.3)
    fig.suptitle("TONARI rare-tile allocation: fixed vs least-busy vs dynamic damped (agent-based, 2,000 players + background crowd, 8 checkpoints)", fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig("tonari_sim_chart.png", dpi=110)
    print("saved tonari_sim_chart.png")

    # frontier chart: benefit (hot-spot queue) vs herding cost (worst wait created at quiet spots)
    fig2, ax = plt.subplots(figsize=(8.5, 6))
    xs = [frontier[m]["max_expected_wait_quiet_spots"] for m in frontier]; ys = [frontier[m]["peak_queue_hot_spot0"] for m in frontier]
    ax.plot(xs, ys, "-o", color="#2ca02c", label="(c) dynamic damped, nudge-budget slider x0.5 … x8")
    for m, x, y in zip(frontier, xs, ys):
        ax.annotate(f"x{m:g}", (x, y), textcoords="offset points", xytext=(6, 4), fontsize=9)
    for st, c, mk in [("none", "#999", "s"), ("fixed", "#d62728", "X"), ("least_busy", "#ff7f0e", "D"), ("damped_stress", "#1f77b4", "^")]:
        ax.scatter(out[st]["max_expected_wait_quiet_spots"]["mean"], out[st]["peak_queue_hot_spot0"]["mean"], color=c, marker=mk, s=80, label=LABEL[st], zorder=3)
    ax.set_xscale("symlog", linthresh=10)
    ax.axvline(W_MAX, color="k", ls=":", lw=1); ax.text(W_MAX * 1.03, ax.get_ylim()[0] + 2, "W_MAX ceiling (8 min)", fontsize=8)
    ax.set_xlabel("Herding cost: worst expected wait created at normally-quiet spots (min, symlog)")
    ax.set_ylabel("Benefit: peak queue at the naturally hot spot (people, lower is better)")
    ax.set_title("Nudge strength vs herding risk (mean over seeds)")
    ax.grid(alpha=.3); ax.legend(fontsize=8)
    fig2.tight_layout(); fig2.savefig("tonari_nudge_frontier.png", dpi=110)
    print("saved tonari_nudge_frontier.png")


# =====================================================================================================
# v2: exit / station model (regulated exit after the show) and the v2 experiment driver
# =====================================================================================================
EXIT_M = 20000          # fans heading for the bottleneck station (JR Suidobashi) [INF: ~40% of ~50k]
EXIT_WAVES = 12         # regulated-exit blocks
EXIT_GAP = 4.0          # min between block calls (first call at +2 min -> last at +46 min)
EXIT_NC = 0.10          # share of fans in later blocks who ignore the call and leave at +0..8 min [INF]
EXIT_MU = 250.0         # station gate throughput, people/min [INF, calibrated: baseline worst wait ~30 min]
EXIT_STAY_ACC = 0.5     # P(a player offered the seated "finale round" stays)
EXIT_STAY = (10.0, 25.0)  # personal, randomised extra stay (min)
EXIT_HOLD_CAP = 75.0    # nobody is held past +75 min (venue close / staff); FREEZE ends all holds at once


def run_exit(seed, adoption=0.0, lever="none"):
    """lever: none | station_aware (personal random stay, only while the station is forecast busy)
              | fixed_finale (naive: everyone who stays leaves together at +50 min)"""
    rng = np.random.default_rng([seed, 99])
    M = EXIT_M
    wave = rng.integers(0, EXIT_WAVES, M)
    call = 2.0 + EXIT_GAP * wave
    player = rng.random(M) < adoption
    nc = np.where(player, EXIT_NC * 0.3, EXIT_NC)           # the seated game keeps players compliant
    early_leave = (rng.random(M) < nc) & (call > 10.0)
    leave = np.where(early_leave, rng.uniform(0, 8, M), call + rng.uniform(0, 3, M))
    walk = rng.uniform(10.0, 18.0, M)

    def station(arr):
        a = np.sort(arr); i = np.arange(len(a))
        dep = i / EXIT_MU + np.maximum.accumulate(a - i / EXIT_MU)
        return a, dep

    base_arr = leave + walk
    a0, d0 = station(base_arr)
    extra = np.zeros(M)
    if lever != "none" and adoption > 0:
        # forecast from the baseline schedule: wait at the station when this fan would arrive
        wait_at = np.interp(base_arr, a0, d0 - a0)
        offered = player & ~early_leave & (wait_at > 5.0)
        stays = offered & (rng.random(M) < EXIT_STAY_ACC)
        if lever == "station_aware":
            extra = np.where(stays, rng.uniform(*EXIT_STAY, M), 0.0)
            extra = np.minimum(extra, np.maximum(0.0, EXIT_HOLD_CAP - leave))
        elif lever == "fixed_finale":
            extra = np.where(stays, np.maximum(0.0, 50.0 - leave), 0.0)
    arr = leave + extra + walk
    a, d = station(arr)
    w = d - a
    tt = np.arange(0, 120.5, 0.5)
    qlen = np.searchsorted(a, tt, side="right") - np.searchsorted(np.sort(d), tt, side="right")
    arr_rate = np.histogram(a, bins=np.arange(0, 121, 1.0))[0]
    return {"peak_station_queue": int(qlen.max()), "peak_arrivals_per_min": int(arr_rate.max()), "max_station_wait": float(w.max()),
            "mean_station_wait": float(w.mean()), "p95_station_wait": float(np.percentile(w, 95)),
            "station_clear_min": float(d.max()), "players_stayed_pct": 100.0 * float((extra > 0).sum()) / max(1, int(player.sum())),
            "mean_extra_seated_min_stayers": float(extra[extra > 0].mean()) if (extra > 0).any() else 0.0,
            "_qlen": qlen}


V2_CONFIGS = [
    # name, scenario label, kwargs
    ("A none", "v1", dict(strategy="none")),
    ("B damped x2 (v1 default)", "v1", dict(strategy="damped")),
    ("C x6 + governor", "v1", dict(strategy="damped", nudge=6, governor=True)),
    ("D x2 + queue offers/VQ tokens", "v1", dict(strategy="damped", token=True)),
    ("E x2 + early-luck 15%", "v1", dict(strategy="damped", early=0.15)),
    ("F BEST: x2+gov+tokens+early", "v1", dict(strategy="damped", governor=True, token=True, early=0.15)),
    ("F4 x4+gov+tokens+early", "v1", dict(strategy="damped", nudge=4, governor=True, token=True, early=0.15)),
    ("G x6+gov+tokens+early", "v1", dict(strategy="damped", nudge=6, governor=True, token=True, early=0.15)),
    ("H naive ban of hot spot", "v1", dict(strategy="none", oracle=True)),
    ("F pessimistic (acc x0.5, early 7%)", "v1", dict(strategy="damped", governor=True, token=True, early=0.07, acc_scale=0.5)),
    ("F optimistic (acc x1.5, early 30%)", "v1", dict(strategy="damped", governor=True, token=True, early=0.30, acc_scale=1.5)),
    ("F stress (3x eager, over-believing)", "v1", dict(strategy="damped_stress", governor=True, token=True, early=0.15)),
    ("F4 stress (3x eager, over-believing)", "v1", dict(strategy="damped_stress", nudge=4, governor=True, token=True, early=0.15)),
    ("A none @5k", "v1-5k", dict(strategy="none", n_players=5000)),
    ("B damped x2 @5k", "v1-5k", dict(strategy="damped", n_players=5000)),
    ("F BEST @5k", "v1-5k", dict(strategy="damped", governor=True, token=True, early=0.15, n_players=5000)),
    ("F4 x4 combo @5k", "v1-5k", dict(strategy="damped", nudge=4, governor=True, token=True, early=0.15, n_players=5000)),
    ("G x6 combo @5k", "v1-5k", dict(strategy="damped", nudge=6, governor=True, token=True, early=0.15, n_players=5000)),
    ("A none (gate arrivals)", "v2", dict(strategy="none", arrivals=True)),
    ("B damped x2 (gate arrivals)", "v2", dict(strategy="damped", arrivals=True)),
    ("E x2 + early-luck 15% (gate arrivals)", "v2", dict(strategy="damped", arrivals=True, early=0.15)),
    ("F BEST (gate arrivals)", "v2", dict(strategy="damped", arrivals=True, governor=True, token=True, early=0.15)),
    ("F4 x4 combo (gate arrivals)", "v2", dict(strategy="damped", arrivals=True, nudge=4, governor=True, token=True, early=0.15)),
    ("F optimistic (gate arrivals)", "v2", dict(strategy="damped", arrivals=True, governor=True, token=True, early=0.30, acc_scale=1.5)),
]


def _v2_job(args):
    name, sd = args
    cfg = dict(next(c for n, _, c in V2_CONFIGS if n == name)); st = cfg.pop("strategy")
    r = run(st, sd, **cfg)
    keep = {k: v for k, v in r.items() if not k.startswith("_")}
    if sd == 0:
        keep["_hist_q"] = r["_hist_q"].tolist()
    return name, sd, keep


def main_v2(n_seeds=20):
    from multiprocessing import Pool
    jobs = [(n, s) for n, _, _ in V2_CONFIGS for s in range(n_seeds)]
    with Pool() as pool:
        res = pool.map(_v2_job, jobs)
    out, ex = {}, {}
    for n, scen, _ in V2_CONFIGS:
        rs = [r for nm, _, r in res if nm == n]
        ex[n] = next(r["_hist_q"] for nm, sd, r in res if nm == n and sd == 0)
        keys = [k for k in rs[0] if not k.startswith("_") and k != "peak_queue_spot"]
        out[n] = {"scenario": scen, **{k: {"mean": float(np.mean([r[k] for r in rs])), "sd": float(np.std([r[k] for r in rs]))} for k in keys}}
        print(n, {k: round(out[n][k]["mean"], 2) for k in ["peak_queue", "peak_wait_busiest_min", "max_expected_wait_quiet_spots", "mean_wait", "player_mean_wait_incl_virtual", "herding_incidents_induced", "redirects", "tokens", "nudge_eff_mean"]}, flush=True)
    # exit model
    exit_cfg = [("baseline (no game)", 0.0, "none")]
    for a in (0.05, 0.15, 0.30):
        exit_cfg.append((f"station-aware seated finale, adoption {int(a*100)}%", a, "station_aware"))
    exit_cfg.append(("naive fixed-time finale, adoption 15%", 0.15, "fixed_finale"))
    exit_out, exit_ex = {}, {}
    for name, a, lv in exit_cfg:
        rs = [run_exit(sd, a, lv) for sd in range(n_seeds)]
        exit_ex[name] = rs[0]["_qlen"].tolist()
        keys = [k for k in rs[0] if not k.startswith("_")]
        exit_out[name] = {k: {"mean": float(np.mean([r[k] for r in rs])), "sd": float(np.std([r[k] for r in rs]))} for k in keys}
        print("exit", name, {k: round(v["mean"], 1) for k, v in exit_out[name].items()}, flush=True)
    params = {"W_OFFER": W_OFFER, "URGENT_SHARE": URGENT_SHARE, "REDIR_ACC": REDIR_ACC, "REDIR_ACC_URGENT": REDIR_ACC_URGENT,
              "TOK_ACC": TOK_ACC, "TOK_ACC_URGENT": TOK_ACC_URGENT, "LATER_ACC": LATER_ACC, "TOK_TARGET_WAIT": TOK_TARGET_WAIT,
              "PRIO_SLOT_SHARE": PRIO_SLOT_SHARE, "EARLY_PULL_UP": EARLY_PULL_UP, "EARLY_PEAK_DOWN": EARLY_PEAK_DOWN,
              "EARLY_BUDGET_BOOST": EARLY_BUDGET_BOOST, "GOV_WARN": GOV_WARN, "EXIT_M": EXIT_M, "EXIT_WAVES": EXIT_WAVES,
              "EXIT_GAP": EXIT_GAP, "EXIT_NC": EXIT_NC, "EXIT_MU": EXIT_MU, "EXIT_STAY_ACC": EXIT_STAY_ACC, "EXIT_STAY": EXIT_STAY,
              "EXIT_HOLD_CAP": EXIT_HOLD_CAP}
    json.dump({"seeds": n_seeds, "params_v2": params, "concourse": out, "exit": exit_out}, open("results_v2.json", "w"), indent=2)

    # markdown
    base = {"v1": out["A none"], "v1-5k": out["A none @5k"], "v2": out["A none (gate arrivals)"]}
    cols = [("peak_queue", "Busiest-spot peak queue (people)"), ("peak_wait_busiest_min", "Busiest-spot peak wait (min)"),
            ("max_expected_wait_quiet_spots", "Quiet-spot worst wait (min)"), ("mean_wait", "Mean standing wait, all (min)"),
            ("player_mean_wait_incl_virtual", "Player wait incl. virtual hold (min)"), ("p95_wait", "p95 wait (min)"),
            ("peak_queue_first_60min", "Peak queue first 60 min"), ("herding_incidents", "Ceiling crossings ≤10 min after lucky"),
            ("herding_incidents_induced", "Induced herding incidents"),
            ("seeker_trips", "Rare-chasing trips"), ("redirects", "Redirects"), ("tokens", "VQ tokens"),
            ("token_mean_deferral_min", "'Later' token deferral (min)"), ("nudge_eff_mean", "Mean effective nudge")]
    lines = [f"Mean ± SD over {n_seeds} seeds. v1 = the original scenario (players present from doors; identical to results.md). "
             "v1-5k = 5,000 players, same total crowd. v2 = players enter over time through their ticketed gate (no choice of gate).", "",
             "| Config | Scenario | Busiest-spot change vs none | " + " | ".join(c[1] for c in cols) + " |", "|---|---|---|" + "---|" * len(cols)]
    for n, scen, _ in V2_CONFIGS:
        d = 100.0 * (out[n]["peak_queue"]["mean"] / base[scen]["peak_queue"]["mean"] - 1)
        lines.append(f"| {n} | {scen} | {d:+.0f}% | " + " | ".join(f"{out[n][c]['mean']:.1f} ± {out[n][c]['sd']:.1f}" for c, _ in cols) + " |")
    lines += ["", "Exit / station model (regulated exit, bottleneck station, 20 seeds)", "",
              "| Config | Peak station queue | Peak arrivals/min at station | Max wait (min) | Mean wait (min) | p95 (min) | Station clear (min after show) | Players who stayed (%) | Extra seated time of stayers (min) |",
              "|---|---|---|---|---|---|---|---|---|"]
    for name in exit_out:
        e = exit_out[name]
        lines.append(f"| {name} | " + " | ".join(f"{e[k]['mean']:.1f}" for k in ["peak_station_queue", "peak_arrivals_per_min", "max_station_wait", "mean_station_wait", "p95_station_wait", "station_clear_min", "players_stayed_pct", "mean_extra_seated_min_stayers"]) + " |")
    open("results_v2.md", "w").write("\n".join(lines) + "\n")

    # charts
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(18, 13))
    gs = fig.add_gridspec(3, 3, height_ratios=[1, 1, 1])
    tt = np.arange(int(T_END / DT)) * DT
    show = [("A none", "No rares (reference)"), ("B damped x2 (v1 default)", "v1 default: damped x2 (−10%)"), ("F BEST: x2+gov+tokens+early", "v2 best: x2 + governor + queue offers/VQ tokens + early-luck")]
    axs = [fig.add_subplot(gs[0, i]) for i in range(3)]
    for ax, (n, title) in zip(axs, show):
        hq = np.array(ex[n])
        for k in range(K):
            ax.plot(tt, hq[:, k], lw=1.2, label=f"spot {k} (cap {int(CAP[k])}/min)")
        ax.set_title(title + " — seed 0", fontsize=10); ax.set_xlabel("minutes after doors"); ax.set_ylabel("people in physical queue"); ax.grid(alpha=.3)
    ym = max(a.get_ylim()[1] for a in axs)
    for a in axs:
        a.set_ylim(0, ym)
    axs[0].legend(fontsize=7, loc="upper left")
    names = [n for n, s, _ in V2_CONFIGS if s == "v1"]
    short = [n.split(" (")[0] if not n.startswith("F p") and not n.startswith("F o") and "stress" not in n else n for n in names]
    colors = ["#999" if n.startswith("A") else "#2ca02c" if n.startswith("B") else "#1f77b4" if n.startswith("F BEST") else "#ff7f0e" if n.startswith("H") else "#9467bd" for n in names]
    for i, (m, title) in enumerate([("peak_queue", "Busiest-spot peak queue (people)"), ("max_expected_wait_quiet_spots", "Quiet-spot worst wait (min); ceiling = 8"), ("mean_wait", "Mean standing wait, all visitors (min)")]):
        ax = fig.add_subplot(gs[1, i])
        vals = [out[n][m]["mean"] for n in names]; errs = [out[n][m]["sd"] for n in names]
        ax.bar(range(len(names)), vals, yerr=errs, color=colors, capsize=3)
        if m == "max_expected_wait_quiet_spots":
            ax.axhline(W_MAX, color="k", ls=":", lw=1)
        ax.set_xticks(range(len(names))); ax.set_xticklabels(short, rotation=35, ha="right", fontsize=7)
        ax.set_title(title + f" — v1 scenario, {n_seeds} seeds", fontsize=10); ax.grid(axis="y", alpha=.3)
    # robustness: busiest-spot change across scenarios
    ax = fig.add_subplot(gs[2, 0])
    groups = [("v1 (2k players)", "A none", ["B damped x2 (v1 default)", "F BEST: x2+gov+tokens+early", "F4 x4+gov+tokens+early"]),
              ("v1 @5k players", "A none @5k", ["B damped x2 @5k", "F BEST @5k", "F4 x4 combo @5k"]),
              ("v2 gate arrivals", "A none (gate arrivals)", ["B damped x2 (gate arrivals)", "F BEST (gate arrivals)", "F4 x4 combo (gate arrivals)"])]
    wbar = 0.25
    labs = ["damped x2 (v1 default)", "v2 BEST (x2 + gov + offers/VQ + early)", "same levers at x4"]
    for j in range(3):
        ys = [100 * (out[g[2][j]]["peak_queue"]["mean"] / out[g[1]]["peak_queue"]["mean"] - 1) for g in groups]
        ax.bar(np.arange(3) + (j - 1) * wbar, ys, wbar, label=labs[j], color=["#2ca02c", "#1f77b4", "#9467bd"][j])
    ax.set_xticks(range(3)); ax.set_xticklabels([g[0] for g in groups]); ax.axhline(0, color="k", lw=.8)
    ax.set_ylabel("busiest-spot peak queue vs no rares (%)"); ax.set_title("Busiest-spot change by scenario", fontsize=10); ax.legend(fontsize=8); ax.grid(axis="y", alpha=.3)
    ax = fig.add_subplot(gs[2, 1])
    for j in range(3):
        ys = [out[g[2][j]]["max_expected_wait_quiet_spots"]["mean"] for g in groups]
        ax.bar(np.arange(3) + (j - 1) * wbar, ys, wbar, label=labs[j], color=["#2ca02c", "#1f77b4", "#9467bd"][j])
    ax.axhline(W_MAX, color="k", ls=":", lw=1); ax.text(-0.4, W_MAX + 0.2, "ceiling 8 min", fontsize=8)
    ax.set_xticks(range(3)); ax.set_xticklabels([g[0] for g in groups]); ax.set_ylabel("quiet-spot worst wait (min)")
    ax.set_title("Safety: worst wait created at normally-quiet spots", fontsize=10); ax.legend(fontsize=8); ax.grid(axis="y", alpha=.3)
    ax = fig.add_subplot(gs[2, 2])
    te = np.arange(0, 120.5, 0.5)
    for name in exit_ex:
        ax.plot(te, exit_ex[name], lw=1.4, label=name)
    ax.set_xlabel("minutes after the show ends"); ax.set_ylabel("people queuing at the bottleneck station")
    ax.set_title("Exit: seated finale round vs station queue (seed 0)", fontsize=10); ax.legend(fontsize=7); ax.grid(alpha=.3); ax.set_xlim(0, 110)
    fig.suptitle("TONARI v2 levers: time-shifting + in-queue offers + safety governor (agent-based model, stylised, not calibrated to Tokyo Dome)", fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig("tonari_v2_levers.png", dpi=105)
    print("saved tonari_v2_levers.png")


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "v2":
    main_v2(int(sys.argv[2]) if len(sys.argv) > 2 else 20)
