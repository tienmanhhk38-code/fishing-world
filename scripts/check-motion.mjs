import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--use-angle=d3d11','--use-gl=angle','--disable-software-rasterizer']});
const results=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.addInitScript(()=>localStorage.setItem('fishing-player-settings',JSON.stringify({version:1,state:{quality:'low',fps:60,soundMuted:true}})));
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173/?diagnostics=1');await page.getByRole('button',{name:'Chọn phòng',exact:true}).click();await page.getByRole('button',{name:'Tạo phòng mới'}).click();await page.getByRole('button',{name:'Thả câu'}).waitFor();await page.locator('.asset-loading-screen').waitFor({state:'hidden',timeout:60000});await page.locator('.nameplate').first().waitFor();await page.waitForTimeout(1200);await page.evaluate(()=>window.__fishingDiagnostics.setCamera(0));
 for(const fps of [60,30]){
  if(fps===30){await page.getByRole('button',{name:'Cài đặt game',exact:true}).click();await page.getByRole('dialog').getByLabel('Giới hạn khung hình').selectOption('30');await page.getByRole('button',{name:'Đóng cài đặt'}).click()}
  await page.mouse.click(700,500);await page.waitForTimeout(400);
  await page.evaluate(()=>{window._samples=[];window._record=true;let last=0;const tick=()=>{if(!window._record)return;const d=window.__fishingDiagnostics,at=d.samples.at(-1)?.at;if(at&&at!==last){last=at;const p=d.localPlayer();if(p)window._samples.push({at,x:p.rendered.x,y:p.rendered.y,serverX:p.server.x,camera:d.info.camera})}requestAnimationFrame(tick)};requestAnimationFrame(tick)});
  const from=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server.x);
  const key=fps===60?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(1000);await page.keyboard.up(key);await page.waitForTimeout(300);
  const samples=await page.evaluate(()=>{window._record=false;return window._samples});
  const to=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server.x),delta=Math.abs(to-from);
  const active=samples.filter((s,i)=>i>5&&i<samples.length-12),direction=fps===60?1:-1;
  const steps=active.slice(1).map((s,i)=>({dt:s.at-active[i].at,dx:direction*(s.x-active[i].x),cameraDx:direction*(s.camera[0]-active[i].camera[0])}));
  await writeFile('.local/experience-v4/motion-debug.json',JSON.stringify({fps,from,to,samples,body:await page.locator('body').innerText(),active:await page.evaluate(()=>document.activeElement?.outerHTML)},null,2));
  assert(delta>3.7&&delta<5.1,`walk ${fps}: ${delta}`);assert(steps.every(s=>s.dx>-.1),'backward correction');
  results.push({fps,walkDistance1s:delta,frames:samples.length,maxBackwardStep:Math.min(...steps.map(s=>s.dx)),maxStep:Math.max(...steps.map(s=>s.dx)),maxCameraBackward:Math.min(...steps.map(s=>s.cameraDx)),maxReconciliationError:Math.max(...samples.map(s=>Math.abs(s.x-s.serverX)))});
 }
 const base=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server.y);
 await page.keyboard.press('Space');await page.waitForTimeout(250);const apex=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server);assert(!apex.grounded&&apex.y-base>.85&&apex.y-base<1.1);
 await page.waitForTimeout(600);const from=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server.x);await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyD');await page.waitForTimeout(700);await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');await page.waitForTimeout(200);const to=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer().server.x);assert(to-from>4.1&&to-from<5.8);
 await writeFile('.local/experience-v4/motion.json',JSON.stringify({at:new Date().toISOString(),scope:'Desktop Chromium hardware, local connection, straight dock movement; diagnostic render and authoritative snapshots',results,jumpHeight:apex.y-base,sprintDistance700ms:to-from},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
