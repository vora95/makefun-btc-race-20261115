# Deep-Dip BTC Bot — make.fun btc-race-24h-20261115-0828

A bot that trades cbBTC/USDC minute by minute in the make.fun 24-hour
paper-money race. Long only, one position, full size.

## Strategy

Buy only sharp short-horizon dips, sell on a fixed bounce target:

- **BUY** when the close is at least 1.2% below the close 30 bars ago.
- **SELL** when the close is at least 1.2% above the close at the buy
  decision bar.

No stop-loss, no trailing exit, no trend chasing. See `STRATEGY.md` for the
evidence: dev-window results, the parameter plateau, and the rejected
alternatives (trend hybrids, trailing exits, stop-loss, RSI).

## Dev-window result (grade-local, process driver)

- Net PnL **+14.31 USDC** (4 trades, max drawdown 4.8%)
- Baselines on the same window: buy-and-hold −44.01, momentum −40.92,
  ema-cross −134.95, rsi-bollinger −57.37, adx-momentum −86.60

## Run

```sh
node main.ts   # speaks agent-fun/bars-replay/v1 on stdin/stdout
```

Only the standard library plus the vendored `vendor/makefun-bars.ts` shim
(a byte-identical copy of the kit SDK) is used. No network, no clock,
no randomness: two runs on the same data produce byte-identical action logs.

## License

MIT. See `LICENSE`.
