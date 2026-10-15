import { test, expect, BrowserContext } from '@playwright/test';
const userId='10000000-0000-4000-8000-000000000001';
const siteId='20000000-0000-4000-8000-000000000001';
const site={id:siteId,name:'Synthetic Facility',location:'Test Region',archived_at:null};
const profile={id:userId,email:'synthetic@example.test',full_name:'Synthetic Operator'};
async function setup(context:BrowserContext,role:'admin'|'manager'|'member'){
 const user={id:userId,aud:'authenticated',role:'authenticated',email:profile.email,app_metadata:{provider:'email'},user_metadata:{full_name:profile.full_name},created_at:'2025-01-01T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(part=>typeof part==='string'?part:Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
 const session={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
 await context.addInitScript(session=>{
  // Seed once. A reload after logout must not silently restore the fixture session.
  if(!localStorage.getItem('fixture-seeded')) {localStorage.setItem('sb-fixture-auth-token',JSON.stringify(session));localStorage.setItem('fixture-seeded','1');}
  localStorage.setItem('hazwaste_install_dismissed_at',String(Date.now()));
 },session);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://127.0.0.1:8181') return route.continue();
  if(url.origin!=='https://fixture.supabase.co') return route.abort();
  const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8181','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/user')) return route.fulfill({json:user,headers});
  if(url.pathname.endsWith('/logout')) return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/token')) return route.fulfill({json:session,headers});
  const table=url.pathname.split('/').pop();
  const tables:Record<string,unknown[]>={sites:[site],profiles:[profile],user_sites:[{id:'membership',user_id:userId,site_id:siteId,sites:site}],
   user_roles:[{id:'role',user_id:userId,site_id:siteId,role}],site_locations:[{id:'location',site_id:siteId,code:'SHED',is_common:false,sort_order:1}],
   waste_entries:[],disposal_batches:[],waste_entry_photos:[],site_access_requests:[],audit_log:[],regions:[]};
  if(!table || !(table in tables)) throw new Error('Unexpected synthetic backend request: '+url.pathname);
  let rows=tables[table];
  if(table==='user_roles'&&url.searchParams.get('role')==='eq.admin'&&role!=='admin')rows=[];
  const offset=Number(url.searchParams.get('offset') ?? 0),limit=Number(url.searchParams.get('limit') ?? 1000);
  rows=rows.slice(offset,offset+limit);
  return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?(rows[0] ?? null):rows,headers});
 });
}
for(const role of ['member','manager','admin'] as const){
 test(role+' can load the current PWA and navigate inventory',async({context,page})=>{
  await setup(context,role);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/app');
  await expect(page.getByText('Synthetic Facility').first()).toBeVisible();
  await page.goto('/app?tab=inventory');
  await expect(page.getByText('Waste Inventory & Records').first()).toBeAttached();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({path:test.info().outputPath(role+'-inventory.png'),fullPage:true});
 });
}
test('shortcut survives the authentication redirect and opens the entry form',async({page})=>{
 await page.goto('/app?action=new');
 await expect(page).toHaveURL(/\/auth\?action=new/);
});
test('installed app can reopen offline after loading a facility',async({context,page})=>{
 await setup(context,'member');await page.goto('/app');
 await expect(page.getByText('Synthetic Facility').first()).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();
 await expect(page.getByText('Synthetic Facility').first()).toBeVisible();
 await expect(page.getByText(/Offline Mode/)).toBeVisible();
 await context.setOffline(false);
});
