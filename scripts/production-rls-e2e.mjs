import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const projectRef = process.env.SUPABASE_PROJECT_REF;
const keysPath = process.env.SUPABASE_KEYS_JSON_PATH;
const allowedOrigin = process.env.APP_ORIGIN || 'https://mentor.mentoria4x.com';

if (!projectRef || !keysPath) throw new Error('Missing SUPABASE_PROJECT_REF or SUPABASE_KEYS_JSON_PATH');

const supabaseUrl = `https://${projectRef}.supabase.co`;
const keyJson = JSON.parse(fs.readFileSync(keysPath, 'utf8'));

function objects(value, out = []) {
  if (Array.isArray(value)) for (const item of value) objects(item, out);
  else if (value && typeof value === 'object') {
    out.push(value);
    for (const item of Object.values(value)) objects(item, out);
  }
  return out;
}

function candidateValue(obj) {
  for (const key of ['api_key', 'key', 'value', 'token']) {
    const value = obj?.[key];
    if (typeof value === 'string' && (value.startsWith('eyJ') || value.startsWith('sb_'))) return value;
  }
  for (const value of Object.values(obj || {})) {
    if (typeof value === 'string' && (value.startsWith('eyJ') || value.startsWith('sb_'))) return value;
  }
  return null;
}

function labelOf(obj) {
  return Object.entries(obj || {})
    .filter(([k, v]) => typeof v === 'string' && !['api_key', 'key', 'value', 'token'].includes(k))
    .map(([, v]) => v)
    .join(' ')
    .toLowerCase();
}

const all = objects(keyJson);
const serviceObj = all.find((o) => /service[_ -]?role|secret/.test(labelOf(o)) && candidateValue(o) && !candidateValue(o).includes('REDACTED'));
const publicObj = all.find((o) => /anon|publishable/.test(labelOf(o)) && candidateValue(o) && !candidateValue(o).includes('REDACTED'));
const serviceKey = serviceObj && candidateValue(serviceObj);
const publicKey = publicObj && candidateValue(publicObj);

if (!serviceKey) throw new Error('Could not resolve a full service-role/secret API key from Supabase CLI output.');
if (!publicKey) throw new Error('Could not resolve anon/publishable API key from Supabase CLI output.');

console.log('Resolved project API keys without printing secret material.');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const password = `RlsE2E-${crypto.randomBytes(16).toString('base64url')}!9a`;
const emailA = `e2e-a-${suffix}@rc360.invalid`;
const emailB = `e2e-b-${suffix}@rc360.invalid`;
const created = { users: [], companies: [], goals: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  const errors = [];
  if (created.goals.length) {
    const { error } = await admin.from('goals').delete().in('id', created.goals);
    if (error) errors.push(`goals: ${error.message}`);
  }
  if (created.companies.length) {
    for (const table of ['company_access', 'company_members']) {
      const { error } = await admin.from(table).delete().in('company_id', created.companies);
      if (error) errors.push(`${table}: ${error.message}`);
    }
    const { error } = await admin.from('companies').delete().in('id', created.companies);
    if (error) errors.push(`companies: ${error.message}`);
  }
  for (const userId of created.users) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) errors.push(`auth user ${userId}: ${error.message}`);
  }
  if (errors.length) console.error(`Cleanup warnings: ${errors.join(' | ')}`);
  else console.log('Temporary production E2E data cleaned successfully.');
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  assert(data.user?.id, `User creation returned no id for ${email}`);
  created.users.push(data.user.id);
  return data.user.id;
}

async function login(email) {
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert(data.session?.access_token, `No JWT session for ${email}`);
  return { client, jwt: data.session.access_token };
}

