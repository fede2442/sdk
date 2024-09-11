import { IAllowanceService } from '@services/allowances';
import { EarnService } from '@services/earn/earn-service';
import { IFetchService } from '@services/fetch';
import { IPermit2Service } from '@services/permit2';
import { IProviderService } from '@services/providers';
import { IQuoteService } from '@services/quotes';

export type BuildEarnParams = { customAPIUrl?: string };
type Dependencies = {
  permit2Service: IPermit2Service;
  quoteService: IQuoteService;
  providerService: IProviderService;
  allowanceService: IAllowanceService;
  fetchService: IFetchService;
};
export function buildEarnService(
  params: BuildEarnParams | undefined,
  { permit2Service, quoteService, providerService, allowanceService, fetchService }: Dependencies
) {
  return new EarnService(
    params?.customAPIUrl ?? 'https://api.balmy.xyz',
    permit2Service,
    quoteService,
    providerService,
    allowanceService,
    fetchService
  );
}