import {expireDeliveryDetails} from '../src/retention';
import {validateWeeklyRoute,type WeeklyRoute} from '../src/weekly-routes';
﻿import {test,expect,type Page} from '@playwright/test';
import {seed} from '../tests/fixtures/seed';
import {applyCommand} from '../src/commands';
async function signInFixture(page:Page,role:'ADMIN'|'MANAGER'|'DRIVER', active=false,draft=false,weekly=false,cis=false,expired=false,closing=false){
 const stats={pulls:0,identities:0,operations:0};
 const weeklyRoutes:WeeklyRoute[]=[];
 const state=seed(),user=state.users.find(u=>u.role===role)!;
 if(role==='DRIVER'){
  const job=state.jobs.find(j=>j.remaining>0)!;const trip={...state.trips[0],id:'mobile-current-trip',name:'Phone delivery route',date:job.date,primaryDriverId:user.id,companionId:null,status:active?'Active' as const:'Released' as const,opening:active?25000:null,closing:null,openingPhoto:null,closingPhoto:null,startedAt:null,endedAt:null,loaded:false,handoverConfirmed:false,approvedOdometer:false,stops:[{id:'phone-stop',kind:'Delivery' as const,customerId:job.customerId,jobId:job.id,completed:false}]};job.tripId=trip.id;job.shopId='SHOP_S';job.status='Assigned';state.trips.push(trip);
 }
 if(draft){const trip=structuredClone(state.trips[0]);trip.id='manager-draft';trip.name='Manager draft route';trip.startShopId=user.shopIds[0];trip.status='Draft';trip.opening=null;trip.closing=null;trip.startedAt=null;trip.endedAt=null;state.trips.push(trip);}
 if(weekly){const route:WeeklyRoute={id:'planner-weekly',name:'Weekly road',from:'A',to:'B',shopIds:['SHOP_A'],days:[0,1,2,3,4,5,6],stops:[{id:'first',name:'First road'},{id:'later',name:'Later road'}],active:true,revision:1};weeklyRoutes.push(route);state.jobs.filter(j=>j.shopId==='SHOP_A'&&j.status==='Ready'&&!j.tripId).slice(0,2).forEach((j,index)=>{j.routeId=route.id;j.routeName=route.name;j.routeStopId=index===0?'later':'first';j.routeStopName=index===0?'Later road':'First road';});}
 if(expired)expireDeliveryDetails(state,new Set([state.trips[0].id]),'2026-10-08T00:00:00Z');
 if(closing){const t={...structuredClone(state.trips[0]),id:'manager-end',name:'Shift needing review',status:'End submitted' as const,startShopId:'SHOP_A',endShopId:'SHOP_S',openingAdvance:0,handoverConfirmed:false,approvedOdometer:false,cashReceived:0,stops:[]};state.trips.push(t);const f=state.fuels[0];state.fuels.push({...f,id:'earlier-diesel',tripId:t.id,at:'2026-10-24T05:00:00Z',status:'Submitted',reimbursement:'Pending',source:'Personal',pump:'Earlier diesel claim'},{...f,id:'latest-diesel',tripId:t.id,at:'2026-10-24T06:00:00Z',status:'Submitted',reimbursement:'Pending',source:'Personal',pump:'Latest diesel claim'});}
 const projectId=cis?'cisapp-236ab':'delivery-28165';
 const identity={uid:user.id,actorId:user.id,issuer:projectId,role,shopIds:user.shopIds,name:user.name};
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const idToken=encode({alg:'RS256',typ:'JWT'})+'.'+encode({sub:user.id,user_id:user.id,aud:projectId,iss:'https://securetoken.google.com/'+projectId,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,auth_time:Math.floor(Date.now()/1000),email:'fixture@example.invalid',firebase:{sign_in_provider:'password'}})+'.test-only';
 // Every Auth/backend request is intercepted: fictional UI data never reaches Firebase.
 let rejectedFirst=false;
 await page.route('https://identitytoolkit.googleapis.com/**',route=>{if(cis&&!rejectedFirst&&route.request().url().includes('accounts:signInWithPassword')){rejectedFirst=true;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{code:400,message:'INVALID_LOGIN_CREDENTIALS'}})});}return route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('accounts:lookup')?{users:[{localId:user.id,email:'fixture@example.invalid',displayName:user.name}]}:{localId:user.id,email:'fixture@example.invalid',displayName:user.name,idToken,refreshToken:'test-only-refresh',expiresIn:'3600'})});});
 await page.route('https://securetoken.googleapis.com/**',route=>route.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"TEST_ONLY"}}'}));
 await page.route('https://asia-south1-cisapp-236ab.cloudfunctions.net/**',async route=>{const body=route.request().postDataJSON();if(body.action==='pull')stats.pulls++;if(body.action==='identity')stats.identities++;if(body.action==='operation')stats.operations++;let result:unknown=identity;if(body.action==='operation'){applyCommand(state,user,body.payload.command,()=>true);const c=body.payload.command;const tripId=c.type==='reviewFuel'?state.fuels.find(f=>f.id===c.id)?.tripId:c.id;result={id:body.payload.id,status:'Acknowledged',...(['reviewFuel','handover','closeTrip'].includes(c.type)?{reviewed:{trip:state.trips.find(t=>t.id===tripId),fuels:state.fuels.filter(f=>f.tripId===tripId),audit:[]}}:{})};}if(body.action==='pull')result={operational:state};if(body.action==='routeCatalog')result={routes:weeklyRoutes};if(body.action==='saveWeeklyRoute'){const value=validateWeeklyRoute(body.payload.value);const old=weeklyRoutes.find(r=>r.id===value.id);if(old)weeklyRoutes.splice(weeklyRoutes.indexOf(old),1);const saved={...value,revision:value.revision+1};weeklyRoutes.push(saved);result=saved;}if(body.action==='administration')result={shops:state.shops,vehicles:state.vehicles,users:[],roles:[{id:'ADMIN',name:'Administrator',baseRole:'ADMIN',permissions:[],active:true,protected:true}],settings:state.settings};await route.fulfill({contentType:'application/json',body:JSON.stringify({result})});});
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('Password',{exact:true}).fill('UI-test-only-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeAttached();
 return stats;
}
for(const role of ['ADMIN','MANAGER','DRIVER'] as const){
 test(`${role} phone navigation and operational layout`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await signInFixture(page,role);await page.screenshot({path:`test-results/clean-overview-${role.toLowerCase()}.png`});
  const tiles=page.locator('.action-tiles .action-tile');expect(await tiles.count()).toBeGreaterThan(0);
  for(const tile of await tiles.all()){const box=await tile.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(100);expect(await tile.locator('strong').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}

  const nav=page.getByRole('navigation',{name:'Mobile navigation'});await expect(nav).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await nav.getByRole('button',{name:'More navigation'}).click();
  if(role==='DRIVER'){await expect(page.getByRole('link',{name:'Configuration',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Trips & shifts',exact:true}).click();await page.getByRole('link').filter({hasText:'Phone delivery route'}).click();}
  else{await page.getByRole('link',{name:'Customers & references',exact:true}).click();await expect(page.locator('.responsive-table tbody tr').first()).toBeVisible();await expect(page.locator('.responsive-table tbody td').first()).toHaveAttribute('data-label','Customer');}
  await page.screenshot({path:`test-results/mobile-${role.toLowerCase()}.png`});
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${role} overflow at ${width}px`).toBe(true);}
  await page.setViewportSize({width:1280,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/cis-theme-desktop-${role.toLowerCase()}.png`});
  await expect(nav).toBeVisible();const shell=await page.locator('.app-shell').boundingBox();expect(shell!.width).toBe(460);expect(Math.abs(shell!.x-(1280-460)/2)).toBeLessThan(2);
  await nav.getByRole('link',{name:'Home',exact:true}).click();await page.screenshot({path:`test-results/portal-desktop-${role.toLowerCase()}.png`});
  const desktopTiles=await page.locator('.action-tile').all();const first=await desktopTiles[0].boundingBox();const second=await desktopTiles[1].boundingBox();expect(Math.abs(first!.y-second!.y)).toBeLessThan(2);
  await nav.getByRole('button',{name:'More navigation'}).click();await expect(page.getByRole('button',{name:'Close navigation'})).toBeVisible();await page.getByRole('button',{name:'Close navigation'}).click();

 });
}
test('Admin phone settings opens a usable vehicle form',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'ADMIN');await page.getByRole('button',{name:'More navigation'}).click();await page.getByRole('link',{name:'Configuration',exact:true}).click();await page.getByRole('button',{name:'Vehicles',exact:true}).click();await page.getByRole('button',{name:'Add vehicle',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Registration number')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await dialog.getByRole('button',{name:'Save',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeVisible();await page.screenshot({path:'test-results/mobile-vehicle-form.png'});});

test('Driver confirms cross-shop packages loaded and retains the result after reload',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'DRIVER',true);await page.goto('/trips/mobile-current-trip');await page.getByRole('button',{name:'Confirm packages loaded',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Confirm packages loaded',exact:true});await dialog.getByRole('button',{name:'Confirm',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Confirm packages loaded',exact:true})).toHaveCount(0);await expect(page.getByText('Out for delivery',{exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Phone delivery route',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Confirm packages loaded',exact:true})).toHaveCount(0);await expect(page.getByText('Out for delivery',{exact:true}).first()).toBeVisible();});
test('Admin vehicle tile opens vehicle settings directly',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'ADMIN');await page.getByRole('link',{name:'Vehicles',exact:true}).click();await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Add vehicle',exact:true})).toBeVisible();});
test('Collection amount stays exactly 100 through scrolling, submission and reload',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'DRIVER',true);await page.goto('/trips/mobile-current-trip');await page.getByRole('button',{name:'Record collection',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Record customer collection'});const amount=dialog.getByRole('spinbutton',{name:/Amount received/});await amount.fill('100');await amount.focus();await amount.hover();await page.mouse.wheel(0,150);await expect(amount).toHaveValue('100');await amount.fill('');await expect(amount).toHaveValue('');await amount.pressSequentially('100');await expect(amount).toHaveValue('100');const submitted=page.waitForRequest(r=>{if(!r.url().includes('cloudfunctions.net')||r.method()!=='POST')return false;try{return r.postDataJSON()?.payload?.command?.type==='submitCollection';}catch{return false;}});await dialog.getByRole('button',{name:'Submit for manager review',exact:true}).click();expect((await submitted).postDataJSON().payload.command.value.amount).toBe(10000);await expect(dialog).not.toBeVisible();await page.goto('/collections');await expect(page.getByText('₹100.00',{exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByText('₹100.00',{exact:true}).first()).toBeVisible();});
test('Numeric settings can be cleared and retyped without a sticky zero',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'ADMIN');await page.getByRole('link',{name:'Vehicles',exact:true}).click();await page.getByRole('button',{name:'Add vehicle',exact:true}).click();const reading=page.getByRole('dialog').getByRole('spinbutton',{name:'Odometer baseline',exact:true});await expect(reading).toHaveValue('0');await reading.fill('');await expect(reading).toHaveValue('');await reading.pressSequentially('100');await expect(reading).toHaveValue('100');await reading.focus();await reading.hover();await page.mouse.wheel(0,200);await expect(reading).toHaveValue('100');});


test('Manager releases a draft from trip details and release persists after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'MANAGER',false,true);
 await page.goto('/trips/manager-draft');await page.getByRole('button',{name:'Release route',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Approve and release route'});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Confirm',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page.getByText('Released',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Release route',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByText('Released',{exact:true}).first()).toBeVisible();
});


test('Admin creates an ordered weekly route, remaps days and retains it after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'ADMIN');await page.goto('/settings?tab=Routes');
 await page.getByRole('button',{name:'Add route',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Create weekly route'});
 await dialog.getByLabel('Route name',{exact:true}).fill('Route 1');await dialog.getByLabel('Starting point',{exact:true}).fill('A road');await dialog.getByLabel('Destination',{exact:true}).fill('B road');
 await dialog.getByLabel('Monday',{exact:true}).check();await dialog.getByLabel('Wednesday',{exact:true}).check();
 await dialog.getByRole('button',{name:'Add stop',exact:true}).click();await dialog.getByLabel('Stop 1',{exact:true}).fill('First pharmacy road');
 await dialog.getByRole('button',{name:'Add stop',exact:true}).click();await dialog.getByLabel('Stop 2',{exact:true}).fill('Second pharmacy road');
 await dialog.getByRole('button',{name:'Move stop 2 up',exact:true}).click();await expect(dialog.getByLabel('Stop 1',{exact:true})).toHaveValue('Second pharmacy road');
 await dialog.getByRole('button',{name:'Save weekly route',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.route-card').getByText('Monday, Wednesday',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit route & days',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit weekly route'});await dialog.getByLabel('Monday',{exact:true}).uncheck();await dialog.getByLabel('Tuesday',{exact:true}).check();await dialog.getByRole('button',{name:'Save weekly route',exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.reload();await expect(page.locator('.route-card').getByText('Tuesday, Wednesday',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('Manager builds a trip from matching weekly route deliveries in stop order',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'MANAGER',false,false,true);await page.goto('/routes');await page.getByRole('button',{name:'Plan route',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Weekly route',{exact:true}).selectOption('planner-weekly');await dialog.getByRole('button',{name:'Add matching deliveries in stop order',exact:true}).click();
 const submitted=page.waitForRequest(r=>{try{return r.url().includes('cloudfunctions.net')&&r.method()==='POST'&&r.postDataJSON()?.payload?.command?.type==='saveTrip';}catch{return false;}});
 await dialog.getByRole('button',{name:'Save route draft',exact:true}).click();const value=(await submitted).postDataJSON().payload.command.value;expect(value.routeTemplateId).toBe('planner-weekly');expect(value.stops).toHaveLength(2);expect(value.stops.map((st:{jobId:string})=>st.jobId)).toEqual(seed().jobs.filter(j=>j.shopId==='SHOP_A'&&j.status==='Ready'&&!j.tripId).slice(0,2).reverse().map(j=>j.id));
 await expect(dialog).not.toBeVisible();await expect(page.locator('.route-card').getByRole('heading',{name:'Weekly road'})).toBeVisible();
});


test('CISapp credentials automatically choose the correct issuer and persist the verified session',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'MANAGER',false,false,false,true);
 expect(await page.evaluate(()=>sessionStorage.getItem('dispatch:issuer'))).toBe('cisapp-236ab');
 await page.reload();await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toHaveCount(0);
});


test('Sync downloads once at login, not on timers/reconnect, and supports pull down and reload',async({page})=>{
 await page.clock.install();await page.setViewportSize({width:390,height:844});const stats=await signInFixture(page,'MANAGER');expect(stats.pulls).toBe(1);
 const identities=stats.identities;await page.clock.fastForward(61000);await expect.poll(()=>stats.identities).toBeGreaterThan(identities);expect(stats.pulls).toBe(1);
 const afterTimer=stats.identities;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>stats.identities).toBeGreaterThan(afterTimer);expect(stats.pulls).toBe(1);
 async function gesture(startOnly=false){await page.evaluate(({startOnly})=>{const target=document.querySelector('main h1')!;const touch=(y:number)=>new Touch({identifier:1,target,clientX:70,clientY:y});target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(150)]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[touch(260)]}));if(!startOnly)target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));},{startOnly});}
 await page.evaluate(()=>window.scrollTo(0,0));await gesture(true);await expect(page.getByText('Release to synchronise',{exact:true})).toBeVisible();await page.evaluate(()=>document.querySelector('main h1')!.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]})));await expect.poll(()=>stats.pulls).toBe(2);
 await page.evaluate(()=>window.scrollTo(0,500));await gesture();expect(stats.pulls).toBe(2);
 await page.getByRole('link',{name:'Connection',exact:true}).click();await page.getByRole('button',{name:'Synchronise now',exact:true}).click();await expect.poll(()=>stats.pulls).toBe(3);
 await page.reload();await expect(page.getByRole('heading',{name:'Connection & pending work'})).toBeVisible();await expect.poll(()=>stats.pulls).toBe(4);
});


