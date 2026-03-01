// ✅ 強制告訴 TypeScript vis-network 模組有哪些匯出
declare module "vis-network" {
  export class Network {
    constructor(container: HTMLElement, data: any, options?: any);
    on(event: string, callback: (params?: any) => void): void;
    fit(options?: any): void;
  }

  export class DataSet<T = any> {
    constructor(items?: T[]);
    add(items: T[] | T): void;
    clear(): void;
    get(): T[];
  }
}
