import { Chains } from '@chains';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';

export const CHANGELLY_METADATA: QuoteSourceMetadata<ChangellySupport> = {
  name: 'Changelly DEX',
  supports: {
    chains: [Chains.ETHEREUM, Chains.OPTIMISM, Chains.ARBITRUM, Chains.BNB_CHAIN, Chains.POLYGON, Chains.FANTOM, Chains.AVALANCHE].map(
      ({ chainId }) => chainId
    ),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qmbnnx5bD1wytBna4oY8DaL1cw5c5mTStwUMqLCoLt3yHR',
};
type ChangellyConfig = { apiKey: string };
type ChangellySupport = { buyOrders: false; swapAndTransfer: true };
export class ChangellyQuoteSource implements IQuoteSource<ChangellySupport, ChangellyConfig> {
  getMetadata() {
    return CHANGELLY_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<ChangellySupport, ChangellyConfig>): Promise<SourceQuoteResponse> {
    let url =
      `https://dex-api.changelly.com/v1/${chain.chainId}/quote` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&slippage=${slippagePercentage * 10}` +
      `&skipValidation=true`;
    // We are disabling RFQ because it fails often when validation is turned off. But we can't turn it on or the simulation quote would fail
    // `&takerAddress=${takeFrom}`

    if (recipient && !isSameAddress(recipient, takeFrom)) {
      url += `&recipientAddress=${recipient}`;
    }

    const headers = { 'X-Api-Key': config.apiKey };
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(CHANGELLY_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { amount_out_total, estimate_gas_total, calldata, to } = await response.json();

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amount_out_total),
      estimatedGas: BigInt(estimate_gas_total),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      tx: {
        to,
        calldata,
        value: isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : 0n,
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  isConfigAndContextValid(config: Partial<ChangellyConfig> | undefined): config is ChangellyConfig {
    return !!config?.apiKey;
  }
}