test('CISapp Staff can release a trip starting at their assigned shop',async({page})=>{
 await page.setViewportSize({width:390,height:844});const stats=await signInFixture(page,'MANAGER',false,true,false,true);
 await page.goto('/trips/manager-draft');await expect(page.getByRole('button',{name:'Release route',exact:true})).toBeVisible();const before=stats.pulls;await page.getByRole('button',{name:'Release route',exact:true}).click();await page.getByRole('dialog',{name:'Approve and release route'}).getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByText('Released',{exact:true}).first()).toBeVisible();await expect.poll(()=>stats.operations).toBe(1);await expect(page.locator('.toast')).toContainText('Saved to connected Firebase');expect(stats.pulls).toBe(before);
});


test('Expired delivery details disappear from trip history and cannot expose old images',async({page})=>{await page.setViewportSize({width:390,height:844});await signInFixture(page,'ADMIN',false,false,false,false,true);await page.goto('/trips/historical-demo');await expect(page.locator('.empty')).toContainText('Closed delivery details and images were removed after seven days. Financial and report summaries are retained.');await expect(page.getByRole('button',{name:/Evidence|photo/i})).toHaveCount(0);await page.goto('/deliveries');await page.getByRole('textbox',{name:'Search customer or invoice...'}).fill('DEMO-008');await expect(page.locator('.responsive-table tbody tr')).toHaveCount(0);});

