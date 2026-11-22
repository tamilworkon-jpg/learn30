// End-to-end check of a running deployment (Vercel or npm start) with closed sign-up and an admin account:
//   BASE=https://<project>.vercel.app ADMIN_USER=admin ADMIN_PASS='…' node scripts/smoke-deploy.mjs
// Creates a throw-away learner, saves progress, checks access rules and admin actions, then deletes the learner.
/* global console, process, fetch */
const BASE = (process.env.BASE ?? 'http://localhost:4321').replace(/\/+$/, '');
const ADMIN = { username: process.env.ADMIN_USER ?? 'admin', password: process.env.ADMIN_PASS ?? '' };
if (!ADMIN.password) {
  console.error('Set ADMIN_USER and ADMIN_PASS (and BASE) first.');
  process.exit(2);
}
const H = { 'Content-Type': 'application/json', 'X-AIP-Request': '1' };
let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
};
const get = (p, cookie) => fetch(BASE + p, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
const api = (method, p, body, cookie) => fetch(BASE + p, { method, redirect: 'manual', headers: { ...H, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (r) => (r.headers.getSetCookie().find((c) => c.startsWith('aip_session=')) ?? '').split(';')[0];
const boot = (html) => JSON.parse(/id="aip-bootstrap">(.*?)<\/script>/s.exec(html)?.[1] ?? 'null');

const home = await get('/');
const homeHtml = await home.text();
check(home.status === 200, 'GET / (function)', String(home.status));
check(boot(homeHtml)?.site?.signup === false, 'bootstrap says sign-up closed');
check(home.headers.get('x-content-type-options') === 'nosniff', 'security headers on pages');
const asset = /\/_astro\/[^"']+\.css/.exec(homeHtml)?.[0];
if (asset) {
  const a = await get(asset);
  check(a.status === 200, `static asset ${asset}`, a.headers.get('x-served-by') ?? a.headers.get('x-vercel-cache') ?? '');
}
check((await get('/pagefind/pagefind.js')).status === 200, 'pagefind asset');
const su = await get('/signup');
check(su.status === 302 && su.headers.get('location') === '/login', '/signup → /login when closed', `${su.status} ${su.headers.get('location')}`);
check((await api('POST', '/api/auth/signup', { username: 'walkin', password: 'password123' })).status === 403, 'public sign-up refused');
const dash = await get('/course/aws-ai-practitioner');
check(dash.status === 302 && dash.headers.get('location')?.startsWith('/login?next='), 'course dashboard needs sign-in');
check((await get('/admin')).status === 302, '/admin signed out → login');

const al = await api('POST', '/api/auth/login', ADMIN);
const admin = cookieOf(al);
check(al.status === 200 && !!admin, 'admin login', String(al.status));
if (BASE.startsWith('https:')) check(/; Secure/.test(al.headers.getSetCookie().join()), 'session cookie is Secure on https');
const ap = await get('/admin', admin);
check(ap.status === 200 && (await ap.text()).includes('Admin console'), 'GET /admin as admin');

const uname = 'learner' + Date.now().toString(36).slice(-5);
const cu = await api('POST', '/api/admin/users', { username: uname, displayName: 'Smoke Learner', password: 'learner-pass-1' }, admin);
check(cu.status === 201, 'admin creates learner', String(cu.status));
const ll = await api('POST', '/api/auth/login', { username: uname, password: 'learner-pass-1' });
const learner = cookieOf(ll);
check(ll.status === 200, 'learner signs in with the given password');
const prog = await (await api('GET', '/api/courses/aws-ai-practitioner/progress', undefined, learner)).json();
prog.days = { 1: { status: 'completed', sectionsViewed: [] } };
check((await api('PUT', '/api/courses/aws-ai-practitioner/progress', prog, learner)).status === 204, 'learner saves progress');
check((await get('/admin', learner)).status === 404, 'learner gets 404 on /admin');
check((await api('GET', '/api/admin/users', undefined, learner)).status === 403, 'learner gets 403 on admin API');
const list = await (await api('GET', '/api/admin/users', undefined, admin)).json();
const row = list.users.find((u) => u.username === uname);
check(row?.courses?.['aws-ai-practitioner']?.completed === 1, 'admin sees learner progress (1 day completed)');
const id = row?.id;
check((await api('PATCH', `/api/admin/users/${id}`, { password: 'reset-pass-22' }, admin)).status === 200, 'admin resets password');
check((await api('GET', '/api/me', undefined, learner)).status === 401, 'learner signed out after reset');
check((await api('DELETE', `/api/admin/users/${id}`, undefined, admin)).status === 204, 'admin deletes learner');
check((await api('POST', '/api/auth/logout', undefined, admin)).status === 204, 'admin logout');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
