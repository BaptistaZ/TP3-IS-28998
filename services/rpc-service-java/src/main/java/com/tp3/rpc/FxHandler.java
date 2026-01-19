package com.tp3.rpc;

public class FxHandler {

  /**
   * Return the EUR->USD exchange rate.
   *
   * @return fixed FX rate as double.
   */
  public double get_eur_usd_rate() {
    // Fixed value is sufficient for the pipeline enrichment and for protocol validation.
    return 1.10;
  }
}