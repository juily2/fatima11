import { test, expect } from '@playwright/test';

test('desktop starts, moves, pauses and restores a real save', async ({page}) => {
  const errors: string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('button',{name:'启程探索'})).toBeVisible();
  await expect(page.locator('canvas#world')).toBeVisible();
  await page.screenshot({path:'test-results/landing.png'});
  await page.getByRole('button',{name:'启程探索'}).click();
  await expect(page.locator('#objective')).toBeVisible();
  await page.getByRole('button',{name:'关闭声音',exact:true}).click();
  await page.keyboard.down('w');
  await expect.poll(async()=> (await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).position))[1],{timeout:20000}).toBeLessThan(124);
  await page.keyboard.up('w');
  await page.waitForTimeout(1400);
  const before = await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).position);
  expect(before[1]).toBeLessThan(128);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'歇一会儿'})).toBeVisible();
  await page.keyboard.down('w'); await page.waitForTimeout(600); await page.keyboard.up('w');
  const after = await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).position);
  expect(after).toEqual(before);
  await page.getByRole('button',{name:'继续探索'}).click();
  await page.screenshot({path:'test-results/exploring.png'});
  await page.reload();
  await expect(page.getByRole('button',{name:'继续旅程'})).toBeVisible();
  await page.getByRole('button',{name:'继续旅程'}).click();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).position);
  expect(restored).toEqual(before);
  expect(errors).toEqual([]);
});

test('saved progress gates activation and the final ruin completes the journey',async({page})=>{
  await page.goto('./');
  await page.evaluate(()=>localStorage.setItem('wind-island-v1',JSON.stringify({version:1,collected:['tide','grove','summit'].flatMap(r=>[0,1,2,3].map(i=>`${r}-${i}`)),active:['tide','grove'],position:[65,-42],sound:false,quality:'low'})));
  await page.reload(); await page.getByRole('button',{name:'继续旅程'}).click();
  await expect(page.getByRole('button',{name:'唤醒日光遗迹'})).toBeVisible();
  await page.getByRole('button',{name:'唤醒日光遗迹'}).click();
  await expect(page.getByRole('heading',{name:'风，记住了你的旅程。'})).toBeVisible();
  await page.getByRole('button',{name:'留在岛上'}).click();
  await page.getByRole('button',{name:'暂停游戏'}).click();
  await page.getByRole('button',{name:'重新开始'}).click();
  await expect(page.getByRole('heading',{name:'开启新的旅程？'})).toBeVisible();
  await page.getByRole('button',{name:'取消'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).active.length)).toBe(3);
  await page.getByRole('button',{name:'重新开始'}).click();
  await page.getByRole('button',{name:'确认重新开始'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).collected)).toEqual([]);
});

test('mobile touch movement, portrait and landscape controls work', async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage(); await page.goto(process.env.PLAY_URL || 'http://127.0.0.1:4173/wind-island/');
  await page.getByRole('button',{name:'启程探索'}).tap();
  await expect(page.locator('#joystick')).toBeVisible();
  const box=(await page.locator('#joystick').boundingBox())!;
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2,y:box.y+12}]});
  await page.waitForTimeout(1300);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(1200);
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('wind-island-v1')!).position))[1]).toBeLessThan(128);
  await page.screenshot({path:'test-results/mobile-portrait.png'});
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('button',{name:'跳跃'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'暂停游戏'}).tap();
  await page.getByLabel('画质').selectOption('low');
  await page.getByRole('button',{name:'继续探索'}).tap();
  await page.screenshot({path:'test-results/mobile-landscape.png'});
  await context.close();
});

test('WebGL failure explains the recovery instead of leaving a blank game',async({page})=>{
  await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(this: HTMLCanvasElement, type: any,...args:any[]):any {if(String(type).startsWith('webgl'))return null;return (old as any).apply(this,[type,...args]);} as any;});
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'暂时无法打开这座岛'})).toBeVisible();
  await expect(page.getByRole('button',{name:'重新加载'})).toBeVisible();
});
