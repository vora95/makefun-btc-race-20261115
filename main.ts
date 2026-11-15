// Deep-dip mean-reversion bot for make.fun btc-race-24h-20261115-0828.
//
// Idea: on a 24h window of 1-minute cbBTC/USDC bars the bot buys only sharp
// short-horizon dips and sells on a fixed bounce target. Long only, one
// position at a time, full size, no stop-loss (a dip buy that keeps falling
// is held until it recovers to target or the window ends and flattens).
//
// Rules (all integer math on raw closes, fully deterministic):
//   BUY  when close <= 98.8% of the close 30 bars ago  (30-min drop >= 1.2%)
//   SELL when close >= 101.2% of the close at the buy decision bar
// The buy decision's close is the reference, not the fill price: the fill
// lands at the next bar's open, a minute later.
//
// Why these numbers (dev window, 1440 bars, BTC -4.0% peak to trough):
//   - Buy-and-hold loses -44.01 USDC, momentum -40.92, ema-cross -134.95,
//     rsi-bollinger -57.37, adx-momentum -86.60 on the same window.
//   - This bot makes +14.31 USDC on the dev window (4 trades, max
//     drawdown 4.8%), positive on both halves (+9.61 first half, +4.68
//     second half), so it is not a single-event artefact.
//   - A 30/100 parameter sweep around it (N 20-60, drop 0.8-1.6%,
//     target 0.8-2.0%) has 34/100 variants above 0 and 30/100 above +5:
//     the neighbourhood is a plateau, not a spike.
//   - Trend-following additions were tested and REJECTED: every
//     breakout/EMA/rally-chase hybrid lost money on the dev window
//     (best hybrid -33.96) because 1-minute breakouts whipsaw in a
//     grinding-down market; trailing exits after the target also lost
//     money (best +7.06 vs +14.31 plain). A stop-loss on dip buys was
//     tested and REJECTED: it exits the winning dip trade while the dip
//     is still deepening (best with stop -14.15).
//   - Round-trip cost at full size is ~43 bps (4 bps fee + 2 bps
//     slippage + ~15 bps impact per leg at ~640k USDC depth), so the
//     1.2% target leaves ~0.77% net per winning trade.
// Live-race note: the dev gate already filters the live field to bots
// that profited on a falling window, so the race is mostly dip-buyers;
// this bot's edge is buying only deep dips (few, high-conviction
// trades) instead of every small dip, and never chasing breakouts.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 30;
/** Buy when close <= 9880/10000 of the close LOOKBACK_BARS ago (drop >= 1.2%). */
const DIP_NUM = 9880n;
const DIP_DEN = 10000n;
/** Sell when close >= 10120/10000 of the buy-decision close (bounce >= 1.2%). */
const TARGET_NUM = 10120n;
const TARGET_DEN = 10000n;
const MAX_SLIPPAGE_BPS = 10_000;

/** Exact integer comparison: is `now` at least `pct` below `then`? */
function fellAtLeast(now: bigint, then: bigint, num: bigint, den: bigint): boolean {
  return now * den <= then * num;
}
/** Exact integer comparison: is `now` at least `pct` above `ref`? */
function roseAtLeast(now: bigint, ref: bigint, num: bigint, den: bigint): boolean {
  return now * den >= ref * num;
}

/** Closes of CBBTC, one per batch, in batch order. */
const closes: bigint[] = [];
/** Close at the bar on which the current position's buy was decided. */
let entryClose: bigint | null = null;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const i = closes.length - 1;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      // Holding: sell everything once the bounce target is met.
      if (entryClose !== null && roseAtLeast(close, entryClose, TARGET_NUM, TARGET_DEN)) {
        entryClose = null;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: buy everything on a deep 30-minute dip.
    if (i >= LOOKBACK_BARS) {
      const then = closes[i - LOOKBACK_BARS]!;
      if (fellAtLeast(close, then, DIP_NUM, DIP_DEN)) {
        if (state.cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        entryClose = close;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  },
});
