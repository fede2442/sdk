import { IFetchService } from '@services/fetch/types';
import { IGasService, SupportedGasValues } from '@services/gas/types';
import { GlobalQuoteSourceConfig, SourceId, SourceMetadata } from '@services/quotes/types';
import { BaseTokenMetadata, IMetadataService } from '@services/metadata/types';
import { LocalSourceList } from '@services/quotes/source-lists/local-source-list';
import { QuoteService } from '@services/quotes/quote-service';
import { LocalSourcesConfig } from '@services/quotes/source-registry';
import { IQuoteSourceList } from '@services/quotes/source-lists/types';
import { OverridableSourceList } from '@services/quotes/source-lists/overridable-source-list';
import { ArrayOneOrMore } from '@utility-types';
import { APISourceList, URIGenerator } from '@services/quotes/source-lists/api-source-list';
import { IProviderSource } from '@services/providers';
import { IPriceService } from '@services/prices';

export type LocalSourcesConfigInput = GlobalQuoteSourceConfig & Partial<LocalSourcesConfig>;
export type QuoteSourceListInput =
  | { type: 'custom'; instance: IQuoteSourceList }
  | { type: 'local'; withConfig?: GlobalQuoteSourceConfig & Partial<LocalSourcesConfig> }
  | { type: 'api'; baseUri: URIGenerator; sources: Record<SourceId, SourceMetadata> }
  | {
      type: 'overridable-source-list';
      lists: { default: QuoteSourceListInput; overrides: ArrayOneOrMore<{ list: QuoteSourceListInput; sourceIds: SourceId[] }> };
    };

export type BuildQuoteParams = { sourceList?: QuoteSourceListInput };

export function buildQuoteService(
  params: BuildQuoteParams | undefined,
  providerSource: IProviderSource,
  fetchService: IFetchService,
  gasService: IGasService<SupportedGasValues>,
  metadataService: IMetadataService<BaseTokenMetadata>,
  priceService: IPriceService
) {
  const sourceList = buildList(params?.sourceList, { providerSource, fetchService });
  return new QuoteService({ priceService, gasService, metadataService, sourceList });
}

function buildList(
  list: QuoteSourceListInput | undefined,
  {
    providerSource,
    fetchService,
  }: {
    providerSource: IProviderSource;
    fetchService: IFetchService;
  }
): IQuoteSourceList {
  switch (list?.type) {
    case 'custom':
      return list.instance;
    case 'local':
    case undefined:
      return new LocalSourceList({
        providerSource,
        fetchService,
        config: addReferrerIfNotSet(list?.withConfig),
      });
    case 'api':
      return new APISourceList({ fetchService, ...list });
    case 'overridable-source-list':
      const defaultList = buildList(list.lists.default, { providerSource, fetchService });
      const overrides = list.lists.overrides.map(({ list, sourceIds }) => ({
        list: buildList(list, { providerSource, fetchService }),
        sourceIds,
      }));
      return new OverridableSourceList({ default: defaultList, overrides });
  }
}

// If no referrer address was set, then we will use Mean's address
function addReferrerIfNotSet(config?: GlobalQuoteSourceConfig & Partial<LocalSourcesConfig>) {
  return { referrer: { address: '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01', name: 'MeanFinance' }, ...config };
}
