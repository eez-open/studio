export interface Config {
    server: {
        address: string;
        username: string;
    };

    filePathBase: string;

    toc: {
        [key: string]: [
            {
                category: {
                    name: string;
                    id: number;
                };

                articles: {
                    content: string;
                    status: string;

                    sha256?: string;
                    id?: number;
                }[];
            }
        ];
    };
}

export type Server = Config["server"];
