import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

/**
 * Acesso ao Supabase Storage com a service role key (apenas no backend).
 * O binário nunca passa pela API: emitimos URLs assinadas e o cliente
 * faz upload/download direto, garantindo armazenamento criptografado.
 */
@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      throw new InternalServerErrorException(
        'Storage não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      );
    }
    this.client = createClient(url, serviceKey, { auth: { persistSession: false } });
    return this.client;
  }

  bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'documents';
  }

  async createUploadUrl(path: string): Promise<SignedUpload> {
    const bucket = this.bucket();
    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL de upload: ${error?.message}`);
    }
    return { bucket, path: data.path, token: data.token, signedUrl: data.signedUrl };
  }

  async createDownloadUrl(path: string, expiresIn = 300): Promise<string> {
    const { data, error } = await this.getClient()
      .storage.from(this.bucket())
      .createSignedUrl(path, expiresIn);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao gerar URL de download: ${error?.message}`);
    }
    return data.signedUrl;
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await this.getClient().storage.from(this.bucket()).remove(paths);
    if (error) {
      throw new InternalServerErrorException(`Falha ao remover arquivo: ${error.message}`);
    }
  }
}
