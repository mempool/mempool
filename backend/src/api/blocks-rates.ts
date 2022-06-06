import logger from "../logger";
import RatesRepository from "../repositories/RatesRepository";
import fiatConversion from "./fiat-conversion";

class BlocksRates {
  private pendingBlocksRates: number[] = [];
  private saveInProgress = false;

  public async savePendingBlockRates() {
    if (this.saveInProgress === false && fiatConversion.ratesInitialized === true) {
      this.saveInProgress = true;

      const pending = [...this.pendingBlocksRates];
      this.pendingBlocksRates = [];

      for (let height of pending) {
        try {
          await RatesRepository.$saveRate(height, fiatConversion.getConversionRates());
        } catch (e) {
          this.pendingBlocksRates.push(height);
          logger.debug(`Cannot save pending block rates, trying again later`);
        }
      }
    }

    this.saveInProgress = false;
  }

  public async saveRateForBlock(height: number) {
    if (fiatConversion.ratesInitialized === true) {
      try {
        await RatesRepository.$saveRate(height, fiatConversion.getConversionRates());
      } catch (e) {
        this.pendingBlocksRates.push(height);
      }
    } else {
      this.pendingBlocksRates.push(height);
    }
  }
}

export default new BlocksRates();