package com.tp3.rpc;

public class FxHandler {
  // O Processor chama: client.get_eur_usd_rate()
  public double get_eur_usd_rate() {
    return 1.10; // fixo; suficiente para cumprir protocolo XML-RPC
  }
}