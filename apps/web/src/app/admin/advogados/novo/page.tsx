'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Category {
  slug: string;
  name: string;
}

const empty = {
  fullName: '',
  email: '',
  password: '',
  cpf: '',
  phone: '',
  phone2: '',
  birthDate: '',
  oabNumber: '',
  oabState: '',
  residentialAddress: '',
  professionalAddress: '',
};

export default function NovoAdvogadoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...empty });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  function set<K extends keyof typeof empty>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggle(slug: string) {
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  }
  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    set('password', p);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ lawyerId: string }>('/admin/lawyers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          oabState: form.oabState.toUpperCase(),
          phone2: form.phone2 || undefined,
          birthDate: form.birthDate || undefined,
          residentialAddress: form.residentialAddress || undefined,
          professionalAddress: form.professionalAddress || undefined,
          specialties: selected,
          status: 'ACTIVE',
        }),
      });
      router.push(`/admin/advogados/${res.lawyerId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar advogado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/advogados" className="text-sm text-muted-foreground hover:text-foreground">
        ← Advogados
      </Link>
      <h1 className="mb-2 mt-2 font-serif text-3xl tracking-tightish">Novo advogado</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cadastro direto pelo backoffice. A conta é criada já ativa, com login e senha definidos aqui.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciais de acesso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Group label="E-mail (login)" full>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </Group>
            <Group label="Senha" full>
              <div className="flex gap-2">
                <Input value={form.password} onChange={(e) => set('password', e.target.value)} required />
                <Button type="button" variant="outline" size="sm" onClick={genPassword}>
                  Gerar
                </Button>
              </div>
            </Group>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do advogado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Group label="Nome completo" full>
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </Group>
            <Group label="CPF">
              <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} required />
            </Group>
            <Group label="Data de nascimento">
              <Input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
            </Group>
            <Group label="Telefone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
            </Group>
            <Group label="Telefone 2">
              <Input value={form.phone2} onChange={(e) => set('phone2', e.target.value)} />
            </Group>
            <Group label="Número da OAB">
              <Input value={form.oabNumber} onChange={(e) => set('oabNumber', e.target.value)} required />
            </Group>
            <Group label="UF da OAB">
              <Input maxLength={2} value={form.oabState} onChange={(e) => set('oabState', e.target.value)} required />
            </Group>
            <Group label="Endereço residencial" full>
              <Input value={form.residentialAddress} onChange={(e) => set('residentialAddress', e.target.value)} />
            </Group>
            <Group label="Endereço profissional" full>
              <Input value={form.professionalAddress} onChange={(e) => set('professionalAddress', e.target.value)} />
            </Group>
            <Group label="Áreas de atuação" full>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.slug}
                    onClick={() => toggle(c.slug)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selected.includes(c.slug)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Group>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || selected.length === 0 || !form.password}>
            {busy ? <Spinner /> : 'Criar advogado'}
          </Button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </form>
    </div>
  );
}

function Group({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
