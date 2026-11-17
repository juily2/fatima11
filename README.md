# 风屿 · Wind Island

一个关于海风、遗迹与微小发现的单人 3D 海岛探索小游戏。打开浏览器，踏上一座低多边形小岛；电脑和手机均可游玩。

## 玩法

自由探索海滩、森林和日光山丘，找到 12 枚风之水晶。每处遗迹对应 4 枚水晶，收齐后靠近遗迹并唤醒它。三处遗迹全部唤醒即可完成旅程，也可以留下继续漫游。

- 电脑：WASD / 方向键移动，拖动鼠标环顾，空格跳跃，Shift 奔跑，E 互动，Esc 暂停；滚轮调整镜头距离。
- 手机：左侧摇杆移动，右侧滑动环顾；跳跃按钮与奔跑开关支持同时操作。
- 小地图显示你、水晶和遗迹的位置，进度面板显示各区域收集情况。
- 进度自动保存在当前浏览器的 localStorage 中，不跨设备同步。暂停菜单可更改画质、声音或确认重新开始。
- 离开窗口或切换应用时自动暂停；图形或存储不可用时给出提示。

## 本地运行

需要 Node.js 22.12+ 或 24+。

```sh
npm ci
npm run dev
```

打开终端显示的 `/wind-island/` 地址。

```sh
npm test             # 收集、遗迹、存档恢复、地形与碰撞规则
npm run typecheck
npm run build
npm run preview
```

浏览器集成测试使用 Playwright 和 `/usr/bin/chromium`：

```sh
npm run test:browser
```

其他系统请在 `playwright.config.ts` 中修改浏览器路径为本机 Chromium 路径。测试覆盖桌面移动/暂停/恢复、完成/重置、手机触摸/横竖屏、WebGL 错误提示。

## GitHub Pages 发布

仓库名使用 `wind-island`，Vite 的 `base` 已设为 `/wind-island/`。

1. 将源码推送至公开仓库的 `main` 分支。
2. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. `.github/workflows/pages.yml` 会在类型检查、测试和构建通过后部署。
4. 以 Actions 返回的成功部署网址为准；默认形式为 `https://<用户名>.github.io/wind-island/`。

更新 `main` 会自动重新发布。如果更换仓库名，请同时修改 `vite.config.ts` 的 base 路径。

## 实现

TypeScript + Vite + Three.js。岛屿、植被、遗迹、角色、水面、环境音和音效均由代码生成，无需远程素材、账号、API Key 或后端。地形碰撞与可视网格使用相同的三角面高度。植被使用实例化渲染，移动端默认关闭实时阴影，自动画质可在持续低帧率时降级。

这是有限地图上的自由探索小游戏，不包含联机、战斗、建造或无限世界。
