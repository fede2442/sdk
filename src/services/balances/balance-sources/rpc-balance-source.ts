import { Address as ViemAddress, encodeFunctionData, parseAbi } from 'viem';
import { Address, AmountOfToken, BigIntish, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { chainsIntersection } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IProviderService } from '@services/providers/types';
import { SingleChainBaseBalanceSource } from './base/single-chain-base-balance-source';

export class RPCBalanceSource extends SingleChainBaseBalanceSource {
  constructor(
    private readonly providerService: IProviderService,
    private readonly multicallService: IMulticallService,
    private readonly client: 'ethers' | 'viem' = 'ethers'
  ) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const supportedChains = chainsIntersection(this.providerService.supportedChains(), this.multicallService.supportedChains());
    const entries = supportedChains.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: false }]);
    return Object.fromEntries(entries);
  }

  protected fetchERC20TokensHeldByAccountsInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, AmountOfToken>>> {
    throw new Error('Operation not supported');
  }

  protected async fetchERC20BalancesForAccountsInChain(
    chainId: ChainId,
    accounts: Record<Address, TokenAddress[]>,
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, AmountOfToken>>> {
    const pairs = Object.entries(accounts).flatMap(([account, tokens]) => tokens.map((token) => ({ account, token })));
    const calls: { target: Address; decode: string[]; calldata: string }[] = pairs.map(({ account, token }) => ({
      target: token,
      decode: ['uint256'],
      calldata: encodeFunctionData({
        abi: parseAbi(ERC20_ABI),
        functionName: 'balanceOf',
        args: [account],
      }),
    }));
    const multicallResults = await this.multicallService.tryReadOnlyMulticall({ chainId, calls });
    const result: Record<Address, Record<TokenAddress, AmountOfToken>> = {};
    for (let i = 0; i < pairs.length; i++) {
      const multicallResult = multicallResults[i];
      if (!multicallResult.success) continue;
      const { account, token } = pairs[i];
      if (!(account in result)) result[account] = {};
      result[account][token] = multicallResult.result[0].toString();
    }
    return result;
  }

  protected async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, AmountOfToken>> {
    const entries = accounts.map(async (account) => [account, await this.fetchNativeBalanceInChain(chainId, account)]);
    return Object.fromEntries(await Promise.all(entries));
  }

  private fetchNativeBalanceInChain(chainId: ChainId, account: Address) {
    const promise =
      this.client === 'viem'
        ? this.providerService.getViemPublicClient({ chainId }).getBalance({ address: account as ViemAddress, blockTag: 'latest' })
        : this.providerService.getEthersProvider({ chainId }).getBalance(account);
    return promise.then((balance) => balance.toString());
  }
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
