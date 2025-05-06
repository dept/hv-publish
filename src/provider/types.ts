export interface ProviderOptions {
   branch?: string;
   path?: string;
   number?: number;
   commit?: string;
}

export interface Provider {
   name: string;
   identify(): boolean;
   getOptions(): ProviderOptions;
   getRepository(options: Pick<ProviderOptions, 'path'>): Promise<string>;
}

export interface RepositoryInfo {
   name: string;
   scm: string;
   is_private: boolean;
   project: {
      key: string;
   };
   error?: any;
} 