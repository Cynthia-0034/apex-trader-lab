// Execution Engine — Broker abstraction layer.
// PaperBroker fully implemented. MT5Broker is a locked stub (live mode disabled).

import type { BrokerFill, Order, Side } from './types';

export interface BrokerAdapter {
  name: string;
  connected: boolean;
  connect(): Promise<void>;
  getSpread(): Promise<number>;
  placeOrder(order: Order, marketPrice: number, ts: string): Promise<BrokerFill>;
  closeOrder(tradeId: string, exitPrice: number, ts: string): Promise<{ pnl: number }>;
}

// Paper broker — simulates fills with configurable spread/slippage.
export class PaperBroker implements BrokerAdapter {
  name = 'paper';
  connected = true;
  spread = 1.2; // pips
  slippage = 0.2; // pips

  async connect() { this.connected = true; }
  async getSpread() { return this.spread; }

  async placeOrder(order: Order, marketPrice: number, ts: string): Promise<BrokerFill> {
    const slipPrice = (this.spread + this.slippage) * 0.0001;
    const filled = order.side === 'LONG' ? marketPrice + slipPrice : marketPrice - slipPrice;
    return { filled_price: +filled.toFixed(5), ts, spread: this.spread };
  }

  async closeOrder(_id: string, exitPrice: number) {
    return { pnl: 0, _ts: exitPrice } as { pnl: number };
  }
}

// MT5 broker stub — live trading is locked until prerequisites met.
export class MT5Broker implements BrokerAdapter {
  name = 'mt5';
  connected = false;
  async connect(): Promise<void> { throw new Error('MT5 connection not configured. Live trading is locked.'); }
  async getSpread(): Promise<number> { throw new Error('MT5 broker not connected.'); }
  async placeOrder(): Promise<BrokerFill> { throw new Error('MT5 broker not connected.'); }
  async closeOrder(): Promise<{ pnl: number }> { throw new Error('MT5 broker not connected.'); }
}

export function calcPnl(side: Side, entry: number, exit: number, lotSize: number) {
  const pips = side === 'LONG' ? (exit - entry) * 10000 : (entry - exit) * 10000;
  // For EURUSD, $10 per pip per standard lot.
  const pnl = pips * 10 * lotSize;
  return { pips: +pips.toFixed(1), pnl: +pnl.toFixed(2) };
}