test('Driver diesel bill calculates automatically, pump is optional, and no advance means personal funds',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'DRIVER',true);await page.goto('/trips/mobile-current-trip');
 await page.getByRole('button',{name:'Record diesel',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Record diesel purchase'});
 await dialog.getByLabel('Litres purchased',{exact:true}).fill('20');await dialog.getByLabel(/Price per litre/).fill('100');
 await expect(dialog.getByLabel(/Total bill/)).toHaveValue('2000.00');await expect(dialog.getByLabel(/Total bill/)).toHaveAttribute('readonly','');
 await expect(dialog.getByLabel('Payment source',{exact:true})).toHaveValue('Personal');await expect(dialog.getByLabel('Pump name (optional)',{exact:true})).not.toHaveAttribute('required');
 await expect(dialog.getByText('Take photo',{exact:true})).toBeVisible();await expect(dialog.getByText('Upload photo',{exact:true})).toBeVisible();await expect(dialog.locator('input[type=file][capture]')).toHaveAttribute('capture','environment');await expect(dialog.locator('input[type=file]:not([capture])')).toHaveCount(1);
 await dialog.locator('input[type=file][capture]').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV5kAAAAASUVORK5CYII=','base64')});
 await expect(dialog.getByText('Saved locally',{exact:true})).toBeVisible();
 const request=page.waitForRequest(r=>{try{return r.url().includes('cloudfunctions.net')&&r.method()==='POST'&&r.postDataJSON()?.payload?.command?.type==='submitFuel';}catch{return false;}});
 await dialog.getByRole('button',{name:'Submit fuel claim',exact:true}).click();const value=(await request).postDataJSON().payload.command.value;expect(value.amount).toBe(200000);expect(value.source).toBe('Personal');expect(value.pump).toBe('');await expect(dialog).not.toBeVisible();
 await page.getByRole('button',{name:'Submit shift end',exact:true}).click();await expect(page.getByRole('checkbox',{name:/returned|undelivered/i})).toHaveCount(0);
 const endDialog=page.getByRole('dialog');await expect(endDialog.locator('input[type=file][capture]')).toHaveAttribute('capture','environment');await expect(endDialog.getByText('Take photo',{exact:true})).toBeVisible();await expect(endDialog.getByText('Upload photo',{exact:true})).toBeVisible();await endDialog.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Confirm packages loaded',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('button',{name:'Record outcome',exact:true}).click();const proof=page.getByRole('dialog',{name:'Record delivery outcome'});await expect(proof.locator('input[type=file][capture]')).toHaveAttribute('capture','environment');await expect(proof.getByText('Take photo',{exact:true})).toBeVisible();await expect(proof.getByText('Upload photo',{exact:true})).toBeVisible();await expect(proof.getByRole('button',{name:'Capture signature',exact:true})).toBeVisible();
});
test('Manager closes a trip through scoped cash, latest diesel reviews, and green completed steps',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signInFixture(page,'MANAGER',false,false,false,false,false,true);await page.goto('/trips/manager-end');
 await expect(page.getByRole('button',{name:'Verify & close shift',exact:true})).toBeDisabled();await page.getByRole('link',{name:'Check cash',exact:true}).click();
 await expect(page.locator('.card-grid > .panel')).toHaveCount(1);await expect(page.getByText('Fictional Demo Pump',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Record physical handover',exact:true}).click();await page.getByRole('button',{name:'Confirm handover',exact:true}).click();
 await expect(page).toHaveURL(/trips\/manager-end$/);await expect(page.locator('[aria-label="Cash completed"]')).toBeVisible();
 await page.getByRole('link',{name:'Check diesel',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Fuel claim review'});await expect(dialog.getByRole('heading',{name:'Latest diesel claim',exact:true})).toBeVisible();
 await dialog.getByLabel('Decision',{exact:true}).selectOption('Approve & reimburse');await dialog.getByRole('button',{name:'Confirm fuel decision',exact:true}).click();
 await expect(page).toHaveURL(/trips\/manager-end$/);await expect(page.locator('[aria-label="Diesel completed"]')).toHaveCount(0);
 await page.getByRole('link',{name:'Check diesel',exact:true}).click();dialog=page.getByRole('dialog',{name:'Fuel claim review'});await expect(dialog.getByRole('heading',{name:'Earlier diesel claim',exact:true})).toBeVisible();
 await dialog.getByLabel('Decision',{exact:true}).selectOption('Approve & reimburse');await dialog.getByRole('button',{name:'Confirm fuel decision',exact:true}).click();
 await expect(page).toHaveURL(/trips\/manager-end$/);await expect(page.locator('[aria-label="Diesel completed"]')).toBeVisible();await page.screenshot({path:'test-results/guided-shift-close-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Verify & close shift',exact:true}).click();dialog=page.getByRole('dialog',{name:'Verify odometer & close shift'});await dialog.getByRole('textbox').fill('Odometer photos reviewed');await dialog.getByRole('button',{name:'Confirm reviewed action',exact:true}).click();
 await expect(page.getByText('Closed',{exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByText('Closed',{exact:true}).first()).toBeVisible();
 await page.goto('/cash');await expect(page.locator('.card-grid > .panel')).toHaveCount(0);await page.getByRole('checkbox',{name:'Show confirmed handovers',exact:true}).check();await expect(page.getByRole('heading',{name:'Shift needing review',exact:true})).toBeVisible();
 await page.goto('/fuel');await expect(page.locator('.responsive-table tbody tr')).toHaveCount(0);
});
