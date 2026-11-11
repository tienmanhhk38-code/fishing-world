import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--use-angle=d3d11','--use-gl=angle','--disable-software-rasterizer']});
let page;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
 await context.addInitScript(()=>localStorage.setItem('fishing-player-settings',JSON.stringify({version:1,state:{soundMuted:true,fps:60,quality:'high'}})));
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,700));});
 await page.goto((process.env.SMOKE_URL??'http://127.0.0.1:5173')+'/?diagnostics=1');await page.getByRole('button',{name:'Chọn phòng',exact:true}).click();await page.getByRole('button',{name:'Tạo phòng mới',exact:true}).click();await page.getByRole('button',{name:'Thả câu'}).waitFor();
 await page.locator('.asset-loading-screen').waitFor({state:'hidden',timeout:60000});await page.locator('.nameplate').first().waitFor();await page.waitForTimeout(1500);await page.screenshot({path:'.local/experience-v4/dock.png'});
 await page.mouse.click(800,650);await page.keyboard.press('Space');await page.waitForTimeout(240);
 const jump=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer()?.server);
 await page.waitForTimeout(700);await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyD');await page.waitForTimeout(550);await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');await page.waitForTimeout(300);
 const moved=await page.evaluate(()=>window.__fishingDiagnostics.localPlayer()?.server);
 await page.screenshot({path:'.local/experience-v4/moved.png'});
 let success=false;
 for(let attempt=0;attempt<5&&!success;attempt++){
  await page.getByRole('button',{name:'Thả câu'}).click();await page.waitForTimeout(1000);
  await page.screenshot({path:'.local/experience-v4/waiting.png'});
  await page.evaluate(()=>new Promise(resolve=>{const observer=new MutationObserver(()=>{if(document.querySelector('.hint b')?.textContent!=='Cá cắn! Giật cần ngay!')return;observer.disconnect();document.querySelector('.cast').click();resolve();});observer.observe(document.querySelector('.hint'),{childList:true,subtree:true,characterData:true});}));
  await page.waitForTimeout(250);await page.screenshot({path:'.local/experience-v4/reeling.png'});
  await page.waitForFunction(()=>document.querySelector('.result')||document.querySelector('.hint small')?.textContent?.includes('tuột mất'),{},{timeout:18000});
  success=await page.getByRole('button',{name:'Khoe cá',exact:true}).isVisible();if(!success)await page.waitForTimeout(1000);
 }
 if(!success)throw Error('No successful catch in five attempts');
 await page.screenshot({path:'.local/experience-v4/result.png'});
 await page.getByRole('button',{name:'Khoe cá',exact:true}).click();await page.getByText(/Tôi câu được/).waitFor();await page.waitForTimeout(600);await page.screenshot({path:'.local/experience-v4/showcase.png'});
 await page.getByRole('button',{name:'Cất cá'}).click();await page.getByRole('button',{name:'Nhiệm vụ',exact:false}).click();await page.screenshot({path:'.local/experience-v4/quests.png'});
 const row=page.locator('.quest-list article').filter({hasText:'Di chuyển và nhảy một lần'});await row.getByRole('button',{name:'Nhận',exact:true}).click();await page.waitForTimeout(500);await page.getByRole('button',{name:'Đóng nhiệm vụ'}).click();
 await page.getByRole('button',{name:'Bản đồ',exact:true}).click();await page.screenshot({path:'.local/experience-v4/map.png'});await page.getByRole('button',{name:'Đóng bản đồ'}).click();
 await page.getByRole('button',{name:'Cài đặt game',exact:true}).click();await page.getByRole('button',{name:'Về lobby',exact:true}).click();await page.getByRole('button',{name:'Chơi khách',exact:true}).waitFor();
 await writeFile('.local/experience-v4/smoke.json',JSON.stringify({errors,jump,moved},null,2));console.log(JSON.stringify({errors,jumpY:jump.y,grounded:jump.grounded,movedX:moved.x}));
}catch(e){console.log('FAIL',e.message,errors);if(page){console.log((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'.local/experience-v4/failure.png'});}throw e;}
finally{await browser.close();}