try {
  const userA = await createUser(emailA);
  const userB = await createUser(emailB);

  const { data: companies, error: companyError } = await admin
    .from('companies')
    .insert([
      { name: `[E2E] Empresa A ${suffix}`, notes: 'Temporary real JWT/RLS E2E - safe to delete' },
      { name: `[E2E] Empresa B ${suffix}`, notes: 'Temporary real JWT/RLS E2E - safe to delete' },
    ])
    .select('id,name');
  if (companyError) throw companyError;
  assert(companies?.length === 2, 'Expected two temporary companies');
  const companyA = companies[0].id;
  const companyB = companies[1].id;
  created.companies.push(companyA, companyB);

  const { error: memberError } = await admin.from('company_members').insert([
    { company_id: companyA, user_id: userA, member_role: 'company_responsible', is_primary: true },
    { company_id: companyB, user_id: userB, member_role: 'company_responsible', is_primary: true },
  ]);
  if (memberError) throw memberError;

  const { error: accessError } = await admin.from('company_access').insert([
    { company_id: companyA, user_id: userA, access_role: 'company_responsible', is_primary_responsible: true, status: 'ativo' },
    { company_id: companyB, user_id: userB, access_role: 'company_responsible', is_primary_responsible: true, status: 'ativo' },
  ]);
  if (accessError) throw accessError;

  const sessionA = await login(emailA);
  const sessionB = await login(emailB);
  console.log('Real Supabase Auth login succeeded for two temporary users; JWTs issued.');

  const { data: aOwn, error: aOwnError } = await sessionA.client.from('companies').select('id').eq('id', companyA);
  if (aOwnError) throw aOwnError;
  assert(aOwn?.length === 1, 'User A cannot read own company');

  const { data: aForeign, error: aForeignError } = await sessionA.client.from('companies').select('id').eq('id', companyB);
  if (aForeignError) throw aForeignError;
  assert(aForeign?.length === 0, 'RLS leak: User A can read Company B');

  const { data: bOwn, error: bOwnError } = await sessionB.client.from('companies').select('id').eq('id', companyB);
  if (bOwnError) throw bOwnError;
  assert(bOwn?.length === 1, 'User B cannot read own company');

  const { data: bForeign, error: bForeignError } = await sessionB.client.from('companies').select('id').eq('id', companyA);
  if (bForeignError) throw bForeignError;
  assert(bForeign?.length === 0, 'RLS leak: User B can read Company A');
  console.log('Company SELECT isolation passed in both directions.');

  const { data: ownGoal, error: ownGoalError } = await sessionA.client
    .from('goals')
    .insert({ company_id: companyA, title: `[E2E] own goal ${suffix}`, created_by: userA })
    .select('id')
    .single();
  if (ownGoalError) throw ownGoalError;
  created.goals.push(ownGoal.id);

  const crossInsert = await sessionA.client
    .from('goals')
    .insert({ company_id: companyB, title: `[E2E] forbidden goal ${suffix}`, created_by: userA })
    .select('id');
  assert(!!crossInsert.error, 'RLS leak: User A inserted a goal into Company B');

  const { data: bGoalView, error: bGoalViewError } = await sessionB.client.from('goals').select('id').eq('id', ownGoal.id);
  if (bGoalViewError) throw bGoalViewError;
  assert(bGoalView?.length === 0, 'RLS leak: User B can read User A goal');
  console.log('Goal write/read cross-company RLS isolation passed.');

  const fnUrl = `${supabaseUrl}/functions/v1/admin-list-users`;
  const unauth = await fetch(fnUrl, {
    method: 'GET',
    headers: { apikey: publicKey, Origin: allowedOrigin },
  });
  assert([401, 403].includes(unauth.status), `Expected unauthenticated Edge Function rejection, got ${unauth.status}`);

  const nonAdmin = await fetch(fnUrl, {
    method: 'GET',
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${sessionA.jwt}`,
      Origin: allowedOrigin,
    },
  });
  assert(nonAdmin.status === 403, `Expected authenticated non-admin rejection from admin-list-users, got ${nonAdmin.status}`);
  console.log('Edge Function JWT enforcement and role authorization passed.');

  console.log('PRODUCTION JWT + RLS E2E: PASS');
} finally {
  await cleanup();
}
