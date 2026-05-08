declare class WhisperService {
    private client;
    constructor();
    private decryptWhatsAppAudio;
    transcribeAudio(audioUrl: string, mediaKey?: string): Promise<string>;
}
export declare const whisperService: WhisperService;
export {};
//# sourceMappingURL=whisper.service.d.ts.map