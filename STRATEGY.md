# Strategy: deep-dip mean reversion

## The problem

The dev window (1,440 one-minute cbBTC/USDC bars, 24h ending at the
competition opening) falls 4.0% from $67,216 to $64,524. Long-only, no
shorts, cash earns nothing, and a full-size round trip costs ~43 bps
(4 bps fee + 2 bps slippage + ~15 bps price impact per leg at ~640k USDC
pool depth). Every kit baseline loses on it:

| bot | dev net PnL | trades | max drawdown |
| --- | --- | --- | --- |
| buy-and-hold | −44.01 USDC | 1 | 7.9% |
| momentum | −40.92 USDC | 1 | 7.9% |
| ema-cross | −134.95 USDC | 63 | 13.7% |
| rsi-bollinger | −57.37 USDC | 12 | 6.8% |
| adx-momentum | −86.60 USDC | 35 | 8.8% |
| hold-cash | 0.00 USDC | 0 | 0% (fails the dev gate: no trade) |

## The chosen bot

Buy only a deep dip, sell on a fixed bounce, full size, one position:

- BUY when close <= 98.8% of the close 30 bars ago (30-min drop >= 1.2%).
- SELL when close >= 101.2% of the close at the buy decision bar.

Dev-window result (kit `grade-local`, process driver, two runs
byte-identical): **net PnL +14.31 USDC, 4 trades, max drawdown 4.8%,
fees ~1.61 USDC**. Split-half: +9.61 USDC on bars 0–719, +4.68 USDC on
bars 720–1439 — positive on both halves, so the result is not one lucky
event (the biggest single trade is the h16–h17 V: bought ~$63,757, sold
~$64,735).

## Robustness

A 100-point sweep around the parameters (lookback 20–60 bars, dip
0.8–1.6%, target 0.8–2.0%) gives 34 variants above 0 and 30 above
+5 USDC: a plateau, not a spike. The chosen point (30, 1.2%, 1.2%) sits
in the middle of it.

## What was tested and rejected

- **Trend hybrids** (Donchian breakout / EMA cross / rally-chase entries
  sharing the slot): best −33.96 USDC. 1-minute breakouts whipsaw badly
  in a grinding-down market; every hybrid lost far more than dip-only.
- **Trailing exit after the target**: best +7.06 USDC vs +14.31 plain —
  the bounce usually fades right after the target.
- **Stop-loss on dip buys** (0.5–1.5%): best −14.15 USDC — it exits the
  winning dip trade while the dip is still deepening, before the bounce.
- **RSI mean reversion**: worst −88.49 USDC — buys too early into a
  downtrend, 24–42 churned trades.
- **Bounce confirmation** (require the last 3–10 min to turn up first):
  inconsistent (+16.16 in one variant but 0 trades in others) — fragile,
  dropped in favour of the plain rule.

## Live-race reasoning

The dev gate admits only bots that profited on a falling window, so the
live field is mostly dip-buyers, not buy-and-hold clones (those failed
the gate). This bot's edge is selectivity: it buys only deep dips
(2 round trips on the dev window) instead of every small dip, and it
never chases breakouts, so it keeps its powder dry for the V-bounces
that actually pay. Drawdown stays far under the 25% guardrail (4.8%
on dev). The risk is a live window with no >= 1.2% 30-minute dip: then
it trades little or not at all — accepted, because loosening the dip
threshold was tested and loses money (the 0.8% variants are negative).
