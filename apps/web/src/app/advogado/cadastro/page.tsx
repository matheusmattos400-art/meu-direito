'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Category {
  slug: string;
  name: string;
}
interface LawyerProfile {
  fullName: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  phone2: string | null;
  birthDate: string | null;
  oabNumber: string;
  oabState: string;
  city: string | null;
  avatarUrl: string | null;
  residentialAddress: string | null;
  professionalAddress: string | null;
}

const empty = {
  fullName: '',
  cpf: '',
  email: '',
  phone: '',
  phone2: '',
  birthDate: '',
  oabNumber: '',
  oabState: '',
  city: '',
  avatarUrl: '',
  residentialAddress: '',
  professionalAddress: '',
};

export default function CadastroAdvogadoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...empty });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Category[]>('/categories')
      .then(setCategories)
      .catch(() => setCategories([]));
    apiFetch<LawyerProfile & { id: string }>('/lawyers/me')
      .then((p) =>
        setForm({
          fullName: p.fullName ?? '',
          cpf: p.cpf ?? '',
          email: p.email ?? '',
          phone: p.phone ?? '',
          phone2: p.phone2 ?? '',
          birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
          oabNumber: p.oabNumber ?? '',
          oabState: p.oabState ?? '',
          city: p.city ?? '',
          avatarUrl: p.avatarUrl ?? '',
          residentialAddress: p.residentialAddress ?? '',
          professionalAddress: p.professionalAddress ?? '',
        }),
      )
      .catch(() => {
        /* ainda não cadastrado — formulário em branco */
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function toggle(slug: string) {
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/lawyers/register', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          oabState: form.oabState.toUpperCase(),
          phone2: form.phone2 || undefined,
          email: form.email || undefined,
          specialties: selected,
        }),
      });
      router.push('/advogado/verificacao');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cadastro.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Cadastro profissional</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Preencha seus dados. Em seguida, você enviará os documentos e aceitará o termo para análise.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Group label="Nome completo" full>
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </Group>
            <Group label="CPF">
              <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} required />
            </Group>
            <Group label="Data de nascimento">
              <Input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} required />
            </Group>
            <Group label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Group>
            <Group label="Telefone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
            </Group>
            <Group label="Telefone 2">
              <Input value={form.phone2} onChange={(e) => set('phone2', e.target.value)} />
            </Group>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados profissionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Group label="Número da OAB">
              <Input value={form.oabNumber} onChange={(e) => set('oabNumber', e.target.value)} required />
            </Group>
            <Group label="UF da OAB">
              <Input maxLength={2} value={form.oabState} onChange={(e) => set('oabState', e.target.value)} required />
            </Group>
            <Group label="Cidade de atuação">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="São Paulo" />
            </Group>
            <Group label="Foto de perfil (URL)">
              <Input value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder="https://..." />
            </Group>
            <Group label="Endereço residencial" full>
              <Input value={form.residentialAddress} onChange={(e) => set('residentialAddress', e.target.value)} required />
            </Group>
            <Group label="Endereço profissional" full>
              <Input value={form.professionalAddress} onChange={(e) => set('professionalAddress', e.target.value)} required />
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
          <Button type="submit" disabled={busy || selected.length === 0}>
            {busy ? <Spinner /> : 'Salvar e continuar'}
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
