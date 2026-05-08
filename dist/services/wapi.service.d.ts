declare class WApiService {
    private readonly headers;
    private readonly instanceId;
    constructor();
    private url;
    sendTextMessage(phone: string, message: string): Promise<void>;
    sendTyping(phone: string): Promise<void>;
}
export declare const wapiService: WApiService;
export {};
//# sourceMappingURL=wapi.service.d.ts.map