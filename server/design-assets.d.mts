export type DesignAssetSearchResult = {
  source: string;
  query: string;
  total: number;
  assets: Array<Record<string, unknown>>;
};

export function searchDesignAssets(options: {
  source?: string;
  query: string;
  fetchImpl?: typeof fetch;
}): Promise<DesignAssetSearchResult>;

export function getIconifyAsset(options: {
  iconId: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  iconId: string;
  title: string;
  sourceUrl: string;
  author: string;
  authorUrl: string | null;
  collection: string;
  license: string;
  spdx: string;
  licenseUrl: string | null;
  svg: string;
}>;

export function permitDesignAssetRequest(key: string, now?: number): boolean;
export function clearDesignAssetCache(): void;
